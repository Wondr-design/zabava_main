import { NextRequest, NextResponse } from "next/server";

import { getPublicDealBySlug } from "@/lib/data/flash-deals";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const deal = await getPublicDealBySlug(slug);
  if (!deal) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  return NextResponse.json({ deal });
}
