"use client";

import { useMemo } from "react";

import {
  DashboardDataTable,
  type DashboardTableColumn,
} from "@/components/dashboard/table/dashboard-data-table";
import { StatusPill } from "@/components/design-system";

export interface TransportServiceRow {
  id: string;
  partnerId: string;
  name: string;
  serviceType: "taxi" | "bus" | "limo";
  commissionPerRide: number;
  qrValidityDays: number;
  enabled: boolean;
  notes?: string | null;
}

interface TransportServiceTableProps {
  items: TransportServiceRow[];
  loading?: boolean;
  onToggle?(id: string, enabled: boolean): void;
  onEdit?(id: string): void;
}

export function TransportServiceTable({
  items,
  loading = false,
  onToggle,
  onEdit,
}: TransportServiceTableProps) {
  const columns = useMemo<DashboardTableColumn<TransportServiceRow>[]>(
    () => [
      {
        id: "name",
        header: "Service",
        accessor: (item) => (
          <div className="space-y-1">
            <p className="font-semibold text-[color:var(--ds-text-strong)]">{item.name}</p>
            <p className="text-xs uppercase tracking-[0.25em] text-[color:var(--ds-text-muted)]">
              {item.partnerId}
            </p>
          </div>
        ),
        width: "28%",
      },
      {
        id: "type",
        header: "Type",
        accessor: (item) => item.serviceType,
        width: "10%",
      },
      {
        id: "commission",
        header: "Commission / ride",
        accessor: (item) => `${item.commissionPerRide.toFixed(2)} CZK`,
        width: "15%",
      },
      {
        id: "validity",
        header: "QR validity",
        accessor: (item) => `${item.qrValidityDays} days`,
        width: "12%",
      },
      {
        id: "status",
        header: "Status",
        accessor: (item) => (
          <StatusPill size="sm" tone={item.enabled ? "success" : "danger"}>
            {item.enabled ? "Active" : "Disabled"}
          </StatusPill>
        ),
        width: "12%",
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
                onEdit?.(item.id);
              }}
            >
              Edit
            </button>
            <button
              type="button"
              className={item.enabled
                ? "rounded-full border border-amber-300 px-3 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                : "rounded-full border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"}
              onClick={(event) => {
                event.stopPropagation();
                onToggle?.(item.id, !item.enabled);
              }}
            >
              {item.enabled ? "Disable" : "Enable"}
            </button>
          </div>
        ),
        width: "18%",
        align: "right",
      },
    ],
    [onEdit, onToggle],
  );

  return (
    <DashboardDataTable
      title="Services"
      description={
        loading
          ? "Loading transport services…"
          : `${items.length} service${items.length === 1 ? "" : "s"}`
      }
      rows={items}
      rowId={(row) => row.id}
      columns={columns}
      loading={loading}
      emptyMessage="No transport services configured yet. Create one to let partners process rides."
    />
  );
}
