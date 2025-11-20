import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { withCors, preflightResponse } from "@/lib/http/cors";
import { log, getCorrelationId } from "@/lib/logging";
import { getRewardById } from "@/lib/data/rewards";
import { getTotalPointsForEmail } from "@/lib/data/points";
import { createRedemption } from "@/lib/data/redemptions";
import { getPartnerFormById } from "@/lib/data/partner-forms";
import {
  computePartnerFormMetrics,
  estimatePointsFromMetrics,
} from "@/lib/services/partner-form-metrics";
import { createVisitRegistration } from "@/lib/data/visits";
import { generateQrCodeForVisit } from "@/lib/services/qr";
import { resolveLocale } from "@/i18n/config";
import { buildLocalizedPath } from "@/i18n/routing";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  buildVerificationPurpose,
  isEmailVerified,
} from "@/lib/data/email-verifications";
import { notifyQrEmail } from "@/lib/services/notifications/qr-email";
import { loadPartnerBranding } from "@/lib/services/partner-branding";

const CORS_CONFIG = {
  methods: "POST, OPTIONS",
  headers: "Content-Type",
} as const;

const ACTIVE_REDEMPTION_STATUSES = ["pending", "applied", "used"] as const;

const formPayloadSchema = z.object({
  values: z.record(z.string(), z.any()),
  hidden: z.record(z.string(), z.any()).optional(),
  labels: z.record(z.string(), z.string()).optional(),
});

const postSchema = z.object({
  email: z.string().email(),
  rewardId: z.string().min(1),
  form: formPayloadSchema.optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

type FormPayload = z.infer<typeof formPayloadSchema>;

function utcDateValue(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function OPTIONS() {
  return preflightResponse(CORS_CONFIG);
}

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

function normalizeString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

function inferPartnerId(args: {
  formRecord: Awaited<ReturnType<typeof getPartnerFormById>>;
  formPayload: FormPayload | null;
  rewardAvailable: string[];
  requestMetadata?: Record<string, unknown>;
}) {
  const candidates: string[] = [];

  if (args.formRecord?.partnerId) {
    candidates.push(args.formRecord.partnerId);
  }
  const configPartnerId = args.formRecord?.config?.partner?.id;
  if (configPartnerId) {
    candidates.push(configPartnerId);
  }

  const hidden = args.formPayload?.hidden ?? {};
  for (const key of ["partnerId", "partner_id", "partner", "partnerID"]) {
    const hiddenValue = hidden[key];
    if (typeof hiddenValue === "string") {
      candidates.push(hiddenValue);
    }
  }

  const values = args.formPayload?.values ?? {};
  for (const key of ["partnerId", "partner_id", "partner"]) {
    const value = values[key];
    if (typeof value === "string") {
      candidates.push(value);
    }
  }

  const metaPartner =
    typeof args.requestMetadata?.partnerId === "string"
      ? args.requestMetadata.partnerId
      : null;
  if (metaPartner) {
    candidates.push(metaPartner);
  }

  if (args.rewardAvailable.length === 1) {
    candidates.push(args.rewardAvailable[0]);
  }

  for (const candidate of candidates) {
    const normalized = normalizeString(candidate);
    if (normalized) return normalized;
  }

  return null;
}

type TicketSelection = {
  id: string;
  quantity: number;
  points: number | null;
};

function parseTicketSelections(formPayload: FormPayload | null) {
  const rawSelections =
    (formPayload?.values?.__ticketSelections as unknown) ??
    (formPayload?.hidden?.__ticketSelections as unknown);
  if (!Array.isArray(rawSelections)) return [];
  return rawSelections
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const obj = entry as Record<string, unknown>;
      const id =
        typeof obj.id === "string" && obj.id.trim().length > 0
          ? obj.id.trim()
          : null;
      const quantity =
        typeof obj.quantity === "number"
          ? obj.quantity
          : Number(obj.quantity ?? 0);
      if (!id || !Number.isFinite(quantity) || quantity <= 0) return null;
      const points =
        typeof obj.points === "number"
          ? obj.points
          : Number(obj.points ?? NaN);
      return {
        id,
        quantity: Math.max(1, Math.floor(quantity)),
        points: Number.isFinite(points) ? points : null,
      } satisfies TicketSelection;
    })
    .filter((entry): entry is TicketSelection => entry !== null);
}

export async function POST(req: NextRequest) {
  const correlationId = getCorrelationId(req);
  const supabase = getSupabaseAdmin();
  try {
    const rawBody = await req.json().catch(() => ({}));
    const parsed = postSchema.safeParse(rawBody ?? {});
    if (!parsed.success) {
      return withCors(
        NextResponse.json(
          { error: "ValidationError", details: parsed.error.flatten() },
          { status: 400 }
        ),
        CORS_CONFIG
      );
    }

    const { email, rewardId, form, metadata } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();
    const rewardResp = await getRewardById(rewardId);
    const reward = rewardResp?.reward ?? null;

    if (!reward || reward.status !== "active" || reward.isAvailable === false) {
      log.warn("bonus_reward_unavailable", {
        rewardId,
        correlationId,
      });
      return withCors(
        NextResponse.json({ error: "Reward unavailable" }, { status: 404 }),
        CORS_CONFIG
      );
    }

    // Enforce availability window and monthly redemption limit
    const now = new Date();
    const nowDateValue = utcDateValue(now);
    if (reward.validFrom) {
      const startsAt = new Date(reward.validFrom);
      if (!Number.isNaN(startsAt.getTime())) {
        const startDateValue = utcDateValue(startsAt);
        if (startDateValue > nowDateValue) {
          return withCors(
            NextResponse.json(
              { error: "Reward not yet available" },
              { status: 403 }
            ),
            CORS_CONFIG
          );
        }
      }
    }
    if (reward.validUntil) {
      const expiresAt = new Date(reward.validUntil);
      if (!Number.isNaN(expiresAt.getTime())) {
        const endDateValue = utcDateValue(expiresAt);
        if (nowDateValue > endDateValue) {
          return withCors(
            NextResponse.json(
              { error: "Reward is no longer available" },
              { status: 410 }
            ),
            CORS_CONFIG
          );
        }
      }
    }
    if (
      typeof reward.monthlyRedemptionLimit === "number" &&
      reward.monthlyRedemptionLimit > 0
    ) {
      const startOfMonth = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
      );
      const { count, error: limitError } = await supabase
        .from("redemptions")
        .select("id", { count: "exact", head: true })
        .eq("reward_id", reward.id)
        .gte("created_at", startOfMonth.toISOString())
        .in("status", ACTIVE_REDEMPTION_STATUSES);
      if (limitError) {
        log.error("bonus_reward_limit_check_failed", limitError, {
          rewardId: reward.id,
          correlationId,
        });
        return withCors(
          NextResponse.json(
            { error: "Failed to verify reward limit" },
            { status: 500 }
          ),
          CORS_CONFIG
        );
      }
      if ((count ?? 0) >= reward.monthlyRedemptionLimit) {
        return withCors(
          NextResponse.json(
            { error: "Reward monthly redemption limit reached" },
            { status: 409 }
          ),
          CORS_CONFIG
        );
      }
    }

    if (
      typeof reward.dailyRedemptionLimit === "number" &&
      reward.dailyRedemptionLimit > 0
    ) {
      const startOfDay = new Date(now);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const dayIso = startOfDay.toISOString();
      const { count, error: dailyError } = await supabase
        .from("redemptions")
        .select("id", { count: "exact", head: true })
        .eq("reward_id", reward.id)
        .gte("created_at", dayIso)
        .in("status", ACTIVE_REDEMPTION_STATUSES);
      if (dailyError) {
        log.error("bonus_reward_daily_limit_check_failed", dailyError, {
          rewardId: reward.id,
          correlationId,
        });
        return withCors(
          NextResponse.json(
            { error: "Failed to verify daily reward limit" },
            { status: 500 }
          ),
          CORS_CONFIG
        );
      }
      if ((count ?? 0) >= reward.dailyRedemptionLimit) {
        return withCors(
          NextResponse.json(
            { error: "Reward daily redemption limit reached" },
            { status: 409 }
          ),
          CORS_CONFIG
        );
      }
    }

    if (typeof reward.stock === "number" && reward.stock > 0) {
      let windowStartIso: string | null = null;
      if (reward.stockWindowDays && reward.stockWindowDays > 0) {
        const windowStart = new Date(now);
        windowStart.setUTCDate(
          windowStart.getUTCDate() - reward.stockWindowDays
        );
        windowStartIso = windowStart.toISOString();
      } else if (reward.validFrom) {
        windowStartIso = reward.validFrom;
      }
      const stockQuery = supabase
        .from("redemptions")
        .select("id", { count: "exact", head: true })
        .eq("reward_id", reward.id)
        .in("status", ACTIVE_REDEMPTION_STATUSES);
      if (windowStartIso) {
        stockQuery.gte("created_at", windowStartIso);
      }
      const { count: stockCount, error: stockError } = await stockQuery;
      if (stockError) {
        log.error("bonus_reward_stock_check_failed", stockError, {
          rewardId: reward.id,
          correlationId,
        });
        return withCors(
          NextResponse.json(
            { error: "Failed to verify reward stock" },
            { status: 500 }
          ),
          CORS_CONFIG
        );
      }
      if ((stockCount ?? 0) >= reward.stock) {
        return withCors(
          NextResponse.json(
            { error: "Reward is out of stock" },
            { status: 409 }
          ),
          CORS_CONFIG
        );
      }
    }

    const purpose = buildVerificationPurpose({ type: "bonus" });
    const verified = await isEmailVerified({
      email: normalizedEmail,
      purpose,
    });
    if (!verified) {
      return withCors(
        NextResponse.json(
          { error: "Email verification required" },
          { status: 401 }
        ),
        CORS_CONFIG
      );
    }

    // Determine partner ID first to get accurate points cost and form
    const availablePartners = Array.isArray(reward.availableFor)
      ? reward.availableFor.map((id) => normalizeString(id))
      : [];

    // Infer partner ID from form data/metadata
    let partnerId: string | null = null;
    if (form) {
      partnerId = inferPartnerId({
        formRecord: null, // Will be set below after we get the form
        formPayload: form,
        rewardAvailable: reward.availableFor ?? [],
        requestMetadata: metadata ?? {},
      });
    }

    // Also check metadata for partner ID
    if (!partnerId && metadata?.partnerId) {
      partnerId = normalizeString(metadata.partnerId);
    }

    // If only one partner available, use that
    if (!partnerId && availablePartners.length === 1) {
      partnerId = availablePartners[0];
    }

    // Partner validation and points check happens after form is loaded (see below)

    // Get partner-specific form
    let formId: string | null = null;
    if (partnerId && reward.partnerConfigs) {
      const partnerConfig = reward.partnerConfigs.get(partnerId);
      if (partnerConfig?.formId) {
        formId = partnerConfig.formId;
      }
    }

    // Fallback to default form if no partner-specific form (for backward compatibility)
    if (!formId) {
      formId = reward.redemptionFormId ?? null;
    }

    if (!formId) {
      log.warn("bonus_reward_missing_form", {
        rewardId,
        partnerId,
        correlationId,
      });
      return withCors(
        NextResponse.json(
          { error: "Reward is missing a redemption form for this partner" },
          { status: 422 }
        ),
        CORS_CONFIG
      );
    }

    const formRecord = await getPartnerFormById(formId);
    if (!formRecord || formRecord.status !== "published") {
      log.warn("bonus_reward_form_unavailable", {
        rewardId,
        partnerId,
        formId,
        correlationId,
      });
      return withCors(
        NextResponse.json(
          { error: "Redemption form unavailable" },
          { status: 409 }
        ),
        CORS_CONFIG
      );
    }

    const dynamicForm = form ?? null;
    if (!dynamicForm) {
      return withCors(
        NextResponse.json(
          { error: "Form submission required" },
          { status: 400 }
        ),
        CORS_CONFIG
      );
    }

    // Re-infer partner ID now that we have the form (more accurate)
    const finalPartnerId =
      inferPartnerId({
        formRecord,
        formPayload: dynamicForm,
        rewardAvailable: reward.availableFor ?? [],
        requestMetadata: metadata ?? {},
      }) ?? partnerId;

    // Use the final partner ID
    partnerId = finalPartnerId ?? partnerId;

    // Final check: verify partner is allowed and check points
    if (availablePartners.length > 0) {
      if (!partnerId || !availablePartners.includes(partnerId)) {
        log.warn("bonus_reward_partner_mismatch", {
          rewardId,
          providedPartner: partnerId,
          allowed: availablePartners,
          correlationId,
        });
        return withCors(
          NextResponse.json(
            {
              error: "Reward not available for the selected partner",
              allowedPartners: availablePartners,
              providedPartnerId: partnerId,
            },
            { status: 400 }
          ),
          CORS_CONFIG
        );
      }
    }

    if (!partnerId) {
      log.warn("bonus_reward_partner_missing", {
        rewardId,
        formId: formRecord.id,
        correlationId,
      });
      return withCors(
        NextResponse.json(
          { error: "Unable to determine partner for this reward" },
          { status: 400 }
        ),
        CORS_CONFIG
      );
    }

    // Calculate actual points cost (partner/ ticket-specific or default)
    const ticketSelections = parseTicketSelections(dynamicForm);
    let actualPointsCost = reward.pointsCost;

    // Check ticket points if ticket type is available
    const formMetrics = computePartnerFormMetrics(
      formRecord.config,
      dynamicForm.values
    );
    const normalizedTicketType =
      reward.ticketType?.trim() || formMetrics.ticketType || null;
    if (normalizedTicketType) {
      formMetrics.ticketType = normalizedTicketType;
    }
    if (reward.transportIncluded) {
      formMetrics.transportChoice = "included";
      formMetrics.transportSelected = true;
    }

    // Ticket points priority: explicit selections -> partner config tickets -> reward ticketPoints -> base pointsCost
    if (ticketSelections.length > 0) {
      const partnerTickets =
        partnerId && reward.partnerConfigs
          ? reward.partnerConfigs.get(partnerId)?.tickets ?? []
          : [];
      const totalPoints = ticketSelections
        .map((sel) => {
          const matched =
            partnerTickets.find(
              (t) => t.key.toLowerCase() === sel.id.toLowerCase()
            ) ||
            reward.ticketPoints?.find(
              (tp) => tp.value.toLowerCase() === sel.id.toLowerCase()
            );
          const perUnit =
            matched?.points ??
            (typeof sel.points === "number" ? sel.points : null);
          return perUnit !== null ? perUnit * sel.quantity : null;
        })
        .filter((val): val is number => val !== null);
      if (totalPoints.length > 0) {
        actualPointsCost = totalPoints.reduce((sum, val) => sum + val, 0);
      }
    } else if (normalizedTicketType) {
      if (partnerId && reward.partnerConfigs?.get(partnerId)?.tickets) {
        const partnerTicket = reward.partnerConfigs
          .get(partnerId)
          ?.tickets.find(
            (t) => t.key.toLowerCase() === normalizedTicketType.toLowerCase()
          );
        if (partnerTicket) {
          actualPointsCost = partnerTicket.points;
        }
      }
      if (reward.ticketPoints && reward.ticketPoints.length > 0) {
        const ticketPointEntry = reward.ticketPoints.find(
          (tp) => tp.value.toLowerCase() === normalizedTicketType.toLowerCase()
        );
        if (ticketPointEntry) {
          actualPointsCost = ticketPointEntry.points;
        }
      }
    }

    // Final points check with actual cost
    const availablePointsFinal = await getTotalPointsForEmail(normalizedEmail);
    if (availablePointsFinal < actualPointsCost) {
      log.info("bonus_redeem_insufficient_points", {
        email: normalizedEmail,
        rewardId,
        partnerId,
        required: actualPointsCost,
        available: availablePointsFinal,
        correlationId,
      });
      return withCors(
        NextResponse.json(
          {
            error: "Insufficient points",
            required: actualPointsCost,
            available: availablePointsFinal,
          },
          { status: 403 }
        ),
        CORS_CONFIG
      );
    }

    const estimatedPoints = estimatePointsFromMetrics(formMetrics) ?? 0;

    const metadataPayload = {
      ...(metadata ?? {}),
      rewardTicketType: normalizedTicketType,
      rewardTransportIncluded: reward.transportIncluded,
    };

    const visitPayload: Record<string, unknown> = {
      source: "bonus_portal",
      submittedAt: new Date().toISOString(),
      form: dynamicForm,
      metadata: metadataPayload,
      rewardId: reward.id,
      rewardName: reward.name,
      rewardTicketType: normalizedTicketType,
      rewardTransportIncluded: reward.transportIncluded,
    };

    visitPayload.formMetrics = formMetrics;
    visitPayload.formId = formRecord.id;
    visitPayload.formName = formRecord.name;
    visitPayload.formSlug = formRecord.slug;
    visitPayload.formVersion = formRecord.embedVersion;
    visitPayload.partnerId = partnerId;
    if (ticketSelections.length > 0) {
      visitPayload.ticketSelections = ticketSelections;
    }

    const submissionId = `bonus:${randomUUID()}`;
    const visit = await createVisitRegistration({
      email: normalizedEmail,
      partnerId,
      status: "pending",
      submissionId,
      qrType: "bonus",
      rewardId: reward.id,
      payload: visitPayload,
      estimatedPoints,
      pointsAwarded: 0,
      totalPrice:
        formMetrics.totalPrice !== null ? formMetrics.totalPrice : undefined,
      numPeople: formMetrics.numPeople ?? 1,
      ticketType: normalizedTicketType ?? undefined,
      transport: reward.transportIncluded
        ? "included"
        : formMetrics.transportChoice ?? undefined,
      categories:
        Array.isArray(reward.tags) && reward.tags.length > 0
          ? reward.tags.join(",")
          : undefined,
      hasRedemption: true,
      redemptionReward: reward.name,
      redemptionValue: actualPointsCost,
    });

    const resolvedBaseUrl = resolveBaseUrl(req.nextUrl.origin);
    const locale = resolveLocale(req.headers.get("x-locale"));
    const verifyUrl =
      visit.id && normalizedEmail
        ? buildVerifyUrl(normalizedEmail, visit.id, resolvedBaseUrl)
        : null;
    const staffScanUrl =
      visit.id && resolvedBaseUrl
        ? new URL(
            buildLocalizedPath(`/staff/scan/${visit.id}`, locale),
            resolvedBaseUrl
          ).toString()
        : null;

    const partnerBranding = await loadPartnerBranding(partnerId, supabase);
    const existingPayload = (visit.payload ?? {}) as Record<string, unknown>;
    const basePayload = {
      ...existingPayload,
      staffScanUrl,
    };

    const redemptionMetadata: Record<string, unknown> = {
      visitId: visit.id,
      submissionId,
      verifyUrl,
      staffScanUrl,
      partnerId,
      baseUrl: resolvedBaseUrl,
      formValues: dynamicForm.values,
      formHidden: dynamicForm.hidden ?? {},
      formLabels: dynamicForm.labels ?? {},
      rewardHeroImages: reward.heroImages,
      rewardSavingsValue: reward.savingsValue,
      rewardTicketType: normalizedTicketType,
      rewardTransportIncluded: reward.transportIncluded,
    };

    const { code, redemption } = await createRedemption({
      email: normalizedEmail,
      rewardId: reward.id,
      partnerId,
      visitId: visit.id,
      metadata: redemptionMetadata,
    });

    let qrInfo: {
      url: string | null;
      expiresAt: string | null;
      path: string | null;
    } = { url: null, expiresAt: null, path: null };

    if (verifyUrl && visit.id) {
      try {
        const qr = await generateQrCodeForVisit(
          verifyUrl,
          visit.id,
          formRecord.config.qrExpiresInSeconds,
          {
            badgeLabel: partnerBranding.initial,
            badgeColor: partnerBranding.accentColor,
            matrixColor: partnerBranding.accentColor,
            footerLabel: "Reward",
            badgeIconUrl: partnerBranding.logoUrl ?? undefined,
            qrVariant: "reward",
          }
        );
        qrInfo = {
          url: qr.url,
          expiresAt: qr.expiresAt,
          path: qr.path,
        };
      } catch (error) {
        log.error("bonus_reward_qr_error", error, {
          visitId: visit.id,
          correlationId,
        });
      }
    }

    const finalPayload = {
      ...basePayload,
      verifyUrl,
      qrCodeUrl: qrInfo.url,
      qrCodeExpiresAt: qrInfo.expiresAt,
      qrStoragePath: qrInfo.path,
      redemptionCode: code,
      redemptionSummary: {
        code,
        rewardName: reward.name,
        pointsCost: actualPointsCost,
        redeemedAt: redemption?.applied_at ?? redemption?.created_at ?? null,
      },
    };

    redemptionMetadata.qrCodeUrl = qrInfo.url;
    redemptionMetadata.qrCodeExpiresAt = qrInfo.expiresAt;
    redemptionMetadata.qrStoragePath = qrInfo.path;

    await supabase
      .from("visit_registrations")
      .update({
        payload: finalPayload as unknown as never,
        redemption_code: code,
        has_redemption: true,
        redemption_reward: reward.name,
        redemption_value: actualPointsCost,
        updated_at: new Date().toISOString(),
      } as unknown as never)
      .eq("id", visit.id);

    log.info("bonus_reward_redeemed", {
      email: normalizedEmail,
      rewardId: reward.id,
      code,
      visitId: visit.id,
      correlationId,
    });

    await notifyQrEmail({
      type: "reward",
      email: normalizedEmail,
      visitId: visit.id,
      submissionId,
      verifyUrl,
      qrUrl: qrInfo.url,
      qrExpiresAt: qrInfo.expiresAt,
      qrStoragePath: qrInfo.path,
      partnerId: partnerId ?? null,
      partner: partnerId
        ? {
            id: partnerId,
            name: formRecord.config?.partner?.name ?? formRecord.name ?? null,
            displayName: formRecord.name ?? null,
          }
        : null,
      staffScanUrl,
      locale,
      payload: {
        form: dynamicForm,
        metadata: metadata ?? {},
        storedPayload: visitPayload,
        reward: {
          id: reward.id,
          name: reward.name,
          pointsCost: actualPointsCost,
          savingsValue: reward.savingsValue ?? null,
          tags: reward.tags ?? null,
          ticketType: normalizedTicketType,
          transportIncluded: reward.transportIncluded,
        },
        formRecord: {
          id: formRecord.id,
          name: formRecord.name,
          slug: formRecord.slug,
          version: formRecord.embedVersion,
        },
      },
      metadata: {
        source: visitPayload.source ?? "bonus_portal",
        rewardId: reward.id,
        usageType: "reward",
      },
      extras: {
        submissionId,
        redemptionCode: code,
        redemptionStatus: redemption?.status ?? "applied",
        qrExpiresAt: qrInfo.expiresAt,
      },
    });

    return withCors(
      NextResponse.json(
        {
          success: true,
          message: "Reward redeemed successfully",
          redemption: {
            code,
            rewardName: reward.name,
            pointsSpent: actualPointsCost,
            partnerId,
            status: redemption?.status ?? "applied",
            appliedAt: redemption?.applied_at ?? null,
            expiresAt: redemption?.expires_at ?? null,
            email: normalizedEmail,
            visitId: visit.id,
            verifyUrl,
            qrCodeUrl: qrInfo.url,
            qrCodeExpiresAt: qrInfo.expiresAt,
            staffScanUrl,
            form: {
              values: dynamicForm.values,
              labels: dynamicForm.labels ?? {},
            },
          },
        },
        { status: 200 }
      ),
      CORS_CONFIG
    );
  } catch (err) {
    if (err instanceof ZodError) {
      log.warn("bonus_redeem_validation_error", {
        issues: err.flatten?.(),
        correlationId,
      });
      return withCors(
        NextResponse.json(
          { error: "ValidationError", details: err.flatten() },
          { status: 400 }
        ),
        CORS_CONFIG
      );
    }

    log.error("bonus_redeem_error", err, { correlationId });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      CORS_CONFIG
    );
  }
}
