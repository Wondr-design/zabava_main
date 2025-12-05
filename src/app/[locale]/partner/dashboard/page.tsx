"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { partnerApi } from "@/lib/web/api-client";
import { RedemptionProcessor } from "@/components/partner/redemption-processor";
import { DashboardFilters, PartnerFilterState } from "@/components/partner/dashboard-filters";
import { OverviewCards, OverviewMetrics, SeriesPoint } from "@/components/partner/overview-cards";
import { SubmissionsTable, SubmissionItem } from "@/components/partner/submissions-table";
import { QuickVisitForm } from "@/components/partner/quick-visit-form";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { getSupabaseBrowser } from "@/lib/realtime/client";
import { toast } from "sonner";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Download, LogOut } from "lucide-react";
import { RedemptionHistoryCard } from "@/components/partner/redemption-history";
import { LocalizedLink } from "@/components/ui/localized-link";
import { useLocalizedRouter } from "@/i18n/use-localized-router";
import type { RedemptionHistoryItem } from "@/lib/data/redemptions";
import { formatCurrencyCZK } from "@/lib/format/currency";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
interface FilePayload {
  filename: string;
  contentType: string;
  base64: string;
}

const downloadFile = ({ filename, contentType, base64 }: FilePayload) => {
  if (typeof window === "undefined") return;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const blob = new Blob([bytes], { type: contentType });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
};

export default function PartnerDashboardPage() {
  const router = useLocalizedRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [partnerId, setPartnerId] = useState<string>("");
  const [initialized, setInitialized] = useState(false);
  const [partnerName, setPartnerName] = useState<string>("");
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [redemptions, setRedemptions] = useState<RedemptionHistoryItem[]>([]);
  const [redemptionStats, setRedemptionStats] = useState<{ used: number; rejected: number }>({ used: 0, rejected: 0 });
  const [filters, setFilters] = useState<PartnerFilterState>({ search: "", status: "all" });
  const [privacyMode, setPrivacyMode] = useState(false);
  const [billingExporting, setBillingExporting] = useState(false);
  const [flashExporting, setFlashExporting] = useState(false);

  const refresh = useCallback(
    async (pid: string, { silent = false }: { silent?: boolean } = {}) => {
      if (!pid) return;
      const start = performance.now();
      console.info("[partner-dashboard] refresh:start", {
        partnerId: pid,
        silent,
      });
      if (!silent) {
        setLoading(true);
        setError("");
      }
      try {
        const data = (await partnerApi.dashboard(pid, {})) as {
          partner?: string;
          submissions?: SubmissionItem[];
          redemptions?: RedemptionHistoryItem[];
          redemptionStats?: { used?: number; rejected?: number };
        };
        console.info("[partner-dashboard] refresh:success", {
          partnerId: pid,
          submissionCount: Array.isArray(data.submissions)
            ? data.submissions.length
            : 0,
          durationMs: Math.round(performance.now() - start),
        });
        setPartnerName(String(data.partner || pid));
        const list = Array.isArray(data.submissions) ? data.submissions : [];
        setSubmissions(list);
        setRedemptions(Array.isArray(data.redemptions) ? data.redemptions : []);
        setRedemptionStats({
          used: Number(data.redemptionStats?.used ?? 0),
          rejected: Number(data.redemptionStats?.rejected ?? 0),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load partner data";
        console.error("[partner-dashboard] refresh:error", {
          partnerId: pid,
          durationMs: Math.round(performance.now() - start),
          message,
        });
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
    const readCookie = (name: string) => {
      if (typeof document === "undefined") return "";
      return document.cookie
        .split(";")
        .map((s) => s.trim())
        .map((s) => s.split("="))
        .reduce<Record<string, string>>((acc, [k, v]) => {
          if (k && v !== undefined) acc[k] = decodeURIComponent(v);
          return acc;
        }, {})[name] || "";
    };

    const role = readCookie("zabava_role");
    const pid = readCookie("zabava_partner");

    if (!pid || (role !== "partner" && role !== "staff")) {
      router.replace("/partner/login");
      return;
    }

    setPartnerId((prev) => (prev === pid ? prev : pid));

    if (!initialized || partnerId !== pid) {
      void refresh(pid, { silent: initialized });
      setInitialized(true);
    }
  }, [initialized, partnerId, refresh, router]);

  const autoRefresh = useCallback(async () => {
    if (!partnerId) return;
    await refresh(partnerId, { silent: true });
  }, [partnerId, refresh]);

  const { refreshing: autoRefreshing, trigger: triggerRefresh } = useAutoRefresh(autoRefresh, {
    enabled: Boolean(partnerId),
    minInterval: 5_000,
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
        void triggerRefresh().then(() => {
          toast.info("Partner activity updated", {
            description: "Latest visit registrations synced.",
          });
        }).catch((err) => {
          console.error("[partner-dashboard] realtime refresh failed", err);
          toast.error("Failed to refresh latest partner activity.");
        });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [partnerId, triggerRefresh]);

  const handleBillingExport = useCallback(async () => {
    if (!partnerId) {
      toast.error("Partner session not found.");
      return;
    }
    try {
      setBillingExporting(true);
      const dateFromIso = filters.from ? new Date(`${filters.from}T00:00:00Z`).toISOString() : undefined;
      const dateToIso = filters.to ? new Date(`${filters.to}T23:59:59Z`).toISOString() : undefined;
      const report = await partnerApi.billingExport(
        { dateFrom: dateFromIso, dateTo: dateToIso },
        {},
      );
      downloadFile(report.files.csv);
      downloadFile(report.files.xlsx);
      toast.success("Export ready", {
        description: `${report.summary.visitCount.toLocaleString()} visits · ${report.summary.flashDealCount.toLocaleString()} flash deals · ${report.summary.transportRideCount.toLocaleString()} rides`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to export partner report.";
      toast.error(message);
    } finally {
      setBillingExporting(false);
    }
  }, [filters.from, filters.to, partnerId]);

  const handleFlashUsageExport = useCallback(async () => {
    if (!partnerId) {
      toast.error("Partner session not found.");
      return;
    }
    try {
      setFlashExporting(true);
      const dateFromIso = filters.from ? new Date(`${filters.from}T00:00:00Z`).toISOString() : undefined;
      const dateToIso = filters.to ? new Date(`${filters.to}T23:59:59Z`).toISOString() : undefined;
      const report = await partnerApi.flashDealUsageExport(
        { dateFrom: dateFromIso, dateTo: dateToIso },
        {},
      );
      downloadFile(report.files.csv);
      downloadFile(report.files.xlsx);
      const summary = report.summary;
      toast.success("Flash-deal export ready", {
        description: `${summary.used.toLocaleString()} used · ${summary.pending.toLocaleString()} pending · ${summary.rejected.toLocaleString()} rejected`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to export flash-deal usage.";
      toast.error(message);
    } finally {
      setFlashExporting(false);
    }
  }, [filters.from, filters.to, partnerId]);

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

  useEffect(() => {
    const label = partnerName ? `Zabava - ${partnerName}` : "Zabava - Partner Dashboard";
    document.title = label;
  }, [partnerName]);

  const handleLogout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore network errors
    }
    router.replace("/partner/login");
  }, [router]);

  if (loading) {
    return (
      <div className="space-y-8">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Loading partner dashboard…
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle>{`Welcome back, ${partnerName || "Partner"}`}</CardTitle>
            <CardDescription>
              Track visit performance, register walk-ins, and process loyalty redemptions for your team in one place.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RefreshButton
              variant="secondary"
              size="sm"
              onRefresh={async () => {
                await triggerRefresh({ force: true });
                toast.success("Dashboard refreshed");
              }}
              disabled={!partnerId || autoRefreshing}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleBillingExport}
              disabled={!partnerId || billingExporting}
            >
              <Download className="size-4" aria-hidden />
              {billingExporting ? "Preparing export…" : "Export billing"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleFlashUsageExport}
              disabled={!partnerId || flashExporting}
            >
              <Download className="size-4" aria-hidden />
              {flashExporting ? "Preparing export…" : "Flash-deal usage"}
            </Button>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-4 py-2 text-sm text-muted-foreground">
              <Switch
                id="partner-privacy-mode"
                checked={privacyMode}
                onCheckedChange={(checked) => setPrivacyMode(Boolean(checked))}
                aria-label="Toggle privacy mode"
              />
              <label
                htmlFor="partner-privacy-mode"
                className="cursor-pointer select-none text-foreground"
              >
                Privacy mode
              </label>
            </div>
            <Button asChild variant="secondary" size="sm" className="gap-2">
              <LocalizedLink href="/partner/staff">Staff &amp; access</LocalizedLink>
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="gap-2"
              onClick={() => {
                void handleLogout();
              }}
            >
              <LogOut className="size-4" aria-hidden />
              Logout
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{metrics.totalCount.toLocaleString()} total visits</Badge>
            <Badge className="bg-green-500/20 text-green-600 border-green-500/30">{metrics.visitedCount.toLocaleString()} visited</Badge>
            <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">{metrics.pendingCount.toLocaleString()} pending</Badge>
            <Badge>{redemptionStats.used.toLocaleString()} rewards redeemed</Badge>
            <Badge variant="destructive">{redemptionStats.rejected.toLocaleString()} rejected</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Refine dashboard data</CardTitle>
          <CardDescription>
            Filter by date range, guest status, or keyword to focus on specific visits.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DashboardFilters value={filters} onChange={setFilters} />
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Quick overview</CardTitle>
            <CardDescription>
              Key metrics and performance indicators at a glance.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="px-4 py-2">
                <span className="font-semibold">{metrics.totalCount.toLocaleString()}</span>
                <span className="ml-2 text-xs">Total visits</span>
              </Badge>
              <Badge className="px-4 py-2 bg-green-500/20 text-green-600 border-green-500/30">
                <span className="font-semibold">{metrics.visitedCount.toLocaleString()}</span>
                <span className="ml-2 text-xs">Visited</span>
              </Badge>
              <Badge className="px-4 py-2 bg-amber-500/20 text-amber-600 border-amber-500/30">
                <span className="font-semibold">{metrics.pendingCount.toLocaleString()}</span>
                <span className="ml-2 text-xs">Pending</span>
              </Badge>
              <Badge className="px-4 py-2">
                <span className="font-semibold">{formatCurrencyCZK(metrics.revenue)}</span>
                <span className="ml-2 text-xs">Revenue</span>
              </Badge>
              <Badge className="px-4 py-2">
                <span className="font-semibold">{metrics.points.toLocaleString()}</span>
                <span className="ml-2 text-xs">Points awarded</span>
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance overview</CardTitle>
            <CardDescription>
              Key totals and charts for your partner location.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OverviewCards metrics={metrics} series={series} />
          </CardContent>
        </Card>
      </div>

      {privacyMode ? (
        <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-600">
          <AlertDescription>
            Privacy mode hides guest emails, payload details, and staff names in the visit list.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Visit registrations</CardTitle>
          <CardDescription>
            Latest entries from your Zabava QR and quick visit forms. Refresh to see new guests.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SubmissionsTable
            items={filtered}
            partnerId={partnerId}
            onRefresh={async () => {
              await refresh(partnerId, { silent: true });
              toast.info("Visit list updated");
            }}
            viewerRole="partner"
            privacyMode={privacyMode}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Register a quick visit</CardTitle>
            <CardDescription>
              Create a visit on behalf of guests who arrive without a completed form.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QuickVisitForm partnerId={partnerId} onCreated={() => refresh(partnerId)} />
          </CardContent>
        </Card>
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Process a loyalty redemption</CardTitle>
            <CardDescription>
              Validate and confirm loyalty rewards in real time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RedemptionProcessor partnerId={partnerId} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Redemption history</CardTitle>
          <CardDescription>
            Track recently processed rewards and confirm who handled each request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RedemptionHistoryCard
            items={redemptions}
            emptyLabel="No rewards have been processed yet."
            showHeader={false}
          />
        </CardContent>
      </Card>
    </div>
  );
}
