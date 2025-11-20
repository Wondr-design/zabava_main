import type { Metadata } from "next";

import { listDealsWithMeta, type DealWithMeta } from "@/lib/data/flash-deals";
import { listPartnerMetas } from "@/lib/data/partners";
import { DealsDashboard, type AdminDealListItem } from "@/components/admin/deals/deals-dashboard";
import { listGlobalValues, type GlobalValueRecord } from "@/lib/data/global-values";

export const metadata: Metadata = {
  title: "Deals · Zabava admin",
};

function mapDeal(entry: DealWithMeta): AdminDealListItem {
  const { deal, usageStats, media } = entry;
  const mediaItems = (media ?? []).map((item) => ({
    id: item.id,
    mediaType: item.media_type,
    url: item.url,
    altText: item.alt_text,
    sortOrder: item.sort_order,
  }));

  return {
    id: deal.id,
    partnerId: deal.partner_id,
    partnerName: entry.partnerName ?? null,
    dealType: deal.deal_type,
    title: deal.title,
    description: deal.description,
    status: deal.status,
    discountPercent: deal.discount_percent,
    minVisitors: deal.min_visitors,
    validFrom: deal.valid_from,
    validTo: deal.valid_to,
    validDays: deal.valid_days,
    commissionPercent: deal.commission_percent,
    priceOverrideCzk: deal.price_override_czk,
    bonusPointsOverride: deal.bonus_points_override,
    qrValiditySeconds: deal.qr_validity_seconds,
    usageLimit: deal.usage_limit,
    usageLimitDaily: deal.usage_limit_daily,
    usageCount: deal.usage_count,
    autoExpire: deal.auto_expire,
    sendReminders: deal.send_reminders,
    tags: deal.tags,
    audience: deal.audience,
    ticketTypes: deal.ticket_types ?? [],
    city: deal.city,
    createdAt: deal.created_at,
    updatedAt: deal.updated_at,
    media: mediaItems.length ? mediaItems : undefined,
    usageStats: usageStats
      ? {
          qrGenerated: usageStats.qr_generated,
          qrScanned: usageStats.qr_scanned,
          qrRejected: usageStats.qr_rejected,
          commissionCzk: usageStats.commission_czk,
          bonusAwarded: usageStats.bonus_awarded,
          updatedAt: usageStats.updated_at,
        }
      : {
          qrGenerated: 0,
          qrScanned: 0,
          qrRejected: 0,
          commissionCzk: 0,
          bonusAwarded: 0,
          updatedAt: deal.updated_at,
        },
  };
}

export default async function AdminDealsPage() {
  let deals: DealWithMeta[] = [];
  let partners: Awaited<ReturnType<typeof listPartnerMetas>> = [];
  let ticketTypes: GlobalValueRecord[] = [];
  let loadError: string | null = null;

  try {
    [deals, partners, ticketTypes] = await Promise.all([
      listDealsWithMeta(),
      listPartnerMetas(),
      listGlobalValues({ type: "ticket_type", includeInactive: true }),
    ]);
  } catch (error) {
    console.error("admin_deals_page_load_error", error);
    loadError =
      error instanceof Error ? error.message : "Failed to load deal data.";
    if (deals.length === 0) {
      try {
        deals = await listDealsWithMeta();
      } catch (retryError) {
        console.error("admin_deals_page_retry_error", retryError);
      }
    }
    if (partners.length === 0) {
      try {
        partners = await listPartnerMetas();
      } catch (retryError) {
        console.error("admin_deals_page_partner_retry_error", retryError);
      }
    }
    if (ticketTypes.length === 0) {
      try {
        ticketTypes = await listGlobalValues({
          type: "ticket_type",
          includeInactive: true,
        });
      } catch (retryError) {
        console.error("admin_deals_page_ticket_type_retry_error", retryError);
      }
    }
  }

  const items = deals.map(mapDeal);
  const partnerOptions = partners.map((partner) => ({
    id: partner.partnerId,
    label: partner.displayName ?? partner.partnerId,
    status: partner.status,
    defaultCommission: partner.contract.commissionRate ?? null,
  }));

  return (
    <div className="px-6 py-8 space-y-4">
      {loadError ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      Unable to load the latest deal data. Please confirm the Supabase migrations
      have been applied and refresh. Details: {loadError}
    </div>
  ) : null}
      <DealsDashboard
        initialItems={items}
        partnerOptions={partnerOptions}
        ticketTypeValues={ticketTypes}
      />
    </div>
  );
}
