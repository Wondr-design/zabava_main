"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { adminApi } from "@/lib/web/api-client";
import { formatDateTime } from "@/lib/format/date";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { getSupabaseBrowser } from "@/lib/realtime/client";

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
        } = (res as {
          totals?: typeof totals;
          revenueTrend?: TimelinePoint[];
          partners?: PartnerSummary[];
          latestSubmissions?: SubmissionSummary[];
          points?: typeof points;
          redemptions?: typeof redemptions;
          pointsTrend?: TimelinePoint[];
          redemptionUsedTrend?: TimelinePoint[];
        });
        setTotals(totalsData ?? null);
        setRevenueTrend(revenueTrendData ?? []);
        setPartners(partnerData ?? []);
        setLatest(latestSubmissions ?? []);
        setPoints(pointsData ?? null);
        setRedemptions(redemptionsData ?? null);
        setPointsTrend(pointsTrendData ?? []);
        setRedemptionUsedTrend(redemptionTrendData ?? []);
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
        const { items } = (res as { items?: SubmissionSummary[] });
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

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

  const refreshAll = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      await Promise.all([
        loadMetrics({ silent }),
        loadSubmissions({ silent }),
      ]);
    },
    [loadMetrics, loadSubmissions],
  );

  const { refreshing: autoRefreshing, trigger: triggerRefresh } = useAutoRefresh(
    useCallback(async () => {
      await refreshAll({ silent: true });
    }, [refreshAll]),
    { enabled: true },
  );

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    const channel = supabase
      .channel('admin-dashboard-visits')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'visit_registrations',
      }, () => {
        void refreshAll({ silent: true });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refreshAll]);

  const filteredPartners = useMemo(() => {
    if (!search) return partners;
    const q = search.toLowerCase();
    return partners.filter((p) => `${p.id} ${p.label ?? ''}`.toLowerCase().includes(q));
  }, [partners, search]);

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin · Analytics</h1>
        <div className="flex gap-2">
          <input className="rounded border px-3 py-2 bg-white/80 text-black" placeholder="Filter by partnerId" value={partnerId} onChange={(e) => setPartnerId(e.target.value)} />
          <input className="rounded border px-3 py-2 bg-white/80 text-black" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <button
            onClick={() => {
              void triggerRefresh();
            }}
            disabled={autoRefreshing}
            className="rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {autoRefreshing ? "Refreshing…" : "Refresh"}
          </button>
          <a className="rounded bg-slate-700 px-3 py-2 text-sm" href="/api/admin/analytics?mode=export" target="_blank" rel="noreferrer">Export CSV</a>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card label="Total" value={(totals?.count ?? 0)} />
        <Card label="Visited" value={(totals?.visited ?? 0)} />
        <Card label="Revenue" value={(totals?.revenue ?? 0)} />
        <Card label="Avg Rev" value={(totals?.averageRevenue ?? 0)} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card label="Points earned" value={(points?.earned ?? 0)} />
        <Card label="Points redeemed" value={(points?.redeemed ?? 0)} />
        <Card label="Points net" value={(points?.net ?? 0)} />
        <Card label="Redemptions used" value={(redemptions?.used ?? 0)} />
      </div>

      <div className="border rounded-xl p-3">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                  <th className="text-left p-2">Submissions</th>
                  <th className="text-left p-2">Revenue</th>
                  <th className="text-left p-2">Last submission</th>
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
          <h3 className="text-sm font-medium">Latest submissions</h3>
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
                    <td className="p-2">{submission.email || '—'}</td>
                    <td className="p-2">{submission.partnerId || '—'}</td>
                    <td className="p-2">{submission.status || '—'}</td>
                    <td className="p-2">{formatDateTime(submission.createdAt)}</td>
                    <td className="p-2">{typeof submission.totalPrice === 'number' ? submission.totalPrice : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium">Submissions</h3>
        {subLoading && <div className="text-sm">Loading submissions…</div>}
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
                  <td className="p-2">{submission.email || '—'}</td>
                  <td className="p-2">{submission.partnerId || '—'}</td>
                  <td className="p-2">{submission.visited ? 'visited' : 'pending'}</td>
                  <td className="p-2">{formatDateTime(submission.createdAt)}</td>
                  <td className="p-2">{formatDateTime(submission.visitedAt)}</td>
                  <td className="p-2">{typeof submission.totalPrice === 'number' ? submission.totalPrice : '—'}</td>
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
