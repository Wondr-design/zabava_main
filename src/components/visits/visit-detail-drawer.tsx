'use client';

import * as React from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerClose } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { VisitRegistrationRecord } from '@/lib/data/visits';
import { PointsHistoryRecord } from '@/lib/data/points';
import { formatDateTime } from '@/lib/format/date';

interface VisitDetailDrawerProps {
  visit: VisitRegistrationRecord | null;
  history: PointsHistoryRecord[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function VisitDetailDrawer({ visit, history, open, onOpenChange }: VisitDetailDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="border-slate-800 bg-slate-900">
        <DrawerHeader className="border-b border-slate-800 text-left">
          <DrawerTitle className="text-xl text-slate-100">Visit details</DrawerTitle>
          <DrawerDescription className="text-slate-400">Complete payload and point history.</DrawerDescription>
        </DrawerHeader>
        <div className="grid gap-6 p-6 text-sm text-slate-100">
          {visit ? (
            <React.Fragment>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DetailItem label="Email" value={visit.email} />
                <DetailItem label="Partner" value={visit.partner_id ?? '—'} />
                <DetailItem label="Status" value={visit.status ?? 'pending'} />
                <DetailItem label="Registered" value={formatDateTime(visit.created_at)} />
                <DetailItem label="Visited" value={formatDateTime(visit.visited_at)} />
                <DetailItem label="Estimated Points" value={String(visit.estimated_points ?? 0)} />
                <DetailItem label="Points Awarded" value={String(visit.points_awarded ?? 0)} />
                <DetailItem label="Total Price" value={`₦${visit.total_price ?? 0}`} />
              </div>

              <section className="space-y-2">
                <h3 className="text-base font-semibold">Payload</h3>
                <pre className="rounded-md bg-slate-950 p-4 text-xs text-slate-300 overflow-x-auto">
                  {JSON.stringify(visit.payload ?? {}, null, 2)}
                </pre>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-semibold">Points History</h3>
                {history.length === 0 ? (
                  <p className="text-xs text-slate-400">No point events recorded.</p>
                ) : (
                  <ul className="space-y-1 text-xs text-slate-300">
                    {history.map((entry) => (
                      <li key={entry.id} className="flex justify-between gap-4">
                        <span className="capitalize">{entry.type}</span>
                        <span>{entry.points}</span>
                        <span>{formatDateTime(entry.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </React.Fragment>
          ) : (
            <p className="text-sm text-slate-400">Select a visit from the table to view details.</p>
          )}

          <DrawerClose asChild>
            <Button variant="secondary" className="self-end">Close</Button>
          </DrawerClose>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="text-sm text-slate-100">{value}</p>
    </div>
  );
}
