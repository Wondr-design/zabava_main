import type { Metadata } from "next";

import {
  DealCreateForm,
  type DealFormInitialData,
  type PartnerOption,
} from "@/components/admin/deals/deal-create-form";
import { PageHeader } from "@/components/design-system/page-header";
import { Button } from "@/components/ui/button";
import { LocalizedLink } from "@/components/ui/localized-link";
import { getDealWithMeta } from "@/lib/data/flash-deals";
import { listPartnerMetas } from "@/lib/data/partners";
import { listPartnerForms } from "@/lib/data/partner-forms";

export const metadata: Metadata = {
  title: "Deal detail · Zabava admin",
};

export default async function AdminDealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let deal: Awaited<ReturnType<typeof getDealWithMeta>> | null = null;
  let partners: Awaited<ReturnType<typeof listPartnerMetas>> = [];
  let forms: Awaited<ReturnType<typeof listPartnerForms>> = [];
  let loadError: string | null = null;

  try {
    const [entry, partnerList, formList] = await Promise.all([
      getDealWithMeta(id),
      listPartnerMetas(),
      listPartnerForms({ usageType: "deal", status: "published", limit: 100 }),
    ]);
    deal = entry;
    partners = partnerList;
    forms = formList;
    console.info("admin_deal_detail_page_loaded", {
      dealId: id,
      hasDeal: Boolean(entry),
      partnerCount: partnerList.length,
      formCount: formList.length,
    });
  } catch (error) {
    console.error("admin_deal_detail_page_load_error", error);
    loadError =
      error instanceof Error ? error.message : "Failed to load deal resources.";
    if (!deal) {
      try {
        deal = await getDealWithMeta(id);
      } catch (retryError) {
        console.error("admin_deal_detail_page_retry_error", retryError);
      }
    }
    if (!partners.length) {
      try {
        partners = await listPartnerMetas();
      } catch (partnerRetryError) {
        console.error("admin_deal_detail_page_partner_retry_error", partnerRetryError);
      }
    }
    if (!forms.length) {
      try {
        forms = await listPartnerForms({ usageType: "deal", status: "published", limit: 100 });
      } catch (formRetryError) {
        console.error("admin_deal_detail_form_retry_error", formRetryError);
      }
    }
  }

  if (!deal) {
    console.error("admin_deal_detail_page_missing_deal", {
      dealId: id,
      loadError,
    });
    return (
      <div className="px-6 py-8 text-sm text-red-600">
        Unable to load the selected deal.
      </div>
    );
  }

  const basePartnerOptions: PartnerOption[] = partners.map((partner) => ({
    id: partner.partnerId,
    label: partner.displayName ?? partner.partnerId,
    status: partner.status,
    defaultCommission: partner.contract.commissionRate ?? null,
    ticketTypes: partner.ticketing.ticketTypes ?? [],
  }));

  const selectedPartnerId =
    deal.deal.partner_id || deal.partnerName || "unassigned-partner";
  const hasSelectedPartner = basePartnerOptions.some(
    (partner) => partner.id === selectedPartnerId,
  );

  const partnerOptions: PartnerOption[] = hasSelectedPartner
    ? basePartnerOptions
    : [
        ...basePartnerOptions,
        {
          id: selectedPartnerId,
          label: deal.partnerName ?? selectedPartnerId,
          status: deal.deal.status,
          defaultCommission: deal.deal.commission_percent ?? null,
          ticketTypes: deal.deal.ticket_types ?? [],
        },
      ];

  const partnerLabel =
    partnerOptions.find((partner) => partner.id === selectedPartnerId)?.label ??
    deal.partnerName ??
    selectedPartnerId;

  const heroMedia =
    (deal.media ?? []).find((item) => (item.media_type ?? "").includes("hero")) ??
    (deal.media?.[0] ?? null);

  const existingDeal: DealFormInitialData = {
    id: deal.deal.id,
    partnerId: selectedPartnerId,
    status: deal.deal.status,
    title: deal.deal.title,
    slug: deal.deal.slug,
    description: deal.deal.description,
    isFeatured: deal.deal.is_featured,
    bannerLeadHours: deal.deal.banner_lead_hours,
    qrValiditySeconds: deal.deal.qr_validity_seconds,
    formId: deal.deal.form_id ?? null,
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
    timeZone: deal.deal.time_zone,
  };

  const formOptions = forms.map((form) => ({
    id: form.id,
    name: form.name,
  }));

  if (!forms.length) {
    console.warn("admin_deal_detail_page_no_forms", {
      dealId: id,
      loadError,
    });
  }

  console.info("admin_deal_detail_render_payload", {
    dealId: id,
    partnerOptionCount: partnerOptions.length,
    formOptionCount: formOptions.length,
    ticketTypeCount: existingDeal.ticketTypes.length,
    ticketRequirementCount: existingDeal.ticketRequirements.length,
  });

  return (
    <div className="px-6 py-8 space-y-6">
      <PageHeader
        title="Deal details"
        description={
          <div className="space-y-1">
            <p>Review the current configuration for this deal.</p>
            <p className="text-xs text-muted-foreground">
              Partner: <span className="font-semibold text-foreground">{partnerLabel}</span>{" "}
              <span className="font-mono text-[11px] text-muted-foreground">({deal.deal.partner_id})</span>
            </p>
          </div>
        }
        actions={
          <Button asChild size="sm">
            <LocalizedLink href={`/admin/deals/${id}/edit`}>Edit deal</LocalizedLink>
          </Button>
        }
      />

      {loadError ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Unable to load all deal resources. Please confirm Supabase migrations are applied and refresh. Details:{" "}
          {loadError}
        </div>
      ) : null}

      <DealCreateForm
        mode="edit"
        existingDeal={existingDeal}
        partnerOptions={partnerOptions}
        formOptions={formOptions}
        readOnly
      />
    </div>
  );
}
