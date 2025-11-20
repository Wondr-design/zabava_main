import { NextRequest, NextResponse } from 'next/server';
import { withCors, preflightResponse } from '@/lib/http/cors';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export function OPTIONS() {
  return preflightResponse({ methods: 'GET, OPTIONS', headers: 'Content-Type' });
}

export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase();
    if (!email) return withCors(NextResponse.json({ error: 'Email is required' }, { status: 400 }));

    const supabase = getSupabaseAdmin();

    // Visits (qrRecords equivalent)
    const visitsRes = await supabase
      .from('visit_registrations')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false });
    if (visitsRes.error) throw new Error(visitsRes.error.message);
    type VisitRowDbg = {
      id: string;
      email: string | null;
      partner_id: string | null;
      status: string | null;
      visited_at: string | null;
      created_at: string | null;
      payload: Record<string, unknown> | null;
    };
    const visits: VisitRowDbg[] = visitsRes.data ?? [];

    const qrRecords: Record<string, unknown> = {};
    for (const v of visits) {
      qrRecords[`visit:${v.id}`] = {
        email: v.email,
        partnerId: v.partner_id,
        visited: v.status === 'visited',
        visitedAt: v.visited_at,
        createdAt: v.created_at,
        payload: v.payload || {},
      };
    }

    // Partner memberships
    const membersRes = await supabase
      .from('partner_members')
      .select('partner_id')
      .eq('email', email);
    if (membersRes.error) throw new Error(membersRes.error.message);
    const memberRows: { partner_id: string | null }[] = membersRes.data ?? [];
    const partnerMemberships = memberRows.map((r) => r.partner_id).filter((v): v is string => Boolean(v));

    // Points history
    const pointsRes = await supabase
      .from('points_history')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(50);
    if (pointsRes.error) throw new Error(pointsRes.error.message);
    const pointsHistory = pointsRes.data ?? [];

    // Redemptions
  const redRes = await supabase
    .from('redemptions')
    .select('*, reward:rewards(name, points_cost)')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(50);
  if (redRes.error) throw new Error(redRes.error.message);
  type RedemptionDebugRow = Record<string, unknown> & {
    reward?: { name?: string | null; points_cost?: number | null } | null;
  };
  const redemptionRows: RedemptionDebugRow[] = (redRes.data ?? []) as RedemptionDebugRow[];
  const redemptions = redemptionRows.map((row) => ({
    ...row,
    reward: row.reward ?? null,
  }));

    return withCors(
      NextResponse.json({
        email,
        qrRecords,
        partnerMemberships,
        pointsHistory,
        redemptions,
      })
    );
  } catch (err) {
    console.error('bonus/debug-user error', err);
    return withCors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
  }
}
