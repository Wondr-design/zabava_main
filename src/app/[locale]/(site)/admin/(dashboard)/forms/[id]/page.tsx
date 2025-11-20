import { notFound } from "next/navigation";

import { AdminFormBuilder } from "@/components/admin/forms/form-builder";
import { fetchPartnersOverview } from "@/lib/data/analytics";
import {
  getPartnerFormById,
  listPartnerForms,
} from "@/lib/data/partner-forms";
import { listRewards } from "@/lib/data/rewards";
import { listDealSummariesForForms } from "@/lib/data/flash-deals";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AdminFormDetailPageContext = {
  params: Promise<{ id: string }>;
};

export default async function AdminFormDetailPage({
  params,
}: AdminFormDetailPageContext) {
  const { id: formId } = await params;
  const [forms, partners, selected, rewardsData, dealOptions] = await Promise.all([
    listPartnerForms({ limit: 100 }),
    fetchPartnersOverview(),
    getPartnerFormById(formId),
    listRewards(),
    listDealSummariesForForms({ statuses: ["live", "scheduled"] })
  ]);

  if (!selected) {
    notFound();
  }

  const partnerOptions = partners.map((partner) => ({
    id: partner.id,
    displayName: partner.display_name,
    type: partner.type,
  }));

  const combinedForms = [
    selected,
    ...forms.filter((form) => form.id !== selected.id),
  ];

  return (
    <AdminFormBuilder
      forms={combinedForms}
      partners={partnerOptions}
      initialSelectedId={selected.id}
      rewards={rewardsData.rewards}
      deals={dealOptions}
    />
  );
}
