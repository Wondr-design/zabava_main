import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

import { getFlashDealAnalytics } from "@/lib/data/flash-deals";
import { getAuthFromRequest } from "@/lib/auth/request";
import { withCors, preflightResponse } from "@/lib/http/cors";
import { log, getCorrelationId } from "@/lib/logging";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const JWT_SECRET = process.env.JWT_SECRET || "";

const CORS_CONFIG = {
  methods: "GET,OPTIONS",
  headers: "Content-Type, Authorization, x-admin-secret",
} as const;

function isAuthorized(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (auth?.role === "admin") return true;

  const adminSecret = req.headers.get("x-admin-secret");
  if (ADMIN_SECRET && adminSecret === ADMIN_SECRET) {
    return true;
  }

  if (!JWT_SECRET) {
    return false;
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.slice(7).trim();
  if (!token) return false;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (typeof payload === "object" && payload && "role" in payload) {
      return (payload as { role?: string }).role === "admin";
    }
    return false;
  } catch (error) {
    log.warn("admin_flash_deals_analytics_auth_failed", {
      error: error instanceof Error ? error.message : String(error),
      correlationId: getCorrelationId(req),
    });
    return false;
  }
}

export function OPTIONS() {
  return preflightResponse(CORS_CONFIG);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const req = request as NextRequest;
  if (!isAuthorized(req)) {
    return withCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), CORS_CONFIG);
  }

  const { id } = await context.params;
  if (!id) {
    return withCors(NextResponse.json({ error: "Flash deal ID is required" }, { status: 400 }), CORS_CONFIG);
  }
  const url = req.nextUrl;
  const daysParam = Number(url.searchParams.get("days"));
  const limitParam = Number(url.searchParams.get("limit"));

  const days = Number.isFinite(daysParam) && daysParam > 0 ? daysParam : undefined;
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined;

  try {
    const analytics = await getFlashDealAnalytics(id, { days, limit });
    return withCors(NextResponse.json({ analytics }), CORS_CONFIG);
  } catch (error) {
    log.error("admin_flash_deals_analytics_error", error, {
      route: "admin/flash-deals/[id]/analytics",
      correlationId: getCorrelationId(req),
      flashDealId: id,
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      CORS_CONFIG,
    );
  }
}
