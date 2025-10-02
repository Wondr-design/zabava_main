import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
// preflightResponse imported elsewhere in app; not needed here
import { getVisitById } from '@/lib/data/visits';
import { log, getCorrelationId } from '@/lib/logging';
import { loadPartnerMeta } from '@/lib/data/partners';
import { normalizeVisitRecord } from '@/lib/services/visit-normalizer';

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
    const payload = jwt.verify(token, JWT_SECRET);
    if (typeof payload === 'object' && payload && 'role' in payload) {
      return (payload as { role?: string }).role === 'admin';
    }
    return false;
  } catch (err) {
    console.warn('admin visits detail auth failed', err);
    return false;
  }
}

export function OPTIONS() {
  return applyCors(new NextResponse(null, { status: 200 }));
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(req)) {
    log.warn('admin_visits_detail_auth_failed', { route: 'admin/visits/[id]', correlationId: getCorrelationId(req) });
    return applyCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
  }

  try {
    const { id } = await ctx.params;
    const visit = await getVisitById(id);
    if (!visit) {
      log.warn('admin_visits_detail_not_found', { route: 'admin/visits/[id]', id, correlationId: getCorrelationId(req) });
      return applyCors(NextResponse.json({ error: 'not found' }, { status: 404 }));
    }

    const partnerId = (visit.partner_id || '').toLowerCase();
    let partnerName: string | null = null;
    try {
      const meta = await loadPartnerMeta(partnerId);
      partnerName = meta.displayName ?? partnerId;
    } catch {
      partnerName = partnerId || null;
    }

    // Build a normalized view for admin inspection
    const normalized = normalizeVisitRecord(
      {
        payload: (visit.payload || {}) as Record<string, unknown>,
        record: {},
        visitRecord: {},
        confirmation: {
          partnerId,
          email: visit.email,
          visitDate: visit.created_at,
          visitedAt: visit.visited_at,
          status: visit.status,
        } as Record<string, unknown>,
        meta: { partnerName } as Record<string, unknown>,
      },
      { computeAwardedPoints: true }
    );

    const response = {
      visit: {
        id: visit.id,
        submissionId: visit.submission_id,
        email: visit.email,
        partnerId,
        partnerName,
        status: visit.status,
        createdAt: visit.created_at,
        visitedAt: visit.visited_at,
        pointsAwarded: visit.points_awarded ?? 0,
        estimatedPoints: visit.estimated_points ?? 0,
        totalPrice: typeof visit.total_price === 'number' ? visit.total_price : Number(visit.total_price || 0),
        numPeople: visit.num_people ?? 1,
        ticketType: visit.ticket_type ?? 'Standard',
        transport: visit.transport ?? null,
        categories: visit.categories ?? '',
        payload: visit.payload || {},
      },
      normalized,
    };

    return applyCors(NextResponse.json(response));
  } catch (err) {
    log.error('admin_visits_detail_error', err, { route: 'admin/visits/[id]', correlationId: getCorrelationId(req) });
    return applyCors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
  }
}
