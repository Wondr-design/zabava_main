"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
          <div className="font-semibold text-foreground">
            {invite.email || "—"}
          </div>
          {invite.name ? (
            <div className="text-xs text-muted-foreground">
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
        <Badge
          variant={
            invite.status === "pending"
              ? "secondary"
              : invite.status === "used"
              ? "default"
              : "destructive"
          }
          className={
            invite.status === "pending"
              ? "bg-amber-500/20 text-amber-600 border-amber-500/30"
              : invite.status === "used"
              ? "bg-green-500/20 text-green-600 border-green-500/30"
              : ""
          }
        >
          {invite.status}
        </Badge>
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
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onCopy(invite)}
            >
              Copy link
            </Button>
            {invite.status === "pending" ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => void handleRevoke(invite)}
                disabled={disabled}
              >
                {disabled ? "Working…" : "Revoke"}
              </Button>
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
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
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
