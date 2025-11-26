import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { preflightResponse, withCors } from "@/lib/http/cors";
import { verifyCsrf } from "@/lib/http/csrf";
import { log, getCorrelationId } from "@/lib/logging";
import {
  getVisitById,
  getLatestPendingVisit,
  updateVisitStatus,
} from "@/lib/data/visits";
import {
  addPointsHistoryEntry,
  getTotalPointsForEmail,
} from "@/lib/data/points";
import { loadPartnerMeta } from "@/lib/data/partners";
import { getAuthFromRequest } from "@/lib/auth/request";
import { getVisitQrExpiryStatus } from "@/lib/services/visit-links";
import { getActivePointRatio } from "@/lib/data/point-settings";
import {
  getFlashDeal,
  markFlashRedemptionRejected,
  markFlashRedemptionUsed,
} from "@/lib/data/flash-deals";
import { recordQrEvent } from "@/lib/data/qr-events";
import { resolveAllowedOrigin } from "@/lib/http/allowed-origin";
import { isEmailDeliveryConfigured, sendTemplatedEmail } from "@/lib/services/mailer";
import { EMAIL_TEMPLATE_DEFAULTS } from "@/lib/email-template-constants";
import { getWeekdayInTimeZone } from "@/lib/timezone";

const markVisitedSchema = z.object({
  email: z.string().email(),
  partnerId: z.string().min(1),
  visitId: z.string().uuid().optional(),
  visitDate: z.string().optional(),
  notes: z.string().optional(),
  actualVisitors: z.number().int().positive().optional(),
  action: z.enum(["use", "reject"]).optional(),
  rejectReason: z.string().optional(),
});

function isAuthorized(req: NextRequest, partnerId: string) {
  const auth = getAuthFromRequest(req);
  if (!auth?.role) return false;
  if (auth.role === "admin") return true;
  const pid = (auth.partnerId || "").toLowerCase();
  if (!pid || pid !== partnerId.toLowerCase()) return false;
  return auth.role === "partner" || auth.role === "staff";
}

function corsOptions(req: NextRequest) {
  return {
    origin: resolveAllowedOrigin(req),
    methods: "POST,OPTIONS",
    headers: "Content-Type, Authorization",
    credentials: true,
  } as const;
}

function cors(req: NextRequest, response: NextResponse) {
  return withCors(response, corsOptions(req));
}

export function OPTIONS(req: NextRequest) {
  return preflightResponse(corsOptions(req));
}

function toNumber(x: unknown, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function derivePointsFromRecord(
  record: {
    points_awarded: number | null;
    estimated_points: number | null;
    total_price: number | string | null;
    ticket_type: string | null;
    num_people: number | null;
    transport: string | null;
  },
  ratioCzk: number
) {
  if (record.points_awarded && record.points_awarded > 0)
    return record.points_awarded;
  if (record.estimated_points && record.estimated_points > 0)
    return record.estimated_points;

  const numPeople =
    typeof record.num_people === "number" && record.num_people > 0
      ? record.num_people
      : 1;
  const ticket = String(record.ticket_type || "").toLowerCase();
  let points = 0;
  switch (ticket) {
    case "vip":
      points = 50 * numPeople;
      break;
    case "family":
      points = 30 * numPeople;
      break;
    case "group":
      points = 20 * numPeople;
      break;
    case "student":
      points = 15 * numPeople;
      break;
    default:
      points = 10 * numPeople;
      break;
  }
  const price = toNumber(record.total_price, 0);
  if (price > 0 && ratioCzk > 0) {
    points = Math.max(points, Math.floor(price / ratioCzk));
  }
  return points || 10;
}

function isWithinValidityWindow(
  validFrom: string | null,
  validTo: string | null,
  now: Date,
) {
  const from = validFrom ? Date.parse(validFrom) : NaN;
  if (!Number.isNaN(from) && from > now.getTime()) {
    return false;
  }
  const to = validTo ? Date.parse(validTo) : NaN;
  if (!Number.isNaN(to) && to < now.getTime()) {
    return false;
  }
  return true;
}

function isAllowedDay(validDays: number[] | null, now: Date, timeZone?: string | null) {
  if (!validDays || validDays.length === 0) return true;
  const today = getWeekdayInTimeZone(now, timeZone);
  return validDays.includes(today);
}

export async function POST(req: NextRequest) {
  // CSRF check
  if (!verifyCsrf(req)) {
    return cors(
      req,
      NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    );
  }
  try {
    const json = await req.json().catch(() => ({}));
    const parsed = markVisitedSchema.safeParse(json);
    if (!parsed.success) {
      return cors(
        req,
        NextResponse.json(
          { error: "Invalid request", details: parsed.error.flatten() },
          { status: 400 }
        )
      );
    }

    const { email, partnerId, visitId, visitDate, notes, actualVisitors, action, rejectReason } =
      parsed.data;
    const auth = getAuthFromRequest(req);
    if (!auth || !isAuthorized(req, partnerId)) {
      log.warn("auth_failed", {
        route: "partner/mark-visited",
        method: req.method,
        partnerId,
        email,
        correlationId: getCorrelationId(req),
        actor: auth?.role ?? "unknown",
      });
      return cors(
        req,
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPartnerId = partnerId.trim().toLowerCase();
    const actingStaffId = auth?.role === "staff" ? auth.staffId ?? null : null;

    // Resolve the visit to mark
    let visit = null;
    if (visitId) {
      const v = await getVisitById(visitId);
      if (!v) {
        log.warn("visit_not_found", {
          route: "partner/mark-visited",
          method: req.method,
          partnerId,
          email,
          correlationId: getCorrelationId(req),
        });
        return cors(
          req,
          NextResponse.json(
            { error: "Registration not found" },
            { status: 404 }
          )
        );
      }
      visit = v;
    } else {
      const v = await getLatestPendingVisit(
        normalizedEmail,
        normalizedPartnerId
      );
      if (!v) {
        log.warn("visit_not_found", {
          route: "partner/mark-visited",
          method: req.method,
          partnerId,
          email,
          correlationId: getCorrelationId(req),
        });
        return cors(
          req,
          NextResponse.json(
            { error: "Registration not found" },
            { status: 404 }
          )
        );
      }
      visit = v;
    }

    // Sanity checks
    if ((visit.partner_id || "").toLowerCase() !== normalizedPartnerId) {
      log.warn("cross_partner_mismatch", {
        route: "partner/mark-visited",
        method: req.method,
        expected: normalizedPartnerId,
        found: visit.partner_id,
        correlationId: getCorrelationId(req),
      });
      return cors(
        req,
        NextResponse.json(
          {
            error: "Registration does not belong to this partner",
            expected: normalizedPartnerId,
            found: visit.partner_id,
          },
          { status: 400 }
        )
      );
    }
    if (visit.status === "visited") {
      log.info("already_visited", {
        route: "partner/mark-visited",
        method: req.method,
        visitId: visit.id,
        visitedAt: visit.visited_at,
        correlationId: getCorrelationId(req),
      });
      return cors(
        req,
        NextResponse.json(
          { error: "Already marked as visited", visitedAt: visit.visited_at },
          { status: 400 }
        )
      );
    }

    const expiryStatus = getVisitQrExpiryStatus(visit);
    if (expiryStatus.expired) {
      log.info("mark_visited_expired_qr", {
        route: "partner/mark-visited",
        method: req.method,
        visitId: visit.id,
        expiredAt: expiryStatus.expiresAt,
        correlationId: getCorrelationId(req),
      });
      return cors(
        req,
        NextResponse.json(
          {
            error: "QR code expired",
            expiredAt: expiryStatus.expiresAt,
            message:
              "This registration has expired and can no longer be marked as visited. Ask the guest to submit a new form.",
          },
          { status: 410 }
        )
      );
    }

    const payload =
      (visit.payload as Record<string, unknown> | undefined) ?? {};
    const isFlashDeal =
      (visit as { qr_type?: string }).qr_type === "flash" ||
      payload.source === "special_flash_deal";
    const ticketRequirements =
      Array.isArray(payload.ticketRequirements) && payload.ticketRequirements.length
        ? (payload.ticketRequirements as Array<{ ticketType: string; subType?: string; quantity: number }>)
        : null;
    const ticketBreakdown =
      Array.isArray(payload.ticketBreakdown) && payload.ticketBreakdown.length
        ? (payload.ticketBreakdown as Array<{ ticketType: string; subType?: string; quantity: number }>)
        : null;

    const nowIso = visitDate || new Date().toISOString();
    const nowDate = new Date(nowIso);

    let flashDealId: string | null =
      typeof payload.dealId === "string" ? payload.dealId : null;
    let flashDealMinVisitors =
      typeof payload.visitors === "number"
        ? payload.visitors
        : undefined;

    let actualVisitorCount =
      typeof actualVisitors === "number"
        ? actualVisitors
        : typeof visit.num_people === "number"
        ? visit.num_people
        : undefined;
    const trimmedRejectReason = rejectReason?.trim() ?? "";

    if (isFlashDeal) {
      if (!flashDealId && typeof payload.deal_id === "string") {
        flashDealId = payload.deal_id;
      }
      if (!flashDealId) {
        return cors(
          req,
          NextResponse.json(
            { error: "Unable to resolve flash deal for this visit." },
            { status: 409 },
          ),
        );
      }

      const deal = await getFlashDeal(flashDealId);
      if (!deal) {
        return cors(
          req,
          NextResponse.json(
            { error: "Flash deal no longer exists." },
            { status: 409 },
          ),
        );
      }

      if (action === "reject" && !trimmedRejectReason) {
        return cors(
          req,
          NextResponse.json(
            { error: "Rejection note is required." },
            { status: 400 },
          ),
        );
      }

      flashDealMinVisitors =
        flashDealMinVisitors ?? deal.min_visitors ?? visit.num_people ?? 1;
      actualVisitorCount =
        actualVisitorCount ?? visit.num_people ?? flashDealMinVisitors;
      if (
        typeof actualVisitorCount !== "number" ||
        Number.isNaN(actualVisitorCount)
      ) {
        actualVisitorCount = flashDealMinVisitors;
      }
      actualVisitorCount = Math.max(1, Math.floor(actualVisitorCount));

      if (actualVisitorCount < flashDealMinVisitors) {
        if (!trimmedRejectReason) {
          return cors(
            req,
            NextResponse.json(
              {
                error: "Minimum visitors not met",
                message: "Add a rejection note and decline the QR.",
                required: flashDealMinVisitors,
                provided: actualVisitorCount,
              },
              { status: 409 },
            ),
          );
        }
        await markFlashRedemptionRejected({
          flashDealId,
          visitId: visit.id,
          metadata: {
            reason: "min_visitors",
            required: flashDealMinVisitors,
            provided: actualVisitorCount,
            checkedAt: nowIso,
            staffId: actingStaffId ?? undefined,
            note: trimmedRejectReason,
          },
        });

        await recordQrEvent({
          eventType: "rejected",
          qrType: "flash",
          flashDealId,
          visitId: visit.id,
          source: "partner_mark_visited",
          metadata: {
            reason: "min_visitors",
            required: flashDealMinVisitors,
            provided: actualVisitorCount,
            note: trimmedRejectReason,
          },
        });

        return cors(
          req,
          NextResponse.json(
            {
              error: "Minimum visitors not met",
              required: flashDealMinVisitors,
              provided: actualVisitorCount,
            },
            { status: 409 },
          ),
        );
      }

      if (
        !isWithinValidityWindow(
          deal.valid_from,
          deal.valid_to,
          nowDate,
        )
      ) {
        await markFlashRedemptionRejected({
          flashDealId,
          visitId: visit.id,
          metadata: {
            reason: "invalid_window",
            checkedAt: nowIso,
            staffId: actingStaffId ?? undefined,
          },
        });
        await recordQrEvent({
          eventType: "rejected",
          qrType: "flash",
          flashDealId,
          visitId: visit.id,
          source: "partner_mark_visited",
          metadata: {
            reason: "invalid_window",
            validFrom: deal.valid_from,
            validTo: deal.valid_to,
          },
        });
        return cors(
          req,
          NextResponse.json(
            { error: "Deal validity window has passed." },
            { status: 409 },
          ),
        );
      }

      const localWeekday = getWeekdayInTimeZone(nowDate, deal.time_zone);
      if (!isAllowedDay(deal.valid_days, nowDate, deal.time_zone)) {
        await markFlashRedemptionRejected({
          flashDealId,
          visitId: visit.id,
          metadata: {
            reason: "invalid_day",
            checkedAt: nowIso,
            staffId: actingStaffId ?? undefined,
          },
        });
        await recordQrEvent({
          eventType: "rejected",
          qrType: "flash",
          flashDealId,
          visitId: visit.id,
          source: "partner_mark_visited",
          metadata: {
            reason: "invalid_day",
            validDays: deal.valid_days ?? [],
            checkedDay: localWeekday,
          },
        });
        return cors(
          req,
          NextResponse.json(
            { error: "This deal cannot be redeemed today." },
            { status: 409 },
          ),
        );
      }

      if (ticketRequirements && ticketRequirements.length > 0) {
        if (!ticketBreakdown || ticketBreakdown.length === 0) {
          if (!trimmedRejectReason) {
            return cors(
              req,
              NextResponse.json(
                { error: "Ticket requirements missing. Add a rejection note and decline." },
                { status: 409 },
              ),
            );
          }
        } else {
          const requirementMap = new Map(
            ticketRequirements.map((item) => [
              `${String(item.ticketType).toLowerCase()}::${(item as { subType?: string }).subType?.toLowerCase() ?? ""}`,
              item.quantity,
            ]),
          );
          const invalid =
            ticketBreakdown.length !== 1 ||
            ticketBreakdown.some((item) => {
              const key = `${String(item.ticketType).toLowerCase()}::${(item as { subType?: string }).subType?.toLowerCase() ?? ""}`;
              const expected = requirementMap.get(key);
              return !expected || expected !== item.quantity;
            });
          if (invalid) {
            if (!trimmedRejectReason) {
              return cors(
                req,
                NextResponse.json(
                  {
                    error: "Ticket mix does not match requirements. Add a rejection note and decline.",
                  },
                  { status: 409 },
                ),
              );
            }
          }
        }
      }

      if (
        ticketRequirements &&
        ticketRequirements.length > 0 &&
        ticketBreakdown &&
        ticketBreakdown.length > 0
      ) {
        const reqMap = new Map(
          ticketRequirements.map((item) => [
            `${String(item.ticketType).toLowerCase()}::${(item as { subType?: string }).subType?.toLowerCase() ?? ""}`,
            item.quantity,
          ]),
        );
        const inputMap = new Map(
          ticketBreakdown.map((item) => [
            `${String(item.ticketType).toLowerCase()}::${(item as { subType?: string }).subType?.toLowerCase() ?? ""}`,
            item.quantity,
          ]),
        );
        const mismatch =
          inputMap.size > 1 ||
          Array.from(inputMap.entries()).some(
            ([key, qty]) => reqMap.get(key) !== qty,
          );
        if (mismatch) {
          if (!trimmedRejectReason) {
            return cors(
              req,
              NextResponse.json(
                {
                  error: "Ticket mix does not match requirements. Add a rejection note and decline.",
                },
                { status: 409 },
              ),
            );
          }
          return cors(
            req,
            NextResponse.json(
              {
                error: "Ticket mix does not match requirements. Please reject with a note.",
              },
              { status: 409 },
            ),
          );
        }
      }
    }

    if (action === "reject") {
      if (!trimmedRejectReason) {
        return cors(
          req,
          NextResponse.json(
            { error: "Rejection note is required." },
            { status: 400 },
          ),
        );
      }

      if (isFlashDeal && flashDealId) {
        await markFlashRedemptionRejected({
          flashDealId,
          visitId: visit.id,
          metadata: {
            reason: "staff_reject",
            note: trimmedRejectReason,
            ticketRequirements,
            ticketBreakdown,
            providedVisitors: actualVisitorCount ?? null,
            checkedAt: nowIso,
            staffId: actingStaffId ?? undefined,
          },
        });
        await recordQrEvent({
          eventType: "expired", // DB enum does not include "rejected"; use expired to denote invalidated QR
          qrType: "flash",
          flashDealId,
          visitId: visit.id,
          source: "partner_mark_visited",
          metadata: {
            reason: "staff_reject",
            note: trimmedRejectReason,
            status: "rejected",
          },
        });
      }

      await updateVisitStatus({
        visitId: visit.id,
        status: "cancelled",
        visitNotes: trimmedRejectReason,
        numPeople:
          typeof actualVisitorCount === "number"
            ? actualVisitorCount
            : typeof visit.num_people === "number"
            ? visit.num_people
            : undefined,
        checkedInByStaffId: actingStaffId,
      });

      return cors(
        req,
        NextResponse.json({ success: true, message: "Visit rejected." }, { status: 200 }),
      );
    }

    const { ratioCzk } = isFlashDeal ? { ratioCzk: 0 } : await getActivePointRatio();

    let pointsAwarded = 0;
    if (
      (visit as { qr_type?: string }).qr_type === "bonus" ||
      isFlashDeal
    ) {
      pointsAwarded = 0;
    } else {
      pointsAwarded = derivePointsFromRecord(
        {
          points_awarded: visit.points_awarded,
          estimated_points: visit.estimated_points,
          total_price: visit.total_price,
          ticket_type: visit.ticket_type,
          num_people: visit.num_people,
          transport: visit.transport,
        },
        ratioCzk,
      );
    }

    const estimatedPoints = isFlashDeal
      ? 0
      : visit.estimated_points ?? pointsAwarded;

    // Update the visit
    const updated = await updateVisitStatus({
      visitId: visit.id,
      status: "visited",
      visitedAt: nowIso,
      pointsAwarded,
      estimatedPoints,
      totalPrice:
        typeof visit.total_price === "number"
          ? visit.total_price
          : toNumber(visit.total_price, 0),
      numPeople:
        typeof actualVisitorCount === "number"
          ? actualVisitorCount
          : typeof visit.num_people === "number"
          ? visit.num_people
          : 1,
      ticketType: visit.ticket_type || undefined,
      transport: visit.transport || undefined,
      categories: visit.categories || undefined,
      visitNotes: notes || undefined,
      checkedInByStaffId: actingStaffId,
    });

    if (isFlashDeal && flashDealId) {
      try {
        await markFlashRedemptionUsed({
          flashDealId,
          visitId: visit.id,
          metadata: {
            checkedAt: nowIso,
            staffId: actingStaffId ?? undefined,
            actualVisitors:
              typeof actualVisitorCount === "number"
                ? actualVisitorCount
                : undefined,
            ticketRequirements,
            ticketBreakdown,
          },
        });
        await recordQrEvent({
          eventType: "redeemed",
          qrType: "flash",
          flashDealId,
          visitId: visit.id,
          source: "partner_mark_visited",
          metadata: {
            staffId: actingStaffId ?? undefined,
            actualVisitors:
              typeof actualVisitorCount === "number"
                ? actualVisitorCount
                : undefined,
          },
        });
      } catch (dealError) {
        log.error("flash_deal_mark_used_error", dealError, {
          flashDealId,
          visitId: visit.id,
          correlationId: getCorrelationId(req),
        });
      }
    }

    // Add points history entry
    let partnerName: string | null = null;
    try {
      const meta = await loadPartnerMeta(normalizedPartnerId);
      partnerName = meta.displayName ?? normalizedPartnerId;
    } catch {
      partnerName = normalizedPartnerId;
    }

    if (pointsAwarded > 0) {
      await addPointsHistoryEntry({
        email: normalizedEmail,
        type: "earned",
        points: pointsAwarded,
        partnerId: normalizedPartnerId,
        partnerName,
        visitId: visit.id,
        meta: {
          source: "partner/mark-visited",
          staffId: actingStaffId ?? undefined,
          ratioApplied: ratioCzk,
        },
        source: "visit",
      });
    }

    const totalPointsNow = await getTotalPointsForEmail(normalizedEmail);

    // Send visit confirmed email
    if (isEmailDeliveryConfigured()) {
      try {
        const template = EMAIL_TEMPLATE_DEFAULTS.visit_confirmed;
        await sendTemplatedEmail({
          to: normalizedEmail,
          templateType: "visit_confirmed",
          locale: "en",
          subjectOverride: template.subject,
          bodyOverride: template.body,
          details: [
            { label: "Visit ID", value: visit.id },
            { label: "Partner", value: partnerName },
            { label: "Visited at", value: nowIso },
            { label: "Ticket type", value: updated?.ticket_type ?? visit.ticket_type },
            { label: "Guests", value: String(updated?.num_people ?? visit.num_people ?? 1) },
          ],
        });
      } catch (error) {
        log.error("visit_confirmed_email_failed", error, {
          visitId: visit.id,
          email: normalizedEmail,
          correlationId: getCorrelationId(req),
        });
      }
    }

    const response = {
      success: true,
      message: "Visit confirmed successfully",
      visit: {
        email: normalizedEmail,
        partnerId: normalizedPartnerId,
      visitedAt: nowIso,
      pointsAwarded,
      estimatedPoints,
        totalPrice: updated?.total_price ?? visit.total_price ?? 0,
        ticketType: updated?.ticket_type ?? visit.ticket_type ?? "Standard",
        numPeople: updated?.num_people ?? visit.num_people ?? 1,
        transport: updated?.transport ?? visit.transport ?? null,
        categories: updated?.categories ?? visit.categories ?? "",
        visitId: updated?.id ?? visit.id,
        submissionId: updated?.submission_id ?? visit.submission_id ?? visit.id,
        totalPointsNow,
        checkedInByStaffId: actingStaffId,
      },
    };

    return cors(req, NextResponse.json(response, { status: 200 }));
  } catch (err) {
    log.error("partner/mark-visited error", err, {
      route: "partner/mark-visited",
      method: req.method,
      correlationId: getCorrelationId(req),
    });
    return cors(
      req,
      NextResponse.json({ error: "Internal server error" }, { status: 500 })
    );
  }
}
