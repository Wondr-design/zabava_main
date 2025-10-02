import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { ZodError, z } from 'zod';
import { preflightResponse, withCors } from '@/lib/http/cors';
import { verifyCsrf, generateCsrfToken } from '@/lib/http/csrf';
import { log, getCorrelationId } from '@/lib/logging';
import {
  listPartnerMetas,
  loadPartnerMeta,
  partnerMetaUpdateSchema,
  savePartnerMeta,
  partnerStatusSchema,
  partnerExists,
} from '@/lib/data/partners';
import { getAuthFromRequest } from '@/lib/auth/request';

const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const JWT_SECRET = process.env.JWT_SECRET || '';

const partnerCreateSchema = z.object({
  partnerId: z.string().min(1),
  displayName: z.string().min(1).optional(),
  status: partnerStatusSchema.optional(),
  contactEmail: z.string().email().optional(),
  contactName: z.string().optional(),
});

const CORS_CONFIG = {
  methods: 'GET,POST,PUT,OPTIONS',
  headers: 'Content-Type, Authorization, x-admin-secret',
} as const;

function isAuthorized(req: NextRequest) {
  // Prefer cookie-based admin auth
  const auth = getAuthFromRequest(req);
  if (auth?.role === 'admin') return true;

  // Fallback to x-admin-secret header
  const adminSecret = req.headers.get('x-admin-secret');
  if (ADMIN_SECRET && adminSecret === ADMIN_SECRET) {
    return true;
  }

  // Back-compat: Bearer token header
  if (!JWT_SECRET) {
    return false;
  }
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return false;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (typeof payload === 'object' && payload && 'role' in payload) {
      return (payload as { role?: string }).role === 'admin';
    }
    return false;
  } catch (err) {
    log.warn('admin_partners_auth_failed', { route: 'admin/partners', error: (err as Error)?.message, correlationId: getCorrelationId(req) });
    return false;
  }
}

export function OPTIONS() {
  return preflightResponse(CORS_CONFIG);
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    log.warn('admin_partners_unauthorized', { route: 'admin/partners', method: req.method, correlationId: getCorrelationId(req) });
    return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), CORS_CONFIG);
  }

  try {
    const url = req.nextUrl;
    const partnerId = url.searchParams.get('partnerId');
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');

    if (partnerId) {
      const item = await loadPartnerMeta(partnerId);
      return withCors(NextResponse.json({ item }), CORS_CONFIG);
    }

    const items = await listPartnerMetas({ status, search });
    const response = NextResponse.json({ items });
    response.headers.set('x-csrf-token', generateCsrfToken());
    return withCors(response, CORS_CONFIG);
  } catch (err) {
    log.error('admin_partners_get_error', err, { route: 'admin/partners', correlationId: getCorrelationId(req) });
    return withCors(
      NextResponse.json({ error: 'Internal server error' }, { status: 500 }),
      CORS_CONFIG,
    );
  }
}

export async function PUT(req: NextRequest) {
  if (!isAuthorized(req)) {
    return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), CORS_CONFIG);
  }
  if (!verifyCsrf(req)) {
    return withCors(NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 }), CORS_CONFIG);
  }
  if (!isAuthorized(req)) {
    log.warn('admin_partners_unauthorized', { route: 'admin/partners', method: req.method, correlationId: getCorrelationId(req) });
    return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), CORS_CONFIG);
  }

  const partnerId = req.nextUrl.searchParams.get('partnerId');
  if (!partnerId) {
    return withCors(
      NextResponse.json({ error: 'partnerId is required' }, { status: 400 }),
      CORS_CONFIG,
    );
  }

  try {
    const body = await req.json();
    const payload = partnerMetaUpdateSchema.parse(body ?? {});
    const result = await savePartnerMeta(partnerId, payload);
    return withCors(NextResponse.json(result), CORS_CONFIG);
  } catch (err) {
    if (err instanceof ZodError) {
      log.warn('admin_partners_validation_error', { route: 'admin/partners', method: req.method, correlationId: getCorrelationId(req), issues: err.flatten?.() });
      return withCors(
        NextResponse.json(
          { error: 'ValidationError', issues: err.flatten() },
          { status: 400 },
        ),
        CORS_CONFIG,
      );
    }

    log.error('admin_partners_put_error', err, { route: 'admin/partners', correlationId: getCorrelationId(req) });
    return withCors(
      NextResponse.json({ error: 'Internal server error' }, { status: 500 }),
      CORS_CONFIG,
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), CORS_CONFIG);
  }
  if (!verifyCsrf(req)) {
    return withCors(NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 }), CORS_CONFIG);
  }

  try {
    const body = await req.json();
    const payload = partnerCreateSchema.parse(body ?? {});
    const normalizedId = payload.partnerId.trim().toLowerCase();

    if (await partnerExists(normalizedId)) {
      return withCors(
        NextResponse.json({ error: 'Partner ID already exists' }, { status: 409 }),
        CORS_CONFIG,
      );
    }

    const updates = {
      displayName: payload.displayName ?? payload.partnerId,
      status: payload.status,
      info:
        payload.contactEmail || payload.contactName
          ? {
              contactEmail: payload.contactEmail,
              contactName: payload.contactName,
            }
          : undefined,
    } satisfies Parameters<typeof savePartnerMeta>[1];

    await savePartnerMeta(normalizedId, updates);
    const item = await loadPartnerMeta(normalizedId);
    log.info('admin_partner_created', { partnerId: normalizedId, correlationId: getCorrelationId(req) });
    const response = NextResponse.json({ ok: true, item });
    response.headers.set('x-csrf-token', generateCsrfToken());
    return withCors(response, CORS_CONFIG);
  } catch (err) {
    if (err instanceof z.ZodError) {
      log.warn('admin_partners_create_validation_error', { route: 'admin/partners', issues: err.flatten?.(), correlationId: getCorrelationId(req) });
      return withCors(
        NextResponse.json({ error: 'ValidationError', issues: err.flatten() }, { status: 400 }),
        CORS_CONFIG,
      );
    }

    log.error('admin_partners_post_error', err, { route: 'admin/partners', correlationId: getCorrelationId(req) });
    return withCors(
      NextResponse.json({ error: 'Internal server error' }, { status: 500 }),
      CORS_CONFIG,
    );
  }
}
