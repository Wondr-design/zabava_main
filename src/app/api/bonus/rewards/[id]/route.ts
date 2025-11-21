import { NextRequest, NextResponse } from "next/server";

import { withCors, preflightResponse } from "@/lib/http/cors";
import { getRewardById } from "@/lib/data/rewards";
import {
  applyBookingCapToForm,
  getPartnerFormById,
} from "@/lib/data/partner-forms";
import { loadPartnerMeta } from "@/lib/data/partners";
import { log, getCorrelationId } from "@/lib/logging";

const CORS_CONFIG = {
  methods: "GET,OPTIONS",
  headers: "Content-Type",
} as const;

export function OPTIONS() {
  return preflightResponse(CORS_CONFIG);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const rewardId = id ?? "";
  if (!rewardId) {
    return withCors(
      NextResponse.json({ error: "Reward ID is required" }, { status: 400 }),
      CORS_CONFIG,
    );
  }

  const correlationId = getCorrelationId(request);

  try {
    const rewardResp = await getRewardById(rewardId);
    const reward = rewardResp?.reward ?? null;
    if (!reward || reward.status !== "active" || reward.isAvailable === false) {
      return withCors(
        NextResponse.json({ error: "Reward unavailable" }, { status: 404 }),
        CORS_CONFIG,
      );
    }

    if (!reward.redemptionFormId) {
      return withCors(
        NextResponse.json(
          { error: "Reward is missing a redemption form" },
          { status: 422 },
        ),
        CORS_CONFIG,
      );
    }

    const form = await getPartnerFormById(reward.redemptionFormId);
    if (!form || form.status !== "published") {
      return withCors(
        NextResponse.json(
          { error: "Redemption form unavailable" },
          { status: 409 },
        ),
        CORS_CONFIG,
      );
    }

    if (form.usageType !== "reward") {
      log.warn("bonus_reward_form_usage_mismatch", {
        rewardId,
        formId: form.id,
        usageType: form.usageType,
        correlationId,
      });
    }

    if (form.rewardId && form.rewardId !== reward.id) {
      log.warn("bonus_reward_form_link_mismatch", {
        rewardId,
        formId: form.id,
        linkedRewardId: form.rewardId,
        correlationId,
      });
    }

    let partnerBookingCap: number | null = null;
    const candidatePartnerId =
      form.partnerId ||
      form.config.partner?.id ||
      (reward.availableFor && reward.availableFor.length === 1
        ? reward.availableFor[0]
        : null);
    if (candidatePartnerId) {
      try {
        const partnerMeta = await loadPartnerMeta(candidatePartnerId);
        const cap = partnerMeta.ticketing.maxGuestsPerBooking;
        partnerBookingCap =
          typeof cap === "number" && Number.isFinite(cap) && cap > 0
            ? cap
            : null;
      } catch (error) {
        log.warn("bonus_reward_partner_cap_lookup_failed", {
          rewardId,
          formId: form.id,
          partnerId: candidatePartnerId,
          error: (error as Error)?.message ?? String(error),
          correlationId,
        });
      }
    }

    const enrichedForm = applyBookingCapToForm(form, partnerBookingCap);

    return withCors(
      NextResponse.json({
        reward: {
          id: reward.id,
          name: reward.name,
          description: reward.description,
          pointsCost: reward.pointsCost,
          category: reward.category,
          imageUrl: reward.imageUrl,
          heroImages: reward.heroImages,
          partnerLogoUrl: reward.partnerLogoUrl,
          ageGroups: reward.ageGroups,
          tags: reward.tags,
          savingsValue: reward.savingsValue,
          redemptionInstructions: reward.redemptionInstructions,
          availableFor: reward.availableFor,
          redemptionFormId: reward.redemptionFormId,
          status: reward.status,
          ticketType: reward.ticketType,
          transportIncluded: reward.transportIncluded,
          isAvailable: reward.isAvailable,
        },
        form: enrichedForm,
      }),
      CORS_CONFIG,
    );
  } catch (error) {
    log.error("bonus_reward_fetch_error", error, {
      rewardId,
      correlationId,
    });
    return withCors(
      NextResponse.json(
        { error: "Failed to load reward" },
        { status: 500 },
      ),
      CORS_CONFIG,
    );
  }
}
