import { NextRequest, NextResponse } from 'next/server';
import { verifyCsrf } from '@/lib/http/csrf';
import jwt from 'jsonwebtoken';
import { ZodError } from 'zod';
import {
  createInviteInputSchema,
  createPartnerInvite,
  listPartnerInvites,
  listInvitesQuerySchema,
} from '@/lib/data/invites';
import { log, getCorrelationId } from '@/lib/logging';
import { notifyPartnerInvite } from '@/lib/services/invites/notify';

const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const ALLOWED_ORIGIN =
  process.env.ALLOWED_ORIGIN || process.env.DASHBOARD_BASE_URL || '*';
const JWT_SECRET = process.env.JWT_SECRET || '';

function applyCors(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  response.headers.set('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-admin-secret'
  );
  response.headers.set('Access-Control-Max-Age', '86400');
  return response;
}

function isAuthorized(req: NextRequest) {
  const adminSecret = req.headers.get('x-admin-secret');
  if (ADMIN_SECRET && adminSecret === ADMIN_SECRET) {
    return true;
  }

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
    log.warn('admin_invites_auth_failed', { route: 'admin/invites', error: (err as Error)?.message, correlationId: getCorrelationId(req) });
    return false;
  }
}

export function OPTIONS() {
  return applyCors(new NextResponse(null, { status: 200 }));
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    log.warn('admin_invites_unauthorized', { route: 'admin/invites', method: req.method, correlationId: getCorrelationId(req) });
    return applyCors(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    );
  }

  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = listInvitesQuerySchema.parse(params);
    const result = await listPartnerInvites(query);
    log.info('admin_invites_list', { count: result.items?.length ?? 0, correlationId: getCorrelationId(req) });
    return applyCors(NextResponse.json(result));
  } catch (err) {
    if (err instanceof ZodError) {
      log.warn('admin_invites_validation_error', { route: 'admin/invites', method: req.method, correlationId: getCorrelationId(req), issues: err.flatten?.() });
      return applyCors(
        NextResponse.json(
          { error: 'ValidationError', issues: err.flatten() },
          { status: 400 }
        )
      );
    }

    log.error('admin_invites_get_error', err, { route: 'admin/invites', correlationId: getCorrelationId(req) });
    return applyCors(
      NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return applyCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
  }
  if (!verifyCsrf(req)) {
    return applyCors(NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 }));
  }
  try {
    const body = await req.json();
    const payload = createInviteInputSchema.parse(body ?? {});
    const headerLocale = req.headers.get('x-locale') ?? undefined;
    const invite = await createPartnerInvite({
      ...payload,
      locale: payload.locale ?? headerLocale ?? undefined,
    });
    await notifyPartnerInvite(invite);
    log.info('admin_invite_created', {
      email: invite.email,
      partnerId: invite.partnerId,
      role: invite.role,
      token: invite.token,
      correlationId: getCorrelationId(req),
    });
    return applyCors(NextResponse.json({ invite }, { status: 200 }));
  } catch (err) {
    if (err instanceof ZodError) {
      log.warn('admin_invites_validation_error', { route: 'admin/invites', method: req.method, correlationId: getCorrelationId(req), issues: err.flatten?.() });
      return applyCors(NextResponse.json({ error: 'ValidationError', issues: err.flatten() }, { status: 400 }));
    }
    log.error('admin_invites_post_error', err, { route: 'admin/invites', correlationId: getCorrelationId(req) });
    return applyCors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
  }
}

export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req)) {
    return applyCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
  }
  if (!verifyCsrf(req)) {
    return applyCors(NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 }));
  }

  try {
    const tokenFromQuery = req.nextUrl.searchParams.get('token');
    let tokenFromBody: string | null = null;
    if (!tokenFromQuery) {
      try {
        const parsedBody: unknown = await req.json();
        if (
          typeof parsedBody === 'object' &&
          parsedBody !== null &&
          'token' in parsedBody
        ) {
          const candidate = (parsedBody as { token: unknown }).token;
          if (typeof candidate === 'string') {
            tokenFromBody = candidate;
          }
        }
      } catch {
        // ignore body parse errors; tokenFromBody remains null
      }
    }
    const token = tokenFromQuery ?? tokenFromBody ?? '';
    if (!token) {
      return applyCors(NextResponse.json({ error: 'token is required' }, { status: 400 }));
    }
    const { deletePartnerInvite } = await import('@/lib/data/invites');
    await deletePartnerInvite(String(token));
    log.info('admin_invite_deleted', { token, correlationId: getCorrelationId(req) });
    return applyCors(NextResponse.json({ ok: true }));
  } catch (err) {
    console.error('admin invites DELETE error', err);
    return applyCors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
  }
}
