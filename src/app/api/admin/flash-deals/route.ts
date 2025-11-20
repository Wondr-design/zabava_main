import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import jwt from "jsonwebtoken";

import { listFlashDeals, createFlashDeal, type FlashDeal } from "@/lib/data/flash-deals";
import { getAuthFromRequest } from "@/lib/auth/request";
import { log, getCorrelationId } from "@/lib/logging";
import { verifyCsrf, generateCsrfToken } from "@/lib/http/csrf";
import { withCors, preflightResponse } from "@/lib/http/cors";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const JWT_SECRET = process.env.JWT_SECRET || "";

const CORS_CONFIG = {
  methods: "GET,POST,OPTIONS",
  headers: "Content-Type, Authorization, x-admin-secret",
} as const;

const listQuerySchema = z.object({
  partnerId: z.string().optional(),
  status: z
    .enum(["draft", "scheduled", "live", "paused", "expired"])
    .optional(),
  search: z.string().optional(),
});

const createPayloadSchema = z.object({
  partnerId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  discountPercent: z.number().min(0).max(100),
  minVisitors: z.number().int().min(1).default(1),
  validFrom: z.string().datetime().optional(),
  validTo: z.string().datetime().optional(),
  validDays: z.array(z.number().int().min(0).max(6)).optional(),
  commissionPercent: z.number().min(0).max(100),
  qrValiditySeconds: z.number().int().positive().default(86400),
  usageLimit: z.number().int().positive().nullable().optional(),
  status: z.enum(["draft", "scheduled", "live", "paused", "expired"]).default("draft"),
});

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
    log.warn("admin_flash_deals_auth_failed", {
      error: error instanceof Error ? error.message : String(error),
      correlationId: getCorrelationId(req),
    });
    return false;
  }
}

function presentFlashDeal(deal: FlashDeal) {
  return {
    id: deal.id,
    partnerId: deal.partner_id,
    title: deal.title,
    description: deal.description,
    discountPercent: deal.discount_percent,
    minVisitors: deal.min_visitors,
    validFrom: deal.valid_from,
    validTo: deal.valid_to,
    validDays: deal.valid_days,
    commissionPercent: deal.commission_percent,
    qrValiditySeconds: deal.qr_validity_seconds,
    usageLimit: deal.usage_limit,
    usageCount: deal.usage_count,
    status: deal.status,
    createdAt: deal.created_at,
    updatedAt: deal.updated_at,
  };
}

export function OPTIONS() {
  return preflightResponse(CORS_CONFIG);
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    log.warn("admin_flash_deals_unauthorized", {
      route: "admin/flash-deals",
      method: req.method,
      correlationId: getCorrelationId(req),
    });
    return withCors(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      CORS_CONFIG,
    );
  }

  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const filters = listQuerySchema.parse(params);
    const items = await listFlashDeals(filters);
    const response = NextResponse.json({
      items: items.map(presentFlashDeal),
    });
    response.headers.set("x-csrf-token", generateCsrfToken());
    return withCors(response, CORS_CONFIG);
  } catch (error) {
    log.error("admin_flash_deals_list_error", error, {
      route: "admin/flash-deals",
      correlationId: getCorrelationId(req),
    });
    const message = error instanceof z.ZodError ? "ValidationError" : "Internal server error";
    const status = error instanceof z.ZodError ? 400 : 500;
    return withCors(
      NextResponse.json(
        { error: message, ...(error instanceof z.ZodError ? { issues: error.flatten() } : {}) },
        { status },
      ),
      CORS_CONFIG,
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return withCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), CORS_CONFIG);
  }
  if (!verifyCsrf(req)) {
    return withCors(NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }), CORS_CONFIG);
  }

  try {
    const body = await req.json();
    const payload = createPayloadSchema.parse(body ?? {});
    const deal = await createFlashDeal({
      ...payload,
      usageLimit: payload.usageLimit ?? undefined,
      createdBy: getAuthFromRequest(req)?.email ?? undefined,
    });
    return withCors(
      NextResponse.json({ deal: presentFlashDeal(deal) }, { status: 201 }),
      CORS_CONFIG,
    );
  } catch (error) {
    const correlationId = getCorrelationId(req);
    if (error instanceof z.ZodError) {
      log.warn("admin_flash_deals_create_validation_error", {
        route: "admin/flash-deals",
        method: req.method,
        correlationId,
        issues: error.flatten(),
      });
      return withCors(
        NextResponse.json({ error: "ValidationError", issues: error.flatten() }, { status: 400 }),
        CORS_CONFIG,
      );
    }

    log.error("admin_flash_deals_create_error", error, {
      route: "admin/flash-deals",
      correlationId,
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      CORS_CONFIG,
    );
  }
}
