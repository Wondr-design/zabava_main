import type { Metadata } from "next";

import { DealCreateForm, type PartnerOption } from "@/components/admin/deals/deal-create-form";
import { PageHeader } from "@/components/design-system/page-header";
import { listPartnerMetas } from "@/lib/data/partners";
import { listPartnerForms } from "@/lib/data/partner-forms";

export const metadata: Metadata = {
  title: "Create deal · Zabava admin",
};

export default async function AdminDealCreatePage() {
  let partners: Awaited<ReturnType<typeof listPartnerMetas>> = [];
  let forms: Awaited<ReturnType<typeof listPartnerForms>> = [];
  let loadError: string | null = null;

  try {
    [partners, forms] = await Promise.all([
      listPartnerMetas(),
      listPartnerForms({ usageType: "deal", status: "published", limit: 100 }),
    ]);
  } catch (error) {
    console.error("admin_deal_create_page_load_error", error);
    loadError =
      error instanceof Error ? error.message : "Failed to load deal resources.";
    if (partners.length === 0) {
      try {
        partners = await listPartnerMetas();
      } catch (retryError) {
        console.error("admin_deal_create_page_partner_retry_error", retryError);
      }
    }
    if (!forms.length) {
      try {
        forms = await listPartnerForms({ usageType: "deal", status: "published", limit: 100 });
      } catch (formRetryError) {
        console.error("admin_deal_create_page_form_retry_error", formRetryError);
      }
    }
  }

  const partnerOptions: PartnerOption[] = partners.map((partner) => ({
    id: partner.partnerId,
    label: partner.displayName ?? partner.partnerId,
    status: partner.status,
    defaultCommission: partner.contract.commissionRate ?? null,
    ticketTypes: partner.ticketing.ticketTypes ?? [],
  }));
  const formOptions = forms.map((form) => ({ id: form.id, name: form.name }));

  return (
    <div className="px-6 py-8 space-y-6">
      <PageHeader
        title="Create new deal"
        description="Configure a flash deal, weekly promo, or group offer for a partner."
      />

      {loadError ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Unable to load all deal resources. Please confirm Supabase migrations are applied and refresh. Details:{" "}
          {loadError}
        </div>
      ) : null}

      <DealCreateForm partnerOptions={partnerOptions} formOptions={formOptions} />
    </div>
  );
}
