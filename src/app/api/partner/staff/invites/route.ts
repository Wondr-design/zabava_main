import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { withCors, preflightResponse } from '@/lib/http/cors';
import { getAuthFromRequest } from '@/lib/auth/request';
import { log, getCorrelationId } from '@/lib/logging';
import { verifyCsrf } from '@/lib/http/csrf';
import {
  createStaffInvite,
  staffInviteCreateSchema,
  getStaffInviteByToken,
  revokeStaffInvite,
  listPartnerStaffInvites,
} from '@/lib/data/staff-invites';

const CORS_OPTIONS = {
  methods: 'POST,DELETE,GET,OPTIONS',
  headers: 'Content-Type, Authorization, x-partner-secret',
};

function getPartnerScope(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth) return null;
  if (auth.role === 'partner' && auth.partnerId) {
    return auth.partnerId;
  }
  return null;
}

export function OPTIONS() {
  return preflightResponse(CORS_OPTIONS);
}

export async function GET(req: NextRequest) {
  const partnerId = getPartnerScope(req);
  if (!partnerId) {
    return unauthorized();
  }

  try {
    log.info('partner_staff_invites_list', { partnerId, correlationId: getCorrelationId(req) });
    const items = await listPartnerStaffInvites(partnerId);
    return withCors(NextResponse.json({ items }), CORS_OPTIONS);
  } catch (err) {
    log.error('partner_staff_invite_get_error', err, { route: 'partner/staff/invites', correlationId: getCorrelationId(req) });
    return withCors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }), CORS_OPTIONS);
  }
}

function unauthorized() {
  return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), CORS_OPTIONS);
}

function forbidden(message = 'Forbidden') {
  return withCors(NextResponse.json({ error: message }, { status: 403 }), CORS_OPTIONS);
}

export async function POST(req: NextRequest) {
  const partnerId = getPartnerScope(req);
  if (!partnerId) {
    return unauthorized();
  }
  if (!verifyCsrf(req)) {
    return forbidden('Invalid CSRF token');
  }

  try {
    const body = await req.json();
    const payload = staffInviteCreateSchema.parse({
      ...body,
      partnerId,
      token: randomUUID().replace(/-/g, ''),
      createdBy: getAuthFromRequest(req)?.email,
      expiresAt: body.expiresInMinutes
        ? new Date(Date.now() + Number(body.expiresInMinutes) * 60 * 1000).toISOString()
        : null,
    });

    const invite = await createStaffInvite(payload);
    log.info('partner_staff_invite_created', { partnerId, token: invite.token, email: invite.email, correlationId: getCorrelationId(req) });
    return withCors(NextResponse.json({ invite }), CORS_OPTIONS);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return withCors(NextResponse.json({ error: 'ValidationError', issues: err.flatten() }, { status: 400 }), CORS_OPTIONS);
    }
    log.error('partner_staff_invite_post_error', err, { route: 'partner/staff/invites', correlationId: getCorrelationId(req) });
    return withCors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }), CORS_OPTIONS);
  }
}

export async function DELETE(req: NextRequest) {
  const partnerId = getPartnerScope(req);
  if (!partnerId) {
    return unauthorized();
  }
  if (!verifyCsrf(req)) {
    return forbidden('Invalid CSRF token');
  }

  try {
    const token = req.nextUrl.searchParams.get('token')?.trim();
    if (!token) {
      return withCors(NextResponse.json({ error: 'token is required' }, { status: 400 }), CORS_OPTIONS);
    }

    const invite = await getStaffInviteByToken(token);
    if (!invite || invite.partner_id !== partnerId) {
      return forbidden('Invite not found');
    }

    await revokeStaffInvite(token);
    log.info('partner_staff_invite_revoked', { partnerId, token, correlationId: getCorrelationId(req) });
    return withCors(NextResponse.json({ ok: true }), CORS_OPTIONS);
  } catch (err) {
    log.error('partner_staff_invite_delete_error', err, { route: 'partner/staff/invites', correlationId: getCorrelationId(req) });
    return withCors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }), CORS_OPTIONS);
  }
}
