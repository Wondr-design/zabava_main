import { NextRequest, NextResponse } from 'next/server';
import { getPartnerUserByEmail } from '@/lib/data/partner-users';
import { withCors, preflightResponse } from '@/lib/http/cors';
import { getAuthFromRequest } from '@/lib/auth/request';

export function OPTIONS() {
  return preflightResponse({ methods: 'GET, OPTIONS', headers: 'Content-Type, Authorization' });
}

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth?.email) {
    return withCors(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      { methods: 'GET, OPTIONS', headers: 'Content-Type, Authorization' }
    );
  }

  try {
    const record = await getPartnerUserByEmail(auth.email);
    if (!record) {
      return withCors(
        NextResponse.json({ error: 'Not found' }, { status: 404 }),
        { methods: 'GET, OPTIONS', headers: 'Content-Type, Authorization' }
      );
    }

    return withCors(
      NextResponse.json({
        email: record.email,
        partnerId: record.partner_id,
        role: record.role,
        name: record.name,
        lastLoginAt: record.last_login_at,
        createdAt: record.created_at,
      }),
      { methods: 'GET, OPTIONS', headers: 'Content-Type, Authorization' }
    );
  } catch (err) {
    console.error('auth/profile error', err);
    return withCors(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      { methods: 'GET, OPTIONS', headers: 'Content-Type, Authorization' }
    );
  }
}
