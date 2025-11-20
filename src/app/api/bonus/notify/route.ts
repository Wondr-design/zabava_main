import { NextRequest, NextResponse } from 'next/server';
import { preflightResponse, withCors } from '@/lib/http/cors';
import { log, getCorrelationId } from '@/lib/logging';

const HOOK_URL =
  process.env.ZAPIER_HOOK ||
  process.env.ZAPIER_VISIT_HOOK ||
  process.env.ZAPIER_CATCH_HOOK ||
  '';

const CORS_OPTIONS = { methods: 'POST,OPTIONS', headers: 'Content-Type' } as const;

export function OPTIONS() {
  return preflightResponse(CORS_OPTIONS);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body?.email ?? '').trim().toLowerCase();
    const code = String(body?.code ?? '').trim();
    const rewardName = String(body?.rewardName ?? '').trim();
    const partnerId = body?.partnerId ? String(body.partnerId).trim() : undefined;

    if (!email || !code || !rewardName) {
      return withCors(
        NextResponse.json(
          { error: 'email, code, and rewardName are required' },
          { status: 400 },
        ),
        CORS_OPTIONS,
      );
    }

    if (!HOOK_URL) {
      log.warn('bonus_notify_no_hook', { correlationId: getCorrelationId(req) });
      return withCors(
        NextResponse.json(
          { error: 'Notification hook is not configured' },
          { status: 501 },
        ),
        CORS_OPTIONS,
      );
    }

    const payload = {
      type: 'points_redeemed',
      email,
      code,
      rewardName,
      partnerId: partnerId ?? null,
      occurredAt: new Date().toISOString(),
    };

    await fetch(HOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    log.info('bonus_notify_sent', { email, code, rewardName, correlationId: getCorrelationId(req) });

    return withCors(
      NextResponse.json({ success: true }),
      CORS_OPTIONS,
    );
  } catch (err) {
    log.error('bonus_notify_error', err, { correlationId: getCorrelationId(req) });
    return withCors(
      NextResponse.json({ error: 'Failed to send notification' }, { status: 500 }),
      CORS_OPTIONS,
    );
  }
}
