import { NextRequest, NextResponse } from 'next/server';
import { preflightResponse, withCors } from '@/lib/http/cors';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getAuthFromRequest } from '@/lib/auth/request';
import { getPartnerStaffByIds } from '@/lib/data/staff';
import { listRedemptionsForPartner } from '@/lib/data/redemptions';
import { resolveAllowedOrigin } from '@/lib/http/allowed-origin';

type VisitRowPartner = {
  id: string;
  submission_id: string | null;
  legacy_qr_key: string | null;
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

function buildCorsOptions(req: NextRequest) {
  return {
    origin: resolveAllowedOrigin(req),
    methods: 'GET,OPTIONS',
    headers: 'Content-Type, Authorization',
    credentials: true,
  } as const;
}

function isAuthorized(auth: ReturnType<typeof getAuthFromRequest>, requestedPartnerId: string) {
  if (!auth?.role) return false;
  if (auth.role === 'admin') return true;
  const pid = (auth.partnerId || '').toLowerCase();
  if (!pid || pid !== requestedPartnerId.toLowerCase()) return false;
  return auth.role === 'partner' || auth.role === 'staff';
}

export function OPTIONS(request: NextRequest) {
  return preflightResponse(buildCorsOptions(request));
}

export async function GET(
  request: Request,
  context: unknown,
) {
  const req = request as NextRequest;
  const params = (context as { params?: { id?: string } } | undefined)?.params ?? {};
  const partnerId = (params.id ?? "").toLowerCase();

  console.info("[api:partner] incoming", {
    partnerId,
    origin: req.headers.get('origin') ?? null,
    referer: req.headers.get('referer') ?? null,
    userAgent: req.headers.get('user-agent') ?? null,
  });

  if (!partnerId) {
    return withCors(
      NextResponse.json({ error: 'Partner ID is required' }, { status: 400 }),
      buildCorsOptions(req),
    );
  }
  const auth = getAuthFromRequest(req);
  if (!isAuthorized(auth, partnerId)) {
    console.warn("[api:partner] unauthorized", {
      partnerId,
      actorRole: auth?.role ?? null,
      actorPartner: auth?.partnerId ?? null,
    });
    return withCors(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      buildCorsOptions(req),
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    // Fetch partner display name and existence
    const partnerRes = await supabase.from('partners').select('id,display_name').eq('id', partnerId).maybeSingle();
    if (partnerRes.error) throw new Error(partnerRes.error.message);

    // Fetch submissions (visits)
    const visitsRes = await supabase
      .from('visit_registrations')
      .select('id,submission_id,email,status,created_at,visited_at,points_awarded,estimated_points,total_price,num_people,ticket_type,payload,partner_id,checked_in_by_staff_id,legacy_qr_key')
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false });
    if (visitsRes.error) throw new Error(visitsRes.error.message);

    type PartnerRow = { id: string; display_name: string | null };

    const visitRowsRaw: VisitRowPartner[] = visitsRes.data ?? [];

    const visitRows = dedupeVisitRows(visitRowsRaw);

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
      submissionId: v.submission_id,
      legacyKey: v.legacy_qr_key,
      partnerId: v.partner_id,
      email: v.email,
      status: v.status,
      used: v.status === 'visited',
      visited: v.status === 'visited',
      totalPrice: Number(v.total_price) || 0,
      estimatedPoints: v.estimated_points ?? v.points_awarded ?? 0,
      pointsAwarded: v.points_awarded ?? 0,
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

    const redemptionHistory = await listRedemptionsForPartner(partnerId, 100);

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

    const response = withCors(
      NextResponse.json({
        submissions,
        metrics,
        partner: partnerName,
        partnerId,
        lastUpdated: new Date().toISOString(),
        viewer,
        redemptions: redemptionHistory.items,
        redemptionStats: redemptionHistory.totals,
      }),
      buildCorsOptions(req),
    );
    console.info("[api:partner] success", {
      partnerId,
      submissionCount: submissions.length,
      authRole: auth?.role ?? null,
    });
    return response;
  } catch (err) {
    console.error('partner/[id] error', err);
    return withCors(
      NextResponse.json({ error: 'Server error' }, { status: 500 }),
      buildCorsOptions(req),
    );
  }
}

function dedupeVisitRows(rows: VisitRowPartner[]) {
  const map = new Map<string, VisitRowPartner>();

  const buildKey = (row: VisitRowPartner) => {
    if (row.submission_id) {
      return `submission:${row.submission_id.trim().toLowerCase()}`;
    }
    if (row.legacy_qr_key) {
      return `legacy:${row.legacy_qr_key.trim().toLowerCase()}`;
    }
    const createdKey = (() => {
      if (!row.created_at) return 'unknown';
      const parsed = Date.parse(row.created_at);
      if (Number.isNaN(parsed)) return row.created_at;
      const minuteBucket = Math.floor(parsed / (60 * 1000));
      return `m:${minuteBucket}`;
    })();
    const price = Number(row.total_price) || 0;
    const numPeople = row.num_people || 0;
    const ticket = (row.ticket_type || '').toLowerCase();
    return `email:${(row.email || '').toLowerCase()}|${createdKey}|price:${price}|people:${numPeople}|ticket:${ticket}`;
  };

  for (const row of rows) {
    const key = buildKey(row);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, row);
      continue;
    }

    const existingVisited = existing.status === 'visited' || Boolean(existing.visited_at);
    const incomingVisited = row.status === 'visited' || Boolean(row.visited_at);

    if (incomingVisited && !existingVisited) {
      map.set(key, row);
      continue;
    }

    if (!incomingVisited && !existingVisited) {
      const existingCreated = existing.created_at || '';
      const incomingCreated = row.created_at || '';
      if (incomingCreated > existingCreated) {
        map.set(key, row);
      }
      continue;
    }

    if (incomingVisited && existingVisited) {
      const existingVisitedAt = existing.visited_at || existing.created_at || '';
      const incomingVisitedAt = row.visited_at || row.created_at || '';
      if (incomingVisitedAt > existingVisitedAt) {
        map.set(key, row);
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const aCreated = a.created_at || '';
    const bCreated = b.created_at || '';
    return aCreated < bCreated ? 1 : aCreated > bCreated ? -1 : 0;
  });
}
