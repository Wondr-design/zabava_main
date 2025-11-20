"use client";

import { useMemo } from "react";
import { Zap } from "lucide-react";

import type { FlashDealStatus } from "@/lib/data/flash-deals";
import {
  DashboardDataTable,
  type DashboardTableColumn,
} from "@/components/dashboard/table/dashboard-data-table";
import { StatusPill } from "@/components/design-system";

export interface FlashDealsTableItem {
  id: string;
  partnerId: string;
  description: string | null;
  title: string;
  status: FlashDealStatus;
  discountPercent: number;
  minVisitors: number;
  commissionPercent: number;
  usageCount: number;
  usageLimit: number | null;
  validFrom: string | null;
  validTo: string | null;
  validDays: number[] | null;
  qrValiditySeconds: number;
}

interface FlashDealsTableProps {
  items: FlashDealsTableItem[];
  loading?: boolean;
  onSelect?(id: string): void;
  onStatusChange?(id: string, status: FlashDealStatus): Promise<void> | void;
  onDuplicate?(id: string): Promise<void> | void;
}

export function FlashDealsTable({
  items,
  loading = false,
  onSelect,
  onStatusChange,
  onDuplicate,
}: FlashDealsTableProps) {
  const columns = useMemo<DashboardTableColumn<FlashDealsTableItem>[]>(
    () => [
      {
        id: "title",
        header: "Title",
        accessor: (item) => (
          <div className="space-y-0.5">
            <p className="font-semibold text-[color:var(--ds-text-strong)]">
              {item.title}
            </p>
            {item.description ? (
              <p className="text-xs text-[color:var(--ds-text-muted)]">
                {item.description}
              </p>
            ) : null}
          </div>
        ),
        width: "24%",
      },
      {
        id: "partner",
        header: "Partner",
        accessor: (item) => (
          <span className="text-sm text-[color:var(--ds-text-muted)]">
            {item.partnerId}
          </span>
        ),
        width: "12%",
      },
      {
        id: "discount",
        header: "Discount",
        accessor: (item) => `${item.discountPercent.toFixed(1)}%`,
        width: "10%",
      },
      {
        id: "visitors",
        header: "Min visitors",
        accessor: (item) => item.minVisitors.toLocaleString(),
        width: "10%",
      },
      {
        id: "commission",
        header: "Commission",
        accessor: (item) => `${item.commissionPercent.toFixed(1)}%`,
        width: "10%",
      },
      {
        id: "usage",
        header: "Usage",
        accessor: (item) =>
          item.usageLimit
            ? `${item.usageCount} / ${item.usageLimit}`
            : `${item.usageCount}`,
        width: "10%",
      },
      {
        id: "schedule",
        header: "Schedule",
        accessor: (item) => (
          <span className="text-xs text-[color:var(--ds-text-muted)]">
            {item.validFrom ? new Date(item.validFrom).toLocaleDateString() : "–"} →{" "}
            {item.validTo ? new Date(item.validTo).toLocaleDateString() : "–"}
          </span>
        ),
        width: "14%",
      },
      {
        id: "status",
        header: "Status",
        accessor: (item) => (
          <StatusPill
            size="sm"
            tone={
              item.status === "live"
                ? "success"
                : item.status === "paused"
                ? "warning"
                : item.status === "expired"
                ? "danger"
                : "neutral"
            }
          >
            {item.status}
          </StatusPill>
        ),
        width: "10%",
      },
      {
        id: "actions",
        header: "",
        accessor: (item) => (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-full border border-[color:var(--ds-border-subtle)] px-3 py-1 text-xs font-semibold text-[color:var(--ds-text-strong)] transition hover:border-[color:var(--ds-primary)]"
              onClick={(event) => {
                event.stopPropagation();
                onDuplicate?.(item.id);
              }}
            >
              Duplicate
            </button>
            {renderStatusAction(item, onStatusChange)}
          </div>
        ),
        align: "right",
        width: "15%",
      },
    ],
    [onDuplicate, onStatusChange],
  );

  return (
    <DashboardDataTable
      title="Deals"
      description={
        loading ? "Loading deals…" : `${items.length} deal${items.length === 1 ? "" : "s"}`
      }
      rows={items}
      rowId={(deal) => deal.id}
      columns={columns}
      loading={loading}
      selectable
      emptyMessage="No flash deals yet. Create your first offer to get started."
      onRowClick={onSelect ? (deal) => onSelect(deal.id) : undefined}
    />
  );
}

function renderStatusAction(
  deal: FlashDealsTableItem,
  onStatusChange?: (id: string, status: FlashDealStatus) => Promise<void> | void,
) {
  if (!onStatusChange) return null;

  if (deal.status === "live") {
    return (
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-full border border-amber-300 px-3 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
        onClick={(event) => {
          event.stopPropagation();
          onStatusChange?.(deal.id, "paused");
        }}
      >
        Pause
      </button>
    );
  }

  if (deal.status === "scheduled") {
    return (
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-full border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
        onClick={(event) => {
          event.stopPropagation();
          onStatusChange?.(deal.id, "live");
        }}
      >
        Activate
      </button>
    );
  }

  if (deal.status === "paused") {
    return (
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-full border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
        onClick={(event) => {
          event.stopPropagation();
          onStatusChange?.(deal.id, "live");
        }}
      >
        Resume
      </button>
    );
  }

  if (deal.status === "expired") {
    return (
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
        disabled
      >
        Expired
      </button>
    );
  }

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-full border border-primary/50 px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary/10"
      onClick={(event) => {
        event.stopPropagation();
        onStatusChange?.(deal.id, "live");
      }}
    >
      <Zap className="h-3 w-3" />
      Go live
    </button>
  );
}
