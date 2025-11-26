import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import jwt from "jsonwebtoken";

import {
  flashDealStatusSchema,
  dealTypeSchema,
  listDealsWithMeta,
  createFlashDeal,
  type DealWithMeta,
} from "@/lib/data/flash-deals";
import { loadPartnerMeta } from "@/lib/data/partners";
import { getAuthFromRequest } from "@/lib/auth/request";
import { log, getCorrelationId } from "@/lib/logging";
import { generateCsrfToken, verifyCsrf } from "@/lib/http/csrf";
import { withCors, preflightResponse } from "@/lib/http/cors";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const JWT_SECRET = process.env.JWT_SECRET || "";

const CORS_CONFIG = {
  methods: "GET,POST,OPTIONS",
  headers: "Content-Type, Authorization, x-admin-secret",
} as const;

const listQuerySchema = z.object({
  partnerId: z.string().optional(),
  status: flashDealStatusSchema.optional(),
  type: dealTypeSchema.optional(),
  search: z.string().optional(),
});

const createPayloadSchema = z.object({
  partnerId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  dealType: dealTypeSchema.default("flash"),
  formId: z.string().min(1).optional().nullable(),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/i, { message: "Slug may only contain letters, numbers, and hyphens." })
    .optional(),
  validFrom: z.string().datetime().optional(),
  validTo: z.string().datetime().optional(),
  validDays: z.array(z.number().int().min(0).max(6)).optional(),
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
    .optional(),
  qrValiditySeconds: z.number().int().positive().default(864000),
  usageLimit: z.number().int().positive().optional(),
  usageLimitDaily: z.number().int().positive().optional(),
  autoExpire: z.boolean().optional(),
  sendReminders: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  audience: z.array(z.string()).optional(),
  ticketTypes: z.array(z.string()).optional(),
  city: z.string().optional(),
  timeZone: z.string().optional(),
  status: flashDealStatusSchema.default("draft"),
  media: z
    .array(
      z.object({
        url: z.string().url(),
        mediaType: z.string().min(1).optional(),
        altText: z.string().optional(),
        sortOrder: z.number().int().optional(),
      }),
    )
    .optional(),
});

function normalizeTicketTypeList(values?: string[] | null): string[] {
  if (!values) return [];
  const result = Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );
  return result;
}

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
    log.warn("admin_deals_auth_failed", {
      error: error instanceof Error ? error.message : String(error),
      correlationId: getCorrelationId(req),
    });
    return false;
  }
}

function presentDeal(entry: DealWithMeta) {
  const { deal, usageStats, media } = entry;
  return {
    id: deal.id,
    partnerId: deal.partner_id,
    isFeatured: deal.is_featured,
    bannerLeadHours: deal.banner_lead_hours,
    ticketRequirements: (deal.ticket_requirements as Array<{ ticketType: string; subType?: string; quantity: number }> | null) ?? [],
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
    formId: deal.form_id ?? null,
    qrValiditySeconds: deal.qr_validity_seconds,
    usageLimit: deal.usage_limit,
    usageLimitDaily: deal.usage_limit_daily,
    usageCount: deal.usage_count,
    autoExpire: deal.auto_expire,
    sendReminders: deal.send_reminders,
    tags: deal.tags,
    audience: deal.audience,
    ticketTypes: deal.ticket_types ?? [],
    timeZone: deal.time_zone,
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

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    log.warn("admin_deals_unauthorized", {
      route: "admin/deals",
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
  const formFilter = params.form;
  const items = await listDealsWithMeta({
    partnerId: filters.partnerId,
    status: filters.status,
    search: filters.search,
    dealType: filters.type,
  });

  const filteredItems =
    formFilter === "linked"
      ? items.filter((entry) => entry.deal.form_id)
      : formFilter === "unlinked"
      ? items.filter((entry) => !entry.deal.form_id)
      : items;

  const response = NextResponse.json({
    items: filteredItems.map(presentDeal),
  });
    response.headers.set("x-csrf-token", generateCsrfToken());
    return withCors(response, CORS_CONFIG);
  } catch (error) {
    const correlationId = getCorrelationId(req);
    if (error instanceof z.ZodError) {
      log.warn("admin_deals_list_validation_error", {
        route: "admin/deals",
        method: req.method,
        correlationId,
        issues: error.flatten(),
      });
      return withCors(
        NextResponse.json({ error: "ValidationError", issues: error.flatten() }, { status: 400 }),
        CORS_CONFIG,
      );
    }

    log.error("admin_deals_list_error", error, {
      route: "admin/deals",
      correlationId,
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      CORS_CONFIG,
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    log.warn("admin_deals_create_unauthorized", {
      route: "admin/deals",
      method: req.method,
      correlationId: getCorrelationId(req),
    });
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
    const body = await req.json();
    const parsed = createPayloadSchema.parse(body ?? {});
    const partnerMeta = await loadPartnerMeta(parsed.partnerId);

    const partnerTicketTypes = normalizeTicketTypeList(
      partnerMeta?.ticketing.ticketTypes ?? [],
    );
    let ticketTypes = normalizeTicketTypeList(parsed.ticketTypes);

    if (partnerTicketTypes.length) {
      ticketTypes =
        ticketTypes.length > 0
          ? ticketTypes.filter((value) => partnerTicketTypes.includes(value))
          : partnerTicketTypes;
    }

    const validityMode: "valid_days" | "date_range" | "always_on" =
      (parsed.validDays && parsed.validDays.length > 0)
        ? "valid_days"
        : parsed.validFrom || parsed.validTo
        ? "date_range"
        : "always_on";

    if (validityMode === "valid_days" && (!parsed.validDays || parsed.validDays.length === 0)) {
      return withCors(
        NextResponse.json(
          { error: "ValidationError", message: "Select at least one valid day." },
          { status: 400 },
        ),
        CORS_CONFIG,
      );
    }

    if (validityMode === "date_range") {
      if (!parsed.validFrom || !parsed.validTo) {
        return withCors(
          NextResponse.json(
            { error: "ValidationError", message: "Both start and end dates are required." },
            { status: 400 },
          ),
          CORS_CONFIG,
        );
      }
      const start = new Date(parsed.validFrom).getTime();
      const end = new Date(parsed.validTo).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        return withCors(
          NextResponse.json(
            { error: "ValidationError", message: "End date must be after start date." },
            { status: 400 },
          ),
          CORS_CONFIG,
        );
      }
    }

    const normalizedRequirements =
      parsed.ticketRequirements?.map((item) => ({
        ticketType: item.ticketType.trim(),
        subType: item.subType?.trim() || undefined,
        quantity: item.quantity,
      })) ?? [];
    const requirementMinimum = normalizedRequirements.reduce(
      (max, item) => Math.max(max, item.quantity),
      0,
    );
    const minVisitors = requirementMinimum > 0 ? requirementMinimum : 1;
    const commissionPercent =
      typeof partnerMeta?.contract.commissionRate === "number"
        ? partnerMeta.contract.commissionRate
        : 0;
    const payload = {
      partnerId: parsed.partnerId,
      title: parsed.title,
      description: parsed.description,
      dealType: "flash" as const,
      slug: parsed.slug,
      discountPercent: 0,
      minVisitors,
      commissionPercent,
      isFeatured: parsed.isFeatured,
      bannerLeadHours: parsed.bannerLeadHours,
      ticketRequirements: normalizedRequirements,
      qrValiditySeconds: parsed.qrValiditySeconds,
      usageLimit: parsed.usageLimit,
      usageLimitDaily: parsed.usageLimitDaily,
      autoExpire: parsed.autoExpire,
      sendReminders: parsed.sendReminders,
      tags: parsed.tags,
      audience: parsed.audience,
      ticketTypes,
      formId: parsed.formId ?? null,
      city: parsed.city,
      status: parsed.status,
      timeZone: parsed.timeZone?.trim(),
      validDays: validityMode === "valid_days" ? parsed.validDays : undefined,
      validFrom: validityMode === "date_range" ? parsed.validFrom : undefined,
      validTo: validityMode === "date_range" ? parsed.validTo : undefined,
      media: parsed.media,
    };
    const auth = getAuthFromRequest(req);
    const created = await createFlashDeal({
      ...payload,
      createdBy: auth?.email ?? undefined,
    });

    log.info("admin_deal_created", {
      dealId: created.id,
      partnerId: created.partner_id,
      dealType: created.deal_type,
      author: auth?.email,
      correlationId: getCorrelationId(req),
    });

    const response = NextResponse.json(
      { deal: presentDeal({ deal: created, usageStats: undefined, media: [] }) },
      { status: 201 },
    );
    response.headers.set("x-csrf-token", generateCsrfToken());
    return withCors(response, CORS_CONFIG);
  } catch (error) {
    const correlationId = getCorrelationId(req);
    if (error instanceof z.ZodError) {
      log.warn("admin_deals_create_validation_error", {
        route: "admin/deals",
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
      log.warn("admin_deals_create_slug_conflict", {
        route: "admin/deals",
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

    log.error("admin_deals_create_error", error, {
      route: "admin/deals",
      correlationId,
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      CORS_CONFIG,
    );
  }
}
