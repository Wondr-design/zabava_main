import { NextRequest, NextResponse } from 'next/server';
import { withCors, preflightResponse } from '@/lib/http/cors';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getTotalPointsForEmail } from '@/lib/data/points';

export function OPTIONS() {
  return preflightResponse({ methods: 'GET, OPTIONS', headers: 'Content-Type' });
}

interface VisitRowUP {
  partner_id: string | null;
  status?: string | null;
  points_awarded?: number | null;
  estimated_points?: number | null;
  ticket_type?: string | null;
  num_people?: number | null;
  transport?: string | null;
  total_price?: number | string | null;
  created_at?: string | null;
  visited_at?: string | null;
}

function toVisitItem(row: VisitRowUP) {
  const status = row.status || 'pending';
  const points = Number(row.points_awarded || row.estimated_points || 0) || 0;
  return {
    partner: row.partner_id,
    status,
    pointsEarned: points,
    ticketType: row.ticket_type || 'Standard',
    numPeople: row.num_people || 1,
    transport: row.transport || null,
    totalPrice: Number(row.total_price || 0) || 0,
    visitDate: row.created_at || null,
    confirmedDate: row.visited_at || null,
  };
}

interface RewardRow {
  id: string;
  name: string;
  description?: string | null;
  points_cost?: number | null;
  category?: string | null;
  stock?: number | null;
  status?: string | null;
}

export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase();
    if (!email) {
      return withCors(NextResponse.json({ error: 'Email is required' }, { status: 400 }));
    }
    const supabase = getSupabaseAdmin();

    const totalPoints = await getTotalPointsForEmail(email);
    const availablePoints = totalPoints; // no pending holds in this simple model

    const visitsRes = await supabase
      .from('visit_registrations')
      .select('id,email,partner_id,status,created_at,visited_at,points_awarded,estimated_points,total_price,num_people,ticket_type,transport')
      .eq('email', email)
      .order('created_at', { ascending: false });
    if (visitsRes.error) throw new Error(visitsRes.error.message);
    const visitRows: VisitRowUP[] = visitsRes.data ?? [];
    const visits = visitRows.map(toVisitItem);

    const partnersSet = new Set<string>();
    for (const v of visitRows) if (v.partner_id) partnersSet.add(v.partner_id);

    // Rewards: fetch rewards and partner visibility, compute canRedeem
    const rewardsRes = await supabase.from('rewards').select('*').eq('status', 'active');
    if (rewardsRes.error) throw new Error(rewardsRes.error.message);
    const rewardsRows: RewardRow[] = rewardsRes.data ?? [];

    const visibilityMap = new Map<string, string[]>();
    if (rewardsRows.length > 0) {
      const ids = rewardsRows.map((r) => r.id);
      const visRes = await supabase
        .from('reward_partner_visibility')
        .select('reward_id, partner_id')
        .in('reward_id', ids);
      if (visRes.error) throw new Error(visRes.error.message);
      const visRows: { reward_id: string; partner_id: string }[] = visRes.data ?? [];
      for (const row of visRows) {
        const list = visibilityMap.get(row.reward_id) ?? [];
        list.push(row.partner_id);
        visibilityMap.set(row.reward_id, list);
      }
    }

    const visitedPartners = Array.from(partnersSet);

    const availableRewards = rewardsRows.map((r) => {
      const partners = visibilityMap.get(r.id) ?? [];
      const partnerOk = partners.length === 0 || partners.some((p) => visitedPartners.includes(p));
      const canRedeem = partnerOk && availablePoints >= (r.points_cost ?? 0);
      return {
        id: r.id,
        name: r.name,
        description: r.description ?? '',
        pointsCost: r.points_cost ?? 0,
        category: r.category,
        canRedeem,
        stock: r.stock ?? null,
      };
    });

    const statistics = {
      totalPartners: partnersSet.size,
      totalVisits: visits.length,
      pendingVisits: visitRows.filter((v) => (v.status || '').toLowerCase() === 'pending').length,
    };

    return withCors(
      NextResponse.json({
        user: { totalPoints, availablePoints },
        visits,
        statistics,
        availableRewards,
      })
    );
  } catch (err) {
    console.error('bonus/user-points error', err);
    return withCors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
  }
}