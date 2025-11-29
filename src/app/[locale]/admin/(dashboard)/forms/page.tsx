import { AdminFormsOverview } from "@/components/admin/forms/forms-overview";
import { fetchPartnersOverview } from "@/lib/data/analytics";
import { listPartnerForms } from "@/lib/data/partner-forms";
import { listRewards } from "@/lib/data/rewards";
import { listDealSummariesForForms } from "@/lib/data/flash-deals";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminFormsPage() {
  const [forms, partners, rewardsData, dealOptions] = await Promise.all([
    listPartnerForms({ limit: 50 }),
    fetchPartnersOverview(),
    listRewards(),
    listDealSummariesForForms({ statuses: ["live", "scheduled"] }),
  ]);

  const partnerOptions = partners.map((partner) => ({
    id: partner.id,
    displayName: partner.display_name,
    type: partner.type,
  }));

  return (
    <AdminFormsOverview
      forms={forms}
      partners={partnerOptions}
      rewards={rewardsData.rewards}
      deals={dealOptions}
    />
  );
}
