import { NextRequest, NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { preflightResponse, withCors } from '@/lib/http/cors';
import { log, getCorrelationId } from '@/lib/logging';
import {
  createPendingVerification,
  deletePendingVerification,
  getPendingByEmail,
  getPendingByRid,
  purgeExpiredPending,
} from '@/lib/data/pending';

const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const PENDING_ACCESS_TOKEN = process.env.PENDING_ACCESS_TOKEN || '';
const PENDING_ALLOWED_ORIGIN =
  process.env.PENDING_ALLOWED_ORIGIN ||
  process.env.ALLOWED_ORIGIN ||
  process.env.DASHBOARD_BASE_URL ||
  '*';

const postSchema = z.object({
  rid: z.string().optional(),
  email: z.string().email().optional(),
  verifyUrl: z.string().url().optional(),
  qrUrl: z.string().url().optional(),
  visitId: z.string().uuid().optional(),
  key: z.string().optional(),
});

function isAuthorized(req: NextRequest) {
  const pendingToken = req.headers.get('x-pending-token');
  if (PENDING_ACCESS_TOKEN && pendingToken === PENDING_ACCESS_TOKEN) {
    return true;
  }

  const adminToken = req.headers.get('x-admin-secret');
  if (ADMIN_SECRET && adminToken === ADMIN_SECRET) {
    return true;
  }

  return false;
}

function cors(options?: Parameters<typeof preflightResponse>[0]) {
  return {
    methods: 'GET,POST,DELETE,OPTIONS',
    headers: 'Content-Type, x-pending-token, x-admin-secret',
    origin: PENDING_ALLOWED_ORIGIN,
    ...options,
  } as const;
}

export function OPTIONS() {
  return preflightResponse(cors());
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    log.warn('auth_failed', { route: 'pending', method: req.method, correlationId: getCorrelationId(req), actor: 'system' });
    return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), cors());
  }

  try {
    await purgeExpiredPending();

    const rid = req.nextUrl.searchParams.get('rid')?.trim();
    const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase();

    if (rid) {
      const record = await getPendingByRid(rid);
      if (!record || !record.verify_url) {
        return withCors(NextResponse.json({ error: 'not found' }, { status: 404 }), cors());
      }
      log.info('pending_lookup_rid', { rid, email: record.email, visitId: record.visit_id, correlationId: getCorrelationId(req) });
      return withCors(NextResponse.json(record), cors());
    }

    if (email) {
      const record = await getPendingByEmail(email);
      if (!record || !record.verify_url) {
        return withCors(NextResponse.json({ error: 'not found' }, { status: 404 }), cors());
      }
      log.info('pending_lookup_email', { email, visitId: record.visit_id, correlationId: getCorrelationId(req) });
      return withCors(NextResponse.json(record), cors());
    }

    return withCors(
      NextResponse.json({ error: 'Provide ?rid=... or ?email=...' }, { status: 400 }),
      cors()
    );
  } catch (err) {
    log.error('pending GET error', err, { route: 'pending', method: req.method, correlationId: getCorrelationId(req) });
    return withCors(
      NextResponse.json({ error: 'Internal server error' }, { status: 500 }),
      cors()
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    log.warn('auth_failed', { route: 'pending', method: req.method, correlationId: getCorrelationId(req), actor: 'system' });
    return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), cors());
  }

  try {
    const body = await req.json();
    const payload = postSchema.parse(body ?? {});

    if (!payload.verifyUrl && !payload.qrUrl) {
      return withCors(
        NextResponse.json({ error: 'verifyUrl or qrUrl is required' }, { status: 400 }),
        cors()
      );
    }

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const record = await createPendingVerification({
      rid: payload.rid,
      email: payload.email,
      verifyUrl: payload.verifyUrl || payload.qrUrl!,
      qrUrl: payload.qrUrl,
      visitId: payload.visitId,
      legacyKey: payload.key,
      expiresAt,
    });
    log.info('pending_created', {
      rid: record.rid,
      email: record.email,
      visitId: record.visit_id,
      expiresAt,
      correlationId: getCorrelationId(req),
    });

    return withCors(NextResponse.json({ ok: true, record }), cors());
  } catch (err) {
    if (err instanceof ZodError) {
      log.warn('validation_error', { route: 'pending', method: req.method, correlationId: getCorrelationId(req), issues: err.flatten?.() });
      return withCors(
        NextResponse.json({ error: 'ValidationError', issues: err.flatten() }, { status: 400 }),
        cors()
      );
    }

    log.error('pending POST error', err, { route: 'pending', method: req.method, correlationId: getCorrelationId(req) });
    const message = err instanceof Error ? err.message : 'Internal server error';
    return withCors(
      NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 }),
      cors()
    );
  }
}

export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req)) {
    log.warn('auth_failed', { route: 'pending', method: req.method, correlationId: getCorrelationId(req), actor: 'system' });
    return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), cors());
  }

  try {
    const rid = req.nextUrl.searchParams.get('rid')?.trim();
    const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase();

    if (!rid && !email) {
      return withCors(
        NextResponse.json({ error: 'Provide rid or email' }, { status: 400 }),
        cors()
      );
    }

    if (rid) {
      await deletePendingVerification(rid);
      log.info('pending_deleted_by_rid', { rid, correlationId: getCorrelationId(req) });
    }

    if (email) {
      const record = await getPendingByEmail(email);
      if (record) {
        await deletePendingVerification(record.id);
        log.info('pending_deleted_by_email', { email, correlationId: getCorrelationId(req) });
      }
    }

    return withCors(NextResponse.json({ ok: true }), cors());
  } catch (err) {
    log.error('pending DELETE error', err, { route: 'pending', method: req.method, correlationId: getCorrelationId(req) });
    return withCors(
      NextResponse.json({ error: 'Internal server error' }, { status: 500 }),
      cors()
    );
  }
}
