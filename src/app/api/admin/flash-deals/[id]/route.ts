import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import jwt from "jsonwebtoken";

import {
  getFlashDeal,
  updateFlashDeal,
  duplicateFlashDeal,
  setFlashDealStatus,
  type FlashDeal,
} from "@/lib/data/flash-deals";
import { getAuthFromRequest } from "@/lib/auth/request";
import { verifyCsrf } from "@/lib/http/csrf";
import { withCors, preflightResponse } from "@/lib/http/cors";
import { log, getCorrelationId } from "@/lib/logging";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const JWT_SECRET = process.env.JWT_SECRET || "";

const CORS_CONFIG = {
  methods: "GET,PUT,PATCH,OPTIONS",
  headers: "Content-Type, Authorization, x-admin-secret",
} as const;

const updateSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    discountPercent: z.number().min(0).max(100).optional(),
    minVisitors: z.number().int().min(1).optional(),
    validFrom: z.string().datetime().optional().nullable(),
    validTo: z.string().datetime().optional().nullable(),
    validDays: z.array(z.number().int().min(0).max(6)).optional().nullable(),
    commissionPercent: z.number().min(0).max(100).optional(),
    qrValiditySeconds: z.number().int().positive().optional(),
    usageLimit: z.number().int().positive().optional().nullable(),
    status: z.enum(["draft", "scheduled", "live", "paused", "expired"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update.",
  });

const actionSchema = z.union([
  z.object({
    action: z.literal("duplicate"),
    overrides: updateSchema.partial().optional(),
  }),
  z.object({
    action: z.literal("status"),
    status: z.enum(["draft", "scheduled", "live", "paused", "expired"]),
  }),
]);

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
  try {
    const deal = await getFlashDeal(id);
    if (!deal) {
      return withCors(NextResponse.json({ error: "Not found" }, { status: 404 }), CORS_CONFIG);
    }
    return withCors(NextResponse.json({ deal: presentFlashDeal(deal) }), CORS_CONFIG);
  } catch (error) {
    log.error("admin_flash_deals_detail_error", error, {
      route: "admin/flash-deals/[id]",
      correlationId: getCorrelationId(req),
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      CORS_CONFIG,
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const req = request as NextRequest;
  if (!isAuthorized(req)) {
    return withCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), CORS_CONFIG);
  }
  if (!verifyCsrf(req)) {
    return withCors(NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }), CORS_CONFIG);
  }

  const { id } = await context.params;
  if (!id) {
    return withCors(NextResponse.json({ error: "Flash deal ID is required" }, { status: 400 }), CORS_CONFIG);
  }
  try {
    const body = await req.json();
    const payload = updateSchema.parse(body ?? {});
    const updated = await updateFlashDeal(id, {
      ...payload,
      usageLimit: payload.usageLimit ?? undefined,
      validDays: payload.validDays ?? undefined,
      validFrom: payload.validFrom ?? undefined,
      validTo: payload.validTo ?? undefined,
      updatedBy: getAuthFromRequest(req)?.email ?? undefined,
    });
    return withCors(NextResponse.json({ deal: presentFlashDeal(updated) }), CORS_CONFIG);
  } catch (error) {
    if (error instanceof z.ZodError) {
      log.warn("admin_flash_deals_update_validation_error", {
        route: "admin/flash-deals/[id]",
        method: req.method,
        correlationId: getCorrelationId(req),
        issues: error.flatten(),
      });
      return withCors(
        NextResponse.json({ error: "ValidationError", issues: error.flatten() }, { status: 400 }),
        CORS_CONFIG,
      );
    }
    log.error("admin_flash_deals_update_error", error, {
      route: "admin/flash-deals/[id]",
      correlationId: getCorrelationId(req),
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      CORS_CONFIG,
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const req = request as NextRequest;
  if (!isAuthorized(req)) {
    return withCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), CORS_CONFIG);
  }
  if (!verifyCsrf(req)) {
    return withCors(NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }), CORS_CONFIG);
  }

  const { id } = await context.params;
  if (!id) {
    return withCors(NextResponse.json({ error: "Flash deal ID is required" }, { status: 400 }), CORS_CONFIG);
  }
  try {
    const body = await req.json();
    const payload = actionSchema.parse(body ?? {});
    if (payload.action === "duplicate") {
      const overrides = payload.overrides
        ? {
            ...payload.overrides,
            validFrom:
              payload.overrides.validFrom === null
                ? undefined
                : payload.overrides.validFrom,
            validTo:
              payload.overrides.validTo === null
                ? undefined
                : payload.overrides.validTo,
            validDays:
              payload.overrides.validDays === null
                ? undefined
                : payload.overrides.validDays,
            usageLimit:
              payload.overrides.usageLimit === null
                ? undefined
                : payload.overrides.usageLimit,
          }
        : undefined;
      const clone = await duplicateFlashDeal(id, overrides ?? {});
      return withCors(
        NextResponse.json({ deal: presentFlashDeal(clone) }, { status: 201 }),
        CORS_CONFIG,
      );
    }

    const updated = await setFlashDealStatus(id, payload.status, getAuthFromRequest(req)?.email ?? undefined);
    return withCors(NextResponse.json({ deal: presentFlashDeal(updated) }), CORS_CONFIG);
  } catch (error) {
    if (error instanceof z.ZodError) {
      log.warn("admin_flash_deals_action_validation_error", {
        route: "admin/flash-deals/[id]",
        method: req.method,
        correlationId: getCorrelationId(req),
        issues: error.flatten(),
      });
      return withCors(
        NextResponse.json({ error: "ValidationError", issues: error.flatten() }, { status: 400 }),
        CORS_CONFIG,
      );
    }
    log.error("admin_flash_deals_action_error", error, {
      route: "admin/flash-deals/[id]",
      correlationId: getCorrelationId(req),
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      CORS_CONFIG,
    );
  }
}
