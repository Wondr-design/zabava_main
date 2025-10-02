import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { ZodError, z } from 'zod';
import { fetchVisits, VisitFilter } from '@/lib/data/analytics';
import { log, getCorrelationId } from '@/lib/logging';

const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const ALLOWED_ORIGIN =
  process.env.ALLOWED_ORIGIN || process.env.DASHBOARD_BASE_URL || '*';
const JWT_SECRET = process.env.JWT_SECRET || '';

const querySchema = z.object({
  email: z.string().optional(),
  partnerId: z.string().optional(),
  status: z.enum(['pending', 'visited', 'cancelled']).optional(),
  limit: z.coerce.number().optional(),
});

function applyCors(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-admin-secret'
  );
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
    log.warn('admin_visits_auth_failed', { route: 'admin/visits', error: (err as Error)?.message, correlationId: getCorrelationId(req) });
    return false;
  }
}

export function OPTIONS() {
  return applyCors(new NextResponse(null, { status: 200 }));
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    log.warn('admin_visits_unauthorized', { route: 'admin/visits', method: req.method, correlationId: getCorrelationId(req) });
    return applyCors(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    );
  }

  try {
    const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
    const params = querySchema.parse(raw);
    const filter: VisitFilter = {
      email: params.email,
      partnerId: params.partnerId,
      status: params.status,
      limit: params.limit,
    };
    const items = await fetchVisits(filter);
    return applyCors(NextResponse.json({ items }));
  } catch (err) {
    if (err instanceof ZodError) {
      log.warn('admin_visits_validation_error', { route: 'admin/visits', method: req.method, correlationId: getCorrelationId(req), issues: err.flatten?.() });
      return applyCors(
        NextResponse.json({ error: 'ValidationError', issues: err.flatten() }, { status: 400 })
      );
    }

    log.error('admin_visits_get_error', err, { route: 'admin/visits', correlationId: getCorrelationId(req) });
    return applyCors(
      NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    );
  }
}
