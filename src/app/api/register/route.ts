import { NextRequest, NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { preflightResponse, withCors } from '@/lib/http/cors';
import { log, getCorrelationId } from '@/lib/logging';
import { createVisitRegistration } from '@/lib/data/visits';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { computeRegistrationMetrics, extractPartnerId, normalizeEmail } from '@/lib/services/visit-metrics';
import { generateQrCodeForVisit } from '@/lib/services/qr';
import { loadPartnerBranding } from '@/lib/services/partner-branding';

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

function pickNumeric(
  source: Record<string, unknown> | undefined,
  keys: string[]
) {
  if (!source) return undefined;
  for (const key of keys) {
    if (!(key in source)) continue;
    const value = source[key];
    if (value === undefined || value === null || value === '') continue;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }
  return undefined;
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

    const supabase = getSupabaseAdmin();
    const partnerBranding = await loadPartnerBranding(partnerId, supabase);

    const metrics = computeRegistrationMetrics(partnerSource);
    const submissionIdCandidate = [
      raw?.rid,
      cleanedData?.rid,
      raw?.submissionId,
      cleanedData?.submissionId,
    ].find((value) => typeof value === 'string' && value.trim().length > 0) as string | undefined;
    const submissionId = submissionIdCandidate ? submissionIdCandidate.trim().toLowerCase() : undefined;
    log.debug('register_metrics', { email: normalizedEmail, partnerId, metrics, correlationId });

    if (!submissionId) {
      log.info('register_skipped_missing_submission_id', {
        email: normalizedEmail,
        partnerId,
        correlationId,
      });
      return withCors(
        NextResponse.json(
          {
            success: true,
            email: normalizedEmail,
            skipped: true,
            reason: 'Missing submission identifier',
          },
          { status: 202 }
        ),
        { methods: 'POST, OPTIONS', headers: 'Content-Type' }
      );
    }

    const visit = await createVisitRegistration({
      email: normalizedEmail,
      partnerId,
      status: 'pending',
      submissionId,
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
    let qrStoragePath: string | null = null;

    if (verifyUrl && visit.id) {
      try {
        const qrExpiryCandidate = pickNumeric(partnerSource, [
          'qrExpiresInSeconds',
          'qr_expires_in_seconds',
          'qrExpirySeconds',
          'qr_expiry_seconds',
        ]);
        const qr = await generateQrCodeForVisit(
          verifyUrl,
          visit.id,
          qrExpiryCandidate,
          {
            badgeLabel: partnerBranding.initial,
            badgeColor: partnerBranding.accentColor,
            matrixColor: partnerBranding.accentColor,
            badgeIconUrl: partnerBranding.logoUrl ?? undefined,
            qrVariant: "visit",
          }
        );
        qrCodeUrl = qr.url;
        qrCodeExpiresAt = qr.expiresAt;
        qrStoragePath = qr.path;
      } catch (qrError) {
        log.error('register_qr_error', qrError, {
          route: 'register',
          visitId: visit.id,
          correlationId,
        });
      }
    }

    if (visit.id && (qrCodeUrl || verifyUrl || qrCodeExpiresAt)) {
      try {
        const existingPayload = (visit.payload ?? {}) as Record<string, unknown>;
        const nextPayload: Record<string, unknown> = {
          ...existingPayload,
        };

        if (verifyUrl) {
          nextPayload.verifyUrl = verifyUrl;
          nextPayload.verify_url = verifyUrl;
        }
        if (qrCodeUrl) {
          nextPayload.qrCodeUrl = qrCodeUrl;
          nextPayload.qrCodeURL = qrCodeUrl;
          nextPayload.qrUrl = qrCodeUrl;
          nextPayload.qr_url = qrCodeUrl;
        }
        if (qrCodeExpiresAt) {
          nextPayload.qrCodeExpiresAt = qrCodeExpiresAt;
        }
        if (qrStoragePath) {
          nextPayload.qrStoragePath = qrStoragePath;
          nextPayload.qr_storage_path = qrStoragePath;
        }

        await supabase
          .from('visit_registrations')
          .update({
            payload: nextPayload as unknown as never,
            updated_at: new Date().toISOString(),
          } as unknown as never)
          .eq('id', visit.id);
      } catch (err) {
        log.warn('register_visit_payload_update_failed', {
          error: err instanceof Error ? err.message : String(err),
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
