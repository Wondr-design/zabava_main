"use client";

import { useState } from "react";

import {
  DashboardDataTable,
  type DashboardTableColumn,
} from "@/components/dashboard/table/dashboard-data-table";
import { Button } from "@/components/ui/button";
import { PartnerInviteDTO } from "@/lib/data/invites";
import type { PartnerOverview } from "@/lib/data/analytics";
import { formatCurrencyCZK } from "@/lib/format/currency";
import { formatDateTime } from "@/lib/format/date";

interface PartnerInviteTableProps {
  invites: PartnerInviteDTO[];
  deleteAction: (formData: FormData) => Promise<void>;
  partnerLookup?: Map<string, PartnerOverview>;
}

export function PartnerInviteTable({
  invites,
  deleteAction,
  partnerLookup,
}: PartnerInviteTableProps) {
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [copyError, setCopyError] = useState("");

  async function copyInviteLink(invite: PartnerInviteDTO) {
    if (!invite.inviteUrl) {
      setCopyError("Invite link unavailable");
      setCopiedToken(null);
      return;
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(invite.inviteUrl);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = invite.inviteUrl;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopyError("");
      setCopiedToken(invite.token);
      setTimeout(() => {
        setCopiedToken((prev) => (prev === invite.token ? null : prev));
      }, 2000);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to copy link";
      setCopyError(message);
      setCopiedToken(null);
    }
  }

  const columns: DashboardTableColumn<PartnerInviteDTO>[] = [
    {
      id: "email",
      header: "Invitee",
      accessor: (invite) => (
        <div className="space-y-1 text-sm">
          <p className="font-semibold text-foreground">
            {invite.name || invite.email || "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {invite.email || "No email"}
          </p>
        </div>
      ),
      width: "18%",
    },
    {
      id: "partner",
      header: "Partner",
      accessor: (invite) => {
        if (!invite.partnerId) return "—";
        const partner =
          partnerLookup?.get(invite.partnerId) ??
          partnerLookup?.get(invite.partnerId.toLowerCase());
        if (!partner) return invite.partnerId;
        return (
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-foreground">
              {partner.display_name || partner.id}
            </p>
            <p className="text-xs text-muted-foreground">
              {partner.listingTierLabel ?? "No tier"}
            </p>
            <p className="text-xs text-muted-foreground">
              Monthly fee:{" "}
              {partner.monthlyFee !== null
                ? formatCurrencyCZK(partner.monthlyFee)
                : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              Contact: {partner.contactName || "Not set"}
            </p>
            <p className="text-xs text-muted-foreground">
              {partner.contactEmail || "No email"}
            </p>
          </div>
        );
      },
      width: "20%",
    },
    {
      id: "role",
      header: "Role",
      accessor: (invite) => invite.role,
      width: "10%",
    },
    {
      id: "expires",
      header: "Expires",
      accessor: (invite) => formatDateTime(invite.expiresAt),
      width: "18%",
    },
    {
      id: "status",
      header: "Status",
      accessor: (invite) =>
        invite.used ? (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            Used
          </span>
        ) : (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            Pending
          </span>
        ),
      width: "12%",
    },
    {
      id: "link",
      header: "Link",
      accessor: (invite) =>
        invite.inviteUrl ? (
          <button
            type="button"
            onClick={() => void copyInviteLink(invite)}
            className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground transition hover:border-primary"
          >
            {copiedToken === invite.token ? "Copied!" : "Copy link"}
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">
            Unavailable
          </span>
        ),
      width: "15%",
    },
    {
      id: "actions",
      header: "",
      accessor: (invite) => (
        <div className="flex justify-end">
          <form action={deleteAction}>
            <input type="hidden" name="token" value={invite.token} />
            <Button
              type="submit"
              variant="destructive"
              size="sm"
            >
              Delete
            </Button>
          </form>
        </div>
      ),
      width: "10%",
      align: "right",
    },
  ];

  return (
    <div className="space-y-3">
      {copyError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {copyError}
        </div>
      ) : null}
      <DashboardDataTable
        title="Invites"
        description="Most recent partner/admin invites."
        rows={invites}
        rowId={(invite) => invite.token}
        columns={columns}
        selectable
        emptyMessage="No invites found."
      />
    </div>
  );
}
