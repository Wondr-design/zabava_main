import { NextRequest, NextResponse } from 'next/server';
import { withCors, preflightResponse } from '@/lib/http/cors';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getTotalPointsForEmail } from '@/lib/data/points';

export function OPTIONS() {
  return preflightResponse({ methods: 'GET, OPTIONS', headers: 'Content-Type' });
}

export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase();
    if (!email) return withCors(NextResponse.json({ error: 'Email is required' }, { status: 400 }));

    const supabase = getSupabaseAdmin();
    const totalPoints = await getTotalPointsForEmail(email);
    const availablePoints = totalPoints;

    const visitsRes = await supabase
      .from('visit_registrations')
      .select('id,email,partner_id,status,created_at,visited_at,points_awarded,estimated_points,total_price,num_people,ticket_type,transport')
      .eq('email', email)
      .order('created_at', { ascending: false });
    if (visitsRes.error) throw new Error(visitsRes.error.message);
    interface VisitRowUPF {
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

    const rows: VisitRowUPF[] = visitsRes.data ?? [];

    const visits = (rows as VisitRowUPF[]).map((v) => ({
      partner: v.partner_id,
      status: v.status || 'pending',
      pointsEarned: Number(v.points_awarded || v.estimated_points || 0) || 0,
      ticketType: v.ticket_type || 'Standard',
      numPeople: v.num_people || 1,
      transport: v.transport || null,
      totalPrice: Number(v.total_price || 0) || 0,
      visitDate: v.created_at || null,
      confirmedDate: v.visited_at || null,
    }));

    const partners = new Set<string>();
    for (const v of rows) if (v.partner_id) partners.add(v.partner_id);

    const statistics = {
      totalPartners: partners.size,
      totalVisits: visits.length,
      pendingVisits: rows.filter((v) => (v.status || '').toLowerCase() === 'pending').length,
    };

    return withCors(NextResponse.json({ user: { totalPoints, availablePoints }, visits, statistics }));
  } catch (err) {
    console.error('bonus/user-points-fixed error', err);
    return withCors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
  }
}