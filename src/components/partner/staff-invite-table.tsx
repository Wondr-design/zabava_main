"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";

import { DesignButton, StatusPill, SurfaceCard } from "@/components/design-system";
import {
  DashboardDataTable,
  type DashboardTableColumn,
} from "@/components/dashboard/table/dashboard-data-table";

export interface StaffInviteItem {
  token: string;
  email: string | null;
  name: string | null;
  status: "pending" | "used" | "revoked" | "expired";
  expires_at: string | null;
  created_at: string;
  used_at: string | null;
}

interface StaffInviteTableProps {
  items: StaffInviteItem[];
  onCopy: (invite: StaffInviteItem) => void;
  onRevoke: (invite: StaffInviteItem) => Promise<void> | void;
}

export function StaffInviteTable({
  items,
  onCopy,
  onRevoke,
}: StaffInviteTableProps) {
  const [busyToken, setBusyToken] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleRevoke(invite: StaffInviteItem) {
    if (!confirm("Revoke this invite?")) return;
    try {
      setBusyToken(invite.token);
      setError("");
      await onRevoke(invite);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to revoke invite";
      setError(message);
    } finally {
      setBusyToken(null);
    }
  }

  const columns: DashboardTableColumn<StaffInviteItem>[] = [
    {
      id: "email",
      header: "Email",
      accessor: (invite) => (
        <div>
          <div className="font-semibold text-[color:var(--ds-text-strong)]">
            {invite.email || "—"}
          </div>
          {invite.name ? (
            <div className="text-xs text-[color:var(--ds-text-muted)]">
              {invite.name}
            </div>
          ) : null}
        </div>
      ),
      width: "30%",
    },
    {
      id: "status",
      header: "Status",
      accessor: (invite) => (
        <StatusPill
          size="sm"
          tone={
            invite.status === "pending"
              ? "warning"
              : invite.status === "used"
              ? "success"
              : "danger"
          }
        >
          {invite.status}
        </StatusPill>
      ),
      width: "15%",
    },
    {
      id: "expires",
      header: "Expires",
      accessor: (invite) =>
        invite.expires_at
          ? formatDistanceToNow(new Date(invite.expires_at), {
              addSuffix: true,
            })
          : "No expiry",
      width: "20%",
    },
    {
      id: "actions",
      header: "",
      accessor: (invite) => {
        const disabled = busyToken === invite.token;
        return (
          <div className="flex justify-end gap-2">
            <DesignButton
              type="button"
              variant="tonal"
              size="sm"
              onClick={() => onCopy(invite)}
            >
              Copy link
            </DesignButton>
            {invite.status === "pending" ? (
              <DesignButton
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => void handleRevoke(invite)}
                disabled={disabled}
              >
                {disabled ? "Working…" : "Revoke"}
              </DesignButton>
            ) : null}
          </div>
        );
      },
      width: "20%",
      align: "right",
    },
  ];

  return (
    <div className="space-y-4">
      {error ? (
        <SurfaceCard className="rounded-2xl border border-[color:var(--ds-danger)]/40 bg-[color:var(--ds-danger)]/10 px-4 py-3 text-xs text-[color:var(--ds-danger)]">
          {error}
        </SurfaceCard>
      ) : null}
      <DashboardDataTable
        title="Pending invites"
        description={`${items.length} active`}
        rows={items}
        rowId={(invite) => invite.token}
        columns={columns}
        selectable
        emptyMessage="No pending invites."
      />
    </div>
  );
}
