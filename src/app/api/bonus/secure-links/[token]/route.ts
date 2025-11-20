import { NextRequest, NextResponse } from "next/server";

import {
  consumeBonusSecureLink,
  type ConsumeBonusSecureLinkResult,
} from "@/lib/data/bonus-secure-links";
import { loadBonusDashboard } from "@/lib/data/bonus-dashboard";
import { withCors, preflightResponse } from "@/lib/http/cors";
import { log, getCorrelationId } from "@/lib/logging";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export function OPTIONS() {
  return preflightResponse({ methods: "GET, OPTIONS", headers: "Content-Type" });
}

function statusToCode(result: ConsumeBonusSecureLinkResult["status"]) {
  switch (result) {
    case "expired":
      return 410;
    case "consumed":
      return 409;
    case "invalid":
    default:
      return 404;
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const correlationId = getCorrelationId(req);
  try {
    const { token: rawToken } = await context.params;
    const token = rawToken?.trim();
    if (!token) {
      return withCors(
        NextResponse.json({ error: "Token is required" }, { status: 400 }),
      );
    }

    const consumption = await consumeBonusSecureLink(token);
    if (consumption.status !== "ok") {
      return withCors(
        NextResponse.json(
          { error: consumption.status },
          { status: statusToCode(consumption.status) },
        ),
      );
    }

    const dashboard = await loadBonusDashboard(consumption.email);
    const supabase = getSupabaseAdmin();

    const partnerIds = Array.from(
      new Set(
        (dashboard.availableRewards ?? [])
          .flatMap((reward) => reward.availableFor ?? [])
          .filter((value): value is string => Boolean(value)),
      ),
    );
    let partnerNameMap = new Map<string, string>();
    if (partnerIds.length > 0) {
      const { data: partnerRows, error: partnerError } = await supabase
        .from("partners")
        .select("id, display_name")
        .in("id", partnerIds);
      if (!partnerError) {
        partnerNameMap = new Map(
          (partnerRows ?? []).map((row) => [
            row.id as string,
            (row.display_name as string | null) || (row.id as string),
          ]),
        );
      }
    }
    const enrichedRewards = (dashboard.availableRewards ?? []).map((reward) => {
      const partnerNames = (reward.availableFor ?? []).map(
        (id) => partnerNameMap.get(id) ?? id,
      );
      return {
        ...reward,
        partnerNames,
      };
    });

    const { data: pointsRows, error: pointsError } = await supabase
      .from("points_history")
      .select(
        "id, type, points, created_at, partner_id, partner_name, visit_id, meta",
      )
      .eq("email", consumption.email)
      .order("created_at", { ascending: false })
      .limit(50);
    if (pointsError) {
      throw new Error(pointsError.message);
    }

    const { data: redemptionRows, error: redemptionError } = await supabase
      .from("redemptions")
      .select(
        "code, status, created_at, used_at, expires_at, partner_id, reward_id, reward:rewards(name, points_cost)",
      )
      .eq("email", consumption.email)
      .order("created_at", { ascending: false })
      .limit(50);
    if (redemptionError) {
      throw new Error(redemptionError.message);
    }
    const mappedRedemptions = (redemptionRows ?? []).map((row) => ({
      ...row,
      reward: row.reward ?? null,
    }));

    log.info("bonus_secure_link_consumed", {
      email: consumption.email,
      correlationId,
    });

    return withCors(
      NextResponse.json({
        link: {
          email: consumption.email,
          expiresAt: consumption.expiresAt,
        },
        data: {
          ...dashboard,
          availableRewards: enrichedRewards,
        },
        pointsHistory: pointsRows ?? [],
        redemptions: mappedRedemptions,
      }),
    );
  } catch (error) {
    log.error("bonus_secure_link_consume_error", error, { correlationId });
    return withCors(
      NextResponse.json({ error: "Unable to load secure link" }, { status: 500 }),
    );
  }
}
