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
  let forms: Awaited<ReturnType<typeof listPartnerForms>> = [];
  let partners: Awaited<ReturnType<typeof fetchPartnersOverview>> = [];
  let selected: Awaited<ReturnType<typeof getPartnerFormById>> | null = null;
  let rewardsData: Awaited<ReturnType<typeof listRewards>> = {
    rewards: [],
    statistics: {
      totalRewards: 0,
      activeRewards: 0,
      categories: [],
      totalStock: 0,
    },
  };
  let dealOptions: Awaited<ReturnType<typeof listDealSummariesForForms>> = [];

  try {
    const [
      allForms,
      partnerOverview,
      selectedForm,
      rewards,
      deals,
    ] = await Promise.all([
      listPartnerForms({ limit: 100 }),
      fetchPartnersOverview(),
      getPartnerFormById(formId),
      listRewards(),
      listDealSummariesForForms({ statuses: ["live", "scheduled"] }),
    ]);
    forms = allForms;
    partners = partnerOverview;
    selected = selectedForm;
    rewardsData = rewards;
    dealOptions = deals;
    console.info("admin_form_detail_page_loaded", {
      formId,
      formCount: allForms.length,
      partnerCount: partnerOverview.length,
      dealsCount: deals.length,
      hasSelected: Boolean(selectedForm),
      selectedUsageType: selectedForm?.usageType,
    });
  } catch (error) {
    console.error("admin_form_detail_page_load_error", {
      formId,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  if (!selected) {
    console.error("admin_form_detail_page_not_found", { formId });
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
