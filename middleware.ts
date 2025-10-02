import { NextRequest, NextResponse } from 'next/server';

function needsAdminGuard(pathname: string) {
  if (pathname.startsWith('/api')) return false;
  if (pathname === '/admin/login') return false;
  return pathname.startsWith('/admin');
}

function needsPartnerGuard(pathname: string) {
  if (pathname.startsWith('/api')) return false;
  if (pathname === '/partner/login') return false;
  return pathname.startsWith('/partner');
}

function needsStaffGuard(pathname: string) {
  if (pathname.startsWith('/api')) return false;
  if (pathname === '/staff/login') return false;
  if (pathname.startsWith('/staff/signup')) return false;
  return pathname.startsWith('/staff');
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('zabava_token')?.value;
  const role = request.cookies.get('zabava_role')?.value;

  if (needsAdminGuard(pathname)) {
    if (!token || role !== 'admin') {
      const url = new URL('/admin/login', request.url);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (needsPartnerGuard(pathname)) {
    if (!token || role !== 'partner') {
      const url = new URL('/partner/login', request.url);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (needsStaffGuard(pathname)) {
    if (!token || role !== 'staff') {
      const url = new URL('/staff/login', request.url);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/partner/:path*',
    '/staff/:path*',
  ],
};
