import { NextRequest, NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { preflightResponse, withCors } from '@/lib/http/cors';
import { log, getCorrelationId } from '@/lib/logging';
import { createVisitRegistration } from '@/lib/data/visits';
import { computeRegistrationMetrics, extractPartnerId, normalizeEmail } from '@/lib/services/visit-metrics';
import { generateQrCodeForVisit } from '@/lib/services/qr';

const requestSchema = z
  .object({
    email: z.string().email(),
    partnerId: z.string().min(1).optional(),
    data: z.unknown().optional(),
  })
  .passthrough();

function parseData(data: unknown) {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }
  if (data && typeof data === 'object') {
    return data as Record<string, unknown>;
  }
  return undefined;
}

function stripMetaFields(source: Record<string, unknown>) {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (key === 'tranid' || key === 'formid' || key === 'raw_payload') {
      continue;
    }
    cleaned[key] = value;
  }
  return cleaned;
}

function buildVerifyUrl(email: string, visitId: string) {
  const base = (process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/$/, '');
  if (!base) return null;
  const qs = new URLSearchParams({ email });
  if (visitId) {
    qs.set('visitId', visitId);
  }
  return `${base}/api/verify?${qs.toString()}`;
}

export function OPTIONS() {
  return preflightResponse({ methods: 'POST, OPTIONS', headers: 'Content-Type' });
}

export async function POST(req: NextRequest) {
  const correlationId = getCorrelationId(req);
  try {
    const raw = await req.json();
    const payload = requestSchema.parse(raw ?? {});
    const normalizedEmail = normalizeEmail(payload.email);
    const parsedData = parseData(payload.data);
    const cleanedData = parsedData ? stripMetaFields(parsedData) : undefined;

    const partnerSource: Record<string, unknown> = {
      ...(cleanedData || {}),
      ...(raw || {}),
    };

    const partnerCandidate = payload.partnerId || extractPartnerId(partnerSource);
    const partnerId = partnerCandidate ? partnerCandidate.trim().toLowerCase() : '';
    log.info('register_received', { email: normalizedEmail, partnerCandidate, hasData: Boolean(payload.data), correlationId });
    if (!partnerId) {
      log.warn('register_missing_partner', { route: 'register', method: req.method, correlationId, email: normalizedEmail });
      return withCors(NextResponse.json({ error: 'Partner ID is required' }, { status: 400 }), { methods: 'POST, OPTIONS', headers: 'Content-Type' });
    }

    const metrics = computeRegistrationMetrics(partnerSource);
    log.debug('register_metrics', { email: normalizedEmail, partnerId, metrics, correlationId });

    const visit = await createVisitRegistration({
      email: normalizedEmail,
      partnerId,
      status: 'pending',
      payload: {
        ...(raw || {}),
        ...(cleanedData ? { data: cleanedData } : {}),
      } as Record<string, unknown>,
      estimatedPoints: metrics.estimatedPoints,
      pointsAwarded: 0,
      totalPrice: metrics.totalPrice,
      numPeople: metrics.numPeople,
      ticketType: metrics.ticketType,
      transport: metrics.transportLabel ?? undefined,
      categories: metrics.categories ?? undefined,
    });

    const verifyUrl = visit.id ? buildVerifyUrl(normalizedEmail, visit.id) : null;
    log.info('register_visit_created', { email: normalizedEmail, partnerId, visitId: visit.id, correlationId });

    let qrCodeUrl: string | null = null;
    let qrCodeExpiresAt: string | null = null;

    if (verifyUrl && visit.id) {
      try {
        const qr = await generateQrCodeForVisit(verifyUrl, visit.id);
        qrCodeUrl = qr.url;
        qrCodeExpiresAt = qr.expiresAt;
      } catch (qrError) {
        log.error('register_qr_error', qrError, {
          route: 'register',
          visitId: visit.id,
          correlationId,
        });
      }
    }

    return withCors(
      NextResponse.json(
        {
          success: true,
          email: normalizedEmail,
          verifyUrl,
          key: visit.legacy_qr_key || null,
          message: 'Registration successful',
          qrCodeUrl,
          qrCodeExpiresAt,
        },
        { status: 200 }
      ),
      { methods: 'POST, OPTIONS', headers: 'Content-Type' }
    );
  } catch (err) {
    if (err instanceof ZodError) {
      return withCors(NextResponse.json({ error: 'ValidationError', details: err.flatten() }, { status: 400 }), { methods: 'POST, OPTIONS', headers: 'Content-Type' });
    }
    log.error('register_error', err, { route: 'register', correlationId });
    return withCors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }), { methods: 'POST, OPTIONS', headers: 'Content-Type' });
  }
}
