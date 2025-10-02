"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { partnerApi } from "@/lib/web/api-client";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/format/date";

export type SubmissionItem = {
  id?: string;
  email?: string;
  status?: string;
  createdAt?: string;
  visitedAt?: string | null;
  totalPrice?: number;
  estimatedPoints?: number;
  ticket?: string;
  numPeople?: number;
  originalPayload?: Record<string, unknown>;
  checkedInByStaffId?: string | null;
  checkedInByStaff?: {
    id: string;
    name: string | null;
    email: string;
    status?: string;
  } | null;
};

export function SubmissionsTable(props: {
  items: SubmissionItem[];
  partnerId: string;
  onRefresh: () => void;
  viewerRole?: 'partner' | 'staff' | 'admin';
  viewerStaffId?: string | null;
}) {
  const { items, partnerId, onRefresh, viewerRole, viewerStaffId } = props;
  const [openItem, setOpenItem] = React.useState<SubmissionItem | null>(null);
  const [pageSize, setPageSize] = React.useState(50);
  const visible = items.slice(0, pageSize);
  const [acting, setActing] = React.useState<string | null>(null);

  async function markVisited(email?: string, visitId?: string) {
    if (!email) return;
    setActing(email);
    try {
      await partnerApi.markVisited({ email, partnerId, visitId }, {});
      toast.success(`Marked visited: ${email}`);
      onRefresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to mark visited";
      toast.error(message);
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm text-slate-700">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="text-left p-2">Email</th>
            <th className="text-left p-2">Status</th>
            <th className="text-left p-2">Created</th>
            <th className="text-left p-2">Visited</th>
            <th className="text-left p-2">Total</th>
            <th className="text-left p-2">Handled by</th>
            <th className="text-left p-2">Actions</th>
          </tr>
        </thead>
          <tbody className="divide-y divide-slate-200">
          {visible.map((s, i) => {
            const canMark = (s.status !== "visited") && !s.visitedAt;
            return (
              <tr key={s.id ?? i} className="hover:bg-slate-50">
                <td className="p-2">
                  <button className="text-slate-900 underline" onClick={() => setOpenItem(s)}>
                    {s.email || "—"}
                  </button>
                </td>
                <td className="p-2">{s.status || (s.visitedAt ? "visited" : "pending")}</td>
                <td className="p-2">{formatDateTime(s.createdAt)}</td>
                <td className="p-2">{formatDateTime(s.visitedAt)}</td>
                <td className="p-2">{typeof s.totalPrice === "number" ? s.totalPrice : "—"}</td>
                <td className="p-2 text-slate-500">
                  {renderHandledBy({
                    submission: s,
                    viewerRole,
                    viewerStaffId,
                  })}
                </td>
                  <td className="p-2">
                    <button
                      onClick={() => markVisited(s.email as string, s.id)}
                      disabled={!canMark || acting === s.email}
                      className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {acting === s.email ? "Saving…" : "Mark visited"}
                    </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {items.length > pageSize && (
        <div className="p-3">
          <button className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900" onClick={() => setPageSize((s) => s + 50)}>Load more</button>
        </div>
      )}

      <SubmissionDialog
        item={openItem}
        onOpenChange={(v) => !v && setOpenItem(null)}
        viewerRole={viewerRole}
        viewerStaffId={viewerStaffId}
      />
    </div>
  );
}

function renderHandledBy({
  submission,
  viewerRole,
  viewerStaffId,
}: {
  submission: SubmissionItem;
  viewerRole?: 'partner' | 'staff' | 'admin';
  viewerStaffId?: string | null;
}) {
  if (submission.checkedInByStaff) {
    const isSelf = viewerRole === 'staff' && viewerStaffId && submission.checkedInByStaffId === viewerStaffId;
    const label = isSelf ? 'You' : (submission.checkedInByStaff.name || submission.checkedInByStaff.email);
    return (
      <div className="flex flex-col text-xs text-slate-600">
        <span className="font-medium text-slate-900">{label}</span>
        {!isSelf && <span>{submission.checkedInByStaff.email}</span>}
      </div>
    );
  }

  if ((viewerRole === 'partner' || viewerRole === 'admin') && submission.visitedAt) {
    return <span className="text-xs font-medium text-slate-900">You</span>;
  }

  return <span className="text-xs text-slate-400">—</span>;
}

function SubmissionDialog(props: {
  item: SubmissionItem | null;
  onOpenChange: (open: boolean) => void;
  viewerRole?: 'partner' | 'staff' | 'admin';
  viewerStaffId?: string | null;
}) {
  const { item, onOpenChange, viewerRole, viewerStaffId } = props;
  return (
    <Dialog.Root open={!!item} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur" />
        <Dialog.Content className="fixed right-0 top-0 bottom-0 w-full max-w-lg overflow-auto bg-white p-6 shadow-xl">
          <Dialog.Title className="mb-2 text-lg font-semibold text-slate-900">Submission detail</Dialog.Title>
          {item ? (
            <div className="space-y-3 text-sm text-slate-700">
              <div><strong>Email:</strong> {item.email}</div>
              <div><strong>Status:</strong> {item.status || (item.visitedAt ? "visited" : "pending")}</div>
              <div><strong>Created:</strong> {formatDateTime(item.createdAt)}</div>
              <div><strong>Visited:</strong> {formatDateTime(item.visitedAt)}</div>
              <div><strong>Total:</strong> {typeof item.totalPrice === 'number' ? item.totalPrice : '—'}</div>
              <div>
                <strong>Handled by:</strong> {' '}
                {(() => {
                  if (item.checkedInByStaff) {
                    const isSelf = viewerRole === 'staff' && viewerStaffId && item.checkedInByStaffId === viewerStaffId;
                    if (isSelf) return 'You';
                    return item.checkedInByStaff.name || item.checkedInByStaff.email || '—';
                  }
                  if ((viewerRole === 'partner' || viewerRole === 'admin') && item.visitedAt) {
                    return 'You';
                  }
                  return '—';
                })()}
              </div>
              <div><strong>Ticket:</strong> {item.ticket || '—'}</div>
              <div><strong>People:</strong> {item.numPeople || '—'}</div>
              <div className="pt-2">
                <strong>Original payload</strong>
                <pre className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">{JSON.stringify(item.originalPayload ?? {}, null, 2)}</pre>
              </div>
            </div>
          ) : null}
          <div className="pt-6">
            <Dialog.Close className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900">Close</Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
