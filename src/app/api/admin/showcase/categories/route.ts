import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { ZodError } from "zod";

import { getAuthFromRequest } from "@/lib/auth/request";
import {
  deletePartnerCategory,
  listPartnerCategories,
  partnerCategoryInputSchema,
  savePartnerCategory,
} from "@/lib/data/partner-showcase";
import { preflightResponse, withCors } from "@/lib/http/cors";
import { verifyCsrf, generateCsrfToken } from "@/lib/http/csrf";
import { log, getCorrelationId } from "@/lib/logging";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const JWT_SECRET = process.env.JWT_SECRET || "";

const CORS_CONFIG = {
  methods: "GET,POST,DELETE,OPTIONS",
  headers: "Content-Type, Authorization, x-admin-secret",
} as const;

function isAuthorized(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (auth?.role === "admin") return true;

  const adminSecret = req.headers.get("x-admin-secret");
  if (ADMIN_SECRET && adminSecret === ADMIN_SECRET) {
    return true;
  }

  if (!JWT_SECRET) return false;
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
  } catch (err) {
    log.warn("admin_showcase_auth_failed", {
      route: "admin/showcase/categories",
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
    const items = await listPartnerCategories();
    const response = NextResponse.json({ items });
    response.headers.set("x-csrf-token", generateCsrfToken());
    return withCors(response, CORS_CONFIG);
  } catch (error) {
    log.error("admin_showcase_categories_get_error", error, {
      route: "admin/showcase/categories",
      correlationId: getCorrelationId(req),
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      CORS_CONFIG
    );
  }
}

export async function POST(req: NextRequest) {
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
    const payload = partnerCategoryInputSchema.parse(body ?? {});
    const saved = await savePartnerCategory(payload);
    const response = NextResponse.json({ item: saved });
    response.headers.set("x-csrf-token", generateCsrfToken());
    return withCors(response, CORS_CONFIG);
  } catch (error) {
    if (error instanceof ZodError) {
      return withCors(
        NextResponse.json(
          { error: "ValidationError", issues: error.flatten() },
          { status: 400 }
        ),
        CORS_CONFIG
      );
    }
    log.error("admin_showcase_categories_post_error", error, {
      route: "admin/showcase/categories",
      correlationId: getCorrelationId(req),
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      CORS_CONFIG
    );
  }
}

export async function DELETE(req: NextRequest) {
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

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return withCors(
      NextResponse.json({ error: "Missing category id" }, { status: 400 }),
      CORS_CONFIG
    );
  }

  try {
    await deletePartnerCategory(id);
    const response = NextResponse.json({ success: true });
    response.headers.set("x-csrf-token", generateCsrfToken());
    return withCors(response, CORS_CONFIG);
  } catch (error) {
    log.error("admin_showcase_categories_delete_error", error, {
      route: "admin/showcase/categories",
      correlationId: getCorrelationId(req),
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      CORS_CONFIG
    );
  }
}
