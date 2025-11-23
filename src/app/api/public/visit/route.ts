import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  createVisitRegistration,
  estimateVisitPoints,
} from "@/lib/data/visits";
import { getPartnerFormById } from "@/lib/data/partner-forms";
import { getDealWithMeta } from "@/lib/data/flash-deals";
import {
  buildVerificationPurpose,
  isEmailVerified,
  clearVerification,
} from "@/lib/data/email-verifications";
import { generateQrCodeForVisit } from "@/lib/services/qr";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { log, getCorrelationId } from "@/lib/logging";
import { preflightResponse, withCors } from "@/lib/http/cors";
import { computePartnerFormMetrics } from "@/lib/services/partner-form-metrics";
import { resolveLocale } from "@/i18n/config";
import { buildLocalizedPath } from "@/i18n/routing";
import { notifyQrEmail } from "@/lib/services/notifications/qr-email";
import { loadPartnerBranding } from "@/lib/services/partner-branding";
import { loadPartnerMeta } from "@/lib/data/partners";
import { parseTicketSelections } from "@/lib/services/ticket-selections";
import {
  DEAL_TICKET_REQUIREMENT_METADATA_KEY,
  buildDealRequirementKey,
  parseDealTicketRequirement,
  type DealTicketRequirement,
} from "@/lib/deals/ticket-requirements";

const legacyFormSchema = z.object({
  fullName: z.string().min(1).max(120),
  visitDate: z.string().optional(),
  guests: z.number().int().positive().max(12).optional(),
  ticketType: z.string().optional(),
  transport: z.string().optional(),
  notes: z.string().max(1000).optional(),
  totalPrice: z.number().nonnegative().optional(),
});

const dynamicFormSchema = z.object({
  values: z.record(z.string(), z.any()),
  hidden: z.record(z.string(), z.any()).optional(),
  labels: z.record(z.string(), z.string()).optional(),
});

const formSchema = z.union([legacyFormSchema, dynamicFormSchema]);

const requestSchema = z.object({
  email: z.string().email(),
  partnerId: z.string().min(1),
  formId: z.string().optional(),
  form: formSchema,
  metadata: z.record(z.string(), z.any()).optional(),
  totalPrice: z.number().nonnegative().optional(),
});

type LegacyFormPayload = z.infer<typeof legacyFormSchema>;
type DynamicFormPayload = z.infer<typeof dynamicFormSchema>;

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

export function OPTIONS() {
  return preflightResponse({
    methods: "POST, OPTIONS",
    headers: "Content-Type",
  });
}

export async function POST(req: NextRequest) {
  const correlationId = getCorrelationId(req);
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return withCors(
        NextResponse.json(
          { error: "ValidationError", details: parsed.error.flatten() },
          { status: 400 },
        ),
      );
    }

    const { email, partnerId, form, formId, metadata, totalPrice } =
      parsed.data;
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPartnerId = partnerId.trim().toLowerCase();
    const baseOrigin = req.nextUrl.origin;
    const resolvedBaseUrl = resolveBaseUrl(baseOrigin);
    const locale = resolveLocale(req.headers.get("x-locale"));
    const supabase = getSupabaseAdmin();

    const purpose = buildVerificationPurpose({
      partnerId,
      type: "visit",
    });
    const verified = await isEmailVerified({
      email: normalizedEmail,
      purpose,
    });

    if (!verified) {
      return withCors(
        NextResponse.json(
          { error: "Email not verified" },
          { status: 401 },
        ),
      );
    }

    const isDynamicForm =
      typeof form === "object" && form !== null && "values" in form;

    const dynamicForm = isDynamicForm
      ? (form as DynamicFormPayload)
      : null;
    const legacyForm = isDynamicForm
      ? null
      : (form as LegacyFormPayload);

    let partnerFormRecord: Awaited<
      ReturnType<typeof getPartnerFormById>
    > | null = null;

    if (dynamicForm) {
      if (!formId) {
        return withCors(
          NextResponse.json(
            {
              error: "FormIdRequired",
              message: "formId is required for admin-managed forms",
            },
            { status: 400 },
          ),
        );
      }

      partnerFormRecord = await getPartnerFormById(formId);
      if (!partnerFormRecord || partnerFormRecord.status !== "published") {
        return withCors(
          NextResponse.json(
            {
              error: "FormUnavailable",
              message: "This booking form is unavailable. Please try again later.",
            },
            { status: 400 },
          ),
        );
      }

      if (
        partnerFormRecord.partnerId &&
        partnerFormRecord.partnerId !== normalizedPartnerId
      ) {
        return withCors(
          NextResponse.json(
            {
              error: "FormMismatch",
              message: "Selected form does not belong to this partner.",
            },
            { status: 400 },
          ),
        );
      }
    }

    if (partnerFormRecord && partnerFormRecord.usageType === "deal") {
      return await handleDealFormSubmission({
        req,
        normalizedEmail,
        partnerFormRecord,
        dynamicForm,
        metadata,
        locale,
        resolvedBaseUrl,
        correlationId,
      });
    }

    const formMetrics =
      dynamicForm && partnerFormRecord
        ? computePartnerFormMetrics(
            partnerFormRecord.config,
            dynamicForm.values,
          )
        : null;

    const ticketSelections =
      dynamicForm && partnerFormRecord
        ? parseTicketSelections(dynamicForm)
        : [];

    let partnerBookingCap: number | null = null;
    try {
      const partnerMeta = await loadPartnerMeta(normalizedPartnerId);
      const cap = partnerMeta.ticketing.maxGuestsPerBooking;
      partnerBookingCap =
        typeof cap === "number" && Number.isFinite(cap) && cap > 0
          ? cap
          : null;
    } catch (error) {
      log.warn("public_visit_partner_meta_load_failed", {
        partnerId: normalizedPartnerId,
        correlationId,
        error: (error as Error)?.message ?? String(error),
      });
    }

    const totalPriceOverride =
      typeof totalPrice === "number" && Number.isFinite(totalPrice)
        ? totalPrice
        : undefined;

    const payload: Record<string, unknown> = {
      source: "public_site",
      submittedAt: new Date().toISOString(),
      form,
      metadata: metadata ?? {},
    };

    if (formId) {
      payload.formId = formId;
    }
    if (partnerFormRecord) {
      payload.formName = partnerFormRecord.name;
      payload.formSlug = partnerFormRecord.slug;
      payload.formVersion = partnerFormRecord.embedVersion;
    }
    if (formMetrics) {
      payload.formMetrics = formMetrics;
      payload.numPeople = formMetrics.numPeople;
    } else if (legacyForm?.guests) {
      payload.numPeople = legacyForm.guests;
    }
    if (ticketSelections.length > 0) {
      payload.ticketSelections = ticketSelections;
    }
    if (partnerBookingCap && partnerBookingCap > 0) {
      const ticketGuestCount =
        ticketSelections.length > 0
          ? ticketSelections.reduce((sum, entry) => sum + entry.quantity, 0)
          : null;
      const metricsGuests = formMetrics?.numPeople ?? null;
      const legacyGuests =
        typeof legacyForm?.guests === "number" ? legacyForm.guests : null;
      const totalGuests =
        ticketGuestCount ?? metricsGuests ?? legacyGuests ?? 0;
      if (totalGuests > partnerBookingCap) {
        return withCors(
          NextResponse.json(
            {
              error: "GuestLimitExceeded",
              message: `Bookings are limited to ${partnerBookingCap} guests per visit for this partner.`,
            },
            { status: 400 },
          ),
        );
      }
    }

    if (totalPriceOverride !== undefined) {
      payload.totalPriceOverride = totalPriceOverride;
    }

    const combinedTotalPrice =
      totalPriceOverride ??
      formMetrics?.totalPrice ??
      legacyForm?.totalPrice ??
      null;

    const estimatedPoints = estimateVisitPoints({
      estimatedPoints: undefined,
      totalPrice: combinedTotalPrice ?? undefined,
      numPeople: formMetrics?.numPeople ?? legacyForm?.guests,
      ticketType: formMetrics?.ticketType ?? legacyForm?.ticketType,
      transport:
        formMetrics?.transportChoice ?? legacyForm?.transport,
    });

    const submissionId = `public:${randomUUID()}`;

    const visit = await createVisitRegistration({
      email: normalizedEmail,
      partnerId: normalizedPartnerId,
      status: "pending",
      submissionId,
      payload,
      estimatedPoints,
      pointsAwarded: 0,
      totalPrice: combinedTotalPrice ?? undefined,
      numPeople:
        formMetrics?.numPeople ?? legacyForm?.guests ?? 1,
      ticketType:
        formMetrics?.ticketType ?? legacyForm?.ticketType ?? undefined,
      transport:
        formMetrics?.transportChoice ?? legacyForm?.transport ?? undefined,
      categories: metadata?.category ?? undefined,
    });

    const partnerBranding = await loadPartnerBranding(
      normalizedPartnerId,
      supabase
    );

    const verifyUrl =
      visit.id && normalizedEmail
        ? buildVerifyUrl(normalizedEmail, visit.id, resolvedBaseUrl)
        : null;
    const staffScanUrl = visit.id
      ? new URL(
          buildLocalizedPath(`/staff/scan/${visit.id}`, locale),
          resolvedBaseUrl,
        ).toString()
      : null;

    let qrInfo: {
      url: string | null;
      expiresAt: string | null;
      path: string | null;
    } = { url: null, expiresAt: null, path: null };

    if (verifyUrl && visit.id) {
      try {
        const qr = await generateQrCodeForVisit(verifyUrl, visit.id, undefined, {
          badgeLabel: partnerBranding.initial,
          badgeColor: partnerBranding.accentColor,
          matrixColor: partnerBranding.accentColor,
          badgeIconUrl: partnerBranding.logoUrl ?? undefined,
          qrVariant: "visit",
        });
        qrInfo = {
          url: qr.url,
          expiresAt: qr.expiresAt,
          path: qr.path,
        };
        const existingPayload = (visit.payload ?? {}) as Record<string, unknown>;
        const nextPayload = {
          ...existingPayload,
          verifyUrl,
          qrCodeUrl: qr.url,
          qrCodeExpiresAt: qr.expiresAt,
          qrStoragePath: qr.path,
          staffScanUrl,
        };
        await supabase
          .from("visit_registrations")
          .update({
            payload: nextPayload as unknown as never,
            updated_at: new Date().toISOString(),
          } as unknown as never)
          .eq("id", visit.id);
      } catch (error) {
        log.error("public_visit_qr_error", error, {
          visitId: visit.id,
          correlationId,
        });
      }
    }

    await clearVerification({ email: normalizedEmail, purpose });

    log.info("public_visit_registered", {
      email: normalizedEmail,
      partnerId,
      formId: formId ?? null,
      visitId: visit.id,
      correlationId,
    });

    await notifyQrEmail({
      type: "visit",
      email: normalizedEmail,
      visitId: visit.id,
      submissionId,
      verifyUrl,
      qrUrl: qrInfo.url,
      qrExpiresAt: qrInfo.expiresAt,
      qrStoragePath: qrInfo.path,
      partnerId: normalizedPartnerId,
      partner: partnerFormRecord
        ? {
            id: partnerFormRecord.partnerId,
            name: partnerFormRecord.name,
            displayName: partnerFormRecord.name,
          }
        : { id: normalizedPartnerId },
      staffScanUrl,
      locale,
      payload: {
        form,
        metadata: metadata ?? {},
        storedPayload: payload,
        formMetrics,
        legacyForm,
        dynamicForm,
      },
      metadata: {
        source: payload.source,
        formId: formId ?? null,
        usageType: partnerFormRecord?.usageType ?? "legacy",
      },
      extras: {
        estimatedPoints,
        totalPrice:
          formMetrics?.totalPrice ?? legacyForm?.totalPrice ?? null,
        numPeople:
          formMetrics?.numPeople ?? legacyForm?.guests ?? null,
        submissionId,
      },
    });

    return withCors(
      NextResponse.json(
        {
          success: true,
          visitId: visit.id,
          verifyUrl,
          qrCodeUrl: qrInfo.url,
          qrCodeExpiresAt: qrInfo.expiresAt,
          staffScanUrl,
        },
        { status: 201 },
      ),
    );
  } catch (error) {
    log.error("public_visit_register_error", error, { correlationId });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
    );
  }
}

async function handleDealFormSubmission(params: {
  req: NextRequest;
  normalizedEmail: string;
  partnerFormRecord: NonNullable<Awaited<ReturnType<typeof getPartnerFormById>>>;
  dynamicForm: DynamicFormPayload | null;
  metadata: Record<string, unknown> | undefined;
  locale: string;
  resolvedBaseUrl: string;
  correlationId: string | null;
}) {
  const {
    req,
    normalizedEmail,
    partnerFormRecord,
    dynamicForm,
    metadata,
    locale,
    resolvedBaseUrl,
    correlationId,
  } = params;

  if (!dynamicForm) {
    return withCors(
      NextResponse.json(
        { error: "Deal forms require dynamic configuration" },
        { status: 400 },
      ),
    );
  }

  if (!partnerFormRecord.dealId) {
    return withCors(
      NextResponse.json(
        { error: "Deal form is missing a linked deal" },
        { status: 400 },
      ),
    );
  }

  const integration = partnerFormRecord.config.deal;
  if (!integration || !integration.visitorsFieldId) {
    return withCors(
      NextResponse.json(
        { error: "Deal form has no visitors field configured" },
        { status: 400 },
      ),
    );
  }

  const rawVisitors = dynamicForm.values[integration.visitorsFieldId];
  const visitors = Number(rawVisitors);
  if (!Number.isFinite(visitors) || visitors < 1) {
    return withCors(
      NextResponse.json(
        { error: "Invalid visitor count" },
        { status: 400 },
      ),
    );
  }

  const consentValue = integration.consentFieldId
    ? dynamicForm.values[integration.consentFieldId]
    : undefined;
  const consentMarketing = Boolean(consentValue);

  const dealMeta = await getDealWithMeta(partnerFormRecord.dealId);
  const dealSlug = dealMeta?.deal.slug;

  if (!dealSlug) {
    return withCors(
      NextResponse.json(
        { error: "Selected deal is missing a slug" },
        { status: 400 },
      ),
    );
  }

  const ticketRequirements =
    (dealMeta?.deal.ticket_requirements as DealTicketRequirement[] | null) ?? [];
  const selectedRequirementMetadata =
    metadata?.[DEAL_TICKET_REQUIREMENT_METADATA_KEY];
  const selectedRequirement =
    ticketRequirements.length > 0
      ? parseDealTicketRequirement(selectedRequirementMetadata)
      : null;
  let normalizedTicketBreakdown: DealTicketRequirement[] | null = null;

  if (ticketRequirements.length > 0) {
    if (!selectedRequirement) {
      return withCors(
        NextResponse.json(
          {
            error: "TicketSelectionRequired",
            message: "Select a ticket type before continuing.",
          },
          { status: 400 },
        ),
      );
    }
    const requirementMap = new Map(
      ticketRequirements.map((entry) => [
        buildDealRequirementKey(entry.ticketType, entry.subType),
        entry.quantity,
      ]),
    );
    const selectedKey = buildDealRequirementKey(
      selectedRequirement.ticketType,
      selectedRequirement.subType ?? null,
    );
    const expectedQuantity = requirementMap.get(selectedKey);
    if (!expectedQuantity) {
      return withCors(
        NextResponse.json(
          {
            error: "TicketSelectionInvalid",
            message: "The selected ticket type is not available for this deal.",
          },
          { status: 409 },
        ),
      );
    }
    if (selectedRequirement.quantity !== expectedQuantity) {
      return withCors(
        NextResponse.json(
          {
            error: "TicketSelectionMismatch",
            message: "Selected ticket quantity does not match the requirement.",
          },
          { status: 409 },
        ),
      );
    }
    normalizedTicketBreakdown = [
      {
        ticketType: selectedRequirement.ticketType,
        subType: selectedRequirement.subType ?? undefined,
        quantity: expectedQuantity,
      },
    ];
  }

  const resolvedVisitors =
    normalizedTicketBreakdown?.[0]?.quantity ??
    Math.max(1, Math.floor(visitors));
  const requestBody = {
    email: normalizedEmail,
    visitors: resolvedVisitors,
    consentMarketing,
    ticketBreakdown: normalizedTicketBreakdown ?? undefined,
    metadata: {
      ...(metadata ?? {}),
      formId: partnerFormRecord.id,
      formName: partnerFormRecord.name,
      formSlug: partnerFormRecord.slug,
      formValues: dynamicForm.values,
      hiddenValues: dynamicForm.hidden ?? {},
    },
  };

  const internalHeaders = new Headers();
  internalHeaders.set("Content-Type", "application/json");
  if (locale) internalHeaders.set("x-locale", locale);
  if (correlationId) internalHeaders.set("x-correlation-id", correlationId);
  const cookie = req.headers.get("cookie");
  if (cookie) internalHeaders.set("cookie", cookie);

  const dealUrl = new URL(
    `/api/public/special-deals/${encodeURIComponent(dealSlug)}/generate`,
    resolvedBaseUrl,
  );

  const response = await fetch(dealUrl, {
    method: "POST",
    headers: internalHeaders,
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    return withCors(
      NextResponse.json(
        {
          error:
            body?.message ?? body?.error ?? "Unable to generate deal redemption.",
        },
        { status: response.status },
      ),
    );
  }

  const payload = (await response.json()) as Record<string, unknown>;

  log.info("public_deal_form_generated", {
    dealId: partnerFormRecord.dealId,
    formId: partnerFormRecord.id,
    correlationId,
  });

  return withCors(
    NextResponse.json(payload, { status: response.status }),
  );
}
