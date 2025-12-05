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
} from "recharts";
import {
  BarChart3,
  RefreshCw,
  Download,
  TrendingUp,
  Users,
  Ticket,
  Zap,
  Clock,
  QrCode,
  Bell,
  MapPin,
  Activity,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminApi } from "@/lib/web/api-client";
import { formatDateTime } from "@/lib/format/date";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { getSupabaseBrowser } from "@/lib/realtime/client";
import type { QrEventStats } from "@/lib/data/qr-events";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

// Metric Card Component
function MetricCard({
  label,
  value,
  icon: Icon,
  trend,
  className,
}: {
  label: string;
  value: string | number;
  icon?: React.ComponentType<{ className?: string }>;
  trend?: "up" | "down" | "neutral";
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-4", className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        </div>
        {Icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-2 flex items-center gap-1">
          <TrendingUp
            className={cn(
              "h-3 w-3",
              trend === "up" && "text-emerald-500",
              trend === "down" && "rotate-180 text-red-500",
              trend === "neutral" && "text-muted-foreground"
            )}
          />
          <span className="text-xs text-muted-foreground">vs. yesterday</span>
        </div>
      )}
    </div>
  );
}

// Section Card Component
function SectionCard({
  title,
  description,
  children,
  actions,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-card", className)}>
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <h3 className="font-semibold text-foreground">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// Data Table Component
function DataTable({
  headers,
  children,
  emptyMessage = "No data available",
}: {
  headers: string[];
  children: React.ReactNode;
  emptyMessage?: string;
}) {
  return (
    <div className="overflow-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {headers.map((header) => (
              <th key={header} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

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
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [qrTypeFilter, setQrTypeFilter] = useState<string>("all");
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

  const loadMetrics = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) {
      setLoading(true);
      setError("");
    }
    try {
      const res = await adminApi.analyticsMetrics({});
      const data = res as {
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
      setTotals(data.totals ?? null);
      setRevenueTrend(data.revenueTrend ?? []);
      setPartners(data.partners ?? []);
      setLatest(data.latestSubmissions ?? []);
      setPoints(data.points ?? null);
      setRedemptions(data.redemptions ?? null);
      setPointsTrend(data.pointsTrend ?? []);
      setRedemptionUsedTrend(data.redemptionUsedTrend ?? []);
      setLiveCounters(data.liveCounters ?? null);
      setQrStats(data.qrStats ?? null);
      setCityBreakdown(data.cityBreakdown ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const loadSubmissions = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setSubLoading(true);
    try {
      const res = await adminApi.analyticsSubmissions({ limit: 200, partnerId: partnerId || undefined, search: search || undefined }, {});
      setSubmissions((res as { items?: SubmissionSummary[] }).items ?? []);
    } catch {
      // non-fatal
    } finally {
      if (!silent) setSubLoading(false);
    }
  }, [partnerId, search]);

  const loadQrEvents = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) {
      setEventsLoading(true);
      setEventsError("");
    }
    try {
      const res = await adminApi.analyticsQrEvents({
        limit: 100,
        eventType: eventTypeFilter === "all" ? undefined : eventTypeFilter,
        qrType: qrTypeFilter === "all" ? undefined : qrTypeFilter,
      }, {});
      setQrEvents((res as { items?: QrEventFeedItem[] }).items?.map((item) => ({
        ...item,
        metadata: item?.metadata && typeof item.metadata === "object" ? item.metadata : {},
      })) ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load QR events";
      setEventsError(message);
      if (!silent) toast.error(message);
    } finally {
      if (!silent) setEventsLoading(false);
    }
  }, [eventTypeFilter, qrTypeFilter]);

  const loadReminders = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) {
      setRemindersLoading(true);
      setRemindersError(null);
    }
    try {
      const res = await adminApi.dealRemindersList({});
      setReminders((res as { reminders?: DealReminderItem[] }).reminders?.map((item) => ({
        ...item,
        metadata: item?.metadata && typeof item.metadata === "object" ? item.metadata : {},
      })) ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load reminders";
      setRemindersError(message);
      if (!silent) toast.error(message);
    } finally {
      if (!silent) setRemindersLoading(false);
    }
  }, []);

  useEffect(() => { void loadMetrics(); }, [loadMetrics]);
  useEffect(() => { void loadSubmissions(); }, [loadSubmissions]);
  useEffect(() => { void loadQrEvents(); }, [loadQrEvents]);
  useEffect(() => { void loadReminders(); }, [loadReminders]);

  const refreshAll = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    await Promise.all([loadMetrics({ silent }), loadSubmissions({ silent }), loadQrEvents({ silent }), loadReminders({ silent })]);
  }, [loadMetrics, loadSubmissions, loadQrEvents, loadReminders]);

  const { refreshing: autoRefreshing, trigger: triggerRefresh } = useAutoRefresh(
    useCallback(async () => { await refreshAll({ silent: true }); }, [refreshAll]),
    { enabled: true, minInterval: 5_000 }
  );

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    const channel = supabase.channel("admin-dashboard-visits")
      .on("postgres_changes", { event: "*", schema: "public", table: "visit_registrations" }, () => {
        void triggerRefresh().then(() => toast.info("Analytics updated")).catch(() => toast.error("Failed to refresh"));
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [triggerRefresh]);

  const filteredPartners = useMemo(() => {
    if (!search) return partners;
    const q = search.toLowerCase();
    return partners.filter((p) => `${p.id} ${p.label ?? ""}`.toLowerCase().includes(q));
  }, [partners, search]);

  const fmt = useMemo(() => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }), []);
  const currency = useMemo(() => new Intl.NumberFormat(undefined, { style: "currency", currency: "CZK", maximumFractionDigits: 0 }), []);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <p className="text-destructive">{error}</p>
        <Button onClick={() => void loadMetrics()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-foreground/10">
            <BarChart3 className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Analytics</h1>
            <p className="text-sm text-muted-foreground">Real-time platform metrics and insights</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Filter by partner" value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className="h-9 w-40" />
          <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 w-40" />
          <Button variant="outline" size="sm" onClick={() => void triggerRefresh({ force: true })} disabled={autoRefreshing}>
            <RefreshCw className={cn("mr-2 h-4 w-4", autoRefreshing && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="/api/admin/analytics?mode=export" target="_blank" rel="noreferrer">
              <Download className="mr-2 h-4 w-4" />
              Export
            </a>
          </Button>
        </div>
      </div>

      {/* Live Counters */}
      {liveCounters && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          <MetricCard label="Visits today" value={fmt.format(liveCounters.visitsToday)} icon={Ticket} />
          <MetricCard label="Pending visits" value={fmt.format(liveCounters.pendingVisits)} icon={Clock} />
          <MetricCard label="Unique visitors (24h)" value={fmt.format(liveCounters.uniqueVisitors24h)} icon={Users} />
          <MetricCard label="Points earned (24h)" value={fmt.format(liveCounters.bonusEarned24h)} icon={TrendingUp} />
          <MetricCard label="Points redeemed (24h)" value={fmt.format(liveCounters.bonusRedeemed24h)} icon={Activity} />
          <MetricCard label="Active flash deals" value={fmt.format(liveCounters.activeFlashDeals)} icon={Zap} />
          <MetricCard label="Scheduled deals" value={fmt.format(liveCounters.flashDealsScheduled)} icon={Clock} />
          <MetricCard label="QR generated (24h)" value={fmt.format(liveCounters.qrGenerated24h)} icon={QrCode} />
          <MetricCard label="QR scans (24h)" value={fmt.format(liveCounters.qrScans24h)} icon={QrCode} />
          <MetricCard label="Pending redemptions" value={fmt.format(liveCounters.pendingRedemptions)} icon={Bell} />
        </div>
      )}

      {/* QR Stats */}
      {qrStats && (
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title="QR Events (24h)" description="Breakdown by event type">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Generated", value: qrStats.byType.generated },
                { label: "Scanned", value: qrStats.byType.scanned },
                { label: "Redeemed", value: qrStats.byType.redeemed },
                { label: "Expired", value: qrStats.byType.expired },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{fmt.format(item.value)}</p>
                </div>
              ))}
            </div>
          </SectionCard>
          <SectionCard title="QR by Program" description="Distribution across programs">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Standard", value: qrStats.byQrType.standard },
                { label: "Bonus", value: qrStats.byQrType.bonus },
                { label: "Flash Deal", value: qrStats.byQrType.flash },
                { label: "Transport", value: qrStats.byQrType.transport },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{fmt.format(item.value)}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {/* City Breakdown */}
      {cityBreakdown.length > 0 && (
        <SectionCard
          title="City Segmentation"
          description="Top locations by visit volume"
          actions={
            <Badge variant="secondary">
              <MapPin className="mr-1 h-3 w-3" />
              {cityBreakdown[0]?.city}: {fmt.format(cityBreakdown[0]?.visits ?? 0)} visits
            </Badge>
          }
        >
          <DataTable headers={["City", "Visits", "Revenue", "Avg Spend"]}>
            {cityBreakdown.map((entry) => (
              <tr key={entry.city}>
                <td className="px-4 py-3 font-medium text-foreground">{entry.city}</td>
                <td className="px-4 py-3 text-muted-foreground">{fmt.format(entry.visits)}</td>
                <td className="px-4 py-3 text-muted-foreground">{currency.format(entry.revenue)}</td>
                <td className="px-4 py-3 text-muted-foreground">{currency.format(entry.averageSpend)}</td>
              </tr>
            ))}
          </DataTable>
        </SectionCard>
      )}

      {/* QR Event Feed */}
      <SectionCard
        title="QR Event Feed"
        description="Live log of QR lifecycle events"
        actions={
          <div className="flex items-center gap-2">
            <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
              <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All events</SelectItem>
                <SelectItem value="generated">Generated</SelectItem>
                <SelectItem value="scanned">Scanned</SelectItem>
                <SelectItem value="redeemed">Redeemed</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
            <Select value={qrTypeFilter} onValueChange={setQrTypeFilter}>
              <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="bonus">Bonus</SelectItem>
                <SelectItem value="flash">Flash</SelectItem>
                <SelectItem value="transport">Transport</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => void loadQrEvents()} disabled={eventsLoading}>
              {eventsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        }
      >
        {eventsError && <p className="mb-3 text-sm text-destructive">{eventsError}</p>}
        <DataTable headers={["Time", "Event", "Type", "Source", "Context"]}>
          {qrEvents.length === 0 ? (
            <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No events found</td></tr>
          ) : (
            qrEvents.slice(0, 20).map((event) => (
              <tr key={event.id}>
                <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(event.occurredAt)}</td>
                <td className="px-4 py-3"><Badge variant="secondary" className="uppercase text-[10px]">{event.eventType}</Badge></td>
                <td className="px-4 py-3"><Badge variant="outline" className="uppercase text-[10px]">{event.qrType}</Badge></td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{event.source || "system"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{summarizeContext(event)}</td>
              </tr>
            ))
          )}
        </DataTable>
      </SectionCard>

      {/* Reminder Queue */}
      <SectionCard
        title="Reminder Queue"
        description={`${reminders.length} pending reminder${reminders.length === 1 ? "" : "s"}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void loadReminders()} disabled={remindersLoading}>
              <RefreshCw className={cn("mr-2 h-4 w-4", remindersLoading && "animate-spin")} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={queueingReminders}
              onClick={async () => {
                setQueueingReminders(true);
                try {
                  const res = await adminApi.dealRemindersQueue({});
                  toast.success(`Queued ${(res as { created?: number }).created ?? 0} reminders`);
                  await loadReminders();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed");
                } finally {
                  setQueueingReminders(false);
                }
              }}
            >
              {queueingReminders ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Queue
            </Button>
            <Button
              size="sm"
              disabled={dispatchingReminders || reminders.length === 0}
              onClick={async () => {
                setDispatchingReminders(true);
                try {
                  const res = await adminApi.dealRemindersDispatch({
                    reminders: reminders.map((i) => ({ id: i.id, status: "sent" as const, metadata: { dispatchedAt: new Date().toISOString() } })),
                  }, {});
                  toast.success(`Marked ${(res as { updated?: number }).updated ?? 0} as sent`);
                  await loadReminders();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed");
                } finally {
                  setDispatchingReminders(false);
                }
              }}
            >
              {dispatchingReminders ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Mark Sent
            </Button>
          </div>
        }
      >
        {remindersError && <p className="mb-3 text-sm text-destructive">{remindersError}</p>}
        <DataTable headers={["Deal", "Partner", "Type", "Email", "Scheduled"]}>
          {reminders.length === 0 ? (
            <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No pending reminders</td></tr>
          ) : (
            reminders.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 font-medium text-foreground">{item.deal.title}</td>
                <td className="px-4 py-3 text-muted-foreground">{item.deal.partnerName ?? item.deal.partnerId}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{item.reminderType.replace("_", " ")}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{item.userEmail ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(item.scheduledAt)}</td>
              </tr>
            ))
          )}
        </DataTable>
      </SectionCard>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Total Visits" value={fmt.format(totals?.count ?? 0)} />
        <MetricCard label="Visited" value={fmt.format(totals?.visited ?? 0)} />
        <MetricCard label="Revenue" value={currency.format(totals?.revenue ?? 0)} />
        <MetricCard label="Avg Revenue" value={currency.format(totals?.averageRevenue ?? 0)} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Points Earned" value={fmt.format(points?.earned ?? 0)} />
        <MetricCard label="Points Redeemed" value={fmt.format(points?.redeemed ?? 0)} />
        <MetricCard label="Points Net" value={fmt.format(points?.net ?? 0)} />
        <MetricCard label="Redemptions Used" value={fmt.format(redemptions?.used ?? 0)} />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Revenue Trend">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis width={50} tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
        <SectionCard title="Points Trend">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pointsTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis width={50} tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      {/* Partners & Latest Tables */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Partners" description={`${filteredPartners.length} partners`}>
          <DataTable headers={["Partner", "Visits", "Revenue", "Last Visit"]}>
            {filteredPartners.slice(0, 10).map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-medium text-foreground">{p.label || p.id}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.metrics?.count ?? 0}</td>
                <td className="px-4 py-3 text-muted-foreground">{currency.format(p.metrics?.revenue ?? 0)}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(p.lastSubmissionAt)}</td>
              </tr>
            ))}
          </DataTable>
        </SectionCard>
        <SectionCard title="Latest Visits" description="Recent submissions">
          <DataTable headers={["Email", "Partner", "Status", "Total"]}>
            {latest.slice(0, 10).map((s, i) => (
              <tr key={i}>
                <td className="px-4 py-3 text-foreground">{s.email || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.partnerId || "—"}</td>
                <td className="px-4 py-3"><Badge variant={s.visited ? "default" : "secondary"}>{s.visited ? "visited" : "pending"}</Badge></td>
                <td className="px-4 py-3 text-muted-foreground">{typeof s.totalPrice === "number" ? currency.format(s.totalPrice) : "—"}</td>
              </tr>
            ))}
          </DataTable>
        </SectionCard>
      </div>
    </div>
  );
}

function summarizeContext(event: QrEventFeedItem) {
  const parts = [
    event.flashDealId ? `Flash ${event.flashDealId.slice(0, 8)}` : null,
    event.rewardId ? `Reward ${event.rewardId.slice(0, 8)}` : null,
    event.transportServiceId ? `Transport ${event.transportServiceId.slice(0, 8)}` : null,
    event.visitId ? `Visit ${event.visitId.slice(0, 8)}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" • ") : "—";
}
