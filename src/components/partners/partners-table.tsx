import type { ReactNode } from "react";

import {
  DashboardDataTable,
  type DashboardTableColumn,
} from "@/components/dashboard/table/dashboard-data-table";
import { Badge } from "@/components/ui/badge";
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
    <Badge variant="secondary" className="text-[0.65rem] uppercase tracking-widest">
      {label}
    </Badge>
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-1 text-center">
      <p className="text-sm font-semibold text-foreground">
        {numberFormatter.format(value)}
      </p>
      <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
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
            <p className="font-semibold text-foreground">
              {partner.display_name || "Unnamed partner"}
            </p>
            {partner.listingTierLabel ? (
              <ListingTierBadge label={partner.listingTierLabel} />
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {partner.id} · {partner.type}
          </p>
          <p className="text-xs text-muted-foreground">
            {partner.businessName || partner.companyName || "—"}
          </p>
          {warnings.length > 0 ? (
            <div className="flex flex-wrap gap-1 pt-1">
              {warnings.map((warning) => (
                <Badge
                  key={warning}
                  variant="outline"
                  className="border-amber-500/50 bg-amber-500/10 text-[0.65rem] text-amber-700 uppercase tracking-widest"
                >
                  {warning}
                </Badge>
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
        <p className="font-medium text-foreground">
          {partner.contactName || "Not set"}
        </p>
        <p className="text-xs text-muted-foreground">
          {partner.contactEmail ? (
            <a
              href={`mailto:${partner.contactEmail}`}
              className="text-primary underline-offset-2 hover:underline"
            >
              {partner.contactEmail}
            </a>
          ) : (
            "No email"
          )}
        </p>
        <p className="text-xs text-muted-foreground">
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
          <p className="text-base font-semibold text-foreground">
            {hasDiscount
              ? `Discount ${partner.discountRate?.toFixed(0)}%`
              : "No customer discount"}
          </p>
          <p className="text-xs text-muted-foreground">
            Commission {partner.commissionRate ?? "—"}% ·{" "}
            {partner.commissionBasis === "original"
              ? "Original price"
              : "Discounted price"}
          </p>
          <p className="text-xs text-muted-foreground">
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
        <Badge
          variant={
            partner.status === "active"
              ? "default"
              : partner.status === "pending"
              ? "secondary"
              : "outline"
          }
          className={
            partner.status === "active"
              ? "bg-green-500/20 text-green-600 border-green-500/30"
              : partner.status === "pending"
              ? "bg-amber-500/20 text-amber-600 border-amber-500/30"
              : ""
          }
        >
          {partner.status}
        </Badge>
        <p className="text-[0.65rem] text-muted-foreground">
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
