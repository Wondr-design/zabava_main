import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { z } from "zod";

import { getAuthFromRequest } from "@/lib/auth/request";
import {
  getActivePointRatio,
  getPointRatioSettings,
  setPointRatio,
} from "@/lib/data/point-settings";
import { preflightResponse, withCors } from "@/lib/http/cors";
import { verifyCsrf, generateCsrfToken } from "@/lib/http/csrf";
import { log, getCorrelationId } from "@/lib/logging";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const JWT_SECRET = process.env.JWT_SECRET || "";

const CORS_CONFIG = {
  methods: "GET,PUT,OPTIONS",
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
  if (!token) {
    return false;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (typeof payload === "object" && payload && "role" in payload) {
      return (payload as { role?: string }).role === "admin";
    }
    return false;
  } catch (err) {
    log.warn("admin_point_ratio_auth_failed", {
      route: "admin/settings/point-ratio",
      error: (err as Error)?.message,
      correlationId: getCorrelationId(req),
    });
    return false;
  }
}

export function OPTIONS() {
  return preflightResponse(CORS_CONFIG);
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return withCors(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      CORS_CONFIG
    );
  }

  try {
    const [active, history] = await Promise.all([
      getActivePointRatio(),
      getPointRatioSettings(5),
    ]);

    const response = NextResponse.json({
      ratioCzk: active.ratioCzk,
      source: active.source,
      setting: active.setting ?? null,
      history,
    });
    response.headers.set("x-csrf-token", generateCsrfToken());
    return withCors(response, CORS_CONFIG);
  } catch (error) {
    log.error("admin_point_ratio_get_error", error, {
      route: "admin/settings/point-ratio",
      correlationId: getCorrelationId(req),
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      CORS_CONFIG
    );
  }
}

const updateBodySchema = z.object({
  ratioCzk: z.coerce.number().positive(),
});

export async function PUT(req: NextRequest) {
  if (!isAuthorized(req)) {
    return withCors(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      CORS_CONFIG
    );
  }
  if (!verifyCsrf(req)) {
    return withCors(
      NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }),
      CORS_CONFIG
    );
  }

  try {
    const body = await req.json();
    const payload = updateBodySchema.parse(body ?? {});
    const auth = getAuthFromRequest(req);

    const setting = await setPointRatio({
      ratioCzk: payload.ratioCzk,
      createdBy: auth?.email ?? null,
    });

    const response = NextResponse.json({
      ratioCzk: setting.ratioCzk,
      setting,
    });
    response.headers.set("x-csrf-token", generateCsrfToken());
    return withCors(response, CORS_CONFIG);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return withCors(
        NextResponse.json(
          { error: "ValidationError", issues: err.flatten() },
          { status: 400 }
        ),
        CORS_CONFIG
      );
    }

    log.error("admin_point_ratio_put_error", err, {
      route: "admin/settings/point-ratio",
      correlationId: getCorrelationId(req),
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      CORS_CONFIG
    );
  }
}
