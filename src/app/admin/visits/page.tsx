import { fetchVisits } from '@/lib/data/analytics';
import { VisitDetailPanelWrapper } from '@/components/visits/visit-detail-panel-wrapper';

type SearchParams = Record<string, string | string[] | undefined>;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminVisitsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const email = typeof params.email === 'string' ? params.email : '';
  const partnerId = typeof params.partnerId === 'string' ? params.partnerId : '';
  const status = typeof params.status === 'string' ? params.status : '';

  const normalizedStatus = ['pending', 'visited', 'cancelled'].includes(status)
    ? (status as 'pending' | 'visited' | 'cancelled')
    : undefined;

  const visits = await fetchVisits({ email, partnerId, status: normalizedStatus, limit: 100 });

  return (
    <VisitDetailPanelWrapper initialVisits={visits} initialFilters={{ email, partnerId, status }} />
  );
}
