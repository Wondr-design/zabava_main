import { NextRequest, NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { verifyPassword } from '@/lib/auth/passwords';
import { signJwt } from '@/lib/auth/jwt';
import { getPartnerUserByEmail, touchPartnerUserLogin } from '@/lib/data/partner-users';
import { getPartnerStaffByEmail, touchPartnerStaffLogin } from '@/lib/data/staff';
import { preflightResponse, withCors } from '@/lib/http/cors';
import { generateCsrfToken } from '@/lib/http/csrf';
import { log, getCorrelationId } from '@/lib/logging';

const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const JWT_SECRET = process.env.JWT_SECRET || '';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
  role: z.enum(['admin', 'partner', 'staff']).optional(),
});

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function requestedRoleMatches(
  recordRole: 'admin' | 'partner' | 'staff',
  requested?: 'admin' | 'partner' | 'staff'
) {
  if (!requested) return true;
  return recordRole === requested;
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
  return preflightResponse({ methods: 'POST, OPTIONS', headers: 'Content-Type, Authorization' });
}

function unauthorizedResponse(message = 'Invalid credentials') {
  return withCors(
    NextResponse.json({ error: message }, { status: 401 }),
    { methods: 'POST, OPTIONS', headers: 'Content-Type, Authorization' }
  );
}

export async function POST(req: NextRequest) {
  if (!JWT_SECRET) {
    console.error('JWT_SECRET missing in environment');
    return withCors(
      NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 }),
      { methods: 'POST, OPTIONS', headers: 'Content-Type, Authorization' }
    );
  }

  try {
    const body = await req.json();
    const payload = loginSchema.parse(body ?? {});
    const email = normalizeEmail(payload.email);
    const password = payload.password;
    const requestedRole = payload.role;
    const cid = getCorrelationId(req);
    log.info('auth_login_attempt', { email, requestedRole, correlationId: cid });

    const adminSecretMatched = Boolean(
      ADMIN_SECRET && password === ADMIN_SECRET && (!requestedRole || requestedRole === 'admin')
    );

    if (adminSecretMatched) {
      const token = signJwt({ email, role: 'admin' }, { expiresIn: JWT_EXPIRES_IN });
      const response = NextResponse.json(
        {
          token,
          user: {
            email,
            role: 'admin',
          },
        },
        { status: 200 }
      );
      const maxAge = (() => {
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
      })();
      response.cookies.set('zabava_token', token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge });
      response.cookies.set('zabava_role', 'admin', { httpOnly: false, secure: true, sameSite: 'lax', path: '/', maxAge });
      const csrf = generateCsrfToken();
      response.cookies.set('zabava_csrf', csrf, { httpOnly: false, secure: true, sameSite: 'lax', path: '/', maxAge });
      log.info('auth_login_success_admin', { email, correlationId: cid });
      return withCors(
        response,
        { methods: 'POST, OPTIONS', headers: 'Content-Type, Authorization' }
      );
    }

    const partnerRecord = await getPartnerUserByEmail(email);
    if (partnerRecord) {
      const passwordValid = await verifyPassword(password, partnerRecord.password_hash);
      if (!passwordValid) {
        return unauthorizedResponse();
      }

      if (!requestedRoleMatches(partnerRecord.role, requestedRole)) {
        return unauthorizedResponse();
      }

      if (partnerRecord.role === 'partner' && !partnerRecord.partner_id) {
        console.warn('Partner user missing partner_id', { email });
        return unauthorizedResponse();
      }

      await touchPartnerUserLogin(email);

      const tokenPayload: Record<string, unknown> = {
        email,
        role: partnerRecord.role,
      };

      if (partnerRecord.role === 'partner' && partnerRecord.partner_id) {
        tokenPayload.partnerId = partnerRecord.partner_id;
      }

      if (partnerRecord.name) {
        tokenPayload.name = partnerRecord.name;
      }

      const token = signJwt(tokenPayload, { expiresIn: JWT_EXPIRES_IN });

      const response = NextResponse.json(
        {
          token,
          user: {
            email,
            role: partnerRecord.role,
            partnerId: partnerRecord.partner_id,
            name: partnerRecord.name,
          },
        },
        { status: 200 }
      );

      const maxAge = resolveMaxAgeSeconds();

      response.cookies.set('zabava_token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge,
      });
      response.cookies.set('zabava_role', partnerRecord.role, {
        httpOnly: false,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge,
      });
      if (partnerRecord.partner_id) {
        response.cookies.set('zabava_partner', partnerRecord.partner_id, {
          httpOnly: false,
          secure: true,
          sameSite: 'lax',
          path: '/',
          maxAge,
        });
      }
      const csrf = generateCsrfToken();
      response.cookies.set('zabava_csrf', csrf, {
        httpOnly: false,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge,
      });

      log.info('auth_login_success_partner', { email, partnerId: partnerRecord.partner_id, correlationId: cid });
      return withCors(
        response,
        { methods: 'POST, OPTIONS', headers: 'Content-Type, Authorization' }
      );
    }

    const staffRecord = await getPartnerStaffByEmail(email);
    if (staffRecord) {
      if (!requestedRoleMatches('staff', requestedRole)) {
        return unauthorizedResponse();
      }

      if (staffRecord.status !== 'active') {
        return unauthorizedResponse('Account inactive');
      }

      const passwordValid = await verifyPassword(password, staffRecord.password_hash);
      if (!passwordValid) {
        return unauthorizedResponse();
      }

      await touchPartnerStaffLogin(staffRecord.id);

      const tokenPayload: Record<string, unknown> = {
        email,
        role: 'staff',
        partnerId: staffRecord.partner_id,
        staffId: staffRecord.id,
      };
      if (staffRecord.name) {
        tokenPayload.name = staffRecord.name;
      }

      const token = signJwt(tokenPayload, { expiresIn: JWT_EXPIRES_IN });
      const response = NextResponse.json(
        {
          token,
          user: {
            email,
            role: 'staff',
            partnerId: staffRecord.partner_id,
            staffId: staffRecord.id,
            name: staffRecord.name,
          },
        },
        { status: 200 }
      );

      const maxAge = resolveMaxAgeSeconds();
      response.cookies.set('zabava_token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge,
      });
      response.cookies.set('zabava_role', 'staff', {
        httpOnly: false,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge,
      });
      response.cookies.set('zabava_partner', staffRecord.partner_id, {
        httpOnly: false,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge,
      });
      response.cookies.set('zabava_staff', staffRecord.id, {
        httpOnly: false,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge,
      });
      const csrf = generateCsrfToken();
      response.cookies.set('zabava_csrf', csrf, {
        httpOnly: false,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge,
      });

      log.info('auth_login_success_staff', { email, partnerId: staffRecord.partner_id, staffId: staffRecord.id, correlationId: cid });
      return withCors(
        response,
        { methods: 'POST, OPTIONS', headers: 'Content-Type, Authorization' }
      );
    }

    log.warn('auth_login_invalid_credentials', { email, requestedRole, correlationId: cid });
    return unauthorizedResponse();
  } catch (err) {
    if (err instanceof ZodError) {
      return withCors(
        NextResponse.json(
          { error: 'Validation error', details: err.flatten() },
          { status: 400 }
        ),
        { methods: 'POST, OPTIONS', headers: 'Content-Type, Authorization' }
      );
    }

    log.error('auth_login_error', err, { correlationId: getCorrelationId(req) });
    return withCors(
      NextResponse.json({ error: 'Internal server error' }, { status: 500 }),
      { methods: 'POST, OPTIONS', headers: 'Content-Type, Authorization' }
    );
  }
}
