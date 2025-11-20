"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { adminApi, type FlashDealAnalyticsResponse } from "@/lib/web/api-client";

import type { FlashDealsTableItem } from "./flash-deals-table";

export interface FlashDealUsagePanelProps {
  deal: FlashDealsTableItem | null;
}

export function FlashDealUsagePanel({ deal }: FlashDealUsagePanelProps) {
  const dealId = deal?.id ?? null;
  const [analytics, setAnalytics] = useState<FlashDealAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dealId) {
      setAnalytics(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    adminApi
      .flashDealAnalytics(dealId, { days: 30, limit: 20 }, {})
      .then((response) => {
        if (cancelled) return;
        setAnalytics(response.analytics);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load flash deal analytics.";
        setError(message);
        setAnalytics(null);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dealId]);

  const timelineData = useMemo(
    () =>
      (analytics?.timeline ?? []).map((point) => ({
        ...point,
        label: new Date(point.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      })),
    [analytics?.timeline],
  );

  if (!deal) {
    return (
      <section className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
        Select a flash deal to see redemption trends and QR details.
      </section>
    );
  }

  const usageSummary = analytics?.usage;
  const totalRedemptions = usageSummary?.total ?? deal.usageCount;
  const usageLimit = deal.usageLimit;
  const usageProgress =
    usageLimit && usageLimit > 0 ? Math.min(Math.round((totalRedemptions / usageLimit) * 100), 999) : null;

  const usageBreakdown = [
    { label: "Pending", value: usageSummary?.pending ?? 0, tone: "bg-amber-100 text-amber-800" },
    { label: "Used", value: usageSummary?.used ?? 0, tone: "bg-emerald-100 text-emerald-800" },
    { label: "Rejected", value: usageSummary?.rejected ?? 0, tone: "bg-rose-100 text-rose-800" },
    { label: "Expired", value: usageSummary?.expired ?? 0, tone: "bg-slate-200 text-slate-700" },
  ];

  const redemptionFeed = analytics?.redemptions ?? [];
  const qrEventFeed = analytics?.qrEvents ?? [];
  const qrSummary = analytics?.qrSummary;

  const statusTone: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    used: "bg-emerald-100 text-emerald-800",
    rejected: "bg-rose-100 text-rose-800",
    expired: "bg-slate-200 text-slate-700",
  };

  const eventTone: Record<string, string> = {
    generated: "bg-indigo-100 text-indigo-700",
    scanned: "bg-sky-100 text-sky-700",
    redeemed: "bg-emerald-100 text-emerald-700",
    expired: "bg-rose-100 text-rose-700",
  };

  const formatTimeAgo = (value: string) => {
    try {
      return formatDistanceToNow(new Date(value), { addSuffix: true });
    } catch {
      return value;
    }
  };

  const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Usage analytics</h2>
          <p className="text-sm text-muted-foreground">
            Redemption history, QR scans, and conversion insights for <strong>{deal.title}</strong>.
          </p>
        </div>
        {loading ? (
          <span className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">Refreshing…</span>
        ) : null}
      </header>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Total redemptions",
            value: totalRedemptions,
            caption:
              usageProgress !== null
                ? `Limit ${usageLimit} (${usageProgress}% used)`
                : "No usage limit",
          },
          {
            label: "Discount",
            value: `${deal.discountPercent.toFixed(1)}%`,
            caption: `Minimum ${deal.minVisitors} visitor${deal.minVisitors === 1 ? "" : "s"}`,
          },
          {
            label: "Commission",
            value: `${deal.commissionPercent.toFixed(1)}%`,
            caption: `${Math.round(deal.qrValiditySeconds / 3600)}h QR validity`,
          },
          {
            label: "Active window",
            value:
              deal.validFrom && deal.validTo
                ? `${formatDate(deal.validFrom)} → ${formatDate(deal.validTo)}`
                : "Always available",
            caption:
              deal.validTo && new Date(deal.validTo).getTime() < Date.now()
                ? `Expired ${formatDistanceToNow(new Date(deal.validTo), { addSuffix: true })}`
                : "Scheduled availability",
          },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-border/60 bg-background px-4 py-3 text-left">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{card.value}</p>
            <p className="text-xs text-muted-foreground">{card.caption}</p>
          </div>
        ))}
      </div>

      {analytics ? (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {usageBreakdown.map((item) => (
              <div key={item.label} className="rounded-xl border border-border/40 bg-background px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-xl font-semibold text-foreground">{item.value}</p>
                <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${item.tone}`}>
                  {item.value === 1 ? "1 entry" : `${item.value} entries`}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-8 space-y-4 rounded-2xl border border-border bg-background/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Activity timeline (last 30 days)</h3>
                <p className="text-xs text-muted-foreground">
                  Compare daily redemptions with QR activity to spot conversion trends.
                </p>
              </div>
              {qrSummary ? (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-semibold text-indigo-700">
                    Generated {qrSummary.generated}
                  </span>
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 font-semibold text-sky-700">
                    Scanned {qrSummary.scanned}
                  </span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">
                    Redeemed {qrSummary.redeemed}
                  </span>
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 font-semibold text-rose-700">
                    Expired {qrSummary.expired}
                  </span>
                </div>
              ) : null}
            </div>
            {timelineData.length ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timelineData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} width={36} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="redemptions" stroke="#22c55e" strokeWidth={2} dot={false} name="Redemptions" />
                    <Line type="monotone" dataKey="qrScans" stroke="#0ea5e9" strokeWidth={2} dot={false} name="QR scans" />
                    <Line type="monotone" dataKey="qrGenerated" stroke="#6366f1" strokeWidth={2} dot={false} name="QR generated" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No redemptions or QR activity recorded in this window.</p>
            )}
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section className="space-y-3 rounded-2xl border border-border bg-background/50 p-4">
              <header className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Latest redemptions</h3>
                  <p className="text-xs text-muted-foreground">Most recent redemption attempts and outcomes.</p>
                </div>
              </header>
              <div className="space-y-3">
                {redemptionFeed.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No redemption activity yet.</p>
                ) : (
                  redemptionFeed.map((item) => {
                    const status = item.status.toLowerCase();
                    const tone = statusTone[status] ?? "bg-muted text-muted-foreground";
                    const metaSize = Object.keys(item.metadata ?? {}).length;
                    return (
                      <article
                        key={item.id}
                        className="rounded-xl border border-border/50 bg-background px-4 py-3 text-sm text-foreground"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>
                            {titleCase(status)}
                          </span>
                          <span className="text-xs text-muted-foreground">{formatTimeAgo(item.createdAt)}</span>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          Visit ID:{" "}
                          <span className="font-mono text-foreground">
                            {item.visitId ? item.visitId.slice(0, 8) : "—"}
                          </span>
                        </div>
                        {metaSize > 0 ? (
                          <div className="mt-2 text-xs text-muted-foreground">
                            Metadata fields: {metaSize}
                          </div>
                        ) : null}
                      </article>
                    );
                  })
                )}
              </div>
            </section>

            <section className="space-y-3 rounded-2xl border border-border bg-background/50 p-4">
              <header className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">QR activity stream</h3>
                  <p className="text-xs text-muted-foreground">
                    QR generation, scan, and expiry events linked to this flash deal.
                  </p>
                </div>
              </header>
              <div className="space-y-3">
                {qrEventFeed.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No QR events recorded yet.</p>
                ) : (
                  qrEventFeed.map((event) => {
                    const type = event.eventType.toLowerCase();
                    const tone = eventTone[type] ?? "bg-muted text-muted-foreground";
                    return (
                      <article
                        key={event.id}
                        className="rounded-xl border border-border/50 bg-background px-4 py-3 text-sm text-foreground"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>
                            {titleCase(type)}
                          </span>
                          <span className="text-xs text-muted-foreground">{formatTimeAgo(event.occurredAt)}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span>
                            Source: <span className="font-semibold text-foreground">{event.source}</span>
                          </span>
                          <span>
                            QR type: <span className="font-semibold text-foreground">{titleCase(event.qrType)}</span>
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          Visit ID:{" "}
                          <span className="font-mono text-foreground">
                            {event.visitId ? event.visitId.slice(0, 8) : "—"}
                          </span>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        </>
      ) : (
        <div className="mt-8 rounded-xl border border-dashed border-border px-6 py-8 text-sm text-muted-foreground">
          {loading ? "Loading analytics…" : "Analytics will appear here once activity is detected."}
        </div>
      )}

      {error ? (
        <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
    </section>
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}
