"use client";

import Link from "next/link";
import { useMemo, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { partnerApi } from "@/lib/web/api-client";
import { RedemptionProcessor } from "@/components/partner/redemption-processor";
import { DashboardFilters, PartnerFilterState } from "@/components/partner/dashboard-filters";
import { OverviewCards, OverviewMetrics, SeriesPoint } from "@/components/partner/overview-cards";
import { SubmissionsTable, SubmissionItem } from "@/components/partner/submissions-table";
import { QuickVisitForm } from "@/components/partner/quick-visit-form";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { getSupabaseBrowser } from "@/lib/realtime/client";

export default function PartnerDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [partnerId, setPartnerId] = useState<string>("");
  const [partnerName, setPartnerName] = useState<string>("");
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [filters, setFilters] = useState<PartnerFilterState>({ search: "", status: "all" });

  const refresh = useCallback(
    async (pid: string, { silent = false }: { silent?: boolean } = {}) => {
      if (!pid) return;
      if (!silent) {
        setLoading(true);
        setError("");
      }
      try {
        const data = (await partnerApi.dashboard(pid, {})) as {
          partner?: string;
          submissions?: SubmissionItem[];
        };
        setPartnerName(String(data.partner || pid));
        const list = Array.isArray(data.submissions) ? data.submissions : [];
        setSubmissions(list);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load partner data";
        setError(message);
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    const cookies = typeof document !== 'undefined' ? document.cookie : '';
    const getCookie = (name: string) => {
      return cookies
        .split(';')
        .map(s => s.trim())
        .map(s => s.split('='))
        .reduce<Record<string,string>>((acc, [k, v]) => { if (k && v !== undefined) acc[k] = decodeURIComponent(v); return acc; }, {})[name] || '';
    };
    const role = getCookie('zabava_role');
    const pid = getCookie('zabava_partner');
    if (role !== 'partner' || !pid) {
      router.replace("/partner/login");
      return;
    }
    setPartnerId(pid);
    void refresh(pid);
  }, [refresh, router]);

  const autoRefresh = useCallback(async () => {
    if (!partnerId) return;
    await refresh(partnerId, { silent: true });
  }, [partnerId, refresh]);

  const { refreshing: autoRefreshing, trigger: triggerRefresh } = useAutoRefresh(autoRefresh, {
    enabled: Boolean(partnerId),
  });

  useEffect(() => {
    if (!partnerId) return;
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    const channel = supabase
      .channel(`partner-dashboard-${partnerId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'visit_registrations',
        filter: `partner_id=eq.${partnerId.toLowerCase()}`,
      }, () => {
        void refresh(partnerId, { silent: true });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [partnerId, refresh]);

  const filtered = useMemo(() => {
    let list = submissions.slice();
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter((s) => (s.email || '').toLowerCase().includes(q) || (s.ticket || '').toLowerCase().includes(q));
    }
    if (filters.status !== 'all') {
      list = list.filter((s) => {
        const status = s.status || (s.visitedAt ? 'visited' : 'pending');
        return status === filters.status;
      });
    }
    if (filters.from) {
      const from = new Date(filters.from).getTime();
      list = list.filter((s) => {
        const t = s.createdAt ? Date.parse(s.createdAt) : NaN;
        return Number.isNaN(t) ? true : t >= from;
      });
    }
    if (filters.to) {
      const to = new Date(filters.to).getTime();
      list = list.filter((s) => {
        const t = s.createdAt ? Date.parse(s.createdAt) : NaN;
        return Number.isNaN(t) ? true : t <= to;
      });
    }
    return list;
  }, [submissions, filters]);

  const metrics: OverviewMetrics = useMemo(() => {
    const totalCount = filtered.length;
    const visitedCount = filtered.filter((s) => s.visitedAt || s.status === 'visited').length;
    const pendingCount = filtered.filter((s) => !(s.visitedAt || s.status === 'visited')).length;
    const revenue = filtered.reduce((sum, s) => sum + (Number(s.totalPrice) || 0), 0);
    const points = filtered.reduce((sum, s) => sum + (Number(s.estimatedPoints) || 0), 0);
    return { totalCount, visitedCount, pendingCount, revenue, points };
  }, [filtered]);

  const series: SeriesPoint[] = useMemo(() => {
    const map = new Map<string, { visits: number; points: number }>();
    for (const s of filtered) {
      const day = s.createdAt ? new Date(s.createdAt) : null;
      const key = day ? new Date(day.getFullYear(), day.getMonth(), day.getDate()).toISOString().slice(0, 10) : 'unknown';
      const cur = map.get(key) || { visits: 0, points: 0 };
      cur.visits += 1;
      cur.points += Number(s.estimatedPoints) || 0;
      map.set(key, cur);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, visits: v.visits, points: v.points }));
  }, [filtered]);

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold text-slate-900">Partner dashboard · {partnerName}</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              void triggerRefresh();
            }}
            disabled={!partnerId || autoRefreshing}
            className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {autoRefreshing ? "Refreshing…" : "Refresh"}
          </button>
          <Link
            href="/partner/staff"
            className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
          >
            Staff &amp; access
          </Link>
          <button
            onClick={async () => { try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {} router.replace('/partner/login'); }}
            className="rounded-lg bg-slate-900 px-3 py-1 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700"
          >
            Logout
          </button>
        </div>
      </div>

      <DashboardFilters value={filters} onChange={setFilters} />
      <OverviewCards metrics={metrics} series={series} />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <SubmissionsTable
            items={filtered}
            partnerId={partnerId}
            onRefresh={() => {
              void refresh(partnerId, { silent: true });
            }}
            viewerRole="partner"
          />
        </div>
        <div className="space-y-6">
          <QuickVisitForm partnerId={partnerId} onCreated={() => refresh(partnerId)} />
          <RedemptionProcessor partnerId={partnerId} />
        </div>
      </div>
    </div>
  );
}
