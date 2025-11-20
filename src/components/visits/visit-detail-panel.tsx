'use client';

import { useEffect, useState, useTransition } from 'react';
import { VisitRegistrationRecord } from '@/lib/data/visits';
import { PointsHistoryRecord } from '@/lib/data/points';
import { NormalizedVisitRecord } from '@/lib/services/visit-normalizer';
import { VisitDetailDrawer } from './visit-detail-drawer';
import { CardSkeleton } from '@/components/ui/skeletons';

interface VisitDetailPanelProps {
  visit: VisitRegistrationRecord | null;
  onClose: () => void;
}

interface VisitDetailResponse {
  visit: VisitRegistrationRecord;
  history: PointsHistoryRecord[];
  normalized: NormalizedVisitRecord | null;
}

export function VisitDetailPanel({ visit, onClose }: VisitDetailPanelProps) {
  const [open, setOpen] = useState<boolean>(Boolean(visit));
  const [data, setData] = useState<VisitDetailResponse | null>(null);
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visit) {
      setOpen(false);
      setData(null);
      setLoading(false);
      return;
    }

    setOpen(true);
    setLoading(true);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/visits/${visit.id}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load visit');
        const json = (await res.json()) as VisitDetailResponse;
        setData(json);
      } catch (error) {
        console.error('visit detail fetch error', error);
        setData(null);
      } finally {
        setLoading(false);
      }
    });
  }, [visit]);

  // Show skeleton while loading if we have a visit but no data yet
  if (visit && loading && !data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="w-full max-w-4xl mx-4">
          <CardSkeleton showHeader showDescription rows={8} />
        </div>
      </div>
    );
  }

  return (
    <VisitDetailDrawer
      visit={data?.visit ?? visit}
      history={data?.history ?? []}
      normalized={data?.normalized ?? null}
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
