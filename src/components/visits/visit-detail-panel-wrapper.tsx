'use client';

import { useState } from 'react';
import { VisitsFilterBar } from '@/components/visits/visits-filter-bar';
import { RecentVisitsTable } from '@/components/dashboard/recent-visits-table';
import { VisitDetailPanel } from './visit-detail-panel';
import { VisitRegistrationRecord } from '@/lib/data/visits';

interface VisitDetailPanelWrapperProps {
  initialVisits: VisitRegistrationRecord[];
  initialFilters: { email: string; partnerId: string; status: string };
}

export function VisitDetailPanelWrapper({ initialVisits, initialFilters }: VisitDetailPanelWrapperProps) {
  const [selectedVisit, setSelectedVisit] = useState<VisitRegistrationRecord | null>(null);

  return (
    <div className="space-y-6">
      <VisitsFilterBar
        initialEmail={initialFilters.email}
        initialPartnerId={initialFilters.partnerId}
        initialStatus={initialFilters.status}
      />
      <RecentVisitsTable visits={initialVisits} onSelectVisit={setSelectedVisit} showLinks />
      <VisitDetailPanel visit={selectedVisit} onClose={() => setSelectedVisit(null)} />
    </div>
  );
}
