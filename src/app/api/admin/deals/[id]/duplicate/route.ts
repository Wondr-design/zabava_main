import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import jwt from "jsonwebtoken";

import { duplicateFlashDeal, type FlashDealInput } from "@/lib/data/flash-deals";
import { getAuthFromRequest } from "@/lib/auth/request";
import { log, getCorrelationId } from "@/lib/logging";
import { generateCsrfToken, verifyCsrf } from "@/lib/http/csrf";
import { withCors, preflightResponse } from "@/lib/http/cors";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const JWT_SECRET = process.env.JWT_SECRET || "";

const CORS_CONFIG = {
  methods: "POST,OPTIONS",
  headers: "Content-Type, Authorization, x-admin-secret",
} as const;

const overridesSchema = z
  .object({
    partnerId: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    dealType: z.enum(["flash", "weekly_promo", "group"]).optional(),
    slug: z
      .string()
      .regex(/^[a-z0-9-]+$/i, {
        message: "Slug may only contain letters, numbers, and hyphens.",
      })
      .optional(),
    discountPercent: z.number().optional(),
    minVisitors: z.number().int().min(1).optional(),
    validFrom: z.string().datetime().optional(),
    validTo: z.string().datetime().optional(),
    validDays: z.array(z.number().int().min(0).max(6)).optional(),
    commissionPercent: z.number().optional(),
    priceOverrideCzk: z.number().optional(),
    bonusPointsOverride: z.number().optional(),
    qrValiditySeconds: z.number().optional(),
    usageLimit: z.number().optional(),
    usageLimitDaily: z.number().optional(),
    autoExpire: z.boolean().optional(),
    sendReminders: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
    audience: z.array(z.string()).optional(),
    city: z.string().optional(),
    status: z.enum(["draft", "scheduled", "live", "paused", "expired"]).optional(),
  })
  .optional();

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
    log.warn("admin_deal_clone_auth_failed", {
      error: error instanceof Error ? error.message : String(error),
      correlationId: getCorrelationId(req),
    });
    return false;
  }
}

function presentDeal(deal: Awaited<ReturnType<typeof duplicateFlashDeal>>) {
  return {
    id: deal.id,
    partnerId: deal.partner_id,
    dealType: deal.deal_type,
    slug: deal.slug,
    title: deal.title,
    description: deal.description,
    status: deal.status,
    discountPercent: deal.discount_percent,
    minVisitors: deal.min_visitors,
    validFrom: deal.valid_from,
    validTo: deal.valid_to,
    validDays: deal.valid_days,
    commissionPercent: deal.commission_percent,
    priceOverrideCzk: deal.price_override_czk,
    bonusPointsOverride: deal.bonus_points_override,
    qrValiditySeconds: deal.qr_validity_seconds,
    usageLimit: deal.usage_limit,
    usageLimitDaily: deal.usage_limit_daily,
    usageCount: deal.usage_count,
    autoExpire: deal.auto_expire,
    sendReminders: deal.send_reminders,
    tags: deal.tags,
    audience: deal.audience,
    city: deal.city,
    createdAt: deal.created_at,
    updatedAt: deal.updated_at,
  };
}

export function OPTIONS() {
  return preflightResponse(CORS_CONFIG);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthorized(req)) {
    return withCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), CORS_CONFIG);
  }
  if (!verifyCsrf(req)) {
    return withCors(NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }), CORS_CONFIG);
  }

  try {
    const { id } = await params;
    const raw = await req.json().catch(() => null);
    const overrides = overridesSchema.parse(raw ?? undefined);
    const auth = getAuthFromRequest(req);

    const cloned = await duplicateFlashDeal(id, {
      ...(overrides as Partial<FlashDealInput> | undefined),
      status: overrides?.status ?? "draft",
      createdBy: auth?.email ?? undefined,
    });

    log.info("admin_deal_cloned", {
      sourceDealId: id,
      clonedDealId: cloned.id,
      author: auth?.email,
      correlationId: getCorrelationId(req),
    });

    const response = NextResponse.json({ deal: presentDeal(cloned) }, { status: 201 });
    response.headers.set("x-csrf-token", generateCsrfToken());
    return withCors(response, CORS_CONFIG);
  } catch (error) {
    const correlationId = getCorrelationId(req);
    if (error instanceof z.ZodError) {
      log.warn("admin_deal_clone_validation_error", {
        route: "admin/deals/[id]/duplicate",
        method: req.method,
        correlationId,
        issues: error.flatten(),
      });
      return withCors(
        NextResponse.json({ error: "ValidationError", issues: error.flatten() }, { status: 400 }),
        CORS_CONFIG,
      );
    }

    log.error("admin_deal_clone_error", error, {
      route: "admin/deals/[id]/duplicate",
      correlationId,
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      CORS_CONFIG,
    );
  }
}
