"use client";

import { useCallback, useMemo, useState } from "react";
import { format } from "date-fns";

import { DesignButton, StatusPill, SurfaceCard } from "@/components/design-system";
import {
  DashboardDataTable,
  type DashboardTableColumn,
} from "@/components/dashboard/table/dashboard-data-table";

export interface StaffListItem {
  id: string;
  email: string;
  name: string | null;
  status: "active" | "inactive" | "revoked";
  created_at: string;
  last_login_at: string | null;
}

interface StaffTableProps {
  items: StaffListItem[];
  onStatusChange: (
    staff: StaffListItem,
    nextStatus: "active" | "inactive",
  ) => Promise<void> | void;
  onDelete: (staff: StaffListItem) => Promise<void> | void;
  loading?: boolean;
}

export function StaffTable({
  items,
  onStatusChange,
  onDelete,
  loading,
}: StaffTableProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleStatus = useCallback(async (staff: StaffListItem) => {
    const nextStatus = staff.status === "active" ? "inactive" : "active";
    try {
      setBusyId(staff.id);
      setError("");
      await onStatusChange(staff, nextStatus);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update staff status";
      setError(message);
    } finally {
      setBusyId(null);
    }
  }, [onStatusChange]);

  const handleDelete = useCallback(async (staff: StaffListItem) => {
    if (!confirm(`Remove ${staff.email}?`)) return;
    try {
      setBusyId(staff.id);
      setError("");
      await onDelete(staff);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to remove staff";
      setError(message);
    } finally {
      setBusyId(null);
    }
  }, [onDelete]);

  const columns: DashboardTableColumn<StaffListItem>[] = useMemo(
    () => [
      {
        id: "name",
        header: "Name",
        accessor: (staff) => staff.name || "—",
        width: "20%",
      },
      {
        id: "email",
        header: "Email",
        accessor: (staff) => (
          <span className="font-medium text-[color:var(--ds-text-strong)]">
            {staff.email}
          </span>
        ),
        width: "25%",
      },
      {
        id: "status",
        header: "Status",
        accessor: (staff) => (
          <StatusPill
            size="sm"
            tone={
              staff.status === "active"
                ? "success"
                : staff.status === "inactive"
                ? "warning"
                : "danger"
            }
          >
            {staff.status}
          </StatusPill>
        ),
        width: "15%",
      },
      {
        id: "login",
        header: "Last login",
        accessor: (staff) =>
          staff.last_login_at
            ? format(new Date(staff.last_login_at), "PP p")
            : "Never",
        width: "20%",
      },
      {
        id: "actions",
        header: "",
        accessor: (staff) => {
          const disabled = busyId === staff.id;
          const activateLabel =
            staff.status === "active" ? "Deactivate" : "Activate";
          return (
            <div className="flex justify-end gap-2">
              <DesignButton
                type="button"
                variant="tonal"
                size="sm"
                onClick={() => void handleStatus(staff)}
                disabled={disabled}
              >
                {disabled ? "Saving…" : activateLabel}
              </DesignButton>
              <DesignButton
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => void handleDelete(staff)}
                disabled={disabled}
              >
                Remove
              </DesignButton>
            </div>
          );
        },
        width: "20%",
        align: "right",
      },
    ],
    [busyId, handleDelete, handleStatus],
  );

  return (
    <div className="space-y-4">
      {error ? (
        <SurfaceCard className="rounded-2xl border border-[color:var(--ds-danger)]/40 bg-[color:var(--ds-danger)]/10 px-4 py-3 text-sm text-[color:var(--ds-danger)]">
          {error}
        </SurfaceCard>
      ) : null}
      <DashboardDataTable
        title="Team members"
        description={
          loading ? "Refreshing…" : `${items.length} total team members`
        }
        rows={items}
        rowId={(staff) => staff.id}
        columns={columns}
        selectable
        emptyMessage="No staff members yet."
        loading={loading}
        initialPageSize={10}
      />
    </div>
  );
}
