import { NextRequest, NextResponse } from 'next/server';
import { withCors, preflightResponse } from '@/lib/http/cors';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

import { log, getCorrelationId } from '@/lib/logging';
import { getAuthFromRequest } from '@/lib/auth/request';

function isAdmin(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (auth?.role === 'admin') return true;
  const s = req.headers.get('x-admin-secret');
  return Boolean(s) && s === (process.env.ADMIN_SECRET || '');
}

export function OPTIONS() {
  return preflightResponse({ methods: 'GET, OPTIONS', headers: 'Content-Type, x-admin-secret' });
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

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    log.warn('admin_analytics_auth_failed', { route: 'admin/analytics', correlationId: getCorrelationId(req) });
    return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
  }
  const url = req.nextUrl;
  const mode = (url.searchParams.get('mode') || 'metrics').toLowerCase();
  const partnerId = url.searchParams.get('partnerId') || undefined;
  const search = url.searchParams.get('search') || '';
  const limitRaw = url.searchParams.get('limit');
  const limit = Math.min(Math.max(Number(limitRaw || 50), 1), 500);

  const supabase = getSupabaseAdmin();

  try {
    if (mode === 'metrics') {
      const visitsRes = await supabase
        .from('visit_registrations')
        .select('partner_id,status,created_at,total_price,email,payload');
      if (visitsRes.error) throw new Error(visitsRes.error.message);
      const visits: BasicVisitRow[] = visitsRes.data ?? [];

      const totals = {
        count: visits.length,
        used: visits.filter((v) => v.status === 'visited').length,
        unused: visits.filter((v) => v.status !== 'visited').length,
        visited: visits.filter((v) => v.status === 'visited').length,
        notVisited: visits.filter((v) => v.status !== 'visited').length,
        revenue: visits.reduce((s, v) => s + (Number(v.total_price) || 0), 0),
        averageRevenue: 0,
      } as Record<string, number>;
      if (totals.count > 0) {
        totals.averageRevenue = Math.round(totals.revenue / totals.count);
      }

      // Points totals from points_history
      const pointsRes = await supabase
        .from('points_history')
        .select('type,points,created_at');
      if (pointsRes.error) throw new Error(pointsRes.error.message);
      type PointsRow = { type: string | null; points: number | string | null; created_at: string | null };
      const pointsRows: PointsRow[] = pointsRes.data ?? [];
      let pointsEarned = 0, pointsRedeemed = 0, pointsAdjusted = 0;
      const pointsTrendMap = new Map<string, number>();
      for (const r of pointsRows) {
        const n = Number(r.points) || 0;
        const t = (r.type || '').toLowerCase();
        if (t === 'earned') pointsEarned += n;
        else if (t === 'redemption') pointsRedeemed += n;
        else if (t === 'adjustment') pointsAdjusted += n;
        const day = toDateKey(r.created_at);
        if (day) pointsTrendMap.set(day, (pointsTrendMap.get(day) || 0) + (t === 'redemption' ? -n : n));
      }
      const pointsNet = pointsEarned + pointsAdjusted - pointsRedeemed;

      // Redemption stats
      const redRes = await supabase
        .from('redemptions')
        .select('status,created_at,used_at');
      if (redRes.error) throw new Error(redRes.error.message);
      type RedRow = { status: string | null; created_at: string | null; used_at: string | null };
      const redRows: RedRow[] = redRes.data ?? [];
      const redemptionCounts = { total: redRows.length, pending: 0, applied: 0, used: 0, rejected: 0 };
      const usedTrendMap = new Map<string, number>();
      for (const r of redRows) {
        const status = (r.status || '').toLowerCase();
        if (status === 'pending') redemptionCounts.pending += 1;
        else if (status === 'applied') redemptionCounts.applied += 1;
        else if (status === 'used') redemptionCounts.used += 1;
        else if (status === 'rejected') redemptionCounts.rejected += 1;
        const key = toDateKey(r.used_at || r.created_at);
        if (key) usedTrendMap.set(key, (usedTrendMap.get(key) || 0) + 1);
      }

      const revenueTrendMap = new Map<string, number>();
      const latestSubmissions: LatestSubmission[] = [];
      const partnerMap = new Map<string, { total: number; revenue: number; lastSubmissionAt: string | null }>();

      for (const v of visits) {
        const day = toDateKey(v.created_at);
        if (day) revenueTrendMap.set(day, (revenueTrendMap.get(day) || 0) + (Number(v.total_price) || 0));
        latestSubmissions.push({ partnerId: v.partner_id ?? null, ...v } as LatestSubmission);
        const pm = partnerMap.get(v.partner_id || '');
        if (!pm) partnerMap.set(v.partner_id || '', { total: 1, revenue: Number(v.total_price) || 0, lastSubmissionAt: v.created_at });
        else {
          pm.total += 1; pm.revenue += Number(v.total_price) || 0; if (!pm.lastSubmissionAt || (v.created_at && v.created_at > pm.lastSubmissionAt)) pm.lastSubmissionAt = v.created_at;
        }
      }

      const revenueTrend = Array.from(revenueTrendMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([iso, value]) => ({ date: new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), value }));

      const redemptionUsedTrend = Array.from(usedTrendMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([iso, value]) => ({ date: new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), value }));

      const pointsTrend = Array.from(pointsTrendMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([iso, value]) => ({ date: new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), value }));

      latestSubmissions.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      const partners = Array.from(partnerMap.entries()).map(([id, v]) => ({ id, label: id, metrics: { count: v.total, revenue: v.revenue }, lastSubmissionAt: v.lastSubmissionAt }));

      const points = { earned: pointsEarned, redeemed: pointsRedeemed, adjusted: pointsAdjusted, net: pointsNet };
      const redemptions = { ...redemptionCounts };

      return withCors(NextResponse.json({ totals, revenueTrend: revenueTrend.slice(-30), latestSubmissions: latestSubmissions.slice(0, 20), partners, points, pointsTrend: pointsTrend.slice(-30), redemptions, redemptionUsedTrend: redemptionUsedTrend.slice(-30), generatedAt: new Date().toISOString() }));
    }

    if (mode === 'submissions') {
      let query = supabase
        .from('visit_registrations')
        .select('id,email,partner_id,status,created_at,visited_at,total_price,estimated_points,ticket_type,num_people,payload')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (partnerId) query = query.eq('partner_id', partnerId.trim().toLowerCase());
      const res = await query;
      if (res.error) throw new Error(res.error.message);
      const all = (res.data ?? []) as SubmissionRow[];
      const filtered = search
        ? all.filter((s) => `${s.email} ${s.ticket_type} ${s.partner_id}`.toLowerCase().includes(search.toLowerCase()))
        : all;
      const items = filtered.map((v) => ({
        partnerId: v.partner_id,
        email: v.email,
        used: v.status === 'visited',
        visited: v.status === 'visited',
        totalPrice: v.total_price || 0,
        estimatedPoints: v.estimated_points || 0,
        ticket: v.ticket_type || 'Standard',
        numPeople: v.num_people || 1,
        createdAt: v.created_at,
        visitedAt: v.visited_at,
        originalPayload: v.payload || {},
      }));
      return withCors(NextResponse.json({ items, total: filtered.length }));
    }

    if (mode === 'export') {
      const res = await supabase
        .from('visit_registrations')
        .select('email,partner_id,created_at,visited_at,total_price,estimated_points,ticket_type,num_people,payload,status')
        .order('created_at', { ascending: false })
        .limit(2000);
      if (res.error) throw new Error(res.error.message);

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

      const rows: ExportRow[] = res.data ?? [];
      const header = ['partnerId','email','used','visited','totalPrice','estimatedPoints','ticket','numPeople','createdAt','visitedAt','payload'];
      const lines = [header.join(',')];
      for (const r of rows) {
        const payloadCopy = { ...(r.payload || {}) };
        const payloadJson = JSON.stringify(payloadCopy).replace(/\"/g, '\"\"');
        const vals = [
          r.partner_id,
          r.email,
          r.status === 'visited' ? 'true' : 'false',
          r.status === 'visited' ? 'true' : 'false',
          String(r.total_price || 0),
          String(r.estimated_points || 0),
          r.ticket_type || '',
          String(r.num_people || ''),
          r.created_at || '',
          r.visited_at || '',
          payloadJson || '',
        ].map((v) => `\"${String(v ?? '').replace(/\"/g, '\"\"')}\"`);
        lines.push(vals.join(','));
      }
      const csv = lines.join('\n');
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': req.headers.get('origin') || '*',
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename=\"submissions-${Date.now()}\".csv`,
        },
      });
    }

    return withCors(NextResponse.json({ error: 'Unsupported mode' }, { status: 400 }));
  } catch (err) {
    log.error('admin_analytics_error', err, { route: 'admin/analytics', correlationId: getCorrelationId(req) });
    return withCors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
  }
}