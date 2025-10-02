import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { preflightResponse, withCors } from '@/lib/http/cors';
import { verifyCsrf } from '@/lib/http/csrf';
import { log, getCorrelationId } from '@/lib/logging';
import { getVisitById, getLatestPendingVisit, updateVisitStatus } from '@/lib/data/visits';
import { addPointsHistoryEntry, getTotalPointsForEmail } from '@/lib/data/points';
import { loadPartnerMeta } from '@/lib/data/partners';
import { getAuthFromRequest } from '@/lib/auth/request';

const markVisitedSchema = z.object({
  email: z.string().email(),
  partnerId: z.string().min(1),
  visitId: z.string().uuid().optional(),
  visitDate: z.string().optional(),
  notes: z.string().optional(),
});

function isAuthorized(req: NextRequest, partnerId: string) {
  const auth = getAuthFromRequest(req);
  if (!auth?.role) return false;
  if (auth.role === 'admin') return true;
  const pid = (auth.partnerId || '').toLowerCase();
  if (!pid || pid !== partnerId.toLowerCase()) return false;
  return auth.role === 'partner' || auth.role === 'staff';
}

export function OPTIONS() {
  return preflightResponse({ methods: 'POST,OPTIONS', headers: 'Content-Type, Authorization' });
}

function toNumber(x: unknown, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function derivePointsFromRecord(record: {
  points_awarded: number | null;
  estimated_points: number | null;
  total_price: number | string | null;
  ticket_type: string | null;
  num_people: number | null;
  transport: string | null;
}) {
  if (record.points_awarded && record.points_awarded > 0) return record.points_awarded;
  if (record.estimated_points && record.estimated_points > 0) return record.estimated_points;

  const numPeople = typeof record.num_people === 'number' && record.num_people > 0 ? record.num_people : 1;
  const ticket = String(record.ticket_type || '').toLowerCase();
  const hasTransport = (() => {
    const v = String(record.transport || '').toLowerCase();
    return v === 'yes' || v === 'true' || v === '1' || v === 'checked' || v === 'selected';
  })();

  let points = 0;
  switch (ticket) {
    case 'vip': points = 50 * numPeople; break;
    case 'family': points = 30 * numPeople; break;
    case 'group': points = 20 * numPeople; break;
    case 'student': points = 15 * numPeople; break;
    default: points = 10 * numPeople; break;
  }
  const price = toNumber(record.total_price, 0);
  if (price > 0) points = Math.max(points, Math.floor(price / 100));
  if (hasTransport) points += 5;
  return points || 10;
}

export async function POST(req: NextRequest) {
  // CSRF check
  if (!verifyCsrf(req)) {
    return withCors(NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 }), { methods: 'POST,OPTIONS', headers: 'Content-Type, Authorization' });
  }
  try {
    const json = await req.json().catch(() => ({}));
    const parsed = markVisitedSchema.safeParse(json);
    if (!parsed.success) {
      return withCors(NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 }), {
        methods: 'POST,OPTIONS', headers: 'Content-Type, Authorization'
      });
    }

    const { email, partnerId, visitId, visitDate, notes } = parsed.data;
    const auth = getAuthFromRequest(req);
    if (!auth || !isAuthorized(req, partnerId)) {
      log.warn('auth_failed', { route: 'partner/mark-visited', method: req.method, partnerId, email, correlationId: getCorrelationId(req), actor: auth?.role ?? 'unknown' });
      return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), {
        methods: 'POST,OPTIONS', headers: 'Content-Type, Authorization'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPartnerId = partnerId.trim().toLowerCase();
    const actingStaffId = auth?.role === 'staff' ? auth.staffId ?? null : null;

    // Resolve the visit to mark
    let visit = null;
    if (visitId) {
      const v = await getVisitById(visitId);
      if (!v) {
        log.warn('visit_not_found', { route: 'partner/mark-visited', method: req.method, partnerId, email, correlationId: getCorrelationId(req) });
        return withCors(NextResponse.json({ error: 'Registration not found' }, { status: 404 }), {
          methods: 'POST,OPTIONS', headers: 'Content-Type, Authorization'
        });
      }
      visit = v;
    } else {
      const v = await getLatestPendingVisit(normalizedEmail, normalizedPartnerId);
      if (!v) {
        log.warn('visit_not_found', { route: 'partner/mark-visited', method: req.method, partnerId, email, correlationId: getCorrelationId(req) });
        return withCors(NextResponse.json({ error: 'Registration not found' }, { status: 404 }), {
          methods: 'POST,OPTIONS', headers: 'Content-Type, Authorization'
        });
      }
      visit = v;
    }

    // Sanity checks
    if ((visit.partner_id || '').toLowerCase() !== normalizedPartnerId) {
      log.warn('cross_partner_mismatch', { route: 'partner/mark-visited', method: req.method, expected: normalizedPartnerId, found: visit.partner_id, correlationId: getCorrelationId(req) });
      return withCors(NextResponse.json({ error: 'Registration does not belong to this partner', expected: normalizedPartnerId, found: visit.partner_id }, { status: 400 }), {
        methods: 'POST,OPTIONS', headers: 'Content-Type, Authorization'
      });
    }
    if (visit.status === 'visited') {
      log.info('already_visited', { route: 'partner/mark-visited', method: req.method, visitId: visit.id, visitedAt: visit.visited_at, correlationId: getCorrelationId(req) });
      return withCors(NextResponse.json({ error: 'Already marked as visited', visitedAt: visit.visited_at }, { status: 400 }), {
        methods: 'POST,OPTIONS', headers: 'Content-Type, Authorization'
      });
    }

    const now = visitDate || new Date().toISOString();

    // Compute awarded points
    const pointsAwarded = derivePointsFromRecord({
      points_awarded: visit.points_awarded,
      estimated_points: visit.estimated_points,
      total_price: visit.total_price,
      ticket_type: visit.ticket_type,
      num_people: visit.num_people,
      transport: visit.transport,
    });

    const estimatedPoints = visit.estimated_points ?? pointsAwarded;

    // Update the visit
    const updated = await updateVisitStatus({
      visitId: visit.id,
      status: 'visited',
      visitedAt: now,
      pointsAwarded,
      estimatedPoints,
      totalPrice: typeof visit.total_price === 'number' ? visit.total_price : toNumber(visit.total_price, 0),
      numPeople: typeof visit.num_people === 'number' ? visit.num_people : 1,
      ticketType: visit.ticket_type || undefined,
      transport: visit.transport || undefined,
      categories: visit.categories || undefined,
      visitNotes: notes || undefined,
      checkedInByStaffId: actingStaffId,
    });

    // Add points history entry
    let partnerName: string | null = null;
    try {
      const meta = await loadPartnerMeta(normalizedPartnerId);
      partnerName = meta.displayName ?? normalizedPartnerId;
    } catch {
      partnerName = normalizedPartnerId;
    }

    await addPointsHistoryEntry({
      email: normalizedEmail,
      type: 'earned',
      points: pointsAwarded,
      partnerId: normalizedPartnerId,
      partnerName,
      visitId: visit.id,
      meta: {
        source: 'partner/mark-visited',
        staffId: actingStaffId ?? undefined,
      },
    });

    const totalPointsNow = await getTotalPointsForEmail(normalizedEmail);

    const response = {
      success: true,
      message: 'Visit confirmed successfully',
      visit: {
        email: normalizedEmail,
        partnerId: normalizedPartnerId,
        visitedAt: now,
        pointsAwarded,
        estimatedPoints,
        totalPrice: updated?.total_price ?? visit.total_price ?? 0,
        ticketType: updated?.ticket_type ?? visit.ticket_type ?? 'Standard',
        numPeople: updated?.num_people ?? visit.num_people ?? 1,
        transport: updated?.transport ?? visit.transport ?? null,
        categories: updated?.categories ?? visit.categories ?? '',
        visitId: updated?.id ?? visit.id,
        submissionId: updated?.submission_id ?? visit.submission_id ?? visit.id,
        totalPointsNow,
        checkedInByStaffId: actingStaffId,
      },
    };

    return withCors(NextResponse.json(response, { status: 200 }), {
      methods: 'POST,OPTIONS', headers: 'Content-Type, Authorization'
    });
  } catch (err) {
    log.error('partner/mark-visited error', err, { route: 'partner/mark-visited', method: req.method, correlationId: getCorrelationId(req) });
    return withCors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }), {
      methods: 'POST,OPTIONS', headers: 'Content-Type, Authorization'
    });
  }
}
