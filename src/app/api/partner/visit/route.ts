import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { preflightResponse, withCors } from '@/lib/http/cors';
import { verifyCsrf } from '@/lib/http/csrf';
import { log, getCorrelationId } from '@/lib/logging';
import { createVisitRegistration } from '@/lib/data/visits';
import { getAuthFromRequest } from '@/lib/auth/request';

const visitSchema = z.object({
  email: z.string().email(),
  partnerId: z.string().min(1),
  // Either provide a generic payload or a 'data' field (legacy)
  payload: z.record(z.string(), z.any()).optional(),
  data: z.record(z.string(), z.any()).optional(),
  // Optional direct fields (will be derived from payload/data if missing)
  estimatedPoints: z.number().int().nonnegative().optional(),
  totalPrice: z.number().optional(),
  numPeople: z.number().int().positive().optional(),
  ticketType: z.string().optional(),
  transport: z.string().optional(),
  categories: z.string().optional(),
});

function isAuthorized(req: NextRequest, partnerId: string) {
  const auth = getAuthFromRequest(req);
  if (!auth?.role) return false;
  if (auth.role === 'admin') return true;
  const pid = (auth.partnerId || '').toLowerCase();
  return Boolean(pid) && pid === partnerId.toLowerCase();
}

export function OPTIONS() {
  return preflightResponse({ methods: 'POST,OPTIONS', headers: 'Content-Type, Authorization' });
}

function toNumber(x: unknown, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function deriveEstimatedPoints(args: {
  baseEstimated?: number;
  totalPrice?: unknown;
  ticketType?: unknown;
  numPeople?: unknown;
  transport?: unknown;
}) {
  // If directly provided, prefer it
  if (typeof args.baseEstimated === 'number' && Number.isFinite(args.baseEstimated)) {
    return Math.max(0, Math.floor(args.baseEstimated));
  }

  const numPeople = typeof args.numPeople === 'number' && args.numPeople > 0 ? args.numPeople : toNumber(args.numPeople, 1) || 1;
  const ticket = String(args.ticketType || '').toLowerCase();
  const hasTransport = (() => {
    const v = String(args.transport || '').toLowerCase();
    return v === 'yes' || v === 'true' || v === '1' || v === 'checked' || v === 'selected';
  })();

  // Base by ticket type
  let points = 0;
  switch (ticket) {
    case 'vip':
      points = 50 * numPeople; break;
    case 'family':
      points = 30 * numPeople; break;
    case 'group':
      points = 20 * numPeople; break;
    case 'student':
      points = 15 * numPeople; break;
    default:
      points = 10 * numPeople; break;
  }

  // Price-based alternative
  const price = toNumber(args.totalPrice, 0);
  if (price > 0) {
    points = Math.max(points, Math.floor(price / 100));
  }

  if (hasTransport) points += 5;
  return Math.max(0, Math.floor(points));
}

export async function POST(req: NextRequest) {
  // CSRF check
  if (!verifyCsrf(req)) {
    return withCors(NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 }), { methods: 'POST,OPTIONS', headers: 'Content-Type, Authorization' });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = visitSchema.safeParse(body || {});
    if (!parsed.success) {
      return withCors(
        NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 }),
        { methods: 'POST,OPTIONS', headers: 'Content-Type, Authorization' }
      );
    }

    const {
      email,
      partnerId,
      payload: payloadRaw,
      data: dataRaw,
      estimatedPoints,
      totalPrice,
      numPeople,
      ticketType,
      transport,
      categories,
    } = parsed.data;

    // Auth: partner or admin
    if (!isAuthorized(req, partnerId)) {
      log.warn('auth_failed', { route: 'partner/visit', method: req.method, partnerId, email, correlationId: getCorrelationId(req), actor: 'partner' });
      return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), {
        methods: 'POST,OPTIONS', headers: 'Content-Type, Authorization'
      });
    }

    // Merge legacy 'data' with 'payload'
    const payload: Record<string, unknown> = {
      ...(payloadRaw || {}),
      ...(dataRaw || {}),
    };

    // Derive fields from payload if not provided directly
    const derivedTicket = (ticketType ?? (payload.ticket || payload.ticket_type || payload.Ticket || '')) as unknown;
    const derivedPeople = (numPeople ?? (payload.numPeople || payload.NumPeople || payload.people)) as unknown;
    const derivedTransport = (transport ?? (payload.transport || payload.Transport || payload.Bus_Rental || payload.selectedBus)) as unknown;
    const derivedPrice = (totalPrice ?? (payload.totalPrice || payload.TotalPrice || payload.orderValue)) as unknown;

    const estimated = deriveEstimatedPoints({
      baseEstimated: estimatedPoints,
      totalPrice: derivedPrice,
      ticketType: derivedTicket,
      numPeople: derivedPeople,
      transport: derivedTransport,
    });

    // Create the visit in Supabase
    const record = await createVisitRegistration({
      email,
      partnerId,
      status: 'pending',
      payload,
      estimatedPoints: estimated,
      pointsAwarded: 0,
      totalPrice: toNumber(derivedPrice, 0) || undefined,
      numPeople: typeof derivedPeople === 'number' ? derivedPeople : (toNumber(derivedPeople, 1) || 1),
      ticketType: typeof derivedTicket === 'string' ? (derivedTicket as string) : undefined,
      transport: typeof derivedTransport === 'string' ? (derivedTransport as string) : undefined,
      categories: typeof categories === 'string' ? categories : undefined,
    });

    const resp = {
      success: true,
      email: record.email,
      partnerId: record.partner_id,
      estimatedPoints: record.estimated_points ?? estimated,
      status: record.status ?? 'pending',
      createdAt: record.created_at,
      visitId: record.id,
    };

    return withCors(NextResponse.json(resp, { status: 200 }), {
      methods: 'POST,OPTIONS', headers: 'Content-Type, Authorization'
    });
  } catch (err) {
    log.error('partner/visit error', err, { route: 'partner/visit', method: req.method, correlationId: getCorrelationId(req) });
    return withCors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }), {
      methods: 'POST,OPTIONS', headers: 'Content-Type, Authorization'
    });
  }
}
