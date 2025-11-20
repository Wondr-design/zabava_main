import type { NextRequest } from "next/server";

const RAW_ALLOWED_ORIGINS =
  process.env.ALLOWED_ORIGIN ||
  process.env.DASHBOARD_BASE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "";

const ALLOWED_ORIGINS = RAW_ALLOWED_ORIGINS.split(",")
  .map((value) => value.trim())
  .filter((value) => value.length > 0);

export function resolveAllowedOrigin(req: NextRequest) {
  const requestOrigin = req.headers.get("origin");
  const selfOrigin = new URL(req.url).origin;

  if (requestOrigin) {
    if (
      requestOrigin === selfOrigin ||
      ALLOWED_ORIGINS.includes(requestOrigin) ||
      ALLOWED_ORIGINS.includes("*")
    ) {
      return requestOrigin;
    }
  }

  if (ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS[0] !== "*") {
    return ALLOWED_ORIGINS[0];
  }

  return selfOrigin;
}
