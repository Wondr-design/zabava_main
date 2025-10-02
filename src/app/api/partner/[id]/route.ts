import { NextRequest, NextResponse } from 'next/server';
import { preflightResponse } from '@/lib/http/cors';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getAuthFromRequest } from '@/lib/auth/request';
import { getPartnerStaffByIds } from '@/lib/data/staff';

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

function applyCors(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Max-Age', '86400');
  return response;
}

function isAuthorized(auth: ReturnType<typeof getAuthFromRequest>, requestedPartnerId: string) {
  if (!auth?.role) return false;
  if (auth.role === 'admin') return true;
  const pid = (auth.partnerId || '').toLowerCase();
  if (!pid || pid !== requestedPartnerId.toLowerCase()) return false;
  return auth.role === 'partner' || auth.role === 'staff';
}

export function OPTIONS() {
  return preflightResponse({ methods: 'GET, OPTIONS', headers: 'Content-Type, Authorization' });
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: partnerId } = await context.params;
  const auth = getAuthFromRequest(req);
  if (!isAuthorized(auth, partnerId)) {
    return applyCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
  }

  try {
    const supabase = getSupabaseAdmin();
    // Fetch partner display name and existence
    const partnerRes = await supabase.from('partners').select('id,display_name').eq('id', partnerId.toLowerCase()).maybeSingle();
    if (partnerRes.error) throw new Error(partnerRes.error.message);

    // Fetch submissions (visits)
    const visitsRes = await supabase
      .from('visit_registrations')
      .select('id,email,status,created_at,visited_at,points_awarded,estimated_points,total_price,num_people,ticket_type,payload,partner_id,checked_in_by_staff_id')
      .eq('partner_id', partnerId.toLowerCase())
      .order('created_at', { ascending: false });
    if (visitsRes.error) throw new Error(visitsRes.error.message);

    type PartnerRow = { id: string; display_name: string | null };

    type VisitRowPartner = {
      id: string;
      email: string | null;
      status: string | null;
      created_at: string | null;
      visited_at: string | null;
      points_awarded: number | null;
      estimated_points: number | null;
      total_price: number | string | null;
      num_people: number | null;
      ticket_type: string | null;
      payload: Record<string, unknown> | null;
      partner_id: string | null;
      checked_in_by_staff_id: string | null;
    };
    const visitRows: VisitRowPartner[] = visitsRes.data ?? [];

    const staffIds = new Set<string>();
    for (const row of visitRows) {
      if (row.checked_in_by_staff_id) {
        staffIds.add(row.checked_in_by_staff_id);
      }
    }
    if (auth?.role === 'staff' && auth.staffId) {
      staffIds.add(auth.staffId);
    }

    const staffRecords = staffIds.size
      ? await getPartnerStaffByIds(Array.from(staffIds))
      : [];
    const staffMap = new Map<string, { id: string; email: string; name: string | null; status: string; partnerId: string }>();
    for (const staff of staffRecords) {
      staffMap.set(staff.id, {
        id: staff.id,
        email: staff.email,
        name: staff.name,
        status: staff.status,
        partnerId: staff.partner_id,
      });
    }

    const submissions = visitRows.map((v) => ({
      id: v.id,
      partnerId: v.partner_id,
      email: v.email,
      used: v.status === 'visited',
      visited: v.status === 'visited',
      totalPrice: v.total_price || 0,
      estimatedPoints: v.points_awarded || v.estimated_points || 0,
      ticket: v.ticket_type || 'Standard',
      numPeople: v.num_people || 1,
      createdAt: v.created_at,
      visitedAt: v.visited_at,
      originalPayload: v.payload || {},
      checkedInByStaffId: v.checked_in_by_staff_id,
      checkedInByStaff: v.checked_in_by_staff_id ? staffMap.get(v.checked_in_by_staff_id) ?? null : null,
    }));

    const count = submissions.length;
    const used = submissions.filter((s) => s.used).length;
    const visitedCount = submissions.filter((s) => s.visited).length;
    const revenue = submissions.reduce((sum, s) => sum + (Number(s.totalPrice) || 0), 0);
    const points = submissions.reduce((sum, s) => sum + (Number(s.estimatedPoints) || 0), 0);

    const metrics = {
      count,
      used,
      unused: count - used,
      visited: visitedCount,
      notVisited: count - visitedCount,
      revenue,
      points,
      bonusRedemptions: 0,
      averageRevenue: count ? Math.round(revenue / count) : 0,
      averagePoints: count ? Math.round(points / count) : 0,
    };

    const partnerName = (partnerRes.data as PartnerRow | null | undefined)?.display_name || partnerId;

    const viewer = (() => {
      if (!auth) return null;
      if (auth.role === 'staff' && auth.staffId) {
        const staff = staffMap.get(auth.staffId);
        return {
          role: 'staff' as const,
          staff: staff || { id: auth.staffId, email: auth.email || null, name: auth.name || null },
        };
      }
      return { role: auth.role };
    })();

    return applyCors(
      NextResponse.json({
        submissions,
        metrics,
        partner: partnerName,
        partnerId,
        lastUpdated: new Date().toISOString(),
        viewer,
      })
    );
  } catch (err) {
    console.error('partner/[id] error', err);
    return applyCors(NextResponse.json({ error: 'Server error' }, { status: 500 }));
  }
}
