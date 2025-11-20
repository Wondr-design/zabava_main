"use client";

import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AdminDrawerVisibilityContext } from "@/app/[locale]/(site)/admin/admin-shell";
import { type FlashDealAnalytics, type DealType } from "@/lib/data/flash-deals";
import type { AdminDealListItem } from "./deals-dashboard";
import {
  DealEditDialog,
  type DealEditDialogDeal,
} from "./deal-edit-dialog";

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
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fallbackDeal: AdminDealListItem | null;
  onHydrated?: (deal: AdminDealListItem & { slug: string | null }) => void;
}

type AdminDealDetail = AdminDealListItem & { slug: string | null };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function DealDetailDrawer({
  dealId,
  open,
  onOpenChange,
  fallbackDeal,
  onHydrated,
}: DealDetailDrawerProps) {
  const setDrawerVisible = useContext(AdminDrawerVisibilityContext);
  const [detail, setDetail] = useState<AdminDealDetail | null>(
    fallbackDeal ? { ...fallbackDeal, slug: null } : null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<FlashDealAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (setDrawerVisible) {
      setDrawerVisible(open);
      return () => setDrawerVisible(false);
    }
    return undefined;
  }, [open, setDrawerVisible]);

  useEffect(() => {
    if (!open) return;
    if (!dealId) {
      setDetail(null);
      setError("Unable to determine deal ID.");
      return;
    }
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
  }, [dealId, onHydrated, open, refreshKey]);

  useEffect(() => {
    if (fallbackDeal) {
      setDetail((current) =>
        current ? current : { ...fallbackDeal, slug: null },
      );
    }
  }, [fallbackDeal]);

  useEffect(() => {
    if (!open || !dealId) {
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
        const message =
          err instanceof Error ? err.message : "Failed to load deal analytics.";
        setAnalyticsError(message);
        toast.error(message);
      })
      .finally(() => {
        if (!cancelled) setAnalyticsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dealId, open, refreshKey]);

  const validDaysDisplay = useMemo(() => {
    if (!detail?.validDays || detail.validDays.length === 0) return "All days";
    const ordered = [...detail.validDays].sort((a, b) => a - b);
    return ordered
      .map((index) => WEEKDAYS[index] ?? `Day ${index}`)
      .join(", ");
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

  const usageStats = detail?.usageStats;

  const editDeal: DealEditDialogDeal | null = detail
    ? {
        id: detail.id,
        partnerId: detail.partnerId,
        partnerName: detail.partnerName ?? null,
        dealType: detail.dealType,
        status: detail.status,
        slug: detail.slug ?? null,
        title: detail.title,
        description: detail.description ?? null,
        discountPercent: detail.discountPercent,
        minVisitors: detail.minVisitors,
        commissionPercent: detail.commissionPercent,
        priceOverrideCzk: detail.priceOverrideCzk ?? null,
        bonusPointsOverride: detail.bonusPointsOverride ?? null,
        qrValiditySeconds: detail.qrValiditySeconds,
        usageLimit: detail.usageLimit ?? null,
        usageLimitDaily: detail.usageLimitDaily ?? null,
        validFrom: detail.validFrom,
        validTo: detail.validTo,
        validDays: detail.validDays ?? null,
        tags: detail.tags,
        audience: detail.audience,
        ticketTypes: detail.ticketTypes,
        city: detail.city ?? null,
        autoExpire: detail.autoExpire,
        sendReminders: detail.sendReminders,
        createdAt: detail.createdAt,
        updatedAt: detail.updatedAt,
      }
    : null;

  const handleEditUpdated = useCallback(async () => {
    setRefreshKey((key) => key + 1);
    setEditOpen(false);
  }, []);

  return (
    <>
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-background text-foreground sm:max-w-3xl">
        <DrawerHeader className="space-y-1 border-b border-border bg-muted/40 py-5">
          <DrawerTitle className="flex items-center justify-between gap-3 text-xl font-semibold">
            <span>{detail?.title ?? "Deal detail"}</span>
            <div className="flex items-center gap-2">
              {detail ? (
                <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                  Edit
                </Button>
              ) : null}
              {detail ? <StatusBadge status={detail.status} /> : null}
            </div>
          </DrawerTitle>
          <DrawerDescription className="flex flex-wrap items-center gap-3 text-sm">
            <span className="capitalize">{detail?.dealType.replace("_", " ") ?? "—"}</span>
            <Separator orientation="vertical" className="hidden h-4 sm:block" />
            <span className="text-sm font-semibold text-foreground">
              {detail?.partnerName ?? detail?.partnerId ?? "—"}
            </span>
            <Separator orientation="vertical" className="hidden h-4 sm:block" />
            <span className="font-mono text-xs text-muted-foreground">
              {detail?.partnerId ?? "—"}
            </span>
            {detail?.slug ? (
              <>
                <Separator orientation="vertical" className="hidden h-4 sm:block" />
                <span className="font-mono text-xs text-muted-foreground">
                  Slug: {detail.slug}
                </span>
              </>
            ) : null}
          </DrawerDescription>
        </DrawerHeader>

        <div className="max-h-[65vh] space-y-6 overflow-y-auto px-6 py-6 text-sm leading-relaxed">
          {loading && (
            <p className="text-sm text-muted-foreground">Loading latest deal information…</p>
          )}
          {error && !loading ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}

          {detail ? (
            <>
          {detail.description ? (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Overview
              </h3>
                  <p className="whitespace-pre-wrap rounded-lg border border-border/60 bg-card px-4 py-3 text-sm text-muted-foreground">
                    {detail.description}
                  </p>
                </section>
              ) : null}

              <section className="grid gap-4 sm:grid-cols-2">
                <InfoTile label="Discount" value={`${detail.discountPercent}% off`} />
                <InfoTile label="Min visitors" value={String(detail.minVisitors)} />
                <InfoTile label="QR validity" value={qrValidityDays} />
                <InfoTile label="Commission" value={`${detail.commissionPercent}% platform`} />
                <InfoTile
                  label="Price override"
                  value={
                    typeof detail.priceOverrideCzk === "number"
                      ? `${formatCurrency(detail.priceOverrideCzk)} CZK`
                      : "—"
                  }
                />
                <InfoTile
                  label="Bonus override"
                  value={
                    typeof detail.bonusPointsOverride === "number"
                      ? `${detail.bonusPointsOverride} pts`
                      : "No bonus on redemption"
                  }
                />
              </section>

              <section className="grid gap-4 sm:grid-cols-2">
                <InfoTile label="Validity" value={validityRange} />
                <InfoTile label="Valid days" value={validDaysDisplay} />
                <InfoTile
                  label="Usage limits"
                  value={formatUsageLimit(detail.usageLimit, detail.usageLimitDaily)}
                />
                <InfoTile
                  label="Automation"
                  value={[
                    detail.autoExpire ? "Auto-expire on lapse" : "Manual expiry",
                    detail.sendReminders ? "Reminder emails on" : "Reminders disabled",
                  ].join(" • ")}
                />
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Targeting
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  {detail.tags.length ? (
                    detail.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="uppercase">
                        {tag}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">No tags</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {detail.audience.length ? (
                    detail.audience.map((item) => (
                      <Badge key={item} variant="outline">
                        {item}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">General audience</span>
                  )}
                  {detail.city ? (
                    <Badge variant="outline" className="capitalize">
                      {detail.city}
                    </Badge>
                  ) : null}
                </div>
              </section>

              {usageStats ? (
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Usage metrics
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <MetricsTile label="QRs generated" value={usageStats.qrGenerated} />
                    <MetricsTile label="QRs scanned" value={usageStats.qrScanned} />
                    <MetricsTile label="QRs rejected" value={usageStats.qrRejected} />
                    <MetricsTile
                      label="Commission accrued"
                      value={`${formatCurrency(usageStats.commissionCzk)} CZK`}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Updated {formatDateTime(usageStats.updatedAt)}
                  </p>
                </section>
              ) : null}

              {detail.media && detail.media.length ? (
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Media
                  </h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {detail.media.map((item) => (
                      <figure
                        key={item.id}
                        className="overflow-hidden rounded-xl border border-border bg-card"
                      >
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
                          <figcaption className="px-3 py-2 text-xs text-muted-foreground">
                            {item.altText}
                          </figcaption>
                        ) : null}
                      </figure>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          ) : null}

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Usage insights
            </h3>
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
                  <UsageChip label="Rejected/Expired" value={analytics.usage.rejected + analytics.usage.expired} tone="bg-rose-100 text-rose-700" />
                </div>

                {analytics.timeline.length ? (
                  <div className="rounded-xl border border-border/60 bg-card">
                    <header className="flex items-center justify-between border-b border-border/70 px-4 py-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        30-day trend
                      </p>
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
                              <td className="px-3 py-2 font-medium text-foreground">
                                {formatDate(point.date)}
                              </td>
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
                  <div className="space-y-2 rounded-xl border border-border/60 bg-card p-4">
                    <header className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Recent QR events
                      </h4>
                      <span className="text-xs text-muted-foreground">
                        Total {analytics.qrSummary.total}
                      </span>
                    </header>
                    {analytics.qrEvents.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No QR activity recorded yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {analytics.qrEvents.slice(0, 6).map((event) => (
                          <li
                            key={event.id}
                            className="rounded-lg border border-border/60 bg-background px-3 py-2"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold uppercase text-foreground">
                                {event.eventType}
                              </span>
                              <span className="text-muted-foreground">
                                {formatDateTime(event.occurredAt)}
                              </span>
                            </div>
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              {event.visitId ? `Visit ${event.visitId.slice(0, 8)}` : "No visit"}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="space-y-2 rounded-xl border border-border/60 bg-card p-4">
                    <header className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Recent redemptions
                      </h4>
                      <span className="text-xs text-muted-foreground">
                        Total {analytics.redemptions.length}
                      </span>
                    </header>
                    {analytics.redemptions.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No redemptions logged for this deal.</p>
                    ) : (
                      <ul className="space-y-2">
                        {analytics.redemptions.slice(0, 6).map((item) => (
                          <li
                            key={item.id}
                            className="rounded-lg border border-border/60 bg-background px-3 py-2"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold uppercase text-foreground">
                                {item.status}
                              </span>
                              <span className="text-muted-foreground">
                                {formatDateTime(item.createdAt)}
                              </span>
                            </div>
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              {item.visitId ? `Visit ${item.visitId.slice(0, 8)}` : "No visit linked"}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        </div>

        <DrawerFooter className="border-t border-border bg-muted/40 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
    <DealEditDialog
      deal={editDeal}
      open={editOpen}
      onOpenChange={setEditOpen}
      onUpdated={handleEditUpdated}
    />
    </>
  );
}

function mapDealResponse(deal: DealDetailResponse["deal"]): AdminDealDetail {
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
    tags: deal.tags,
    audience: deal.audience,
    city: deal.city,
    autoExpire: deal.autoExpire,
    sendReminders: deal.sendReminders,
    createdAt: deal.createdAt,
    updatedAt: deal.updatedAt,
    ticketTypes: deal.ticketTypes ?? [],
    usageStats: deal.usageStats
      ? {
          qrGenerated: deal.usageStats.qrGenerated,
          qrScanned: deal.usageStats.qrScanned,
          qrRejected: deal.usageStats.qrRejected,
          commissionCzk: deal.usageStats.commissionCzk,
          bonusAwarded: deal.usageStats.bonusAwarded,
          updatedAt: deal.usageStats.updatedAt,
        }
      : undefined,
    media:
      deal.media.length > 0
        ? deal.media
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((item) => ({
              id: item.id,
              mediaType: item.mediaType,
              url: item.url,
              altText: item.altText,
              sortOrder: item.sortOrder,
            }))
        : undefined,
    slug: deal.slug,
  };
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/80 bg-card px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function MetricsTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border/80 bg-card px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: AdminDealListItem["status"] }) {
  const tone =
    status === "live"
      ? "bg-emerald-100 text-emerald-700"
      : status === "scheduled"
      ? "bg-sky-100 text-sky-700"
      : status === "paused"
      ? "bg-amber-100 text-amber-700"
      : status === "expired"
      ? "bg-rose-100 text-rose-700"
      : "bg-slate-200 text-slate-700";
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium capitalize ${tone}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function formatDate(iso: string) {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return iso;
  return new Date(parsed).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(iso: string) {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return iso;
  return new Date(parsed).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatUsageLimit(total: number | null, daily: number | null) {
  if (!total && !daily) return "Unlimited";
  const parts: string[] = [];
  if (typeof total === "number") parts.push(`${total} total`);
  if (typeof daily === "number") parts.push(`${daily} / day`);
  return parts.join(" • ");
}

function UsageChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${tone}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide opacity-70">
        {label}
      </p>
      <p className="text-xl">{value}</p>
    </div>
  );
}
