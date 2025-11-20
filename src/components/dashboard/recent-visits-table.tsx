"use client";

import { useMemo } from "react";
import Image from "next/image";

import {
  DesignButton,
  StatusPill,
} from "@/components/design-system";
import {
  DashboardDataTable,
  type DashboardTableColumn,
} from "@/components/dashboard/table/dashboard-data-table";
import type { VisitRegistrationRecord } from "@/lib/data/visits";
import { formatDateTime } from "@/lib/format/date";
import {
  extractVisitLinks,
  formatUrlDisplay,
  getVisitQrExpiryStatus,
} from "@/lib/services/visit-links";
import { cn } from "@/lib/utils";

interface RecentVisitsTableProps {
  visits: VisitRegistrationRecord[];
  onSelectVisit?: (visit: VisitRegistrationRecord) => void;
  showLinks?: boolean;
}

function resolveStatus(status?: string | null) {
  switch (status) {
    case "visited":
      return { label: "Visited", tone: "success" as const };
    case "cancelled":
      return { label: "Cancelled", tone: "danger" as const };
    default:
      return { label: "Pending", tone: "warning" as const };
  }
}

type VisitRow = {
  visit: VisitRegistrationRecord;
  partnerLabel: string;
  statusLabel: string;
  statusTone: "success" | "warning" | "danger";
  createdAt: string;
  visitedAt: string;
  pointsDisplay: string;
  isPendingExpired: boolean;
  qrUrl: string | null;
  qrDisplay: string | null;
  qrExpiryMessage: string | null;
  verifyUrl: string | null;
  verifyDisplay: string | null;
};

export function RecentVisitsTable({
  visits,
  onSelectVisit,
  showLinks = false,
}: RecentVisitsTableProps) {
  const rows = useMemo<VisitRow[]>(() => {
    return visits.map((visit) => {
      const links = extractVisitLinks(visit);
      const qrUrl = showLinks ? links?.qrUrl ?? null : null;
      const verifyUrl = showLinks ? links?.verifyUrl ?? null : null;
      const qrDisplay = qrUrl ? formatUrlDisplay(qrUrl, 32) : null;
      const verifyDisplay = verifyUrl ? formatUrlDisplay(verifyUrl, 48) : null;
      const isVisited =
        (visit.status || "").toLowerCase() === "visited" ||
        Boolean(visit.visited_at);
      const expiryStatus = getVisitQrExpiryStatus(links);
      const qrExpiresAtIso = expiryStatus.expiresAt;
      const qrExpiresDisplay = qrExpiresAtIso
        ? formatDateTime(qrExpiresAtIso)
        : null;
      const isPendingExpired = expiryStatus.expired && !isVisited;
      const qrExpiryMessage = qrExpiresDisplay
        ? `${expiryStatus.expired ? "Expired" : "Expires"} ${qrExpiresDisplay}`
        : null;
      const pointsValue =
        visit.points_awarded ?? visit.estimated_points ?? 0;
      const pointsDisplay = isPendingExpired
        ? "—"
        : Number(pointsValue).toLocaleString();
      const status = resolveStatus(visit.status);

      return {
        visit,
        partnerLabel: visit.partner_id ?? "—",
        statusLabel: isPendingExpired
          ? `${status.label} · expired`
          : status.label,
        statusTone: isPendingExpired ? "danger" : status.tone,
        createdAt: formatDateTime(visit.created_at),
        visitedAt: formatDateTime(visit.visited_at),
        pointsDisplay,
        isPendingExpired,
        qrUrl,
        qrDisplay,
        qrExpiryMessage,
        verifyUrl,
        verifyDisplay,
      };
    });
  }, [showLinks, visits]);

  const columns = useMemo<DashboardTableColumn<VisitRow>[]>(() => {
    const base: DashboardTableColumn<VisitRow>[] = [
      {
        id: "email",
        header: "Email",
        accessor: (row) => row.visit.email ?? "—",
        width: "18%",
      },
      {
        id: "partner",
        header: "Partner",
        accessor: (row) => (
          <span className="text-xs uppercase tracking-[0.25em] text-[color:var(--ds-text-muted)]">
            {row.partnerLabel}
          </span>
        ),
        width: "12%",
      },
      {
        id: "status",
        header: "Status",
        accessor: (row) => (
          <StatusPill size="sm" tone={row.statusTone}>
            {row.statusLabel}
          </StatusPill>
        ),
        width: "12%",
      },
      {
        id: "registered",
        header: "Registered",
        accessor: (row) => row.createdAt,
        width: "14%",
      },
      {
        id: "visited",
        header: "Visited",
        accessor: (row) => row.visitedAt,
        width: "14%",
      },
      {
        id: "points",
        header: "Points",
        accessor: (row) => (
          <span
            className={cn(
              "font-semibold",
              row.isPendingExpired && "text-[color:var(--ds-danger)]",
            )}
          >
            {row.pointsDisplay}
          </span>
        ),
        align: "right",
        width: "10%",
      },
    ];

    if (showLinks) {
      base.push(
        {
          id: "qr",
          header: "QR",
          accessor: (row) =>
            row.qrUrl ? (
              <div className="flex items-center gap-3">
                <Image
                  src={row.qrUrl}
                  alt="Visit QR code"
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-2xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] object-contain p-1"
                  title={row.qrExpiryMessage ?? undefined}
                  unoptimized
                  sizes="48px"
                />
                <div className="flex flex-col">
                  <a
                    href={row.qrUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-[color:var(--ds-primary)] underline underline-offset-2 transition hover:text-[color:var(--ds-primary)]/80"
                    title={row.qrExpiryMessage ?? undefined}
                  >
                    {row.qrDisplay ?? "Open"}
                  </a>
                  {row.qrExpiryMessage ? (
                    <span className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--ds-text-muted)]">
                      {row.qrExpiryMessage}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : (
              <span className="text-xs text-[color:var(--ds-text-muted)]">—</span>
            ),
          width: "18%",
        },
        {
          id: "verify",
          header: "Verify Link",
          accessor: (row) =>
            row.verifyUrl ? (
              <a
                href={row.verifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-[color:var(--ds-primary)] underline underline-offset-2 transition hover:text-[color:var(--ds-primary)]/80"
              >
                {row.verifyDisplay ?? row.verifyUrl}
              </a>
            ) : (
              <span className="text-xs text-[color:var(--ds-text-muted)]">—</span>
            ),
          width: "16%",
        },
      );
    }

    if (onSelectVisit) {
      base.push({
        id: "actions",
        header: "",
        accessor: (row) => (
          <div className="flex justify-end">
            <DesignButton
              type="button"
              variant="tonal"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                onSelectVisit(row.visit);
              }}
            >
              View
            </DesignButton>
          </div>
        ),
        align: "right",
        width: "10%",
      });
    }

    return base;
  }, [onSelectVisit, showLinks]);

  return (
    <DashboardDataTable
      title="Recent visits"
      description="Latest registrations across partner locations."
      rows={rows}
      rowId={(row) => row.visit.id}
      columns={columns}
      emptyMessage="No visits recorded yet."
      onRowClick={onSelectVisit ? (row) => onSelectVisit(row.visit) : undefined}
      rowClassName={(row) =>
        row.isPendingExpired
          ? "border-[color:var(--ds-danger)]/40 bg-[color:var(--ds-danger)]/10"
          : undefined
      }
    />
  );
}
