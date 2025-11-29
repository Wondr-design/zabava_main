import type { Metadata } from "next";

import type { FlashDeal } from "@/lib/data/flash-deals";
import { listFlashDeals } from "@/lib/data/flash-deals";
import type { FlashDealsTableItem } from "@/components/admin/flash-deals/flash-deals-table";
import { FlashDealsManager } from "@/components/admin/flash-deals/flash-deals-manager";

export const metadata: Metadata = {
  title: "Flash deals · Zabava admin",
};

function mapFlashDeal(deal: FlashDeal): FlashDealsTableItem {
  return {
    id: deal.id,
    partnerId: deal.partner_id,
    title: deal.title,
    description: deal.description,
    status: deal.status,
    discountPercent: deal.discount_percent,
    minVisitors: deal.min_visitors,
    commissionPercent: deal.commission_percent,
    usageCount: deal.usage_count,
    usageLimit: deal.usage_limit,
    validFrom: deal.valid_from,
    validTo: deal.valid_to,
    validDays: deal.valid_days,
    qrValiditySeconds: deal.qr_validity_seconds,
  };
}

export default async function AdminFlashDealsPage() {
  const flashDeals = await listFlashDeals({});
  const items = flashDeals.map(mapFlashDeal);

  return (
    <div className="space-y-6 px-6 py-8">
      <FlashDealsManager deals={items} />
    </div>
  );
}

