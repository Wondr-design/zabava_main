"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { partnerApi } from "@/lib/web/api-client";
import { SubmissionsTable, SubmissionItem } from "@/components/partner/submissions-table";
import { RedemptionProcessor } from "@/components/partner/redemption-processor";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { getSupabaseBrowser } from "@/lib/realtime/client";

interface DashboardResponse {
  partner?: string;
  submissions?: SubmissionItem[];
  metrics?: Record<string, number>;
  viewer?: {
    role: string;
    staff?: {
      id: string;
      name?: string | null;
      email?: string | null;
    };
  } | null;
}

function readCookie(name: string) {
  if (typeof document === "undefined") return "";
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [k, v] = cookie.trim().split("=");
    if (k === name && v !== undefined) return decodeURIComponent(v);
  }
  return "";
}

type StatusFilter = "all" | "pending" | "visited";

export default function StaffDashboardPage() {
  const router = useRouter();
  const [partnerId, setPartnerId] = useState<string>("");
  const [staffId, setStaffId] = useState<string>("");
  const [staffName, setStaffName] = useState<string>("");
  const [partnerName, setPartnerName] = useState<string>("");
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");

  const load = useCallback(
    async (pid: string, { silent = false }: { silent?: boolean } = {}) => {
      if (!pid) return;
      if (!silent) {
        setLoading(true);
        setError("");
      }
      try {
        const res = (await partnerApi.dashboard(pid, {})) as DashboardResponse;
        setPartnerName(res.partner || pid);
        setSubmissions(Array.isArray(res.submissions) ? (res.submissions as SubmissionItem[]) : []);
        if (res.viewer?.staff) {
          setStaffName(res.viewer.staff.name || res.viewer.staff.email || "Team member");
          if (res.viewer.staff.id) {
            setStaffId(res.viewer.staff.id);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load dashboard";
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
    const role = readCookie("zabava_role");
    const pid = readCookie("zabava_partner");
    const sid = readCookie("zabava_staff");
    if (role !== "staff" || !pid) {
      router.replace("/staff/login");
      return;
    }
    setPartnerId(pid);
    if (sid) setStaffId(sid);
    void load(pid);
  }, [load, router]);

  const autoRefresh = useCallback(async () => {
    if (!partnerId) return;
    await load(partnerId, { silent: true });
  }, [load, partnerId]);

  const { refreshing: autoRefreshing, trigger: triggerRefresh } = useAutoRefresh(autoRefresh, {
    enabled: Boolean(partnerId),
  });

  useEffect(() => {
    if (!partnerId) return;
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    const channel = supabase
      .channel(`staff-dashboard-${partnerId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'visit_registrations',
        filter: `partner_id=eq.${partnerId.toLowerCase()}`,
      }, () => {
        void load(partnerId, { silent: true });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, partnerId]);

  const filteredSubmissions = useMemo(() => {
    let list = submissions.slice();
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((item) => (item.email || "").toLowerCase().includes(q));
    }
    if (statusFilter !== "all") {
      list = list.filter((item) => {
        const status = item.status || (item.visitedAt ? "visited" : "pending");
        return status === statusFilter;
      });
    }
    return list;
  }, [submissions, search, statusFilter]);

  const stats = useMemo(() => {
    const total = submissions.length;
    const visited = submissions.filter((s) => s.visitedAt || s.status === "visited").length;
    const pending = total - visited;
    const handledByMe = submissions.filter((s) => s.checkedInByStaffId && s.checkedInByStaffId === staffId).length;
    const revenue = submissions.reduce((sum, s) => sum + (Number(s.totalPrice) || 0), 0);
    const points = submissions.reduce((sum, s) => sum + (Number(s.estimatedPoints) || 0), 0);
    return { total, visited, pending, handledByMe, revenue, points };
  }, [submissions, staffId]);

  if (loading) {
    return <div className="p-6 text-slate-300">Loading dashboard…</div>;
  }

  if (error) {
    return <div className="p-6 text-red-400">{error}</div>;
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-white">{partnerName} · Staff console</h1>
        <p className="text-sm text-slate-400">Signed in as {staffName || "team member"}. Use this dashboard to confirm visits and process rewards.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total visits" value={stats.total} tone="slate" />
        <StatCard label="Pending" value={stats.pending} tone="amber" />
        <StatCard label="Visited" value={stats.visited} tone="emerald" />
        <StatCard label="Visited by you" value={stats.handledByMe} tone="indigo" />
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-lg">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by visitor email"
              className="flex-1 rounded-lg border border-white/10 bg-slate-950/30 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="rounded-lg border border-white/10 bg-slate-950/30 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="visited">Visited</option>
            </select>
            <button
              onClick={() => {
                void triggerRefresh();
              }}
              disabled={!partnerId || autoRefreshing}
              className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 transition-colors hover:border-emerald-400/60 hover:bg-emerald-500/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {autoRefreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
          <div className="text-xs text-slate-500">
            Showing {filteredSubmissions.length} of {submissions.length} registrations
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <SubmissionsTable
            items={filteredSubmissions}
            partnerId={partnerId}
            onRefresh={() => {
              void load(partnerId, { silent: true });
            }}
            viewerRole="staff"
            viewerStaffId={staffId}
          />
        </div>
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-lg">
            <h2 className="text-sm font-semibold text-white">Today&apos;s summary</h2>
            <dl className="mt-3 grid gap-3 text-sm text-slate-300">
              <div className="flex items-center justify-between">
                <dt>Total revenue (all time)</dt>
                <dd className="font-semibold text-white">${stats.revenue.toLocaleString()}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Estimated points</dt>
                <dd className="font-semibold text-white">{stats.points.toLocaleString()}</dd>
              </div>
            </dl>
          </div>
          <RedemptionProcessor partnerId={partnerId} />
        </div>
      </section>
    </div>
  );
}

type StatTone = "slate" | "amber" | "emerald" | "indigo";

function StatCard({ label, value, tone }: { label: string; value: number; tone: StatTone }) {
  const toneClasses: Record<StatTone, string> = {
    slate: "border-white/15 bg-slate-900/60 text-white",
    amber: "border-amber-400/40 bg-amber-500/10 text-amber-100",
    emerald: "border-emerald-400/30 bg-emerald-500/10 text-emerald-100",
    indigo: "border-indigo-400/30 bg-indigo-500/10 text-indigo-100",
  } as const;

  return (
    <div className={`rounded-2xl border px-4 py-3 shadow-lg ${toneClasses[tone]}`}>
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
