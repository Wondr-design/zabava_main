"use client";

import { useLocalizedRouter } from "@/i18n/use-localized-router";

import { DealDetailDrawer } from "@/components/admin/deals/deal-detail-drawer";
import type { DealWithMeta } from "@/lib/data/flash-deals";

export function DealDetailPage({
  dealId,
  fallbackDeal,
}: {
  dealId: string;
  fallbackDeal: DealWithMeta | null;
}) {
  const router = useLocalizedRouter();

  if (!dealId) {
    return <div className="px-6 py-8 text-sm text-red-600">Missing deal id.</div>;
  }

  return (
    <div className="px-6 py-8">
      <DealDetailDrawer
        dealId={dealId}
        fallbackDeal={
          fallbackDeal
            ? {
                id: fallbackDeal.deal.id,
                partnerId: fallbackDeal.deal.partner_id,
                partnerName: fallbackDeal.partnerName ?? null,
                dealType: fallbackDeal.deal.deal_type,
                isFeatured: fallbackDeal.deal.is_featured,
                bannerLeadHours: fallbackDeal.deal.banner_lead_hours,
                ticketRequirements:
                  (fallbackDeal.deal.ticket_requirements as Array<{
                    ticketType: string;
                    subType?: string;
                    quantity: number;
                  }> | null) ?? [],
                title: fallbackDeal.deal.title,
                description: fallbackDeal.deal.description,
                status: fallbackDeal.deal.status,
                discountPercent: fallbackDeal.deal.discount_percent,
                minVisitors: fallbackDeal.deal.min_visitors,
                validFrom: fallbackDeal.deal.valid_from,
                validTo: fallbackDeal.deal.valid_to,
                validDays: fallbackDeal.deal.valid_days,
                commissionPercent: fallbackDeal.deal.commission_percent,
                priceOverrideCzk: fallbackDeal.deal.price_override_czk,
                bonusPointsOverride: fallbackDeal.deal.bonus_points_override,
                qrValiditySeconds: fallbackDeal.deal.qr_validity_seconds,
                usageLimit: fallbackDeal.deal.usage_limit,
                usageLimitDaily: fallbackDeal.deal.usage_limit_daily,
                usageCount: fallbackDeal.deal.usage_count,
                tags: fallbackDeal.deal.tags,
                audience: fallbackDeal.deal.audience,
                ticketTypes: fallbackDeal.deal.ticket_types ?? [],
                city: fallbackDeal.deal.city,
                autoExpire: fallbackDeal.deal.auto_expire,
                sendReminders: fallbackDeal.deal.send_reminders,
                createdAt: fallbackDeal.deal.created_at,
                updatedAt: fallbackDeal.deal.updated_at,
                media: fallbackDeal.media
                  ? fallbackDeal.media.map((item) => ({
                      id: item.id,
                      mediaType: item.media_type,
                      url: item.url,
                      altText: item.alt_text,
                      sortOrder: item.sort_order,
                    }))
                  : undefined,
                usageStats: fallbackDeal.usageStats
                  ? {
                      qrGenerated: fallbackDeal.usageStats.qr_generated,
                      qrScanned: fallbackDeal.usageStats.qr_scanned,
                      qrRejected: fallbackDeal.usageStats.qr_rejected,
                      commissionCzk: fallbackDeal.usageStats.commission_czk,
                      bonusAwarded: fallbackDeal.usageStats.bonus_awarded,
                      updatedAt: fallbackDeal.usageStats.updated_at,
                    }
                  : null,
              }
            : null
        }
        onNavigateBack={() => router.push("/admin/deals")}
      />
    </div>
  );
}
