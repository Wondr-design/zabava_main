"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

import { RefreshButton } from "@/components/ui/refresh-button";
import { Badge } from "@/components/ui/badge";
import { adminApi } from "@/lib/web/api-client";
import { formatDateTime } from "@/lib/format/date";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { getSupabaseBrowser } from "@/lib/realtime/client";
import type { QrEventStats } from "@/lib/data/qr-events";
import { toast } from "sonner";

type TimelinePoint = { date: string; value: number };
type PartnerSummary = {
  id: string;
  label?: string;
  metrics?: { count?: number; revenue?: number };
  lastSubmissionAt?: string | null;
};

type SubmissionSummary = {
  email?: string | null;
  partnerId?: string | null;
  status?: string | null;
  visited?: boolean;
  createdAt?: string | null;
  visitedAt?: string | null;
  totalPrice?: number | null;
};

type LiveCounters = {
  visitsToday: number;
  pendingVisits: number;
  uniqueVisitors24h: number;
  bonusEarned24h: number;
  bonusRedeemed24h: number;
  activeFlashDeals: number;
  flashDealsScheduled: number;
  activeTransportServices: number;
  qrGenerated24h: number;
  qrScans24h: number;
  pendingRedemptions: number;
};

type QrEventFeedItem = {
  id: string;
  eventType: string;
  qrType: string;
  occurredAt: string;
  source: string;
  visitId: string | null;
  rewardId: string | null;
  flashDealId: string | null;
  transportServiceId: string | null;
  metadata: Record<string, unknown>;
};

type DealReminderItem = {
  id: string;
  dealId: string;
  qrId: string | null;
  userEmail: string | null;
  reminderType: string;
  scheduledAt: string;
  status: string;
  metadata: Record<string, unknown>;
  deal: {
    title: string;
    slug: string | null;
    partnerId: string;
    partnerName: string | null;
  };
};

type CityBreakdownItem = {
  city: string;
  visits: number;
  revenue: number;
  averageSpend: number;
};

export default function AdminAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [totals, setTotals] = useState<{ count?: number; visited?: number; revenue?: number; averageRevenue?: number } | null>(null);
  const [revenueTrend, setRevenueTrend] = useState<TimelinePoint[]>([]);
  const [partners, setPartners] = useState<PartnerSummary[]>([]);
  const [latest, setLatest] = useState<SubmissionSummary[]>([]);
  const [points, setPoints] = useState<{ earned: number; redeemed: number; adjusted: number; net: number } | null>(null);
  const [redemptions, setRedemptions] = useState<{ total: number; pending: number; applied: number; used: number; rejected: number } | null>(null);
  const [pointsTrend, setPointsTrend] = useState<TimelinePoint[]>([]);
  const [redemptionUsedTrend, setRedemptionUsedTrend] = useState<TimelinePoint[]>([]);
  const [liveCounters, setLiveCounters] = useState<LiveCounters | null>(null);
  const [qrStats, setQrStats] = useState<QrEventStats | null>(null);
  const [qrEvents, setQrEvents] = useState<QrEventFeedItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("");
  const [qrTypeFilter, setQrTypeFilter] = useState<string>("");
  const [reminders, setReminders] = useState<DealReminderItem[]>([]);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [remindersError, setRemindersError] = useState<string | null>(null);
  const [queueingReminders, setQueueingReminders] = useState(false);
  const [dispatchingReminders, setDispatchingReminders] = useState(false);
  const [cityBreakdown, setCityBreakdown] = useState<CityBreakdownItem[]>([]);

  const [search, setSearch] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [subLoading, setSubLoading] = useState(false);

  const loadMetrics = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!silent) {
        setLoading(true);
        setError("");
      }
      try {
        const res = await adminApi.analyticsMetrics({});
        const {
          totals: totalsData,
          revenueTrend: revenueTrendData,
          partners: partnerData,
          latestSubmissions,
          points: pointsData,
          redemptions: redemptionsData,
          pointsTrend: pointsTrendData,
          redemptionUsedTrend: redemptionTrendData,
          liveCounters: liveCountersData,
          qrStats: qrStatsData,
          cityBreakdown: cityBreakdownData,
        } = res as {
          totals?: typeof totals;
          revenueTrend?: TimelinePoint[];
          partners?: PartnerSummary[];
          latestSubmissions?: SubmissionSummary[];
          points?: typeof points;
          redemptions?: typeof redemptions;
          pointsTrend?: TimelinePoint[];
          redemptionUsedTrend?: TimelinePoint[];
          liveCounters?: LiveCounters;
          qrStats?: QrEventStats;
          cityBreakdown?: CityBreakdownItem[];
        };
        setTotals(totalsData ?? null);
        setRevenueTrend(revenueTrendData ?? []);
        setPartners(partnerData ?? []);
        setLatest(latestSubmissions ?? []);
        setPoints(pointsData ?? null);
        setRedemptions(redemptionsData ?? null);
        setPointsTrend(pointsTrendData ?? []);
        setRedemptionUsedTrend(redemptionTrendData ?? []);
        setLiveCounters(liveCountersData ?? null);
        setQrStats(qrStatsData ?? null);
        setCityBreakdown(cityBreakdownData ?? []);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load analytics";
        setError(message);
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [],
  );

  const loadSubmissions = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!silent) {
        setSubLoading(true);
      }
      try {
        const res = await adminApi.analyticsSubmissions({ limit: 200, partnerId: partnerId || undefined, search: search || undefined }, {});
        const { items } = res as { items?: SubmissionSummary[] };
        setSubmissions(items ?? []);
      } catch {
        // non-fatal, keep going
      } finally {
        if (!silent) {
          setSubLoading(false);
        }
      }
    },
    [partnerId, search],
  );

  const loadQrEvents = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!silent) {
        setEventsLoading(true);
        setEventsError("");
      }
      try {
        const res = await adminApi.analyticsQrEvents(
          {
            limit: 100,
            eventType: eventTypeFilter || undefined,
            qrType: qrTypeFilter || undefined,
          },
          {},
        );
        const { items } = res as { items?: QrEventFeedItem[] };
        setQrEvents(
          (items ?? []).map((item) => ({
            ...item,
            metadata:
              item && typeof item.metadata === "object" && item.metadata !== null
                ? item.metadata
                : {},
          })),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load QR events";
        setEventsError(message);
        if (!silent) {
          toast.error(message);
        }
      } finally {
        if (!silent) {
          setEventsLoading(false);
        }
      }
    },
    [eventTypeFilter, qrTypeFilter],
  );

  const loadReminders = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!silent) {
        setRemindersLoading(true);
        setRemindersError(null);
      }
      try {
        const res = await adminApi.dealRemindersList({});
        const { reminders: raw } = res as { reminders?: DealReminderItem[] };
        setReminders(
          (raw ?? []).map((item) => ({
            ...item,
            metadata:
              item && typeof item.metadata === "object" && item.metadata !== null
                ? item.metadata
                : {},
          })),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load reminders";
        setRemindersError(message);
        if (!silent) toast.error(message);
      } finally {
        if (!silent) setRemindersLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

  useEffect(() => {
    void loadQrEvents();
  }, [loadQrEvents]);

  useEffect(() => {
    void loadReminders();
  }, [loadReminders]);

  const refreshAll = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      await Promise.all([
        loadMetrics({ silent }),
        loadSubmissions({ silent }),
        loadQrEvents({ silent }),
        loadReminders({ silent }),
      ]);
    },
    [loadMetrics, loadSubmissions, loadQrEvents, loadReminders],
  );

  const { refreshing: autoRefreshing, trigger: triggerRefresh } = useAutoRefresh(
    useCallback(async () => {
      await refreshAll({ silent: true });
    }, [refreshAll]),
    { enabled: true, minInterval: 5_000 },
  );

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    const channel = supabase
      .channel("admin-dashboard-visits")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "visit_registrations",
        },
        () => {
          void triggerRefresh()
            .then(() => {
              toast.info("Analytics updated", {
                description: "New visit data received.",
              });
            })
            .catch((err) => {
              console.error("[admin-analytics] realtime refresh failed", err);
              toast.error("Failed to refresh analytics data.");
            });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refreshAll, triggerRefresh]);

  const filteredPartners = useMemo(() => {
    if (!search) return partners;
    const q = search.toLowerCase();
    return partners.filter((p) => `${p.id} ${p.label ?? ""}`.toLowerCase().includes(q));
  }, [partners, search]);

  const metricFormatter = useMemo(
    () => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }),
    [],
  );

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "CZK",
        maximumFractionDigits: 0,
      }),
    [],
  );

  const citySummary = useMemo(() => {
    if (!cityBreakdown.length) {
      return null;
    }
    const totalVisits = cityBreakdown.reduce((sum, entry) => sum + entry.visits, 0);
    const totalRevenue = cityBreakdown.reduce((sum, entry) => sum + entry.revenue, 0);
    return {
      totalVisits,
      totalRevenue,
      topCity: cityBreakdown[0],
    };
  }, [cityBreakdown]);

  const liveCounterCards = useMemo(
    () =>
      liveCounters
        ? [
            { label: "Visits today", value: liveCounters.visitsToday },
            { label: "Pending visits", value: liveCounters.pendingVisits },
            { label: "Unique visitors (24h)", value: liveCounters.uniqueVisitors24h },
            { label: "Points earned (24h)", value: liveCounters.bonusEarned24h },
            { label: "Points redeemed (24h)", value: liveCounters.bonusRedeemed24h },
            { label: "Active flash deals", value: liveCounters.activeFlashDeals },
            { label: "Scheduled flash deals", value: liveCounters.flashDealsScheduled },
            { label: "Active transport services", value: liveCounters.activeTransportServices },
            { label: "QR generated (24h)", value: liveCounters.qrGenerated24h },
            { label: "QR scans (24h)", value: liveCounters.qrScans24h },
            { label: "Pending redemptions", value: liveCounters.pendingRedemptions },
          ]
        : [],
    [liveCounters],
  );

  const reminderSummary = useMemo(() => {
    if (!reminders.length) {
      return {
        pending: 0,
        dueSoon: 0,
      };
    }
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    let dueSoon = 0;
    for (const item of reminders) {
      const scheduled = Date.parse(item.scheduledAt);
      if (!Number.isNaN(scheduled) && scheduled - now <= oneDayMs) {
        dueSoon += 1;
      }
    }
    return {
      pending: reminders.length,
      dueSoon,
    };
  }, [reminders]);

  const flashRejectionSummary = useMemo(() => {
    if (!qrEvents.length) {
      return {
        total: 0,
        last24h: 0,
      };
    }
    const now = Date.now();
    const windowMs = 24 * 60 * 60 * 1000;
    let total = 0;
    let last24h = 0;
    for (const event of qrEvents) {
      if (event.eventType !== "rejected" || event.qrType !== "flash") continue;
      total += 1;
      const occurred = Date.parse(event.occurredAt);
      if (!Number.isNaN(occurred) && now - occurred <= windowMs) {
        last24h += 1;
      }
    }
    return { total, last24h };
  }, [qrEvents]);

  const qrEventTypeCards = useMemo(
    () =>
      qrStats
        ? [
            { label: "Generated events", value: qrStats.byType.generated },
            { label: "Scanned events", value: qrStats.byType.scanned },
            { label: "Redeemed events", value: qrStats.byType.redeemed },
            { label: "Expired events", value: qrStats.byType.expired },
          ]
        : [],
    [qrStats],
  );

  const qrTypeCards = useMemo(
    () =>
      qrStats
        ? [
            { label: "Standard QR", value: qrStats.byQrType.standard },
            { label: "Bonus QR", value: qrStats.byQrType.bonus },
            { label: "Flash-deal QR", value: qrStats.byQrType.flash },
            { label: "Transport QR", value: qrStats.byQrType.transport },
          ]
        : [],
    [qrStats],
  );

  const eventTypeOptions = [
    { label: "All events", value: "" },
    { label: "Generated", value: "generated" },
    { label: "Scanned", value: "scanned" },
    { label: "Redeemed", value: "redeemed" },
    { label: "Expired", value: "expired" },
  ] as const;

  const qrTypeOptions = [
    { label: "All QR types", value: "" },
    { label: "Standard", value: "standard" },
    { label: "Bonus", value: "bonus" },
    { label: "Flash deal", value: "flash" },
    { label: "Transport", value: "transport" },
  ] as const;

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-destructive">{error}</div>;

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-2xl font-semibold text-foreground">
          Admin · Analytics
        </h1>
        <div className="flex gap-2">
          <input
            className="rounded border border-input px-3 py-2 bg-background text-foreground"
            placeholder="Filter by partnerId"
            value={partnerId}
            onChange={(e) => setPartnerId(e.target.value)}
          />
          <input
            className="rounded border border-input px-3 py-2 bg-background text-foreground"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <RefreshButton
            onRefresh={async () => {
              await triggerRefresh({ force: true });
            }}
            label="Refresh"
            className="border-border"
            disabled={autoRefreshing}
          />
          <a
            className="rounded bg-primary text-primary-foreground px-3 py-2 text-sm hover:bg-primary/90"
            href="/api/admin/analytics?mode=export"
            target="_blank"
            rel="noreferrer"
          >
            Export CSV
          </a>
        </div>
      </div>

      {liveCounterCards.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
          {liveCounterCards.map((card) => (
            <Card key={card.label} label={card.label} value={metricFormatter.format(card.value)} />
          ))}
        </div>
      ) : null}

      {(reminderSummary.pending > 0 || flashRejectionSummary.total > 0) ? (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
          <Card
            label="Pending reminders"
            value={`${metricFormatter.format(reminderSummary.pending)}`}
          />
          <Card
            label="Reminders due ≤24h"
            value={`${metricFormatter.format(reminderSummary.dueSoon)}`}
          />
          <Card
            label="Flash QR rejections (24h)"
            value={`${metricFormatter.format(flashRejectionSummary.last24h)}`}
          />
          <Card
            label="Flash QR rejections (all)"
            value={`${metricFormatter.format(flashRejectionSummary.total)}`}
          />
        </section>
      ) : null}

      {qrStats ? (
        <div className="grid gap-4 lg:grid-cols-[2fr,3fr]">
          <section className="rounded-2xl border border-border bg-card/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">QR events (last 24h)</h3>
                <p className="text-xs text-muted-foreground">
                  Counts of generated, scanned, redeemed, and expired QR codes across all programs.
                </p>
              </div>
              <span className="text-2xl font-semibold text-foreground">{metricFormatter.format(qrStats.total)}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {qrEventTypeCards.map((card) => (
                <div key={card.label} className="rounded-xl border border-border/50 bg-background px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</p>
                  <p className="mt-2 text-xl font-semibold text-foreground">{metricFormatter.format(card.value)}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-2xl border border-border bg-card/60 p-4">
            <h3 className="text-sm font-semibold text-foreground">QR usage by program</h3>
            <p className="text-xs text-muted-foreground">
              Breakdown of QR events by experience type within the last 24 hours.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {qrTypeCards.map((card) => (
                <div key={card.label} className="rounded-xl border border-border/50 bg-background px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</p>
                  <p className="mt-2 text-xl font-semibold text-foreground">{metricFormatter.format(card.value)}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {cityBreakdown.length ? (
        <section className="rounded-2xl border border-border bg-card/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-foreground">City segmentation</h3>
              <p className="text-xs text-muted-foreground">
                Top locales by visit volume and revenue drawn from recent submissions.
              </p>
            </div>
            {citySummary?.topCity ? (
              <Badge variant="outline" className="text-xs font-medium">
                Top city: {citySummary.topCity.city} · {metricFormatter.format(citySummary.topCity.visits)} visits
              </Badge>
            ) : null}
          </div>
          <div className="mt-4 overflow-auto rounded-xl border border-border/60">
            <table className="w-full min-w-[500px] text-sm">
              <thead className="bg-black/5 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="p-2 text-left">City</th>
                  <th className="p-2 text-right">Visits</th>
                  <th className="p-2 text-right">Revenue</th>
                  <th className="p-2 text-right">Avg spend</th>
                </tr>
              </thead>
              <tbody>
                {cityBreakdown.map((entry) => (
                  <tr key={entry.city.toLowerCase()} className="border-t border-border/40">
                    <td className="p-2 text-foreground">{entry.city}</td>
                    <td className="p-2 text-right">{metricFormatter.format(entry.visits)}</td>
                    <td className="p-2 text-right">{currencyFormatter.format(entry.revenue)}</td>
                    <td className="p-2 text-right">{currencyFormatter.format(entry.averageSpend)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="space-y-3 rounded-2xl border border-border bg-card/60 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">QR event feed</h3>
            <p className="text-xs text-muted-foreground">
              Live log of QR lifecycle events across bonus, flash-deal, and transport programs.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={eventTypeFilter}
              onChange={(event) => setEventTypeFilter(event.target.value)}
              className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {eventTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={qrTypeFilter}
              onChange={(event) => setQrTypeFilter(event.target.value)}
              className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {qrTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <RefreshButton
              onRefresh={async () => {
                await loadQrEvents();
              }}
              label={eventsLoading ? "Refreshing…" : "Refresh feed"}
              disabled={eventsLoading}
            />
          </div>
        </div>
        {eventsError ? <p className="text-sm text-destructive">{eventsError}</p> : null}
        <div className="overflow-auto rounded-xl border border-border/80">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-black/5">
              <tr>
                <th className="p-2 text-left">Timestamp</th>
                <th className="p-2 text-left">Event</th>
                <th className="p-2 text-left">QR type</th>
                <th className="p-2 text-left">Source</th>
                <th className="p-2 text-left">Context</th>
                <th className="p-2 text-left">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {qrEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">
                    {eventsLoading ? "Loading events…" : "No events found for the selected filters."}
                  </td>
                </tr>
              ) : (
                qrEvents.map((event) => (
                  <tr key={event.id} className="border-t border-border/60">
                    <td className="p-2 text-xs text-muted-foreground">
                      {formatDateTime(event.occurredAt)}
                    </td>
                    <td className="p-2">
                      <Badge variant="secondary" className="uppercase">
                        {event.eventType}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <Badge variant="outline" className="uppercase">
                        {event.qrType}
                      </Badge>
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">{event.source || "system"}</td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {summarizeContext(event)}
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {summarizeMetadata(event.metadata)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card/60 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Reminder queue</h3>
            <p className="text-xs text-muted-foreground">
              Pending flash deal reminder emails awaiting dispatch.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RefreshButton
              onRefresh={async () => {
                await loadReminders();
              }}
              label={remindersLoading ? "Refreshing…" : "Refresh reminders"}
              disabled={remindersLoading}
            />
            <button
              type="button"
              className="rounded-full border border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              disabled={queueingReminders}
              onClick={async () => {
                setQueueingReminders(true);
                try {
                  const res = await adminApi.dealRemindersQueue({});
                  const { processed, created } = res as { processed?: number; created?: number };
                  toast.success(
                    `Queued reminders (processed ${processed ?? 0}, new ${created ?? 0})`,
                  );
                  await loadReminders();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed to queue reminders");
                } finally {
                  setQueueingReminders(false);
                }
              }}
            >
              {queueingReminders ? "Queueing…" : "Queue reminders"}
            </button>
            <button
              type="button"
              className="rounded-full bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={dispatchingReminders || reminders.length === 0}
              onClick={async () => {
                if (!reminders.length) return;
                setDispatchingReminders(true);
                try {
                  const payload = {
                    reminders: reminders.map((item) => ({
                      id: item.id,
                      status: "sent" as const,
                      metadata: { dispatchedAt: new Date().toISOString() },
                    })),
                  };
                  const res = await adminApi.dealRemindersDispatch(payload, {});
                  const { updated } = res as { updated?: number };
                  toast.success(`Marked ${updated ?? 0} reminder(s) as sent.`);
                  await loadReminders();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed to update reminders");
                } finally {
                  setDispatchingReminders(false);
                }
              }}
            >
              {dispatchingReminders ? "Marking…" : "Mark all as sent"}
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Pending: {reminders.length}</span>
          {remindersError ? <span className="text-destructive">{remindersError}</span> : null}
        </div>
        <div className="overflow-auto rounded-xl border border-border/80 bg-background">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-black/5">
              <tr>
                <th className="p-2 text-left">Deal</th>
                <th className="p-2 text-left">Partner</th>
                <th className="p-2 text-left">Reminder</th>
                <th className="p-2 text-left">Email</th>
                <th className="p-2 text-left">Scheduled</th>
                <th className="p-2 text-left">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {reminders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">
                    {remindersLoading ? "Loading reminders…" : "No pending reminders."}
                  </td>
                </tr>
              ) : (
                reminders.map((item) => (
                  <tr key={item.id} className="border-t border-border/60">
                    <td className="p-2">
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">{item.deal.title}</span>
                        {item.deal.slug ? (
                          <span className="text-xs text-muted-foreground">Slug: {item.deal.slug}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {item.deal.partnerName ?? item.deal.partnerId}
                    </td>
                    <td className="p-2 text-xs text-muted-foreground capitalize">
                      {item.reminderType.replace("_", " ")}
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">{item.userEmail ?? "—"}</td>
                    <td className="p-2 text-xs text-muted-foreground">{formatDateTime(item.scheduledAt)}</td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {Object.keys(item.metadata).length ? JSON.stringify(item.metadata) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card label="Total" value={totals?.count ?? 0} />
        <Card label="Visited" value={totals?.visited ?? 0} />
        <Card label="Revenue" value={totals?.revenue ?? 0} />
        <Card label="Avg Rev" value={totals?.averageRevenue ?? 0} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card label="Points earned" value={points?.earned ?? 0} />
        <Card label="Points redeemed" value={points?.redeemed ?? 0} />
        <Card label="Points net" value={points?.net ?? 0} />
        <Card label="Redemptions used" value={redemptions?.used ?? 0} />
      </div>

      <div className="border rounded-xl p-3 bg-card">
        <h3 className="text-sm font-medium mb-2">Revenue trend</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revenueTrend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} width={40} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="border rounded-xl p-3">
          <h3 className="text-sm font-medium mb-2">Points trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pointsTrend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} width={40} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="border rounded-xl p-3">
          <h3 className="text-sm font-medium mb-2">Redemptions used trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={redemptionUsedTrend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} width={40} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="value" stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Partners</h3>
          <div className="overflow-auto border rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-black/5">
                <tr>
                  <th className="text-left p-2">Partner</th>
                  <th className="text-left p-2">Visits</th>
                  <th className="text-left p-2">Revenue</th>
                  <th className="text-left p-2">Last visit</th>
                </tr>
              </thead>
              <tbody>
                {filteredPartners.map((p, index) => (
                  <tr key={index} className="border-t">
                    <td className="p-2">{p.id}</td>
                    <td className="p-2">{p.metrics?.count ?? 0}</td>
                    <td className="p-2">{p.metrics?.revenue ?? 0}</td>
                    <td className="p-2">{formatDateTime(p.lastSubmissionAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium">Latest visits</h3>
          <div className="overflow-auto border rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-black/5">
                <tr>
                  <th className="text-left p-2">Email</th>
                  <th className="text-left p-2">Partner</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Created</th>
                  <th className="text-left p-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {latest.map((submission, index) => (
                  <tr key={index} className="border-t">
                    <td className="p-2">{submission.email || "—"}</td>
                    <td className="p-2">{submission.partnerId || "—"}</td>
                    <td className="p-2">{submission.status || "—"}</td>
                    <td className="p-2">{formatDateTime(submission.createdAt)}</td>
                    <td className="p-2">
                      {typeof submission.totalPrice === "number" ? submission.totalPrice : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium">Visits</h3>
        {subLoading && <div className="text-sm">Loading visits…</div>}
        <div className="overflow-auto border rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-black/5">
              <tr>
                <th className="text-left p-2">Email</th>
                <th className="text-left p-2">Partner</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Created</th>
                <th className="text-left p-2">Visited</th>
                <th className="text-left p-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((submission, index) => (
                <tr key={index} className="border-t">
                  <td className="p-2">{submission.email || "—"}</td>
                  <td className="p-2">{submission.partnerId || "—"}</td>
                  <td className="p-2">{submission.visited ? "visited" : "pending"}</td>
                  <td className="p-2">{formatDateTime(submission.createdAt)}</td>
                  <td className="p-2">{formatDateTime(submission.visitedAt)}</td>
                  <td className="p-2">
                    {typeof submission.totalPrice === "number" ? submission.totalPrice : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Card(props: { label: string; value: number | string }) {
  return (
    <div className="border rounded-xl p-4">
      <div className="text-xs text-white/60">{props.label}</div>
      <div className="text-2xl font-semibold">{props.value}</div>
    </div>
  );
}

function summarizeContext(event: QrEventFeedItem) {
  const contextParts = [
    event.flashDealId ? `Flash ${event.flashDealId.slice(0, 8)}` : null,
    event.rewardId ? `Reward ${event.rewardId.slice(0, 8)}` : null,
    event.transportServiceId ? `Transport ${event.transportServiceId.slice(0, 8)}` : null,
    event.visitId ? `Visit ${event.visitId.slice(0, 8)}` : null,
  ].filter(Boolean);
  return contextParts.length ? contextParts.join(" • ") : "—";
}

function summarizeMetadata(metadata: Record<string, unknown>) {
  if (!metadata || Object.keys(metadata).length === 0) return "—";
  const json = JSON.stringify(metadata);
  return json.length > 120 ? `${json.slice(0, 117)}…` : json;
}
