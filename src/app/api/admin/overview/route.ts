import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { log, getCorrelationId } from '@/lib/logging';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || process.env.DASHBOARD_BASE_URL || '*';
const JWT_SECRET = process.env.JWT_SECRET || '';

function applyCors(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-secret');
  response.headers.set('Access-Control-Max-Age', '86400');
  return response;
}

function isAuthorized(req: NextRequest) {
  const adminSecret = req.headers.get('x-admin-secret');
  if (ADMIN_SECRET && adminSecret === ADMIN_SECRET) {
    return true;
  }

  if (!JWT_SECRET) {
    return false;
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return false;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { role?: string };
    return payload?.role === 'admin';
  } catch (err) {
    log.warn('admin_overview_auth_failed', { route: 'admin/overview', error: (err as Error)?.message, correlationId: getCorrelationId(req) });
    return false;
  }
}

async function collectOverviewMetrics() {
  const supabase = getSupabaseAdmin();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);

  const [partnersRes, partnersPendingRes, visitsRes, visitedTodayRes, generatedTodayRes, monthVisitedRes] =
    await Promise.all([
      supabase.from('partners').select('id', { head: true, count: 'exact' }).eq('status', 'active'),
      supabase.from('partners').select('id', { head: true, count: 'exact' }).eq('status', 'pending'),
      supabase
        .from('visit_registrations')
        .select('status,visited_at,total_price', { head: false })
        .gte('created_at', startOfMonth.toISOString()),
      supabase
        .from('visit_registrations')
        .select('id', { head: true, count: 'exact' })
        .eq('status', 'visited')
        .gte('visited_at', startOfDay.toISOString()),
      supabase
        .from('visit_registrations')
        .select('id', { head: true, count: 'exact' })
        .gte('created_at', startOfDay.toISOString()),
      supabase
        .from('visit_registrations')
        .select('id', { head: true, count: 'exact' })
        .eq('status', 'visited')
        .gte('visited_at', startOfMonth.toISOString()),
    ]);

  if (partnersRes.error) throw new Error(partnersRes.error.message);
  if (partnersPendingRes.error) throw new Error(partnersPendingRes.error.message);
  if (visitsRes.error) throw new Error(visitsRes.error.message);
  if (visitedTodayRes.error) throw new Error(visitedTodayRes.error.message);
  if (generatedTodayRes.error) throw new Error(generatedTodayRes.error.message);
  if (monthVisitedRes.error) throw new Error(monthVisitedRes.error.message);

  type VisitRowOV = {
    status: string | null;
    visited_at: string | null;
    total_price: number | string | null;
  };
  const visits = (visitsRes.data ?? []) as VisitRowOV[];

  const totals = {
    activePartners: partnersRes.count ?? 0,
    qrsGeneratedToday: generatedTodayRes.count ?? 0,
    qrsScannedToday: visitedTodayRes.count ?? 0,
    monthlyVisitors: monthVisitedRes.count ?? 0,
    totalRevenue: visits
      .filter((v) => v.status === 'visited')
      .reduce((sum, v) => sum + (Number(v.total_price) || 0), 0),
    totalCommission: 0,
    unvisitedQRCodes: visits.filter((v) => v.status !== 'visited').length,
  };

  const quickActions = {
    pendingPartnerApprovals: partnersPendingRes.count ?? 0,
    unusedQRCodes: totals.unvisitedQRCodes,
    insight: totals.qrsGeneratedToday - totals.qrsScannedToday,
  };

  return { totals, quickActions };
}

export function OPTIONS() {
  return applyCors(new NextResponse(null, { status: 200 }));
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return applyCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
  }

  try {
    const overview = await collectOverviewMetrics();
    return applyCors(NextResponse.json(overview));
  } catch (err) {
    log.error('admin_overview_error', err, { route: 'admin/overview', correlationId: getCorrelationId(req) });
    return applyCors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
  }
}
