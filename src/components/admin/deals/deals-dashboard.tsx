"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Eye, PauseCircle, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

import {
  DesignButton,
  DesignInput,
  DesignSelect,
  DesignSelectContent,
  DesignSelectItem,
  DesignSelectTrigger,
  DesignSelectValue,
  PageHeader,
  StatusPill,
  SurfaceCard,
} from "@/components/design-system";
import {
  DashboardDataTable,
  type DashboardTableColumn,
} from "@/components/dashboard/table/dashboard-data-table";
import { RefreshButton } from "@/components/ui/refresh-button";
import { LocalizedLink } from "@/components/ui/localized-link";
import { useLocalizedRouter } from "@/i18n/use-localized-router";
import { cn } from "@/lib/utils";
import { FlashDealStatus, DealType } from "@/lib/data/flash-deals";
import { getCsrfToken } from "@/lib/web/csrf";
import { DealUsageExportDialog } from "./deal-usage-export-dialog";

const USE_DEALS_DESIGN_SYSTEM =
  process.env.NEXT_PUBLIC_ADMIN_DEALS_USE_NEW_UI === "true";

type StatusTone = "neutral" | "success" | "warning" | "danger" | "primary";

const DEAL_STATUS_TONE: Record<FlashDealStatus, StatusTone> = {
  live: "success",
  scheduled: "primary",
  paused: "warning",
  expired: "danger",
  draft: "neutral",
};

type AutomationBadgeVariant = "default" | "secondary" | "destructive" | "outline";

const BADGE_VARIANT_TO_TONE: Record<AutomationBadgeVariant, StatusTone> = {
  default: "primary",
  secondary: "neutral",
  destructive: "danger",
  outline: "neutral",
};

type FormattedDealItem = AdminDealListItem & {
  validRange: string;
  qrStats: string;
  qrScanRate: number | null;
  automationBadges: Array<{
    label: string;
    variant: AutomationBadgeVariant;
    tone: StatusTone;
  }>;
  usageCapSummary: string | null;
  usageCapState: "none" | "ok" | "warning" | "exhausted";
};

const SUMMARY_TONE_TEXT: Record<StatusTone, string> = {
  neutral: "text-[color:var(--ds-text-strong)]",
  success: "text-[color:var(--ds-primary)]",
  warning: "text-[color:var(--ds-warning)]",
  danger: "text-[color:var(--ds-danger)]",
  primary: "text-[color:var(--ds-primary)]",
};

export interface AdminDealListItem {
  id: string;
  partnerId: string;
  partnerName: string | null;
  dealType: DealType;
  title: string;
  description: string | null;
  status: FlashDealStatus;
  discountPercent: number;
  minVisitors: number;
  validFrom: string | null;
  validTo: string | null;
  validDays: number[] | null;
  commissionPercent: number;
  priceOverrideCzk: number | null;
  bonusPointsOverride: number | null;
  qrValiditySeconds: number;
  isFeatured: boolean;
  bannerLeadHours: number;
  ticketRequirements: Array<{ ticketType: string; subType?: string; quantity: number }>;
  usageLimit: number | null;
  usageLimitDaily: number | null;
  usageCount: number;
  tags: string[];
  audience: string[];
  ticketTypes: string[];
  city: string | null;
  autoExpire: boolean;
  sendReminders: boolean;
  createdAt: string;
  updatedAt: string;
  media?: Array<{
    id: string;
    mediaType: string;
    url: string;
    altText: string | null;
    sortOrder: number;
  }>;
  usageStats?: {
    qrGenerated: number;
    qrScanned: number;
    qrRejected: number;
    commissionCzk: number;
    bonusAwarded: number;
    updatedAt: string;
  } | null;
}

interface DealsDashboardProps {
  initialItems: AdminDealListItem[];
}

export function DealsDashboard({ initialItems }: DealsDashboardProps) {
  const [items, setItems] = useState<AdminDealListItem[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<FlashDealStatus | "all">("all");
  const [dealType, setDealType] = useState<DealType | "all">("all");
  const [actionState, setActionState] = useState<{
    id: string;
    type: "clone" | "disable";
  } | null>(null);
  const useDesignSystem = USE_DEALS_DESIGN_SYSTEM;
  const router = useLocalizedRouter();

  const refetch = useCallback(
    async (options?: { showToast?: boolean }) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set("search", search.trim());
        if (status !== "all") params.set("status", status);
        if (dealType !== "all") params.set("type", dealType);

        const response = await fetch(`/api/admin/deals?${params.toString()}`, {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error(`Failed to load deals (HTTP ${response.status})`);
        }
        const data = (await response.json()) as { items?: AdminDealListItem[] };
        setItems(data.items ?? []);
        if (options?.showToast) {
          toast.success("Deals refreshed");
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load deals";
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    [dealType, search, status],
  );

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const summaries = useMemo(() => {
    const total = items.length;
    const active = items.filter((deal) => deal.status === "live").length;
    const scheduled = items.filter((deal) => deal.status === "scheduled").length;
    const paused = items.filter((deal) => deal.status === "paused").length;
    const expiringSoon = items.filter((deal) => {
      if (!deal.validTo) return false;
      const diff =
        new Date(deal.validTo).getTime() - new Date().getTime();
      const twoDays = 48 * 60 * 60 * 1000;
      return diff > 0 && diff <= twoDays;
    }).length;
    return {
      total,
      active,
      scheduled,
      paused,
      expiringSoon,
    };
  }, [items]);

  const handleManualRefresh = useCallback(async () => {
    await refetch({ showToast: true });
  }, [refetch]);

  const handleClone = useCallback(
    async (dealId: string) => {
      if (actionState) return;
      setActionState({ id: dealId, type: "clone" });
      try {
        const response = await fetch(`/api/admin/deals/${dealId}/duplicate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": getCsrfToken(),
          },
          credentials: "include",
        });
        if (!response.ok) {
          let message = `Failed to duplicate deal (HTTP ${response.status})`;
          try {
            const data = (await response.json()) as { error?: string };
            if (data?.error) message = data.error;
          } catch {}
          throw new Error(message);
        }
        toast.success("Deal duplicated");
        await refetch();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to duplicate deal.";
        toast.error(message);
      } finally {
        setActionState(null);
      }
    },
    [actionState, refetch],
  );

  const handleDisable = useCallback(
    async (dealId: string) => {
      if (actionState) return;
      const target = items.find((item) => item.id === dealId);
      if (!target || target.status === "paused") return;
      setActionState({ id: dealId, type: "disable" });
      setItems((current) =>
        current.map((item) => (item.id === dealId ? { ...item, status: "paused" } : item)),
      );
      try {
        const response = await fetch(`/api/admin/deals/${dealId}/disable`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": getCsrfToken(),
          },
          credentials: "include",
        });
        if (!response.ok) {
          let message = `Failed to disable deal (HTTP ${response.status})`;
          try {
            const data = (await response.json()) as { error?: string };
            if (data?.error) message = data.error;
          } catch {}
          throw new Error(message);
        }
        toast.success("Deal disabled");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to disable deal.";
        toast.error(message);
        setItems((current) =>
          current.map((item) =>
            item.id === dealId && item.status === "paused"
              ? { ...item, status: target.status }
              : item,
          ),
        );
      } finally {
        setActionState(null);
      }
    },
    [actionState, items],
  );

  const formattedItems = useMemo<FormattedDealItem[]>(() => {
    return items.map((item) => {
      const validRange =
        item.validFrom && item.validTo
          ? `${formatDate(item.validFrom)} → ${formatDate(item.validTo)}`
          : item.validTo
          ? `Until ${formatDate(item.validTo)}`
          : item.validFrom
          ? `From ${formatDate(item.validFrom)}`
          : "—";

      const qrStats = item.usageStats
        ? `${item.usageStats.qrScanned}/${item.usageStats.qrGenerated}`
        : "—";

      const qrScanRate =
        item.usageStats && item.usageStats.qrGenerated > 0
          ? Math.round((item.usageStats.qrScanned / item.usageStats.qrGenerated) * 100)
          : null;

      const automationBadges: Array<{
        label: string;
        variant: AutomationBadgeVariant;
        tone: StatusTone;
      }> = [];

      if (item.autoExpire) {
        automationBadges.push({
          label: "Auto expire",
          variant: "secondary",
          tone: BADGE_VARIANT_TO_TONE.secondary,
        });
      }
      if (item.sendReminders) {
        automationBadges.push({
          label: "Reminders",
          variant: "default",
          tone: BADGE_VARIANT_TO_TONE.default,
        });
      }

      let usageCapSummary: string | null = null;
      let usageCapState: "none" | "ok" | "warning" | "exhausted" = "none";

      if (typeof item.usageLimit === "number" && item.usageLimit > 0) {
        const used = item.usageCount;
        const remaining = item.usageLimit - used;
        let variant: Exclude<AutomationBadgeVariant, "outline"> = "secondary";
        let label = `${Math.min(used, item.usageLimit)}/${item.usageLimit} used`;

        if (remaining <= 0) {
          variant = "destructive";
          label = `Cap reached (${item.usageLimit})`;
          usageCapState = "exhausted";
        } else if (used / item.usageLimit >= 0.75) {
          variant = "default";
          usageCapState = "warning";
        } else {
          usageCapState = "ok";
        }

        automationBadges.push({
          label,
          variant,
          tone: BADGE_VARIANT_TO_TONE[variant],
        });
        usageCapSummary = `${Math.min(used, item.usageLimit)}/${item.usageLimit} redemptions`;
      }

      if (typeof item.usageLimitDaily === "number" && item.usageLimitDaily > 0) {
        automationBadges.push({
          label: `Daily cap ${item.usageLimitDaily}`,
          variant: "outline",
          tone: BADGE_VARIANT_TO_TONE.outline,
        });
      }

      return {
        ...item,
        validRange,
        qrStats,
        qrScanRate,
        automationBadges,
        usageCapSummary,
        usageCapState,
      };
    });
  }, [items]);

  const handleView = useCallback(
    (item: AdminDealListItem) => {
      router.push(`/admin/deals/${item.id}`);
    },
    [router],
  );

  const dealColumns = useMemo<DashboardTableColumn<FormattedDealItem>[]>(
    () => [
      {
        id: "partner",
        header: "Partner",
        accessor: (deal) => (
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-[color:var(--ds-text-strong)]">
              {deal.partnerName ?? deal.partnerId}
            </span>
            <span className="font-mono text-[11px] text-[color:var(--ds-text-subtle)]">
              {deal.partnerId}
            </span>
          </div>
        ),
        width: "18%",
      },
      {
        id: "title",
        header: "Deal",
        accessor: (deal) => (
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-[color:var(--ds-text-strong)]">
              {deal.title}
            </span>
            <span className="text-xs text-[color:var(--ds-text-muted)]">
              Min visitors: {deal.minVisitors}
            </span>
          </div>
        ),
        width: "18%",
      },
      {
        id: "type",
        header: "Type",
        accessor: (deal) => deal.dealType.replace("_", " "),
        width: "10%",
      },
      {
        id: "status",
        header: "Status",
        accessor: (deal) => (
          <StatusPill tone={DEAL_STATUS_TONE[deal.status]} size="sm" className="capitalize">
            {deal.status.replace("_", " ")}
          </StatusPill>
        ),
        width: "10%",
      },
      {
        id: "validity",
        header: "Validity",
        accessor: (deal) => (
          <span className="text-xs text-[color:var(--ds-text-muted)]">{deal.validRange}</span>
        ),
        width: "12%",
      },
      {
        id: "usage",
        header: "Usage",
        accessor: (deal) => {
          const usageTone: StatusTone =
            deal.usageCapState === "exhausted"
              ? "danger"
              : deal.usageCapState === "warning"
              ? "warning"
              : "neutral";
          return (
            <div className="space-y-1 text-xs text-[color:var(--ds-text-muted)]">
              <span>{deal.qrStats}</span>
              {typeof deal.qrScanRate === "number" ? (
                <StatusPill tone="success" size="sm" className="w-max">
                  {deal.qrScanRate}% scanned
                </StatusPill>
              ) : null}
              {deal.usageCapSummary ? (
                <StatusPill tone={usageTone} size="sm" className="w-max uppercase">
                  {deal.usageCapSummary}
                </StatusPill>
              ) : null}
            </div>
          );
        },
        width: "14%",
      },
      {
        id: "automation",
        header: "Automation",
        accessor: (deal) =>
          deal.automationBadges.length ? (
            <div className="flex flex-wrap items-center gap-1">
              {deal.automationBadges.map((badge, index) => (
                <StatusPill
                  key={`${badge.label}-${index}`}
                  tone={badge.tone}
                  size="sm"
                  className="uppercase"
                >
                  {badge.label}
                </StatusPill>
              ))}
            </div>
          ) : (
            <span className="text-xs text-[color:var(--ds-text-muted)]">—</span>
          ),
        width: "15%",
      },
      {
        id: "tags",
        header: "Tags",
        accessor: (deal) =>
          deal.tags.length ? (
            <div className="flex flex-wrap items-center gap-1">
              {deal.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex rounded-full bg-[color:var(--ds-surface-muted)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--ds-text-muted)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-xs text-[color:var(--ds-text-muted)]">—</span>
          ),
        width: "15%",
      },
      {
        id: "actions",
        header: "",
        accessor: (deal) => {
          const disabled = actionState?.id === deal.id;
          return (
            <div className="flex flex-wrap justify-end gap-2">
              <DesignButton
                asChild
                variant="tonal"
                size="sm"
                disabled={loading || disabled}
              >
                <LocalizedLink
                  href={`/admin/deals/${deal.id}`}
                  onClick={(event) => event.stopPropagation()}
                >
                  <Eye className="size-4" />
                  View
                </LocalizedLink>
              </DesignButton>
              <DesignButton
                variant="ghost"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  handleClone(deal.id);
                }}
                disabled={disabled && actionState?.type === "clone"}
              >
                <Copy className="size-4" />
                {disabled && actionState?.type === "clone" ? "Cloning…" : "Clone"}
              </DesignButton>
              <DesignButton
                variant="outline"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  handleDisable(deal.id);
                }}
                disabled={disabled || deal.status === "paused"}
              >
                <PauseCircle className="size-4" />
                {deal.status === "paused"
                  ? "Paused"
                  : disabled && actionState?.type === "disable"
                  ? "Disabling…"
                  : "Disable"}
              </DesignButton>
            </div>
          );
        },
        align: "right",
        width: "20%",
      },
    ],
    [actionState, handleClone, handleDisable, handleView, loading],
  );

  const refreshAction = useDesignSystem ? (
    <DesignButton
      type="button"
      variant="tonal"
      size="sm"
      onClick={() => void handleManualRefresh()}
      disabled={loading}
    >
      <RefreshCcw className={cn("size-4", loading && "animate-spin")} />
      {loading ? "Refreshing…" : "Refresh"}
    </DesignButton>
  ) : (
    <RefreshButton
      onRefresh={handleManualRefresh}
      disabled={loading}
      label={loading ? "Refreshing…" : "Refresh"}
    />
  );

  const headerActions = (
    <>
      {refreshAction}
      <DealUsageExportDialog />
      <DesignButton asChild size="sm">
        <LocalizedLink href="/admin/deals/new">New deal</LocalizedLink>
      </DesignButton>
    </>
  );

  const detailDrawer = (
    null
  );

  const filterToolbar = (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <DesignInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search deals…"
          className="min-w-[220px]"
          disabled={loading}
        />
        <DesignSelect
          value={status}
          onValueChange={(value) => setStatus(value as FlashDealStatus | "all")}
          disabled={loading}
        >
          <DesignSelectTrigger className="min-w-[180px]">
            <DesignSelectValue placeholder="Status" />
          </DesignSelectTrigger>
          <DesignSelectContent>
            <DesignSelectItem value="all">All statuses</DesignSelectItem>
            <DesignSelectItem value="live">Live</DesignSelectItem>
            <DesignSelectItem value="scheduled">Scheduled</DesignSelectItem>
            <DesignSelectItem value="draft">Draft</DesignSelectItem>
            <DesignSelectItem value="paused">Paused</DesignSelectItem>
            <DesignSelectItem value="expired">Expired</DesignSelectItem>
          </DesignSelectContent>
        </DesignSelect>
        <DesignSelect
          value={dealType}
          onValueChange={(value) => setDealType(value as DealType | "all")}
          disabled={loading}
        >
          <DesignSelectTrigger className="min-w-[200px]">
            <DesignSelectValue placeholder="Deal type" />
          </DesignSelectTrigger>
          <DesignSelectContent>
            <DesignSelectItem value="all">All types</DesignSelectItem>
            <DesignSelectItem value="flash">Flash</DesignSelectItem>
            <DesignSelectItem value="weekly_promo">Weekly promo</DesignSelectItem>
            <DesignSelectItem value="group">Group deal</DesignSelectItem>
          </DesignSelectContent>
        </DesignSelect>
      </div>
      <span className="text-xs text-[color:var(--ds-text-muted)]">
        {loading
          ? "Loading deals…"
          : `Showing ${formattedItems.length} deal${
              formattedItems.length === 1 ? "" : "s"
            }`}
      </span>
    </div>
  );

  const dealsTable = (
    <DashboardDataTable
      title="Deal library"
      description="Search, filter, and monitor live campaigns."
      toolbar={filterToolbar}
      rows={formattedItems}
      rowId={(deal) => deal.id}
      columns={dealColumns}
      loading={loading}
      emptyMessage={
        loading ? "Loading deals…" : "No deals found. Adjust filters or create a new deal."
      }
      selectable
      onRowClick={(deal) => handleView(deal)}
      pageSizeOptions={[10, 25, 50, 100]}
    />
  );

  if (useDesignSystem) {
    return (
      <>
        <div className="space-y-10">
          <PageHeader
            title="Deals control centre"
            description="Manage flash deals, weekly promos, and group offers in one place."
            actions={<div className="flex flex-wrap items-center gap-2">{headerActions}</div>}
          />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <DesignSummaryTile label="Total deals" value={summaries.total} />
            <DesignSummaryTile label="Live" value={summaries.active} tone="success" />
            <DesignSummaryTile label="Scheduled" value={summaries.scheduled} tone="primary" />
            <DesignSummaryTile label="Paused" value={summaries.paused} tone="warning" />
            <DesignSummaryTile
              label="Expiring ≤48h"
              value={summaries.expiringSoon}
              tone="danger"
            />
          </div>

          {dealsTable}

        </div>
        {detailDrawer}
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Deals control centre
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage flash deals, weekly promos, and group offers in one place.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">{headerActions}</div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryTile label="Total deals" value={summaries.total} />
          <SummaryTile label="Live" value={summaries.active} tone="text-emerald-600" />
          <SummaryTile label="Scheduled" value={summaries.scheduled} tone="text-sky-600" />
          <SummaryTile label="Paused" value={summaries.paused} tone="text-amber-600" />
          <SummaryTile
            label="Expiring ≤48h"
            value={summaries.expiringSoon}
            tone="text-rose-600"
          />
        </section>

        {dealsTable}

      </div>
      {detailDrawer}
    </>
  );
}

function DesignSummaryTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: StatusTone;
}) {
  const toneClass = SUMMARY_TONE_TEXT[tone] ?? SUMMARY_TONE_TEXT.neutral;
  return (
    <SurfaceCard className="rounded-3xl border border-[color:var(--ds-border-subtle)] p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--ds-text-subtle)]">
        {label}
      </p>
      <p className={cn("text-3xl font-semibold", toneClass)}>{value}</p>
    </SurfaceCard>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/70 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold ${tone ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return value;
  }
}
