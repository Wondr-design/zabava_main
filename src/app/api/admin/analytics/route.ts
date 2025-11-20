import { NextRequest, NextResponse } from "next/server";
import { withCors, preflightResponse } from "@/lib/http/cors";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

import { log, getCorrelationId } from "@/lib/logging";
import { getAuthFromRequest } from "@/lib/auth/request";
import { getQrEventStats, listQrEvents } from "@/lib/data/qr-events";
import type { QrEventType, QrType } from "@/lib/data/qr-events";

function isAdmin(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (auth?.role === "admin") return true;
  const s = req.headers.get("x-admin-secret");
  return Boolean(s) && s === (process.env.ADMIN_SECRET || "");
}

export function OPTIONS() {
  return preflightResponse({
    methods: "GET, OPTIONS",
    headers: "Content-Type, x-admin-secret",
  });
}

function toDateKey(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

type BasicVisitRow = {
  partner_id: string | null;
  status: string | null;
  created_at: string | null;
  total_price: number | string | null;
  email: string | null;
  payload: Record<string, unknown> | null;
};

type SubmissionRow = {
  id: string;
  email: string | null;
  partner_id: string | null;
  status: string | null;
  created_at: string | null;
  visited_at: string | null;
  total_price: number | string | null;
  estimated_points: number | null;
  ticket_type: string | null;
  num_people: number | null;
  payload: Record<string, unknown> | null;
};

type LatestSubmission = SubmissionRow & { partnerId: string | null };
type CityBreakdownItem = {
  city: string;
  visits: number;
  revenue: number;
  averageSpend: number;
};

function isIgnorableRelationError(error: { code?: string } | null | undefined) {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST302";
}

type SupabaseResponseError = { message: string; code?: string } | null;

async function safeList<
  T extends { error: SupabaseResponseError; data: unknown }
>(
  promise: PromiseLike<T>,
  {
    context,
    onError,
  }: {
    context: string;
    onError?: (err: SupabaseResponseError) => void;
  }
) {
  const response = await promise;
  if (response.error) {
    if (isIgnorableRelationError(response.error)) {
      log.warn("admin_analytics_missing_relation", {
        context,
        code: response.error.code,
        message: response.error.message,
      });
      if (onError) onError(response.error);
      return [];
    }
    throw new Error(response.error.message);
  }
  return (response.data as unknown[]) ?? [];
}

async function safeCount(
  promise: PromiseLike<{ error: SupabaseResponseError; count: number | null }>,
  { context }: { context: string }
) {
  const response = await promise;
  if (response.error) {
    if (isIgnorableRelationError(response.error)) {
      log.warn("admin_analytics_missing_relation", {
        context,
        code: response.error.code,
        message: response.error.message,
      });
      return 0;
    }
    throw new Error(response.error.message);
  }
  return response.count ?? 0;
}

function pickCityField(
  source: Record<string, unknown>,
  keys: readonly string[]
) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
}

function normalizeCityName(city: string) {
  const trimmed = city.trim();
  if (!trimmed) return "";
  return trimmed
    .split(/\s+/)
    .map(
      (segment) =>
        segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase()
    )
    .join(" ");
}

function extractCity(payload: Record<string, unknown> | null | undefined) {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;

  const direct = pickCityField(record, [
    "city",
    "city_name",
    "cityName",
    "partnerCity",
    "location_city",
  ]);
  if (direct) return direct;

  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "string" && /city/i.test(key)) {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }

  const form = record.form;
  if (form && typeof form === "object") {
    const values = (form as { values?: Record<string, unknown> }).values;
    if (values && typeof values === "object") {
      const fromValues = pickCityField(values, [
        "city",
        "city_name",
        "cityName",
        "visit_city",
        "location_city",
      ]);
      if (fromValues) return fromValues;
      for (const [key, value] of Object.entries(values)) {
        if (typeof value === "string" && /city/i.test(key)) {
          const trimmed = value.trim();
          if (trimmed) return trimmed;
        }
      }
    }
  }

  const metadata = record.metadata;
  if (metadata && typeof metadata === "object") {
    const metadataRecord = metadata as Record<string, unknown>;
    const fromMetadata = pickCityField(metadataRecord, [
      "city",
      "cityName",
      "city_name",
      "location_city",
    ]);
    if (fromMetadata) return fromMetadata;
    for (const [key, value] of Object.entries(metadataRecord)) {
      if (typeof value === "string" && /city/i.test(key)) {
        const trimmed = value.trim();
        if (trimmed) return trimmed;
      }
    }
  }

  return null;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    log.warn("admin_analytics_auth_failed", {
      route: "admin/analytics",
      correlationId: getCorrelationId(req),
    });
    return withCors(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
  }
  const url = req.nextUrl;
  const mode = (url.searchParams.get("mode") || "metrics").toLowerCase();
  const partnerId = url.searchParams.get("partnerId") || undefined;
  const search = url.searchParams.get("search") || "";
  const limitRaw = url.searchParams.get("limit");
  const limit = Math.min(Math.max(Number(limitRaw || 50), 1), 500);
  const from = url.searchParams.get("from") || undefined;
  const to = url.searchParams.get("to") || undefined;

  const supabase = getSupabaseAdmin();

  try {
    if (mode === "metrics") {
      const visits = (await safeList(
        supabase
          .from("visit_registrations")
          .select("partner_id,status,created_at,total_price,email,payload"),
        { context: "visit_registrations" }
      )) as BasicVisitRow[];

      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayIso = todayStart.toISOString();
      const last24hIso = new Date(
        now.getTime() - 24 * 60 * 60 * 1000
      ).toISOString();

      const flashDealsPromise = supabase
        .from("flash_deals")
        .select("status")
        .in("status", ["live", "scheduled"]);

      const transportActivePromise = supabase
        .from("transport_services")
        .select("id", { head: true, count: "exact" })
        .eq("enabled", true);

      const qrScansPromise = supabase
        .from("qr_events")
        .select("id", { head: true, count: "exact" })
        .eq("event_type", "scanned")
        .gte("occurred_at", last24hIso);

      const qrGeneratedPromise = supabase
        .from("qr_events")
        .select("id", { head: true, count: "exact" })
        .eq("event_type", "generated")
        .gte("occurred_at", last24hIso);

      const totals = {
        count: visits.length,
        used: visits.filter((v) => v.status === "visited").length,
        unused: visits.filter((v) => v.status !== "visited").length,
        visited: visits.filter((v) => v.status === "visited").length,
        notVisited: visits.filter((v) => v.status !== "visited").length,
        revenue: visits.reduce((s, v) => s + (Number(v.total_price) || 0), 0),
        averageRevenue: 0,
      } as Record<string, number>;
      if (totals.count > 0) {
        totals.averageRevenue = Math.round(totals.revenue / totals.count);
      }

      // Points totals from points_history
      type PointsRow = {
        type: string | null;
        points: number | string | null;
        created_at: string | null;
      };
      const pointsRows = (await safeList(
        supabase.from("points_history").select("type,points,created_at"),
        { context: "points_history" }
      )) as PointsRow[];
      let pointsEarned = 0;
      let pointsRedeemed = 0;
      let pointsAdjusted = 0;
      let bonusEarned24h = 0;
      let bonusRedeemed24h = 0;
      const pointsTrendMap = new Map<string, number>();
      for (const r of pointsRows) {
        const n = Number(r.points) || 0;
        const t = (r.type || "").toLowerCase();
        if (t === "earned") pointsEarned += n;
        else if (t === "redemption") pointsRedeemed += n;
        else if (t === "adjustment") pointsAdjusted += n;
        if ((r.created_at || "") >= last24hIso) {
          if (t === "earned") bonusEarned24h += n;
          else if (t === "redemption") bonusRedeemed24h += n;
        }
        const day = toDateKey(r.created_at);
        if (day)
          pointsTrendMap.set(
            day,
            (pointsTrendMap.get(day) || 0) + (t === "redemption" ? -n : n)
          );
      }
      const pointsNet = pointsEarned + pointsAdjusted - pointsRedeemed;

      // Redemption stats
      type RedRow = {
        status: string | null;
        created_at: string | null;
        used_at: string | null;
      };
      const redRows = (await safeList(
        supabase.from("redemptions").select("status,created_at,used_at"),
        { context: "redemptions" }
      )) as RedRow[];
      const redemptionCounts = {
        total: redRows.length,
        pending: 0,
        applied: 0,
        used: 0,
        rejected: 0,
      };
      const usedTrendMap = new Map<string, number>();
      for (const r of redRows) {
        const status = (r.status || "").toLowerCase();
        if (status === "pending") redemptionCounts.pending += 1;
        else if (status === "applied") redemptionCounts.applied += 1;
        else if (status === "used") redemptionCounts.used += 1;
        else if (status === "rejected") redemptionCounts.rejected += 1;
        const key = toDateKey(r.used_at || r.created_at);
        if (key) usedTrendMap.set(key, (usedTrendMap.get(key) || 0) + 1);
      }

      const revenueTrendMap = new Map<string, number>();
      const latestSubmissions: LatestSubmission[] = [];
      const partnerMap = new Map<
        string,
        { total: number; revenue: number; lastSubmissionAt: string | null }
      >();
      const cityMap = new Map<
        string,
        { label: string; visits: number; revenue: number }
      >();
      let visitsToday = 0;
      let pendingVisits = 0;
      const visitorEmails24h = new Set<string>();

      for (const v of visits) {
        const day = toDateKey(v.created_at);
        if (day)
          revenueTrendMap.set(
            day,
            (revenueTrendMap.get(day) || 0) + (Number(v.total_price) || 0)
          );
        latestSubmissions.push({
          partnerId: v.partner_id ?? null,
          ...v,
        } as LatestSubmission);
        const pm = partnerMap.get(v.partner_id || "");
        const numericRevenue = Number(v.total_price) || 0;
        if (!pm)
          partnerMap.set(v.partner_id || "", {
            total: 1,
            revenue: numericRevenue,
            lastSubmissionAt: v.created_at,
          });
        else {
          pm.total += 1;
          pm.revenue += numericRevenue;
          if (
            !pm.lastSubmissionAt ||
            (v.created_at && v.created_at > pm.lastSubmissionAt)
          )
            pm.lastSubmissionAt = v.created_at;
        }

        const createdAt = v.created_at || "";
        if (createdAt >= todayIso) visitsToday += 1;
        if ((v.status || "").toLowerCase() !== "visited") pendingVisits += 1;
        if (createdAt >= last24hIso) {
          const email = (v.email || "").toLowerCase();
          if (email) visitorEmails24h.add(email);
        }

        const cityRaw = extractCity(v.payload);
        if (cityRaw) {
          const label = normalizeCityName(cityRaw);
          if (label) {
            const cityKey = label.toLowerCase();
            const existingCity = cityMap.get(cityKey);
            if (existingCity) {
              existingCity.visits += 1;
              existingCity.revenue += numericRevenue;
            } else {
              cityMap.set(cityKey, {
                label,
                visits: 1,
                revenue: numericRevenue,
              });
            }
          }
        }
      }

      const uniqueVisitors24h = visitorEmails24h.size;

      type FlashDealStatusRow = { status: string | null };
      const [flashDealsRes, transportCount, qrScansCount, qrGeneratedCount] =
        await Promise.all([
          safeList(flashDealsPromise, { context: "flash_deals" }),
          safeCount(transportActivePromise, { context: "transport_services" }),
          safeCount(qrScansPromise, { context: "qr_events (scanned)" }),
          safeCount(qrGeneratedPromise, { context: "qr_events (generated)" }),
        ]);

      const flashDealsData = flashDealsRes as FlashDealStatusRow[];
      const activeFlashDeals = flashDealsData.filter(
        (row) => (row.status || "").toLowerCase() === "live"
      ).length;
      const flashDealsScheduled = flashDealsData.filter(
        (row) => (row.status || "").toLowerCase() === "scheduled"
      ).length;
      const activeTransportServices = transportCount;
      const qrScans24h = qrScansCount;
      const qrGenerated24h = qrGeneratedCount;

      let qrStats: Awaited<ReturnType<typeof getQrEventStats>> = {
        total: 0,
        byType: {
          generated: 0,
          scanned: 0,
          expired: 0,
          redeemed: 0,
          rejected: 0,
        },
        byQrType: {
          standard: 0,
          bonus: 0,
          flash: 0,
          transport: 0,
        },
      };
      try {
        qrStats = await getQrEventStats({
          from: last24hIso,
        });
      } catch (qrError) {
        const message = qrError instanceof Error ? qrError.message : "unknown";
        log.warn("admin_analytics_qr_stats_failed", {
          route: "admin/analytics",
          correlationId: getCorrelationId(req),
          message,
        });
      }

      const liveCounters = {
        visitsToday,
        pendingVisits,
        uniqueVisitors24h,
        bonusEarned24h,
        bonusRedeemed24h,
        activeFlashDeals,
        flashDealsScheduled,
        activeTransportServices,
        qrGenerated24h,
        qrScans24h,
        pendingRedemptions: redemptionCounts.pending,
      };

      const revenueTrend = Array.from(revenueTrendMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([iso, value]) => ({
          date: new Date(iso).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          }),
          value,
        }));

      const redemptionUsedTrend = Array.from(usedTrendMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([iso, value]) => ({
          date: new Date(iso).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          }),
          value,
        }));

      const pointsTrend = Array.from(pointsTrendMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([iso, value]) => ({
          date: new Date(iso).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          }),
          value,
        }));

      latestSubmissions.sort((a, b) =>
        (b.created_at || "").localeCompare(a.created_at || "")
      );
      const partners = Array.from(partnerMap.entries()).map(([id, v]) => ({
        id,
        label: id,
        metrics: { count: v.total, revenue: v.revenue },
        lastSubmissionAt: v.lastSubmissionAt,
      }));

      const points = {
        earned: pointsEarned,
        redeemed: pointsRedeemed,
        adjusted: pointsAdjusted,
        net: pointsNet,
      };
      const redemptions = { ...redemptionCounts };
      const cityBreakdown: CityBreakdownItem[] = Array.from(cityMap.values())
        .map((entry) => ({
          city: entry.label,
          visits: entry.visits,
          revenue: entry.revenue,
          averageSpend: entry.visits > 0 ? entry.revenue / entry.visits : 0,
        }))
        .sort((a, b) => b.visits - a.visits || b.revenue - a.revenue)
        .slice(0, 12);

      return withCors(
        NextResponse.json({
          totals,
          revenueTrend: revenueTrend.slice(-30),
          latestSubmissions: latestSubmissions.slice(0, 20),
          partners,
          points,
          pointsTrend: pointsTrend.slice(-30),
          redemptions,
          redemptionUsedTrend: redemptionUsedTrend.slice(-30),
          liveCounters,
          qrStats,
          cityBreakdown,
          generatedAt: new Date().toISOString(),
        })
      );
    }

    if (mode === "submissions") {
      let query = supabase
        .from("visit_registrations")
        .select(
          "id,email,partner_id,status,created_at,visited_at,total_price,estimated_points,ticket_type,num_people,payload"
        )
        .order("created_at", { ascending: false })
        .limit(limit);
      if (partnerId)
        query = query.eq("partner_id", partnerId.trim().toLowerCase());
      const all = (await safeList(query, {
        context: "visit_registrations",
      })) as SubmissionRow[];
      const filtered = search
        ? all.filter((s) =>
            `${s.email} ${s.ticket_type} ${s.partner_id}`
              .toLowerCase()
              .includes(search.toLowerCase())
          )
        : all;
      const items = filtered.map((v) => ({
        partnerId: v.partner_id,
        email: v.email,
        used: v.status === "visited",
        visited: v.status === "visited",
        totalPrice: v.total_price || 0,
        estimatedPoints: v.estimated_points || 0,
        ticket: v.ticket_type || "Standard",
        numPeople: v.num_people || 1,
        createdAt: v.created_at,
        visitedAt: v.visited_at,
        originalPayload: v.payload || {},
      }));
      return withCors(NextResponse.json({ items, total: filtered.length }));
    }

    if (mode === "qr-events") {
      const eventTypeParam = (
        url.searchParams.get("eventType") || ""
      ).toLowerCase();
      const qrTypeParam = (url.searchParams.get("qrType") || "").toLowerCase();

      const eventType = (
        ["generated", "scanned", "expired", "redeemed"] as const
      ).find((value) => value === eventTypeParam) as QrEventType | undefined;
      const qrType = (
        ["standard", "bonus", "flash", "transport"] as const
      ).find((value) => value === qrTypeParam) as QrType | undefined;

      const events = await listQrEvents({
        limit,
        eventType,
        qrType,
        from,
        to,
      });

      const items = events.map((event) => ({
        id: event.id,
        eventType: event.event_type,
        qrType: event.qr_type,
        occurredAt: event.occurred_at,
        source: event.source,
        visitId: event.visit_id,
        rewardId: event.reward_id,
        flashDealId: event.flash_deal_id,
        transportServiceId: event.transport_service_id,
        metadata: event.metadata,
      }));

      return withCors(NextResponse.json({ items, total: items.length }));
    }

    if (mode === "export") {
      type ExportRow = {
        email: string | null;
        partner_id: string | null;
        created_at: string | null;
        visited_at: string | null;
        total_price: number | string | null;
        estimated_points: number | null;
        ticket_type: string | null;
        num_people: number | null;
        payload: Record<string, unknown> | null;
        status: string | null;
      };

      const rows = (await safeList(
        supabase
          .from("visit_registrations")
          .select(
            "email,partner_id,created_at,visited_at,total_price,estimated_points,ticket_type,num_people,payload,status"
          )
          .order("created_at", { ascending: false })
          .limit(2000),
        { context: "visit_registrations" }
      )) as ExportRow[];
      const header = [
        "partnerId",
        "email",
        "used",
        "visited",
        "totalPrice",
        "estimatedPoints",
        "ticket",
        "numPeople",
        "createdAt",
        "visitedAt",
        "payload",
      ];
      const lines = [header.join(",")];
      for (const r of rows) {
        const payloadCopy = { ...(r.payload || {}) };
        const payloadJson = JSON.stringify(payloadCopy).replace(/\"/g, '""');
        const vals = [
          r.partner_id,
          r.email,
          r.status === "visited" ? "true" : "false",
          r.status === "visited" ? "true" : "false",
          String(r.total_price || 0),
          String(r.estimated_points || 0),
          r.ticket_type || "",
          String(r.num_people || ""),
          r.created_at || "",
          r.visited_at || "",
          payloadJson || "",
        ].map((v) => `\"${String(v ?? "").replace(/\"/g, '""')}\"`);
        lines.push(vals.join(","));
      }
      const csv = lines.join("\n");
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": req.headers.get("origin") || "*",
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename=\"submissions-${Date.now()}\".csv`,
        },
      });
    }

    return withCors(
      NextResponse.json({ error: "Unsupported mode" }, { status: 400 })
    );
  } catch (err) {
    log.error("admin_analytics_error", err, {
      route: "admin/analytics",
      correlationId: getCorrelationId(req),
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 })
    );
  }
}
