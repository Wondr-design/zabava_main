import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import jwt from "jsonwebtoken";

import {
  getDealWithMeta,
  updateFlashDeal,
  flashDealStatusSchema,
  dealTypeSchema,
  type FlashDealUpdate,
} from "@/lib/data/flash-deals";
import { getAuthFromRequest } from "@/lib/auth/request";
import { log, getCorrelationId } from "@/lib/logging";
import { generateCsrfToken, verifyCsrf } from "@/lib/http/csrf";
import { withCors, preflightResponse } from "@/lib/http/cors";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const JWT_SECRET = process.env.JWT_SECRET || "";

const CORS_CONFIG = {
  methods: "GET,PUT,OPTIONS",
  headers: "Content-Type, Authorization, x-admin-secret",
} as const;

const updatePayloadSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    dealType: dealTypeSchema.optional(),
    slug: z
      .string()
      .min(1)
      .regex(/^[a-z0-9-]+$/i, { message: "Slug may only contain letters, numbers, and hyphens." })
      .nullable()
      .optional(),
    // Value & incentives fields are managed automatically and cannot be updated via API
    validFrom: z.string().datetime().nullable().optional(),
    validTo: z.string().datetime().nullable().optional(),
    validDays: z.array(z.number().int().min(0).max(6)).nullable().optional(),
    isFeatured: z.boolean().optional(),
    bannerLeadHours: z.number().int().nonnegative().optional(),
    ticketRequirements: z
      .array(
        z.object({
          ticketType: z.string().min(1),
          subType: z.string().optional(),
          quantity: z.number().int().min(1),
        }),
      )
      .nullable()
      .optional(),
    qrValiditySeconds: z.number().int().positive().optional(),
    usageLimit: z.number().int().positive().nullable().optional(),
    usageLimitDaily: z.number().int().positive().nullable().optional(),
    autoExpire: z.boolean().optional(),
    sendReminders: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
    audience: z.array(z.string()).optional(),
    ticketTypes: z.array(z.string()).optional(),
    city: z.string().nullable().optional(),
    status: flashDealStatusSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "No update fields provided.",
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
    log.warn("admin_deal_auth_failed", {
      error: error instanceof Error ? error.message : String(error),
      correlationId: getCorrelationId(req),
    });
    return false;
  }
}

function presentDeal(entry: Awaited<ReturnType<typeof getDealWithMeta>>) {
  if (!entry) return null;
  const { deal, usageStats, media } = entry;
  return {
    id: deal.id,
    partnerId: deal.partner_id,
    isFeatured: deal.is_featured,
    bannerLeadHours: deal.banner_lead_hours,
    ticketRequirements:
      (deal.ticket_requirements as Array<{ ticketType: string; subType?: string; quantity: number }> | null) ?? [],
    ticketTypes: deal.ticket_types ?? [],
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
    partnerName: entry.partnerName ?? null,
    usageStats: usageStats
      ? {
          qrGenerated: usageStats.qr_generated,
          qrScanned: usageStats.qr_scanned,
          qrRejected: usageStats.qr_rejected,
          commissionCzk: usageStats.commission_czk,
          bonusAwarded: usageStats.bonus_awarded,
          updatedAt: usageStats.updated_at,
        }
      : null,
    media: media
      ? media.map((item) => ({
          id: item.id,
          mediaType: item.media_type,
          url: item.url,
          altText: item.alt_text,
          sortOrder: item.sort_order,
        }))
      : [],
  };
}

export function OPTIONS() {
  return preflightResponse(CORS_CONFIG);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthorized(req)) {
    return withCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), CORS_CONFIG);
  }
  try {
    const { id } = await params;
    const entry = await getDealWithMeta(id);
    if (!entry) {
      return withCors(NextResponse.json({ error: "Not Found" }, { status: 404 }), CORS_CONFIG);
    }
    const response = NextResponse.json({ deal: presentDeal(entry) });
    response.headers.set("x-csrf-token", generateCsrfToken());
    return withCors(response, CORS_CONFIG);
  } catch (error) {
    log.error("admin_deal_fetch_error", error, {
      route: "admin/deals/[id]",
      correlationId: getCorrelationId(req),
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      CORS_CONFIG,
    );
  }
}

export async function PUT(
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
    const body = await req.json();
    const payload = updatePayloadSchema.parse(body ?? {});
    const { slug, ...rest } = payload;
    const updateInput: FlashDealUpdate = { ...(rest as FlashDealUpdate) };
    if (slug !== undefined) {
      updateInput.slug = slug;
    }
    const auth = getAuthFromRequest(req);

    const updated = await updateFlashDeal(id, {
      ...updateInput,
      updatedBy: auth?.email ?? undefined,
    });

    log.info("admin_deal_updated", {
      dealId: updated.id,
      partnerId: updated.partner_id,
      dealType: updated.deal_type,
      author: auth?.email,
      correlationId: getCorrelationId(req),
    });

    const entry = await getDealWithMeta(id);
    const response = NextResponse.json({ deal: presentDeal(entry) });
    response.headers.set("x-csrf-token", generateCsrfToken());
    return withCors(response, CORS_CONFIG);
  } catch (error) {
    const correlationId = getCorrelationId(req);
    if (error instanceof z.ZodError) {
      log.warn("admin_deal_update_validation_error", {
        route: "admin/deals/[id]",
        method: req.method,
        correlationId,
        issues: error.flatten(),
      });
      return withCors(
        NextResponse.json({ error: "ValidationError", issues: error.flatten() }, { status: 400 }),
        CORS_CONFIG,
      );
    }

    const errorCode = (error as { code?: string }).code;
    const errorMessage = (error as { message?: string }).message;
    const duplicateSlug =
      error &&
      typeof error === "object" &&
      ("code" in error || "message" in error) &&
      (errorCode === "duplicate_slug" ||
        (errorCode === "23505" &&
          typeof errorMessage === "string" &&
          errorMessage.includes("flash_deals_slug_unique")));
    if (duplicateSlug) {
      const slug =
        (error as { slug?: string }).slug ??
        ((error as { message?: string }).message?.match(/Key \(slug\)=\(([^)]+)\)/)?.[1] ?? undefined);
      log.warn("admin_deal_update_slug_conflict", {
        route: "admin/deals/[id]",
        slug: slug ?? null,
        correlationId,
      });
      return withCors(
        NextResponse.json(
          {
            error: "DuplicateSlug",
            message: slug ? `Slug "${slug}" is already in use.` : "Slug is already in use.",
            slug: slug ?? null,
          },
          { status: 409 },
        ),
        CORS_CONFIG,
      );
    }

    log.error("admin_deal_update_error", error, {
      route: "admin/deals/[id]",
      correlationId,
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      CORS_CONFIG,
    );
  }
}
