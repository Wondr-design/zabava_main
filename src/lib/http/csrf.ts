import { randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';

export function generateCsrfToken() {
  return randomBytes(24).toString('hex');
}

export function getRequestCsrfHeader(req: NextRequest) {
  return req.headers.get('x-csrf-token') || '';
}

export function getRequestCsrfCookie(req: NextRequest) {
  try { return req.cookies.get('zabava_csrf')?.value || ''; } catch { return ''; }
}

export function verifyCsrf(req: NextRequest) {
  const header = getRequestCsrfHeader(req);
  const cookie = getRequestCsrfCookie(req);
  return Boolean(header) && Boolean(cookie) && header === cookie;
}
