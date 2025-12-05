"use client";

import { useMemo } from "react";

import {
  DashboardDataTable,
  type DashboardTableColumn,
} from "@/components/dashboard/table/dashboard-data-table";
import { Badge } from "@/components/ui/badge";

export interface TransportRideRowItem {
  id: string;
  serviceName: string;
  serviceType: "taxi" | "bus" | "limo";
  createdAt: string;
  status: "pending" | "completed" | "cancelled";
  fareAmount: number | null;
  commissionPerRide: number;
}

interface TransportRideTableProps {
  items: TransportRideRowItem[];
  loading?: boolean;
}

export function TransportRideTable({ items, loading = false }: TransportRideTableProps) {
  const columns = useMemo<DashboardTableColumn<TransportRideRowItem>[]>(
    () => [
      {
        id: "service",
        header: "Service",
        accessor: (item) => (
          <div className="space-y-1">
            <p className="font-semibold text-foreground">
              {item.serviceName}
            </p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              #{item.id}
            </p>
          </div>
        ),
        width: "24%",
      },
      {
        id: "type",
        header: "Type",
        accessor: (item) => item.serviceType,
        width: "10%",
      },
      {
        id: "created",
        header: "Created",
        accessor: (item) => new Date(item.createdAt).toLocaleString(),
        width: "20%",
      },
      {
        id: "status",
        header: "Status",
        accessor: (item) => (
          <Badge
            variant={
              item.status === "completed"
                ? "default"
                : item.status === "pending"
                ? "secondary"
                : "destructive"
            }
            className={
              item.status === "completed"
                ? "bg-green-500/20 text-green-600 border-green-500/30"
                : item.status === "pending"
                ? "bg-amber-500/20 text-amber-600 border-amber-500/30"
                : ""
            }
          >
            {item.status}
          </Badge>
        ),
        width: "12%",
      },
      {
        id: "fare",
        header: "Fare",
        accessor: (item) =>
          item.fareAmount !== null
            ? `${item.fareAmount.toFixed(2)} CZK`
            : "—",
        width: "12%",
      },
      {
        id: "commission",
        header: "Commission",
        accessor: (item) => `${item.commissionPerRide.toFixed(2)} CZK`,
        width: "12%",
      },
    ],
    [],
  );

  return (
    <DashboardDataTable
      title="Recent rides"
      description={
        loading
          ? "Loading transport rides…"
          : `${items.length} record${items.length === 1 ? "" : "s"}`
      }
      rows={items}
      rowId={(row) => row.id}
      columns={columns}
      loading={loading}
      emptyMessage="No rides recorded during this period. Activity will appear once staff process transport QR codes."
    />
  );
}
