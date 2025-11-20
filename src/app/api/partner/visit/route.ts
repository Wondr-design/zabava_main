import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { preflightResponse, withCors } from '@/lib/http/cors';
import { resolveAllowedOrigin } from '@/lib/http/allowed-origin';
import { verifyCsrf } from '@/lib/http/csrf';
import { log, getCorrelationId } from '@/lib/logging';
import { createVisitRegistration, estimateVisitPoints } from '@/lib/data/visits';
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

function corsOptions(req: NextRequest) {
  return {
    origin: resolveAllowedOrigin(req),
    methods: 'POST,OPTIONS',
    headers: 'Content-Type, Authorization',
    credentials: true,
  } as const;
}

export function OPTIONS(request: NextRequest) {
  return preflightResponse(corsOptions(request));
}

function toNumber(x: unknown, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

export async function POST(req: NextRequest) {
  // CSRF check
  if (!verifyCsrf(req)) {
    return withCors(
      NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 }),
      corsOptions(req),
    );
  }
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = visitSchema.safeParse(body || {});
    if (!parsed.success) {
      return withCors(
        NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 }),
        corsOptions(req),
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
      return withCors(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        corsOptions(req),
      );
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

    const estimated = estimateVisitPoints({
      estimatedPoints,
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

    return withCors(NextResponse.json(resp, { status: 200 }), corsOptions(req));
  } catch (err) {
    log.error('partner/visit error', err, { route: 'partner/visit', method: req.method, correlationId: getCorrelationId(req) });
    return withCors(
      NextResponse.json({ error: 'Internal server error' }, { status: 500 }),
      corsOptions(req),
    );
  }
}
