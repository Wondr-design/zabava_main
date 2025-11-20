import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { preflightResponse, withCors } from "@/lib/http/cors";
import { log, getCorrelationId } from "@/lib/logging";
import {
  createVisitRegistration,
  getLatestPendingVisit,
  getVisitBySubmissionId,
} from "@/lib/data/visits";
import {
  computeRegistrationMetrics,
  extractPartnerId,
  normalizeEmail,
} from "@/lib/services/visit-metrics";

const BASE_URL = process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || "";

const requestSchema = z
  .object({
    email: z.string().email(),
    partnerId: z.string().min(1).optional(),
    redemptionCode: z.string().optional(),
    data: z.unknown().optional(),
  })
  .passthrough();

function parseDataField(data: unknown) {
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch (err) {
      console.warn("qr/register: failed to parse data payload string", err);
      return undefined;
    }
  }

  if (data && typeof data === "object") {
    return data as Record<string, unknown>;
  }

  return undefined;
}

function mergePayload(
  base: Record<string, unknown>,
  parsedData?: Record<string, unknown>
) {
  const merged: Record<string, unknown> = { ...base };

  if (parsedData) {
    for (const [key, value] of Object.entries(parsedData)) {
      if (merged[key] === undefined) {
        merged[key] = value;
      } else {
        merged[`data.${key}`] = value;
      }
    }
    merged._rawData = parsedData;
  }

  return merged;
}

function buildVerifyUrl(email: string, visitId: string) {
  if (!BASE_URL) return null;
  const base = BASE_URL.replace(/\/$/, "");
  const params = new URLSearchParams({ email, visitId });
  return `${base}/api/verify?${params.toString()}`;
}

export function OPTIONS() {
  return preflightResponse({
    methods: "POST, OPTIONS",
    headers: "Content-Type",
  });
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const payload = requestSchema.parse(raw ?? {});
    const {
      email,
      partnerId: partnerIdOverride,
      redemptionCode,
      data,
      ...rest
    } = payload;

    const normalizedEmail = normalizeEmail(email);

    const parsedData = parseDataField(data);
    const restRecord = rest as Record<string, unknown>;
    const mergedPayload = mergePayload(restRecord, parsedData);

    const partnerCandidate =
      partnerIdOverride ||
      extractPartnerId({ ...mergedPayload, data: parsedData });
    const normalizedPartnerId = partnerCandidate
      ? partnerCandidate.trim().toLowerCase()
      : "";

    if (!normalizedPartnerId) {
      log.warn("qr_register_missing_partner", { route: 'qr/register', method: req.method, correlationId: getCorrelationId(req), email: normalizedEmail });
      return withCors(
        NextResponse.json({ error: "Partner ID is required" }, { status: 400 }),
        { methods: "POST, OPTIONS", headers: "Content-Type" }
      );
    }

    const registrationMetrics = computeRegistrationMetrics(mergedPayload);

    const rawSubmissionId =
      (typeof restRecord["submissionId"] === "string"
        ? (restRecord["submissionId"] as string)
        : undefined) ??
      (typeof restRecord["rid"] === "string"
        ? (restRecord["rid"] as string)
        : undefined);
    const normalizedSubmissionId = rawSubmissionId
      ? rawSubmissionId.trim().toLowerCase()
      : undefined;

    let existing = null;
    if (normalizedSubmissionId) {
      existing = await getVisitBySubmissionId(normalizedSubmissionId).catch(
        () => null,
      );
    }
    if (!existing) {
      const latestPending = await getLatestPendingVisit(
        normalizedEmail,
        normalizedPartnerId,
      ).catch(() => null);
      if (
        latestPending &&
        (!normalizedSubmissionId ||
          !latestPending.submission_id ||
          latestPending.submission_id.toLowerCase() ===
            normalizedSubmissionId)
      ) {
        existing = latestPending;
      }
    }

    const visitId = existing?.id ?? randomUUID();
    const legacyKey = existing?.legacy_qr_key ??
      `qr:${normalizedEmail}:${normalizedPartnerId}:${visitId}`;

    const visit = await createVisitRegistration({
      id: visitId,
      email: normalizedEmail,
      partnerId: normalizedPartnerId,
      status: "pending",
      submissionId:
        normalizedSubmissionId ?? existing?.submission_id ?? undefined,
      payload: mergedPayload,
      estimatedPoints: registrationMetrics.estimatedPoints,
      pointsAwarded: 0,
      totalPrice: registrationMetrics.totalPrice,
      numPeople: registrationMetrics.numPeople,
      ticketType: registrationMetrics.ticketType,
      transport: registrationMetrics.transportLabel ?? undefined,
      categories: registrationMetrics.categories ?? undefined,
      hasRedemption: Boolean(redemptionCode),
      redemptionCode,
      legacyQrKey: legacyKey,
    });

    const verifyUrl = buildVerifyUrl(normalizedEmail, visit.id);

    return withCors(
      NextResponse.json(
        {
          success: true,
          message: "QR code registered successfully",
          visit: {
            id: visit.id,
            email: visit.email,
            partnerId: visit.partner_id,
            estimatedPoints: visit.estimated_points,
            status: visit.status,
            createdAt: visit.created_at,
            verifyUrl,
          },
        },
        { status: 200 }
      ),
      { methods: "POST, OPTIONS", headers: "Content-Type" }
    );
  } catch (err) {
    if (err instanceof ZodError) {
      log.warn("qr_register_validation_error", { route: 'qr/register', method: req.method, correlationId: getCorrelationId(req), issues: err.flatten?.() });
      return withCors(
        NextResponse.json(
          { error: "ValidationError", issues: err.flatten() },
          { status: 400 }
        ),
        { methods: "POST, OPTIONS", headers: "Content-Type" }
      );
    }

    log.error("qr_register_error", err, { route: 'qr/register', correlationId: getCorrelationId(req) });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      { methods: "POST, OPTIONS", headers: "Content-Type" }
    );
  }
}
