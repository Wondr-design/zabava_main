import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.cookies.set('zabava_token', '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
  res.cookies.set('zabava_role', '', { httpOnly: false, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
  res.cookies.set('zabava_partner', '', { httpOnly: false, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
  res.cookies.set('zabava_staff', '', { httpOnly: false, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return res;
}
