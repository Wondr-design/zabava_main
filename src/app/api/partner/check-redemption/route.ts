import { NextRequest, NextResponse } from "next/server";
import { withCors, preflightResponse } from "@/lib/http/cors";
import { resolveAllowedOrigin } from "@/lib/http/allowed-origin";
import { verifyPartnerToken } from "@/lib/auth/partner-token";
import {
  getRedemptionByCode,
  markRedemptionUsed,
  rejectRedemption,
} from "@/lib/data/redemptions";
import { verifyCsrf } from "@/lib/http/csrf";
import { log, getCorrelationId } from "@/lib/logging";
import { getRewardById } from "@/lib/data/rewards";
import {
  getVisitById,
  getLatestPendingVisitByTypes,
  listVisitsForEmail,
} from "@/lib/data/visits";
import { getAuthFromRequest } from "@/lib/auth/request";

function corsOptions(req: NextRequest) {
  return {
    origin: resolveAllowedOrigin(req),
    methods: "GET,POST,OPTIONS",
    headers: "Content-Type, Authorization",
    credentials: true,
  } as const;
}

function cors(req: NextRequest, response: NextResponse) {
  return withCors(response, corsOptions(req));
}

export function OPTIONS(request: NextRequest) {
  return preflightResponse(corsOptions(request));
}

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code")?.trim();
    if (!code) {
      log.warn("missing_code", {
        route: "partner/check-redemption",
        method: req.method,
        correlationId: getCorrelationId(req),
      });
      return cors(
        req,
        NextResponse.json(
          { error: "Redemption code is required" },
          { status: 400 }
        )
      );
    }

    const redemption = await getRedemptionByCode(code);
    if (!redemption) {
      log.warn("redemption_not_found", {
        route: "partner/check-redemption",
        code,
        correlationId: getCorrelationId(req),
      });
      return cors(
        req,
        NextResponse.json(
          { error: "Redemption not found", code },
          { status: 404 }
        )
      );
    }

    const rewardResp = await getRewardById(redemption.reward_id);
    const reward = rewardResp?.reward ?? null;
    const metadata = (redemption.metadata ?? {}) as Record<string, unknown>;

    let booking: Record<string, unknown> | null = null;
    if (redemption.applied_to_visit_id) {
      const visit = await getVisitById(redemption.applied_to_visit_id);
      if (visit) {
        booking = {
          email: visit.email,
          visitDate: visit.created_at,
          partnerId: visit.partner_id,
          ticketType: visit.ticket_type,
          numPeople: visit.num_people,
          hasVisited: visit.status === "visited",
          visitedAt: visit.visited_at,
        };
      }
    }
    if (!booking) {
      const normalizedEmail = redemption.email?.trim().toLowerCase();
      if (normalizedEmail) {
        const partnerCandidateRaw =
          (redemption.partner_id ||
            (typeof metadata.partnerId === "string"
              ? metadata.partnerId
              : "")).trim();
        const partnerCandidate = partnerCandidateRaw
          ? partnerCandidateRaw.toLowerCase()
          : null;
        try {
          let visit =
            partnerCandidate && partnerCandidate.length > 0
              ? await getLatestPendingVisitByTypes(normalizedEmail, partnerCandidate, {
                  qrTypes: ["standard", "bonus"],
                })
              : null;
          if (!visit) {
            const visits = await listVisitsForEmail(normalizedEmail, 1);
            visit = visits[0] ?? null;
          }
          if (visit) {
            const visitPartner = visit.partner_id
              ? visit.partner_id.trim().toLowerCase()
              : undefined;
            const redemptionPartner = redemption.partner_id
              ? redemption.partner_id.trim().toLowerCase()
              : undefined;
            if (
              !redemptionPartner ||
              redemptionPartner === visitPartner ||
              !visitPartner
            ) {
              booking = {
                email: visit.email,
                visitDate: visit.created_at,
                partnerId: visit.partner_id,
                ticketType: visit.ticket_type,
                numPeople: visit.num_people,
                hasVisited: visit.status === "visited",
                visitedAt: visit.visited_at,
              };
            }
          }
        } catch (lookupError) {
          log.warn("redemption_booking_lookup_failed", {
            route: "partner/check-redemption",
            code,
            correlationId: getCorrelationId(req),
            error: (lookupError as Error)?.message,
          });
        }
      }
    }

    // Codes are valid when applied (preferred) or still pending and not expired
    const now = Date.now();
    const expiresAtMs = redemption.expires_at
      ? Date.parse(redemption.expires_at)
      : NaN;
    const notExpired = Number.isNaN(expiresAtMs) ? true : expiresAtMs > now;
    const validStatuses = new Set(["applied", "pending"]);
    const isValid =
      validStatuses.has((redemption.status || "").toLowerCase()) && notExpired;

    // Optional partner token or cookie-based auth: restrict cross-partner visibility and compute canProcess
    const cookieAuth = getAuthFromRequest(req);
    const tokenPayload =
      cookieAuth ?? verifyPartnerToken(req.headers.get("authorization"));
    const tokenPartner = tokenPayload?.partnerId?.toLowerCase();
    const redemptionPartner = redemption.partner_id?.toLowerCase() || null;
    if (
      tokenPartner &&
      redemptionPartner &&
      redemptionPartner !== tokenPartner
    ) {
      log.warn("redemption_wrong_partner", {
        route: "partner/check-redemption",
        code,
        tokenPartner,
        redemptionPartner,
        correlationId: getCorrelationId(req),
      });
      return cors(
        req,
        NextResponse.json(
          { error: "This redemption belongs to another partner" },
          { status: 403 }
        )
      );
    }

    const canProcess = Boolean(
      isValid &&
        tokenPartner &&
        (!redemptionPartner || redemptionPartner === tokenPartner)
    );

    return cors(
      req,
      NextResponse.json({
        redemption: {
          code,
          email: redemption.email,
          rewardId: redemption.reward_id,
          rewardName:
            (metadata.rewardName as string | undefined) ?? reward?.name ?? null,
          pointsCost:
            (metadata.pointsCost as number | undefined) ??
            reward?.pointsCost ??
            null,
          status: redemption.status,
          redeemedAt: redemption.created_at,
          appliedAt: redemption.applied_at,
          usedAt: redemption.used_at,
          expiresAt: redemption.expires_at,
          partnerId: redemption.partner_id,
          metadata,
        },
        reward: reward
          ? {
              name: reward.name,
              description: reward.description,
              category: reward.category,
              pointsCost: reward.pointsCost,
              instructions: reward.redemptionInstructions,
            }
          : null,
        booking,
        isValid,
        canProcess,
      })
    );
  } catch (err) {
    log.error("check-redemption GET error", err, {
      route: "partner/check-redemption",
      method: req.method,
      correlationId: getCorrelationId(req),
    });
    return cors(
      req,
      NextResponse.json(
        { error: "Failed to check redemption" },
        { status: 500 }
      )
    );
  }
}

export async function POST(req: NextRequest) {
  if (!verifyCsrf(req)) {
    return cors(
      req,
      NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    );
  }
  const tokenPayload =
    getAuthFromRequest(req) ??
    verifyPartnerToken(req.headers.get("authorization"));
  if (
    !tokenPayload ||
    (tokenPayload.role !== "partner" && tokenPayload.role !== "staff")
  ) {
    log.warn("auth_failed", {
      route: "partner/check-redemption",
      method: req.method,
      correlationId: getCorrelationId(req),
      actor: tokenPayload?.role ?? "unknown",
    });
    return cors(
      req,
      NextResponse.json({ error: "Authentication required" }, { status: 401 })
    );
  }

  try {
    const { code, action } = (await req.json()) as {
      code?: string;
      action?: string;
    };
    if (!code || !action) {
      log.warn("missing_code_or_action", {
        route: "partner/check-redemption",
        method: req.method,
        correlationId: getCorrelationId(req),
      });
      return cors(
        req,
        NextResponse.json(
          { error: "Code and action are required" },
          { status: 400 }
        )
      );
    }

    const normalizedPartnerId = tokenPayload.partnerId?.toLowerCase();
    const isStaff = tokenPayload.role === "staff";
    const staffId =
      isStaff && "staffId" in tokenPayload
        ? (tokenPayload as { staffId?: string }).staffId ?? null
        : null;
    const processedRole = isStaff ? "staff" : "partner";
    const processedBy = {
      role: processedRole,
      staffId,
      email: tokenPayload.email ?? null,
      name: tokenPayload.name ?? null,
    } as const;

    if (action === "process") {
      const updated = await markRedemptionUsed({
        code,
        partnerId: normalizedPartnerId,
        processedBy,
      });
      if (!updated) {
        log.warn("redemption_not_found_or_processed", {
          route: "partner/check-redemption",
          action: "process",
          code,
          correlationId: getCorrelationId(req),
        });
        return cors(
          req,
          NextResponse.json(
            { error: "Redemption not found or already processed" },
            { status: 404 }
          )
        );
      }

      // Optional webhook
      if (process.env.REDEMPTION_PROCESSED_WEBHOOK_URL) {
        fetch(process.env.REDEMPTION_PROCESSED_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "redemption_processed",
            code,
            partnerId: normalizedPartnerId,
            processedAt: new Date().toISOString(),
            userEmail: updated.email,
            rewardId: updated.reward_id,
          }),
        }).catch(() => {});
      }

      const fresh = await getRedemptionByCode(code);
      const rewardResp = fresh ? await getRewardById(fresh.reward_id) : null;
      const metadata = (fresh?.metadata ?? {}) as Record<string, unknown>;

      return cors(
        req,
        NextResponse.json({
          success: true,
          message: "Redemption processed successfully",
          redemption: fresh
            ? {
                code: fresh.code,
                email: fresh.email,
                rewardId: fresh.reward_id,
                rewardName:
                  (metadata.rewardName as string | undefined) ??
                  rewardResp?.reward?.name ??
                  null,
                pointsCost:
                  (metadata.pointsCost as number | undefined) ??
                  rewardResp?.reward?.pointsCost ??
                  null,
                status: fresh.status,
                processedAt: fresh.used_at,
                partnerId: fresh.partner_id,
                metadata,
                processedBy:
                  (metadata.processedBy as
                    | Record<string, unknown>
                    | undefined) ?? null,
              }
            : null,
          reward: rewardResp?.reward
            ? {
                name: rewardResp.reward.name,
                pointsCost: rewardResp.reward.pointsCost,
                description: rewardResp.reward.description,
                redemptionInstructions:
                  rewardResp.reward.redemptionInstructions,
              }
            : null,
        })
      );
    }

    if (action === "reject") {
      const updated = await rejectRedemption({
        code,
        partnerId: normalizedPartnerId,
        processedBy,
      });
      if (!updated) {
        log.warn("redemption_not_found_or_processed", {
          route: "partner/check-redemption",
          action: "reject",
          code,
          correlationId: getCorrelationId(req),
        });
        return cors(
          req,
          NextResponse.json(
            { error: "Redemption not found or already processed" },
            { status: 404 }
          )
        );
      }
      const rewardResp = await getRewardById(updated.reward_id);
      const metadata = (updated.metadata ?? {}) as Record<string, unknown>;
      return cors(
        req,
        NextResponse.json({
          success: true,
          message: "Redemption rejected",
          redemption: {
            code: updated.code,
            email: updated.email,
            rewardId: updated.reward_id,
            rewardName:
              (metadata.rewardName as string | undefined) ??
              rewardResp?.reward?.name ??
              null,
            pointsCost:
              (metadata.pointsCost as number | undefined) ??
              rewardResp?.reward?.pointsCost ??
              null,
            status: updated.status,
            rejectedAt: updated.updated_at,
            partnerId: updated.partner_id,
            metadata,
            processedBy:
              (metadata.processedBy as Record<string, unknown> | undefined) ??
              null,
          },
          reward: rewardResp?.reward
            ? {
                name: rewardResp.reward.name,
                pointsCost: rewardResp.reward.pointsCost,
                description: rewardResp.reward.description,
                redemptionInstructions:
                  rewardResp.reward.redemptionInstructions,
              }
            : null,
        })
      );
    }

    return cors(
      req,
      NextResponse.json(
        { error: "Invalid action. Use 'process' or 'reject'" },
        { status: 400 }
      )
    );
  } catch (err) {
    log.error("check-redemption POST error", err, {
      route: "partner/check-redemption",
      method: req.method,
      correlationId: getCorrelationId(req),
    });
    return cors(
      req,
      NextResponse.json(
        { error: "Failed to process redemption" },
        { status: 500 }
      )
    );
  }
}
