'use client';

import { useEffect, useState, useTransition } from 'react';
import { VisitRegistrationRecord } from '@/lib/data/visits';
import { PointsHistoryRecord } from '@/lib/data/points';
import { VisitDetailDrawer } from './visit-detail-drawer';

interface VisitDetailPanelProps {
  visit: VisitRegistrationRecord | null;
  onClose: () => void;
}

interface VisitDetailResponse {
  visit: VisitRegistrationRecord;
  history: PointsHistoryRecord[];
}

export function VisitDetailPanel({ visit, onClose }: VisitDetailPanelProps) {
  const [open, setOpen] = useState<boolean>(Boolean(visit));
  const [data, setData] = useState<VisitDetailResponse | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!visit) {
      setOpen(false);
      setData(null);
      return;
    }

    setOpen(true);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/visits/${visit.id}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load visit');
        const json = (await res.json()) as VisitDetailResponse;
        setData(json);
      } catch (error) {
        console.error('visit detail fetch error', error);
        setData(null);
      }
    });
  }, [visit]);

  return (
    <VisitDetailDrawer
      visit={data?.visit ?? visit}
      history={data?.history ?? []}
      open={Boolean(visit && open)}
      onOpenChange={(next) => {
        if (!next) {
          setOpen(false);
          setData(null);
          onClose();
        }
      }}
    />
  );
}
