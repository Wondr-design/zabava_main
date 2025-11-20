import { NextRequest, NextResponse } from "next/server";

import {
  defaultLocale,
  isLocale,
  type Locale,
} from "./src/i18n/config";

const LOCALE_COOKIE = "zabava_locale";
const PUBLIC_FILE = /\.(?:.*)$/;

function detectLocale(request: NextRequest): Locale {
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) {
    return cookieLocale;
  }

  const acceptLanguage = request.headers.get("accept-language");
  if (acceptLanguage) {
    const parsed = acceptLanguage
      .split(",")
      .map((entry) => entry.split(";")[0]?.trim()?.toLowerCase())
      .filter(Boolean);
    for (const candidate of parsed) {
      const base = candidate?.split("-")?.[0];
      if (isLocale(candidate)) return candidate as Locale;
      if (isLocale(base)) return base as Locale;
    }
  }

  return defaultLocale;
}

function withoutLocale(pathname: string, locale: Locale): string {
  const prefix = `/${locale}`;
  if (pathname === prefix) return "/";
  if (pathname.startsWith(`${prefix}/`)) {
    const sliced = pathname.slice(prefix.length);
    return sliced.length === 0 ? "/" : sliced;
  }
  return pathname;
}

function needsAdminGuard(pathname: string) {
  if (pathname.startsWith("/api")) return false;
  if (pathname === "/admin/login") return false;
  if (pathname === "/admin/signup") return false;
  if (pathname.startsWith("/admin/invite/accept")) return false;
  return pathname.startsWith("/admin");
}

function needsPartnerGuard(pathname: string) {
  if (pathname.startsWith("/api")) return false;
  if (pathname === "/partner/login") return false;
  return pathname.startsWith("/partner");
}

function needsStaffGuard(pathname: string) {
  if (pathname.startsWith("/api")) return false;
  if (pathname === "/staff/login") return false;
  if (pathname.startsWith("/staff/signup")) return false;
  return pathname.startsWith("/staff");
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const segments = pathname.split("/");
  const maybeLocale = segments[1];
  const hasLocalePrefix = isLocale(maybeLocale);

  const locale = hasLocalePrefix
    ? (maybeLocale as Locale)
    : detectLocale(request);

  if (!hasLocalePrefix) {
    const redirectUrl = new URL(
      `/${locale}${pathname === "/" ? "" : pathname}`,
      request.url,
    );
    return NextResponse.redirect(redirectUrl);
  }

  const normalizedPath = withoutLocale(pathname, locale);
  const token = request.cookies.get("zabava_token")?.value;
  const role = request.cookies.get("zabava_role")?.value;

  if (needsAdminGuard(normalizedPath)) {
    if (!token || role !== "admin") {
      const url = new URL(`/${locale}/admin/login`, request.url);
      return NextResponse.redirect(url);
    }
  }

  if (needsPartnerGuard(normalizedPath)) {
    if (!token || role !== "partner") {
      const url = new URL(`/${locale}/partner/login`, request.url);
      return NextResponse.redirect(url);
    }
  }

  if (needsStaffGuard(normalizedPath)) {
    if (!token || role !== "staff") {
      const url = new URL(`/${locale}/staff/login`, request.url);
      return NextResponse.redirect(url);
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-locale", locale);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  response.headers.set("x-locale", locale);

  return response;
}

export const config = {
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
