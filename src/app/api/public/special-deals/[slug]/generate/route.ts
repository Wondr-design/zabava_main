import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  getDealWithMetaBySlug,
  recordFlashRedemption,
  getPublicDealBySlug,
} from "@/lib/data/flash-deals";
import { recordQrEvent } from "@/lib/data/qr-events";
import {
  buildVerificationPurpose,
  clearVerification,
  isEmailVerified,
} from "@/lib/data/email-verifications";
import {
  createVisitRegistration,
  type VisitRegistrationRecord,
} from "@/lib/data/visits";
import { generateQrCodeForVisit } from "@/lib/services/qr";
import { getSupabaseAdmin, getSupabaseAdminTyped } from "@/lib/supabase-admin";
import { buildLocalizedPath } from "@/i18n/routing";
import { resolveLocale } from "@/i18n/config";
import { log, getCorrelationId } from "@/lib/logging";
import { notifyQrEmail } from "@/lib/services/notifications/qr-email";
import { loadPartnerBranding } from "@/lib/services/partner-branding";

const bodySchema = z.object({
  email: z.string().email(),
  visitors: z.number().int().positive().max(500),
  ticketBreakdown: z
    .array(
      z.object({
        ticketType: z.string().min(1),
        quantity: z.number().int().min(1),
      }),
    )
    .optional(),
  consentMarketing: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

function resolveBaseUrl(fallback: string) {
  let base = process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL || "";
  if (!base && process.env.VERCEL_URL) {
    base = process.env.VERCEL_URL.startsWith("http")
      ? process.env.VERCEL_URL
      : `https://${process.env.VERCEL_URL}`;
  }
  return base || fallback;
}

function buildVerifyUrl(email: string, visitId: string, origin: string) {
  const base = resolveBaseUrl(origin);
  if (!base) return null;
  const url = new URL("/api/verify", base);
  url.searchParams.set("email", email);
  url.searchParams.set("visitId", visitId);
  return url.toString();
}

function isWithinValidityWindow(validFrom: string | null, validTo: string | null, now: Date) {
  const fromTime = validFrom ? Date.parse(validFrom) : null;
  const toTime = validTo ? Date.parse(validTo) : null;
  if (Number.isFinite(fromTime) && (fromTime as number) > now.getTime()) {
    return false;
  }
  if (Number.isFinite(toTime) && (toTime as number) < now.getTime()) {
    return false;
  }
  return true;
}

function isValidDay(validDays: number[] | null, now: Date) {
  if (!validDays || validDays.length === 0) return true;
  const today = now.getDay();
  return validDays.includes(today);
}

function startOfDayIso(now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizePartnerId(value: string) {
  return value.trim().toLowerCase();
}

async function ensureNoDuplicateRedemption(
  dealId: string,
  email: string,
) {
  const supabase = getSupabaseAdminTyped();
  const { data, error } = await supabase
    .from("flash_deal_redemptions")
    .select("id, metadata, status")
    .eq("flash_deal_id", dealId)
    .eq("status", "pending");

  if (error) {
    throw new Error(`Failed to check existing deal redemptions: ${error.message}`);
  }

  const normalizedEmail = normalizeEmail(email);
  const hasPending = (data ?? []).some((row) => {
    const metadata = row.metadata as Record<string, unknown> | null;
    const storedEmail =
      typeof metadata?.email === "string" ? normalizeEmail(metadata.email) : null;
    return storedEmail === normalizedEmail;
  });
  if (hasPending) {
    throw Object.assign(new Error("Pending redemption already exists for this email."), {
      code: "duplicate_redemption",
    });
  }
}

async function ensureDailyLimitNotExceeded(
  dealId: string,
  usageLimitDaily: number | null,
  now: Date,
) {
  if (!usageLimitDaily || usageLimitDaily <= 0) return;
  const supabase = getSupabaseAdminTyped();
  const { count, error } = await supabase
    .from("flash_deal_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("flash_deal_id", dealId)
    .in("status", ["pending", "used"])
    .gte("created_at", startOfDayIso(now));

  if (error) {
    throw new Error(`Failed to evaluate daily limit: ${error.message}`);
  }

  if ((count ?? 0) >= usageLimitDaily) {
    throw Object.assign(new Error("Daily capacity reached."), {
      code: "daily_limit_reached",
    });
  }
}

function assertDealIsIssuable(
  deal: Awaited<ReturnType<typeof getDealWithMetaBySlug>>,
  now: Date,
  requestedVisitors: number,
) {
  if (!deal) {
    throw Object.assign(new Error("Deal not found"), { code: "not_found" });
  }
  if (deal.deal.status !== "live") {
    throw Object.assign(new Error("Deal is not active"), { code: "inactive" });
  }
  if (!isWithinValidityWindow(deal.deal.valid_from, deal.deal.valid_to, now)) {
    throw Object.assign(new Error("Deal is not currently valid"), { code: "out_of_window" });
  }
  if (!isValidDay(deal.deal.valid_days ?? null, now)) {
    throw Object.assign(new Error("Deal cannot be used today"), { code: "invalid_day" });
  }
  if (requestedVisitors < deal.deal.min_visitors) {
    throw Object.assign(
      new Error(`Minimum ${deal.deal.min_visitors} visitors required.`),
      { code: "min_visitors" },
    );
  }
  if (
    typeof deal.deal.usage_limit === "number" &&
    deal.deal.usage_limit > 0 &&
    deal.deal.usage_count >= deal.deal.usage_limit
  ) {
    throw Object.assign(new Error("Deal capacity exhausted"), { code: "capacity_exhausted" });
  }
}

function buildVisitPayload(
  existing: VisitRegistrationRecord | null,
  base: Record<string, unknown>,
) {
  const payload = existing?.payload && typeof existing.payload === "object"
    ? { ...(existing.payload as Record<string, unknown>) }
    : {};
  return { ...payload, ...base };
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const correlationId = getCorrelationId(req);
  let slugParam = "";
  try {
    const params = await context.params;
    slugParam = params?.slug?.trim() ?? "";
    const slug = slugParam;
    if (!slug) {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "ValidationError", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const dealMeta = await getDealWithMetaBySlug(slug);
    if (!dealMeta || dealMeta.deal.deal_type !== "flash") {
      return NextResponse.json(
        { error: "UnsupportedDeal", message: "Only flash deals can be generated here." },
        { status: 400 },
      );
    }

    const ticketRequirements = (dealMeta.deal.ticket_requirements ??
      []) as Array<{ ticketType: string; subType?: string; quantity: number }>;
    let normalizedTicketBreakdown: Array<{ ticketType: string; subType?: string; quantity: number }> | null =
      null;

    if (ticketRequirements.length > 0) {
      const breakdown = parsed.data.ticketBreakdown ?? [];
      if (breakdown.length !== 1) {
        return NextResponse.json(
          { error: "ValidationError", message: "Select a single ticket type to continue." },
          { status: 400 },
        );
      }
      const normalizedReq = ticketRequirements.map((item) => ({
        ticketType: item.ticketType.trim().toLowerCase(),
        subType: item.subType?.trim().toLowerCase() || "",
        quantity: item.quantity,
      }));
      const reqMap = new Map(
        normalizedReq.map((item) => [`${item.ticketType}::${item.subType}`, item.quantity]),
      );
      const selection = breakdown[0];
      const selectionKey = `${selection.ticketType.trim().toLowerCase()}::${(
        (selection as { subType?: string }).subType ?? ""
      )
        .trim()
        .toLowerCase()}`;
      const expectedQuantity = reqMap.get(selectionKey);
      if (!expectedQuantity || selection.quantity !== expectedQuantity) {
        return NextResponse.json(
          { error: "ValidationError", message: "Selected ticket type does not match the requirement." },
          { status: 400 },
        );
      }
      const safeTicketType = selection.ticketType.trim();
      const safeSubType = (selection as { subType?: string }).subType?.trim() || undefined;
      normalizedTicketBreakdown = [
        {
          ticketType: safeTicketType,
          subType: safeSubType,
          quantity: expectedQuantity,
        },
      ];
      parsed.data.visitors = expectedQuantity;
      assertDealIsIssuable(dealMeta, new Date(), expectedQuantity);
    } else {
      assertDealIsIssuable(dealMeta, new Date(), parsed.data.visitors);
    }

    const publicDeal = await getPublicDealBySlug(slug);
    if (!publicDeal || !publicDeal.isActive) {
      return NextResponse.json(
        { error: "DealUnavailable", message: "This deal is not currently active." },
        { status: 409 },
      );
    }

    const now = new Date();
    await ensureDailyLimitNotExceeded(
      publicDeal.id,
      dealMeta?.deal.usage_limit_daily ?? null,
      now,
    );

    const normalizedEmail = normalizeEmail(parsed.data.email);
    await ensureNoDuplicateRedemption(publicDeal.id, normalizedEmail);

    const purpose = buildVerificationPurpose({
      partnerId: dealMeta?.deal.partner_id ?? "",
      type: "visit",
    });
    const verified = await isEmailVerified({
      email: normalizedEmail,
      purpose,
    });
    if (!verified) {
      return NextResponse.json(
        { error: "EmailNotVerified" },
        { status: 401 },
      );
    }

    const submissionId = `flash:${randomUUID()}`;
    const locale = resolveLocale(req.headers.get("x-locale"));
    const baseOrigin = req.nextUrl.origin;
    const resolvedBaseUrl = resolveBaseUrl(baseOrigin);

    const visitPayload = buildVisitPayload(null, {
      source: "special_flash_deal",
      dealId: publicDeal.id,
      dealSlug: publicDeal.slug,
      dealTitle: publicDeal.title,
      partnerName: publicDeal.partnerName ?? dealMeta?.deal.partner_id ?? "",
      dealType: publicDeal.dealType,
      visitors: parsed.data.visitors,
      ticketRequirements: ticketRequirements,
      ticketBreakdown:
        ticketRequirements.length > 0
          ? normalizedTicketBreakdown ?? null
          : parsed.data.ticketBreakdown ?? null,
      consentMarketing: parsed.data.consentMarketing ?? false,
      extraMetadata: parsed.data.metadata ?? {},
    });

    const normalizedPartnerIdValue = normalizePartnerId(
      dealMeta?.deal.partner_id ?? "",
    );

    const supabase = getSupabaseAdmin();
    const partnerBranding = normalizedPartnerIdValue
      ? await loadPartnerBranding(normalizedPartnerIdValue, supabase)
      : { initial: undefined, accentColor: undefined, logoUrl: undefined };

    const visit = await createVisitRegistration({
      email: normalizedEmail,
      partnerId: normalizedPartnerIdValue,
      status: "pending",
      submissionId,
      qrType: "flash",
      payload: visitPayload,
      estimatedPoints: 0,
      pointsAwarded: 0,
      totalPrice: undefined,
      numPeople: parsed.data.visitors,
      hasRedemption: true,
      categories: "special_flash_deal",
    });

    const verifyUrl = buildVerifyUrl(normalizedEmail, visit.id, resolvedBaseUrl);
    const staffScanUrl = new URL(
      buildLocalizedPath(`/staff/scan/${visit.id}`, locale),
      resolvedBaseUrl,
    ).toString();

    let qrInfo: { url: string | null; expiresAt: string | null; path: string | null } = {
      url: null,
      expiresAt: null,
      path: null,
    };

    if (verifyUrl) {
      try {
        const qr = await generateQrCodeForVisit(
          verifyUrl,
          visit.id,
          dealMeta?.deal.qr_validity_seconds ?? undefined,
          {
            badgeLabel: partnerBranding.initial,
            badgeColor: partnerBranding.accentColor,
            matrixColor: partnerBranding.accentColor,
            badgeIconUrl: partnerBranding.logoUrl ?? undefined,
            qrVariant: "flash",
          },
        );
        qrInfo = { url: qr.url, expiresAt: qr.expiresAt, path: qr.path };

        const nextPayload = buildVisitPayload(visit, {
          ...visitPayload,
          verifyUrl,
          qrCodeUrl: qr.url,
          qrCodeExpiresAt: qr.expiresAt,
          qrStoragePath: qr.path,
          staffScanUrl,
        });
        await supabase
          .from("visit_registrations")
          .update({
            payload: nextPayload as unknown as never,
            updated_at: new Date().toISOString(),
          } as unknown as never)
          .eq("id", visit.id);
      } catch (error) {
        log.error("public_deal_qr_error", error, {
          visitId: visit.id,
          dealId: publicDeal.id,
          correlationId,
        });
      }
    }

    await recordFlashRedemption({
      flashDealId: publicDeal.id,
      visitId: visit.id,
      status: "pending",
      metadata: {
        email: normalizedEmail,
        visitors: parsed.data.visitors,
        ticketBreakdown: parsed.data.ticketBreakdown ?? null,
        ticketRequirements,
        consentMarketing: parsed.data.consentMarketing ?? false,
        dealSlug: publicDeal.slug,
        qrCodeUrl: qrInfo.url,
        qrStoragePath: qrInfo.path,
      },
    });

    await recordQrEvent({
      eventType: "generated",
      qrType: "flash",
      flashDealId: publicDeal.id,
      visitId: visit.id,
      source: "public_special_deals",
      metadata: {
        email: normalizedEmail,
        visitors: parsed.data.visitors,
        slug: publicDeal.slug,
        ticketBreakdown: parsed.data.ticketBreakdown ?? null,
      },
    });

    await clearVerification({ email: normalizedEmail, purpose });

    log.info("public_deal_redemption_created", {
      dealId: publicDeal.id,
      visitId: visit.id,
      email: normalizedEmail,
      correlationId,
    });

    await notifyQrEmail({
      type: "deal",
      email: normalizedEmail,
      visitId: visit.id,
      submissionId,
      verifyUrl,
      qrUrl: qrInfo.url,
      qrExpiresAt: qrInfo.expiresAt,
      qrStoragePath: qrInfo.path,
      partnerId: normalizedPartnerIdValue || null,
      partner: {
        id: normalizedPartnerIdValue || null,
        name: publicDeal.partnerName ?? dealMeta?.deal.partner_id ?? null,
        displayName: publicDeal.partnerName ?? dealMeta?.deal.partner_id ?? null,
      },
      staffScanUrl,
      locale,
      payload: {
        request: {
          visitors: parsed.data.visitors,
          consentMarketing: parsed.data.consentMarketing ?? false,
          metadata: parsed.data.metadata ?? {},
        },
        visitPayload,
        deal: {
          id: publicDeal.id,
          slug: publicDeal.slug,
          title: publicDeal.title,
          partnerName: publicDeal.partnerName ?? null,
          discountPercent: publicDeal.discountPercent ?? null,
        },
      },
      metadata: {
        source: visitPayload.source ?? "special_flash_deal",
        dealId: publicDeal.id,
        usageType: "deal",
      },
      extras: {
        visitors: parsed.data.visitors,
        consentMarketing: parsed.data.consentMarketing ?? false,
        submissionId,
      },
    });

    return NextResponse.json(
      {
        success: true,
        visitId: visit.id,
        verifyUrl,
        qrCodeUrl: qrInfo.url,
        qrCodeExpiresAt: qrInfo.expiresAt,
        staffScanUrl,
        deal: {
          id: publicDeal.id,
          title: publicDeal.title,
          partnerName: publicDeal.partnerName ?? dealMeta?.deal.partner_id ?? "",
          discountPercent: publicDeal.discountPercent,
          minVisitors: publicDeal.minVisitors,
          validFrom: publicDeal.validFrom,
          validTo: publicDeal.validTo,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const code = (error as { code?: string }).code;
    const status =
      code === "not_found"
        ? 404
        : code === "inactive" ||
          code === "out_of_window" ||
          code === "invalid_day" ||
          code === "min_visitors" ||
          code === "capacity_exhausted" ||
          code === "daily_limit_reached" ||
          code === "duplicate_redemption"
        ? 409
        : 500;
    const message =
      error instanceof Error ? error.message : "Internal server error";
    if (status === 500) {
      log.error("public_deal_generate_error", error, {
        dealSlug: slugParam,
        correlationId,
      });
    }
    return NextResponse.json({ error: message, code }, { status });
  }
}
