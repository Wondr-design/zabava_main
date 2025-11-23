import type { Metadata } from "next";

import { DealCreateForm, type PartnerOption, type DealFormInitialData } from "@/components/admin/deals/deal-create-form";
import { PageHeader } from "@/components/design-system/page-header";
import { getDealWithMeta } from "@/lib/data/flash-deals";
import { listPartnerMetas } from "@/lib/data/partners";

export const metadata: Metadata = {
  title: "Edit deal · Zabava admin",
};

export default async function AdminDealEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let deal: Awaited<ReturnType<typeof getDealWithMeta>> | null = null;
  let partners: Awaited<ReturnType<typeof listPartnerMetas>> = [];
  let loadError: string | null = null;

  try {
    const [entry, partnerList] = await Promise.all([
      getDealWithMeta(id),
      listPartnerMetas(),
    ]);
    deal = entry;
    partners = partnerList;
  } catch (error) {
    console.error("admin_deal_edit_page_load_error", error);
    loadError =
      error instanceof Error ? error.message : "Failed to load deal resources.";
    if (!deal) {
      try {
        deal = await getDealWithMeta(id);
      } catch (retryError) {
        console.error("admin_deal_edit_page_retry_error", retryError);
      }
    }
    if (!partners.length) {
      try {
        partners = await listPartnerMetas();
      } catch (partnerRetryError) {
        console.error("admin_deal_edit_page_partner_retry_error", partnerRetryError);
      }
    }
  }

  if (!deal) {
    return (
      <div className="px-6 py-8 text-sm text-red-600">
        Unable to load the selected deal.
      </div>
    );
  }

  const partnerOptions: PartnerOption[] = partners.map((partner) => ({
    id: partner.partnerId,
    label: partner.displayName ?? partner.partnerId,
    status: partner.status,
    defaultCommission: partner.contract.commissionRate ?? null,
    ticketTypes: partner.ticketing.ticketTypes ?? [],
  }));

  const heroMedia = (deal.media ?? []).find((item) =>
    (item.media_type ?? "").includes("hero"),
  ) ?? (deal.media?.[0] ?? null);

  const existingDeal: DealFormInitialData = {
    id: deal.deal.id,
    partnerId: deal.deal.partner_id,
    status: deal.deal.status,
    title: deal.deal.title,
    slug: deal.deal.slug,
    description: deal.deal.description,
    discountPercent: deal.deal.discount_percent,
    minVisitors: deal.deal.min_visitors,
    commissionPercent: deal.deal.commission_percent,
    priceOverrideCzk: deal.deal.price_override_czk,
    bonusPointsOverride: deal.deal.bonus_points_override,
    isFeatured: deal.deal.is_featured,
    bannerLeadHours: deal.deal.banner_lead_hours,
    qrValiditySeconds: deal.deal.qr_validity_seconds,
    usageLimit: deal.deal.usage_limit,
    usageLimitDaily: deal.deal.usage_limit_daily,
    validFrom: deal.deal.valid_from,
    validTo: deal.deal.valid_to,
    validDays: deal.deal.valid_days,
    autoExpire: deal.deal.auto_expire,
    sendReminders: deal.deal.send_reminders,
    ticketTypes: deal.deal.ticket_types ?? [],
    ticketRequirements:
      (deal.deal.ticket_requirements as Array<{
        ticketType: string;
        subType?: string;
        quantity: number;
      }> | null) ?? [],
    heroImageUrl: heroMedia?.url ?? null,
    heroImageAlt: heroMedia?.alt_text ?? null,
  };

  return (
    <div className="px-6 py-8 space-y-6">
      <PageHeader
        title="Edit deal"
        description="Update deal configuration, visibility, and conditions."
      />

      {loadError ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Unable to load all deal resources. Please confirm Supabase migrations are applied and refresh. Details: {loadError}
        </div>
      ) : null}

      <DealCreateForm
        mode="edit"
        existingDeal={existingDeal}
        partnerOptions={partnerOptions}
      />
    </div>
  );
}
