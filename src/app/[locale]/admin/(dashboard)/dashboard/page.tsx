import { PartnerVisitActions } from "@/components/visits/partner-visit-actions";
import { RecentVisitsTable } from "@/components/dashboard/recent-visits-table";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import {
  fetchDashboardMetrics,
  fetchRecentVisits,
} from "@/lib/data/analytics";
import { RefreshButton } from "@/components/ui/refresh-button";
import { PageHeader, SectionCard } from "@/components/design-system";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminDashboardPage() {
  const [metrics, recentVisits] = await Promise.all([
    fetchDashboardMetrics(),
    fetchRecentVisits(6),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Zabava admin dashboard"
        description="Plan, track, and act on partner performance across visits, rewards, and redemptions."
        actions={<RefreshButton variant="tonal" />}
      />

      <SectionCard
        title="Operational snapshot"
        description="Key totals summarising visits and partner activity."
      >
        <StatsGrid metrics={metrics} />
      </SectionCard>

      <RecentVisitsTable visits={recentVisits} showLinks />

      <PartnerVisitActions />
    </div>
  );
}
