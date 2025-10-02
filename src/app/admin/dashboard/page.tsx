import { fetchDashboardMetrics, fetchRecentVisits } from '@/lib/data/analytics';
import { StatsGrid } from '@/components/dashboard/stats-grid';
import { RecentVisitsTable } from '@/components/dashboard/recent-visits-table';
import { VisitRegistrationForm } from '@/components/visits/visit-registration-form';
import { PartnerVisitActions } from '@/components/visits/partner-visit-actions';
import { PendingLookupCard } from '@/components/visits/pending-lookup-card';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminDashboardPage() {
  const [metrics, recentVisits] = await Promise.all([
    fetchDashboardMetrics(),
    fetchRecentVisits(6),
  ]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-slate-100">Dashboard</h1>
        <p className="text-sm text-slate-400">
          Plan, track, and act on partner performance.
        </p>
      </header>

      <StatsGrid metrics={metrics} />

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <RecentVisitsTable visits={recentVisits} />
        <PendingLookupCard />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <VisitRegistrationForm />
        <PartnerVisitActions />
      </section>
    </div>
  );
}
