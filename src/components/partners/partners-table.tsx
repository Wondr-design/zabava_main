import type { ReactNode } from "react";

import {
  DashboardDataTable,
  type DashboardTableColumn,
} from "@/components/dashboard/table/dashboard-data-table";
import { StatusPill } from "@/components/design-system";
import type { PartnerOverview } from "@/lib/data/analytics";
import { formatCurrencyCZK } from "@/lib/format/currency";
import { formatDate } from "@/lib/format/date";

interface PartnersTableProps {
  partners: PartnerOverview[];
  actions?: ReactNode;
  onPartnerClick?: (partner: PartnerOverview) => void;
}

const numberFormatter = new Intl.NumberFormat("en-US");

function ListingTierBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[color:var(--ds-border-subtle)]/80 bg-[color:var(--ds-surface-muted)] px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[color:var(--ds-text-muted)]">
      {label}
    </span>
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-1 text-center">
      <p className="text-sm font-semibold text-[color:var(--ds-text-strong)]">
        {numberFormatter.format(value)}
      </p>
      <p className="text-[0.65rem] uppercase tracking-[0.25em] text-[color:var(--ds-text-muted)]">
        {label}
      </p>
    </div>
  );
}

function getPartnerWarnings(partner: PartnerOverview) {
  const warnings: string[] = [];
  if (!partner.listingTierLabel) warnings.push("No tier");
  if (partner.monthlyFee === null) warnings.push("No monthly fee");
  if (!partner.contactEmail) warnings.push("No contact email");
  return warnings;
}

const columns: DashboardTableColumn<PartnerOverview>[] = [
  {
    id: "partner",
    header: "Partner",
    accessor: (partner) => {
      const warnings = getPartnerWarnings(partner);
      return (
        <div className="space-y-1 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-[color:var(--ds-text-strong)]">
              {partner.display_name || "Unnamed partner"}
            </p>
            {partner.listingTierLabel ? (
              <ListingTierBadge label={partner.listingTierLabel} />
            ) : null}
          </div>
          <p className="text-xs text-[color:var(--ds-text-muted)]">
            {partner.id} · {partner.type}
          </p>
          <p className="text-xs text-[color:var(--ds-text-muted)]">
            {partner.businessName || partner.companyName || "—"}
          </p>
          {warnings.length > 0 ? (
            <div className="flex flex-wrap gap-1 pt-1">
              {warnings.map((warning) => (
                <span
                  key={warning}
                  className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-amber-700"
                >
                  {warning}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      );
    },
    width: "30%",
  },
  {
    id: "contact",
    header: "Contact",
    accessor: (partner) => (
      <div className="space-y-1 text-sm">
        <p className="font-medium text-[color:var(--ds-text-strong)]">
          {partner.contactName || "Not set"}
        </p>
        <p className="text-xs text-[color:var(--ds-text-muted)]">
          {partner.contactEmail ? (
            <a
              href={`mailto:${partner.contactEmail}`}
              className="text-[color:var(--ds-primary)] underline-offset-2 hover:underline"
            >
              {partner.contactEmail}
            </a>
          ) : (
            "No email"
          )}
        </p>
        <p className="text-xs text-[color:var(--ds-text-muted)]">
          {partner.contactPhone || "No phone"}
        </p>
      </div>
    ),
    width: "20%",
  },
  {
    id: "commercial",
    header: "Commercials",
    accessor: (partner) => {
      const hasDiscount =
        typeof partner.discountRate === "number" && partner.discountRate > 0;
      return (
        <div className="space-y-1 text-sm">
          <p className="text-base font-semibold text-[color:var(--ds-text-strong)]">
            {hasDiscount
              ? `Discount ${partner.discountRate?.toFixed(0)}%`
              : "No customer discount"}
          </p>
          <p className="text-xs text-[color:var(--ds-text-muted)]">
            Commission {partner.commissionRate ?? "—"}% ·{" "}
            {partner.commissionBasis === "original"
              ? "Original price"
              : "Discounted price"}
          </p>
          <p className="text-xs text-[color:var(--ds-text-muted)]">
            Monthly fee {formatCurrencyCZK(partner.monthlyFee)}
          </p>
        </div>
      );
    },
    width: "22%",
  },
  {
    id: "activity",
    header: "Activity",
    accessor: (partner) => (
      <div className="flex flex-wrap gap-2 text-sm">
        <StatChip label="Members" value={partner.memberCount} />
        <StatChip label="Visits" value={partner.visitCount} />
        <StatChip label="Pending" value={partner.pendingCount} />
      </div>
    ),
    width: "18%",
  },
  {
    id: "status",
    header: "Status",
    accessor: (partner) => (
      <div className="space-y-1 text-sm">
        <StatusPill
          tone={
            partner.status === "active"
              ? "success"
              : partner.status === "pending"
              ? "warning"
              : "neutral"
          }
          size="sm"
        >
          {partner.status}
        </StatusPill>
        <p className="text-[0.65rem] text-[color:var(--ds-text-muted)]">
          Onboarded {formatDate(partner.created_at)}
        </p>
      </div>
    ),
    width: "10%",
  },
];

export function PartnersTable({
  partners,
  actions,
  onPartnerClick,
}: PartnersTableProps) {
  return (
    <DashboardDataTable
      title="Partners"
      description={`${partners.length} total partners`}
      rows={partners}
      rowId={(partner) => partner.id}
      columns={columns}
      emptyMessage="No partners found."
      actions={actions}
      onRowClick={onPartnerClick}
    />
  );
}
