"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";

import { SurfaceCard } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { LocalizedLink } from "@/components/ui/localized-link";
import { Loader2 } from "lucide-react";
import type { DealType, FlashDealAnalytics } from "@/lib/data/flash-deals";
import { formatDate, formatDateTime } from "@/lib/format/date";
import type { AdminDealListItem } from "./deals-dashboard";
import { UsageChip } from "./usage-chip";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

interface DealDetailResponse {
  deal: {
    id: string;
    partnerId: string;
    partnerName: string | null;
    dealType: DealType;
    slug: string | null;
    title: string;
    description: string | null;
    status: string;
    discountPercent: number;
    minVisitors: number;
    validFrom: string | null;
    validTo: string | null;
    validDays: number[] | null;
    commissionPercent: number;
    priceOverrideCzk: number | null;
    bonusPointsOverride: number | null;
    qrValiditySeconds: number;
    usageLimit: number | null;
    usageLimitDaily: number | null;
    usageCount: number;
    autoExpire: boolean;
    sendReminders: boolean;
    tags: string[];
    audience: string[];
    ticketTypes: string[];
    ticketRequirements: Array<{ ticketType: string; subType?: string; quantity: number }> | null;
    isFeatured: boolean;
    bannerLeadHours: number;
    city: string | null;
    createdAt: string;
    updatedAt: string;
    usageStats:
      | {
          qrGenerated: number;
          qrScanned: number;
          qrRejected: number;
          commissionCzk: number;
          bonusAwarded: number;
          updatedAt: string;
        }
      | null;
    media: Array<{
      id: string;
      mediaType: string;
      url: string;
      altText: string | null;
      sortOrder: number;
    }>;
  };
}

export interface DealDetailDrawerProps {
  dealId: string | null;
  fallbackDeal: AdminDealListItem | null;
  onHydrated?: (deal: AdminDealListItem & { slug: string | null }) => void;
  onNavigateBack?: () => void;
}

export function DealDetailDrawer({
  dealId,
  fallbackDeal,
  onHydrated,
  onNavigateBack,
}: DealDetailDrawerProps) {
  const [detail, setDetail] = useState<AdminDealListItem & { slug: string | null } | null>(
    fallbackDeal ? { ...fallbackDeal, slug: null } : null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<FlashDealAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  useEffect(() => {
    if (!dealId) return;
    let cancelled = false;
    setError(null);
    setLoading(true);
    void fetch(`/api/admin/deals/${dealId}`, {
      credentials: "include",
    })
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          let message = `Failed to load deal (HTTP ${response.status})`;
          try {
            const body = (await response.json()) as { error?: string };
            if (body?.error) message = body.error;
          } catch {
            /* ignore */
          }
          throw new Error(message);
        }
        const body = (await response.json()) as DealDetailResponse;
        const mapped = mapDealResponse(body.deal);
        setDetail(mapped);
        onHydrated?.(mapped);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load deal detail.";
        setError(message);
        toast.error(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dealId, onHydrated]);

  useEffect(() => {
    if (fallbackDeal) {
      setDetail((current) => (current ? current : { ...fallbackDeal, slug: null }));
    }
  }, [fallbackDeal]);

  useEffect(() => {
    if (!dealId) {
      setAnalytics(null);
      return;
    }
    let cancelled = false;
    setAnalyticsError(null);
    setAnalyticsLoading(true);
    void fetch(`/api/admin/deals/${dealId}/analytics?days=30&limit=20`, {
      credentials: "include",
    })
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          let message = `Failed to load analytics (HTTP ${response.status})`;
          try {
            const body = (await response.json()) as { error?: string };
            if (body?.error) message = body.error;
          } catch {
            /* ignore */
          }
          throw new Error(message);
        }
        const payload = (await response.json()) as { analytics?: FlashDealAnalytics };
        setAnalytics(payload.analytics ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load deal analytics.";
        setAnalyticsError(message);
        toast.error(message);
      })
      .finally(() => {
        if (!cancelled) setAnalyticsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dealId]);

  const validDaysDisplay = useMemo(() => {
    if (!detail?.validDays || detail.validDays.length === 0) return "All days";
    const ordered = [...detail.validDays].sort((a, b) => a - b);
    return ordered.map((index) => WEEKDAYS[index] ?? `Day ${index}`).join(", ");
  }, [detail?.validDays]);

  const validityRange = useMemo(() => {
    if (!detail) return "—";
    const { validFrom, validTo } = detail;
    if (validFrom && validTo) {
      return `${formatDate(validFrom)} → ${formatDate(validTo)}`;
    }
    if (validTo) return `Until ${formatDate(validTo)}`;
    if (validFrom) return `From ${formatDate(validFrom)}`;
    return "No end date";
  }, [detail]);

  const qrValidityDays = useMemo(() => {
    if (!detail) return "—";
    const seconds = detail.qrValiditySeconds;
    if (!seconds || Number.isNaN(seconds)) return "—";
    return `${Math.round(seconds / 86400)} days`;
  }, [detail]);

  const validityModeLabel = useMemo(() => {
    if (!detail) return "Unconfigured";
    if (detail.validDays && detail.validDays.length) return "Recurring days";
    if (detail.validFrom || detail.validTo) return "Scheduled window";
    return "Always on";
  }, [detail]);

  const usageLimitSummary = useMemo(() => {
    if (!detail) return "Unlimited";
    if (typeof detail.usageLimit === "number") {
      return `${Math.min(detail.usageCount, detail.usageLimit)}/${detail.usageLimit} redeemed`;
    }
    return "Unlimited";
  }, [detail]);

  const usageDailySummary = useMemo(() => {
    if (!detail) return "Unlimited per day";
    return typeof detail.usageLimitDaily === "number"
      ? `${detail.usageLimitDaily} redemptions/day`
      : "Unlimited per day";
  }, [detail]);

  const featuredSummary = useMemo(() => {
    if (!detail) return "Hidden";
    return detail.isFeatured ? "Featured on public site" : "Internal only";
  }, [detail]);

  const bannerLeadCopy = useMemo(() => {
    if (!detail) return "—";
    if (!detail.bannerLeadHours || detail.bannerLeadHours <= 0) return "Show banner at expiry";
    return `Show banner ${detail.bannerLeadHours}h before expiry`;
  }, [detail]);

  return (
    <div className="space-y-6">
      {onNavigateBack ? (
        <div>
          <Button variant="ghost" size="sm" onClick={onNavigateBack}>
            ← Back to deals
          </Button>
        </div>
      ) : null}
      <div className="space-y-2 rounded-2xl border border-border bg-muted/30 px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xl font-semibold text-foreground">
          <span>{detail?.title ?? "Deal detail"}</span>
          <div className="flex items-center gap-2">
            {detail ? (
              <Button asChild size="sm" variant="outline">
                <LocalizedLink href={`/admin/deals/${detail.id}/edit`}>Edit</LocalizedLink>
              </Button>
            ) : null}
            {detail ? <StatusBadge status={detail.status} /> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="capitalize">{detail?.dealType.replace("_", " ") ?? "—"}</span>
          <Separator orientation="vertical" className="hidden h-4 sm:block" />
          <span className="text-sm font-semibold text-foreground">
            {detail?.partnerName ?? detail?.partnerId ?? "—"}
          </span>
          <Separator orientation="vertical" className="hidden h-4 sm:block" />
          <span className="font-mono text-xs text-muted-foreground">{detail?.partnerId ?? "—"}</span>
          {detail?.slug ? (
            <>
              <Separator orientation="vertical" className="hidden h-4 sm:block" />
              <span className="font-mono text-xs text-muted-foreground">Slug: {detail.slug}</span>
            </>
          ) : null}
        </div>
      </div>

      <div className="space-y-6">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {!detail && !loading ? (
          <p className="text-sm text-muted-foreground">
            Select a deal or refresh to load the latest data.
          </p>
        ) : null}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading deal detail…
          </div>
        ) : null}

        {detail ? (
          <div className="space-y-6">
            {detail.description ? (
              <SurfaceCard className="space-y-3">
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Deal story</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{detail.description}</p>
                {detail.tags.length ? (
                  <div className="flex flex-wrap gap-2">
                    {detail.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex rounded-full border border-border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </SurfaceCard>
            ) : null}

            <section className="grid gap-3 lg:grid-cols-3">
              <SurfaceCard className="space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Validity & usage</p>
                  <p className="text-lg font-semibold text-foreground">{validityModeLabel}</p>
                </div>
                <dl className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <dt>Window</dt>
                    <dd className="text-right text-foreground" suppressHydrationWarning>
                      {validityRange}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt>Valid days</dt>
                    <dd className="text-right">{validDaysDisplay}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt>QR validity</dt>
                    <dd className="text-right">{qrValidityDays}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt>Total cap</dt>
                    <dd className="text-right">{usageLimitSummary}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt>Daily cap</dt>
                    <dd className="text-right">{usageDailySummary}</dd>
                  </div>
                </dl>
              </SurfaceCard>
              <SurfaceCard className="space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Ticketing & conditions</p>
                  <p className="text-lg font-semibold text-foreground">
                    Min {detail.minVisitors} visitors
                  </p>
                </div>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p>
                    Ticket types:{" "}
                    {detail.ticketTypes.length ? detail.ticketTypes.join(", ") : "All partner ticket types"}
                  </p>
                  {detail.ticketRequirements.length ? (
                    <div className="rounded-2xl border border-border bg-card/60">
                      {detail.ticketRequirements.map((item, index) => (
                        <div
                          key={`${item.ticketType}-${item.subType ?? "default"}-${index}`}
                          className="flex items-center justify-between border-b border-border/70 px-4 py-2 text-sm text-foreground last:border-b-0"
                        >
                          <span className="font-medium">
                            {item.quantity} × {item.ticketType}
                            {item.subType ? ` (${item.subType})` : ""}
                          </span>
                          <span className="text-xs text-muted-foreground">Required</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>No ticket-specific requirements set.</p>
                  )}
                </div>
              </SurfaceCard>
              <SurfaceCard className="space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Visibility & promotion</p>
                  <p className="text-lg font-semibold text-foreground">{featuredSummary}</p>
                </div>
                <dl className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <dt>Banner lead</dt>
                    <dd className="text-right">{bannerLeadCopy}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt>Slug</dt>
                    <dd className="text-right">{detail.slug ?? "Auto-generated"}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt>Auto expire</dt>
                    <dd className="text-right">{detail.autoExpire ? "Enabled" : "Disabled"}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt>Reminders</dt>
                    <dd className="text-right">{detail.sendReminders ? "Enabled" : "Disabled"}</dd>
                  </div>
                </dl>
              </SurfaceCard>
            </section>

            <section className="grid gap-3 lg:grid-cols-2">
              <SurfaceCard className="space-y-2">
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Pricing & bonus</p>
                <p className="text-lg font-semibold text-foreground">{detail.discountPercent}% incentive</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>Commission: {detail.commissionPercent}%</li>
                  <li>Price override: {detail.priceOverrideCzk ? `${detail.priceOverrideCzk} CZK` : "None"}</li>
                  <li>
                    Bonus override: {detail.bonusPointsOverride ? `${detail.bonusPointsOverride} pts` : "Default"}
                  </li>
                </ul>
              </SurfaceCard>
              <SurfaceCard className="space-y-3">
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Operational controls</p>
                <dl className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <dt>QR validity</dt>
                    <dd className="text-right">{qrValidityDays}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt>Status</dt>
                    <dd className="text-right capitalize">{detail.status.replace("_", " ")}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt>Partner</dt>
                    <dd className="text-right">{detail.partnerName ?? detail.partnerId}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt>Send reminders</dt>
                    <dd className="text-right">{detail.sendReminders ? "Enabled" : "Disabled"}</dd>
                  </div>
                </dl>
              </SurfaceCard>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Notes & metadata
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <SurfaceCard className="space-y-1 text-xs text-muted-foreground">
                  <p suppressHydrationWarning>Created {formatDateTime(detail.createdAt)}</p>
                  <p suppressHydrationWarning>Updated {formatDateTime(detail.updatedAt)}</p>
                  <p>City: {detail.city ?? "—"}</p>
                  <p>Audience: {detail.audience.length ? detail.audience.join(", ") : "All"}</p>
                </SurfaceCard>
                <SurfaceCard className="space-y-1 text-xs text-muted-foreground">
                  <p>Partner ID: {detail.partnerId}</p>
                  <p>Deal ID: {detail.id}</p>
                  <p>
                    Tags:{" "}
                    {detail.tags.length ? (
                      detail.tags.map((tag) => (
                        <span key={tag} className="mr-1 rounded-full border border-border px-2 py-0.5 text-[11px]">
                          {tag}
                        </span>
                      ))
                    ) : (
                      "No tags"
                    )}
                  </p>
                </SurfaceCard>
              </div>
            </section>

            {detail.media && detail.media.length ? (
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Media</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {detail.media.map((item) => (
                    <figure key={item.id} className="overflow-hidden rounded-xl border border-border bg-card">
                      {item.mediaType.startsWith("image") ? (
                        <Image
                          src={item.url}
                          alt={item.altText ?? ""}
                          width={320}
                          height={200}
                          className="h-32 w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-32 items-center justify-center bg-muted text-xs text-muted-foreground">
                          {item.mediaType.toUpperCase()}
                        </div>
                      )}
                      {item.altText ? (
                        <figcaption className="px-3 py-2 text-xs text-muted-foreground">{item.altText}</figcaption>
                      ) : null}
                    </figure>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Usage insights</h3>
              {analyticsLoading && <p className="text-xs text-muted-foreground">Loading analytics…</p>}
              {analyticsError && !analyticsLoading ? (
                <p className="text-xs text-destructive">{analyticsError}</p>
              ) : null}
              {analytics ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <UsageChip label="QR generated" value={analytics.usage.total} tone="bg-sky-100 text-sky-700" />
                    <UsageChip label="Confirmed scans" value={analytics.usage.used} tone="bg-emerald-100 text-emerald-700" />
                    <UsageChip label="Pending" value={analytics.usage.pending} tone="bg-amber-100 text-amber-700" />
                    <UsageChip
                      label="Rejected/Expired"
                      value={analytics.usage.rejected + analytics.usage.expired}
                      tone="bg-rose-100 text-rose-700"
                    />
                  </div>

                  {analytics.timeline.length ? (
                    <div className="rounded-xl border border-border/60 bg-card">
                      <header className="flex items-center justify-between border-b border-border/70 px-4 py-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">30-day trend</p>
                        <span className="text-xs text-muted-foreground">Redemptions vs QR activity</span>
                      </header>
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50 text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Date</th>
                            <th className="px-3 py-2 text-left font-medium">Redemptions</th>
                            <th className="px-3 py-2 text-left font-medium">Generated</th>
                            <th className="px-3 py-2 text-left font-medium">Scanned</th>
                            <th className="px-3 py-2 text-left font-medium">Redeemed</th>
                            <th className="px-3 py-2 text-left font-medium">Expired</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analytics.timeline
                            .slice(-14)
                            .reverse()
                            .map((point) => (
                              <tr key={point.date} className="border-t border-border/50 text-muted-foreground">
                                <td className="px-3 py-2 font-medium text-foreground">{formatDate(point.date)}</td>
                                <td className="px-3 py-2">{point.redemptions}</td>
                                <td className="px-3 py-2">{point.qrGenerated}</td>
                                <td className="px-3 py-2">{point.qrScans}</td>
                                <td className="px-3 py-2">{point.qrRedeemed}</td>
                                <td className="px-3 py-2">{point.qrExpired}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}

                  <div className="grid gap-4 lg:grid-cols-2">
                    <SurfaceCard className="space-y-2">
                      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Redemption timeline</p>
                      {analytics.redemptions.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No redemptions recorded yet.</p>
                      ) : (
                        <ul className="space-y-2">
                          {analytics.redemptions.slice(0, 6).map((item) => (
                            <li key={item.id} className="rounded-lg border border-border/60 bg-background px-3 py-2">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold uppercase text-foreground">{item.status}</span>
                                <span className="text-muted-foreground">{formatDateTime(item.createdAt)}</span>
                              </div>
                              <div className="mt-1 text-[11px] text-muted-foreground">
                                {item.visitId ? `Visit ${item.visitId.slice(0, 8)}` : "No visit linked"}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </SurfaceCard>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        ) : null}
      </div>

    </div>
  );
}

const STATUS_BADGE_STYLES: Record<AdminDealListItem["status"], string> = {
  live: "border border-emerald-200 bg-emerald-50 text-emerald-700",
  scheduled: "border border-sky-200 bg-sky-50 text-sky-700",
  paused: "border border-amber-200 bg-amber-50 text-amber-700",
  expired: "border border-rose-200 bg-rose-50 text-rose-700",
  draft: "border border-slate-200 bg-slate-50 text-slate-600",
};

function StatusBadge({ status }: { status: AdminDealListItem["status"] }) {
  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
        STATUS_BADGE_STYLES[status] ?? "border border-slate-200 bg-slate-50 text-slate-600",
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function mapDealResponse(deal: DealDetailResponse["deal"]): AdminDealListItem & { slug: string | null } {
  return {
    id: deal.id,
    partnerId: deal.partnerId,
    partnerName: deal.partnerName ?? null,
    dealType: deal.dealType as DealType,
    title: deal.title,
    description: deal.description,
    status: deal.status as AdminDealListItem["status"],
    discountPercent: deal.discountPercent,
    minVisitors: deal.minVisitors,
    validFrom: deal.validFrom,
    validTo: deal.validTo,
    validDays: deal.validDays,
    commissionPercent: deal.commissionPercent,
    priceOverrideCzk: deal.priceOverrideCzk,
    bonusPointsOverride: deal.bonusPointsOverride,
    qrValiditySeconds: deal.qrValiditySeconds,
    usageLimit: deal.usageLimit,
    usageLimitDaily: deal.usageLimitDaily,
    usageCount: deal.usageCount,
    autoExpire: deal.autoExpire,
    sendReminders: deal.sendReminders,
    tags: deal.tags,
    audience: deal.audience,
    ticketTypes: deal.ticketTypes ?? [],
    isFeatured: deal.isFeatured,
    bannerLeadHours: deal.bannerLeadHours,
    city: deal.city,
    createdAt: deal.createdAt,
    updatedAt: deal.updatedAt,
    ticketRequirements: deal.ticketRequirements ?? [],
    usageStats: deal.usageStats ?? null,
    media: deal.media?.length ? deal.media : undefined,
    slug: deal.slug,
  };
}
