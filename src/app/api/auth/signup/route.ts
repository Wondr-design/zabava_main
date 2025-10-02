import { NextRequest, NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { signJwt } from '@/lib/auth/jwt';
import {
  getPartnerInviteByToken,
  markInviteUsed,
} from '@/lib/data/invites';
import {
  getPartnerUserByEmail,
  upsertPartnerUser,
} from '@/lib/data/partner-users';
import { getStaffInviteByToken, markStaffInviteUsed } from '@/lib/data/staff-invites';
import { getPartnerStaffByEmail, upsertPartnerStaff } from '@/lib/data/staff';
import { hashPassword } from '@/lib/auth/passwords';
import { preflightResponse, withCors } from '@/lib/http/cors';
import { generateCsrfToken } from '@/lib/http/csrf';

const JWT_SECRET = process.env.JWT_SECRET || '';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  token: z.string().min(10, 'Invite token is required'),
  name: z.string().min(1).max(120).optional(),
});

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function isInviteExpired(expiresAt: string | null | undefined) {
  if (!expiresAt) return false;
  const expires = new Date(expiresAt).getTime();
  if (Number.isNaN(expires)) return false;
  return Date.now() > expires;
}

function resolveMaxAgeSeconds() {
  const v = String(JWT_EXPIRES_IN || '12h');
  const m = /^([0-9]+)([smhd])$/.exec(v.trim());
  if (!m) return 60 * 60 * 12;
  const n = Number(m[1]);
  const unit = m[2];
  if (unit === 's') return n;
  if (unit === 'm') return n * 60;
  if (unit === 'h') return n * 60 * 60;
  if (unit === 'd') return n * 60 * 60 * 24;
  return 60 * 60 * 12;
}

export function OPTIONS() {
  return preflightResponse({ methods: 'POST, OPTIONS', headers: 'Content-Type' });
}

export async function POST(req: NextRequest) {
  if (!JWT_SECRET) {
    console.error('JWT_SECRET is not configured');
    return withCors(
      NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      ),
      { methods: 'POST, OPTIONS', headers: 'Content-Type' }
    );
  }

  try {
    const body = await req.json();
    const payload = signupSchema.parse(body ?? {});
    const email = normalize(payload.email);

    const partnerInvite = await getPartnerInviteByToken(payload.token);
    const staffInvite = partnerInvite ? null : await getStaffInviteByToken(payload.token);

    if (!partnerInvite && !staffInvite) {
      return withCors(
        NextResponse.json({ error: 'Invalid or expired invite' }, { status: 400 }),
        { methods: 'POST, OPTIONS', headers: 'Content-Type' }
      );
    }

    if (staffInvite) {
      if (staffInvite.used || staffInvite.status !== 'pending') {
        return withCors(
          NextResponse.json({ error: 'Invite already used' }, { status: 400 }),
          { methods: 'POST, OPTIONS', headers: 'Content-Type' }
        );
      }

      if (isInviteExpired(staffInvite.expires_at)) {
        return withCors(
          NextResponse.json({ error: 'Invite has expired' }, { status: 400 }),
          { methods: 'POST, OPTIONS', headers: 'Content-Type' }
        );
      }

      if (staffInvite.email && normalize(staffInvite.email) !== email) {
        return withCors(
          NextResponse.json({ error: 'Invite email mismatch' }, { status: 400 }),
          { methods: 'POST, OPTIONS', headers: 'Content-Type' }
        );
      }

      const existingStaff = await getPartnerStaffByEmail(email);
      if (existingStaff && existingStaff.email) {
        return withCors(
          NextResponse.json({ error: 'Account already exists' }, { status: 409 }),
          { methods: 'POST, OPTIONS', headers: 'Content-Type' }
        );
      }

      if (!staffInvite.partner_id) {
        return withCors(
          NextResponse.json({ error: 'Invite is misconfigured' }, { status: 400 }),
          { methods: 'POST, OPTIONS', headers: 'Content-Type' }
        );
      }

      const passwordHash = await hashPassword(payload.password);
      const staffName = payload.name || staffInvite.name || null;

      const staffRecord = await upsertPartnerStaff({
        partnerId: staffInvite.partner_id,
        email,
        passwordHash,
        name: staffName ?? undefined,
        status: 'active',
      });

      await markStaffInviteUsed(staffInvite.token);

      const token = signJwt(
        {
          sub: email,
          partnerId: staffRecord.partner_id,
          staffId: staffRecord.id,
          role: 'staff',
          name: staffRecord.name ?? staffName ?? undefined,
        },
        { expiresIn: JWT_EXPIRES_IN }
      );

      const response = NextResponse.json(
        {
          token,
          user: {
            email,
            partnerId: staffRecord.partner_id,
            role: 'staff',
            staffId: staffRecord.id,
            name: staffRecord.name ?? staffName ?? null,
          },
          expiresIn: JWT_EXPIRES_IN,
        },
        { status: 200 }
      );

      const maxAgeStaff = resolveMaxAgeSeconds();
      response.cookies.set('zabava_token', token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: maxAgeStaff });
      response.cookies.set('zabava_role', 'staff', { httpOnly: false, secure: true, sameSite: 'lax', path: '/', maxAge: maxAgeStaff });
      response.cookies.set('zabava_partner', staffRecord.partner_id, { httpOnly: false, secure: true, sameSite: 'lax', path: '/', maxAge: maxAgeStaff });
      response.cookies.set('zabava_staff', staffRecord.id, { httpOnly: false, secure: true, sameSite: 'lax', path: '/', maxAge: maxAgeStaff });
      const csrfStaff = generateCsrfToken();
      response.cookies.set('zabava_csrf', csrfStaff, { httpOnly: false, secure: true, sameSite: 'lax', path: '/', maxAge: maxAgeStaff });

      return withCors(
        response,
        { methods: 'POST, OPTIONS', headers: 'Content-Type' }
      );
    }

    const invite = partnerInvite!;
    if (invite.used) {
      return withCors(
        NextResponse.json({ error: 'Invite already used' }, { status: 400 }),
        { methods: 'POST, OPTIONS', headers: 'Content-Type' }
      );
    }

    if (isInviteExpired(invite.expires_at)) {
      return withCors(
        NextResponse.json({ error: 'Invite has expired' }, { status: 400 }),
        { methods: 'POST, OPTIONS', headers: 'Content-Type' }
      );
    }

    if (invite.email && normalize(invite.email) !== email) {
      return withCors(
        NextResponse.json({ error: 'Invite email mismatch' }, { status: 400 }),
        { methods: 'POST, OPTIONS', headers: 'Content-Type' }
      );
    }

    const existingUser = await getPartnerUserByEmail(email);
    if (existingUser && existingUser.email) {
      return withCors(
        NextResponse.json({ error: 'Account already exists' }, { status: 409 }),
        { methods: 'POST, OPTIONS', headers: 'Content-Type' }
      );
    }

    const partnerId = invite.partner_id;
    if (!partnerId && invite.role !== 'admin') {
      console.warn('Invite missing partnerId', { token: invite.token });
      return withCors(
        NextResponse.json({ error: 'Invite is misconfigured' }, { status: 400 }),
        { methods: 'POST, OPTIONS', headers: 'Content-Type' }
      );
    }

    const passwordHash = await hashPassword(payload.password);
    const role = invite.role || 'partner';
    const name = payload.name || invite.name || null;

    await upsertPartnerUser({
      email,
      passwordHash,
      partnerId: partnerId ?? undefined,
      role,
      name: name ?? undefined,
    });

    const marked = await markInviteUsed(invite.token);
    if (!marked) {
      console.warn('Invite marking resulted in empty response', {
        token: invite.token,
      });
    }

    const token = signJwt(
      {
        sub: email,
        partnerId: partnerId ?? undefined,
        role,
        name: name ?? undefined,
      },
      { expiresIn: JWT_EXPIRES_IN }
    );

    const response = NextResponse.json(
      {
        token,
        user: {
          email,
          partnerId: partnerId ?? null,
          role,
          name,
        },
        expiresIn: JWT_EXPIRES_IN,
      },
      { status: 200 }
    );

    // Set auth cookies (same as login)
    const maxAge = resolveMaxAgeSeconds();

    response.cookies.set('zabava_token', token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge });
    response.cookies.set('zabava_role', role, { httpOnly: false, secure: true, sameSite: 'lax', path: '/', maxAge });
    if (partnerId) {
      response.cookies.set('zabava_partner', partnerId, { httpOnly: false, secure: true, sameSite: 'lax', path: '/', maxAge });
    }
    const csrf = generateCsrfToken();
    response.cookies.set('zabava_csrf', csrf, { httpOnly: false, secure: true, sameSite: 'lax', path: '/', maxAge });

    return withCors(
      response,
      { methods: 'POST, OPTIONS', headers: 'Content-Type' }
    );
  } catch (err) {
    if (err instanceof ZodError) {
      return withCors(
        NextResponse.json(
          { error: 'ValidationError', issues: err.flatten() },
          { status: 400 }
        ),
        { methods: 'POST, OPTIONS', headers: 'Content-Type' }
      );
    }

    console.error('auth/signup error', err);
    return withCors(
      NextResponse.json({ error: 'Internal server error' }, { status: 500 }),
      { methods: 'POST, OPTIONS', headers: 'Content-Type' }
    );
  }
}
