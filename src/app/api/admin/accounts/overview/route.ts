import { NextRequest, NextResponse } from "next/server";

import { withCors, preflightResponse } from "@/lib/http/cors";
import { generateCsrfToken } from "@/lib/http/csrf";
import { log, getCorrelationId } from "@/lib/logging";
import { isAdminRequestAuthorized } from "@/lib/api/admin-auth";
import { loadAdminAccountOverview } from "@/lib/data/admin-account-overview";

const CORS_CONFIG = {
  methods: "GET,OPTIONS",
  headers: "Content-Type, Authorization, x-admin-secret",
} as const;

export function OPTIONS() {
  return preflightResponse(CORS_CONFIG);
}

export async function GET(req: NextRequest) {
  if (!isAdminRequestAuthorized(req)) {
    log.warn("admin_accounts_overview_unauthorized", {
      route: "admin/accounts/overview",
      method: req.method,
      correlationId: getCorrelationId(req),
    });
    return withCors(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      CORS_CONFIG,
    );
  }

  try {
    const overview = await loadAdminAccountOverview();
    const response = NextResponse.json({ overview });
    response.headers.set("x-csrf-token", generateCsrfToken());
    return withCors(response, CORS_CONFIG);
  } catch (error) {
    log.error("admin_accounts_overview_error", error, {
      route: "admin/accounts/overview",
      correlationId: getCorrelationId(req),
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      CORS_CONFIG,
    );
  }
}
