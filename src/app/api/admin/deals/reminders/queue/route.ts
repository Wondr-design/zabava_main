import { NextRequest, NextResponse } from "next/server";

import { enqueueDealReminders } from "@/lib/data/flash-deals";
import { getAuthFromRequest } from "@/lib/auth/request";
import { log, getCorrelationId } from "@/lib/logging";
import { generateCsrfToken, verifyCsrf } from "@/lib/http/csrf";
import { withCors, preflightResponse } from "@/lib/http/cors";
import jwt from "jsonwebtoken";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const JWT_SECRET = process.env.JWT_SECRET || "";

const CORS_CONFIG = {
  methods: "POST,OPTIONS",
  headers: "Content-Type, Authorization, x-admin-secret, x-csrf-token",
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
    log.warn("admin_deal_reminder_queue_auth_failed", {
      error: error instanceof Error ? error.message : String(error),
      correlationId: getCorrelationId(req),
    });
    return false;
  }
}

export function OPTIONS() {
  return preflightResponse(CORS_CONFIG);
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return withCors(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      CORS_CONFIG,
    );
  }

  if (!verifyCsrf(req)) {
    return withCors(
      NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }),
      CORS_CONFIG,
    );
  }

  try {
    const result = await enqueueDealReminders();
    const response = NextResponse.json({ ok: true, ...result });
    response.headers.set("x-csrf-token", generateCsrfToken());
    return withCors(response, CORS_CONFIG);
  } catch (error) {
    log.error("admin_deal_reminder_queue_error", error, {
      correlationId: getCorrelationId(req),
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      CORS_CONFIG,
    );
  }
}
