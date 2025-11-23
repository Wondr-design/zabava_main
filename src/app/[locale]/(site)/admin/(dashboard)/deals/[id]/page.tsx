import type { Metadata } from "next";

import { DealDetailPage } from "@/components/admin/deals/deal-detail-page";
import { getDealWithMeta } from "@/lib/data/flash-deals";

export const metadata: Metadata = {
  title: "Deal detail · Zabava admin",
};

export default async function AdminDealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const deal = await getDealWithMeta(id);

  return <DealDetailPage dealId={id} fallbackDeal={deal} />;
}
