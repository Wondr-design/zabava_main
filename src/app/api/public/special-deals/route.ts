import { NextRequest, NextResponse } from "next/server";

import {
  listPublicDeals,
  type DealType,
  type PublicDealFilters,
} from "@/lib/data/flash-deals";

const DEAL_TYPES: DealType[] = ["flash", "weekly_promo", "group"];

function normalizeParam(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) {
    return value.length > 0 ? value[0] : undefined;
  }
  return value ?? undefined;
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const city = normalizeParam(params.get("city"));
  const tag = normalizeParam(params.get("tag"));
  const audience = normalizeParam(params.get("audience"));
  const dealTypeParam = normalizeParam(params.get("type"));
  const onlyActiveParam = normalizeParam(params.get("onlyActive"));
  const limitParam = normalizeParam(params.get("limit"));

  const filters: PublicDealFilters = {
    city,
    tag,
    audience,
    dealType: DEAL_TYPES.includes((dealTypeParam ?? "") as DealType)
      ? (dealTypeParam as DealType)
      : null,
    onlyActive: onlyActiveParam === "true" ? true : undefined,
  };

  if (limitParam) {
    const parsed = Number(limitParam);
    if (Number.isFinite(parsed) && parsed > 0) {
      filters.limit = Math.floor(parsed);
    }
  }

  const result = await listPublicDeals(filters);

  return NextResponse.json({
    deals: result.items,
    facets: result.facets,
    generatedAt: result.generatedAt,
  });
}
