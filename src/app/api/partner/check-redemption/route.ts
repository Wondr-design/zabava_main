import { NextRequest, NextResponse } from 'next/server';
import { withCors, preflightResponse } from '@/lib/http/cors';
import { verifyPartnerToken } from '@/lib/auth/partner-token';
import { getRedemptionByCode, markRedemptionUsed, rejectRedemption } from '@/lib/data/redemptions';
import { verifyCsrf } from '@/lib/http/csrf';
import { log, getCorrelationId } from '@/lib/logging';
import { getRewardById } from '@/lib/data/rewards';
import { getVisitById } from '@/lib/data/visits';
import { getAuthFromRequest } from '@/lib/auth/request';

export function OPTIONS() {
  return preflightResponse({ methods: 'GET,POST,OPTIONS', headers: 'Content-Type, Authorization' });
}

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code')?.trim();
    if (!code) {
      log.warn('missing_code', { route: 'partner/check-redemption', method: req.method, correlationId: getCorrelationId(req) });
      return withCors(NextResponse.json({ error: 'Redemption code is required' }, { status: 400 }));
    }

    const redemption = await getRedemptionByCode(code);
    if (!redemption) {
      log.warn('redemption_not_found', { route: 'partner/check-redemption', code, correlationId: getCorrelationId(req) });
      return withCors(NextResponse.json({ error: 'Redemption not found', code }, { status: 404 }));
    }

    const rewardResp = await getRewardById(redemption.reward_id);
    const reward = rewardResp?.reward ?? null;

    let booking: Record<string, unknown> | null = null;
    if (redemption.applied_to_visit_id) {
      const visit = await getVisitById(redemption.applied_to_visit_id);
      if (visit) {
        booking = {
          email: visit.email,
          visitDate: visit.created_at,
          partnerId: visit.partner_id,
          ticketType: visit.ticket_type,
          numPeople: visit.num_people,
          hasVisited: visit.status === 'visited',
          visitedAt: visit.visited_at,
        };
      }
    }

    // Legacy semantics: valid only when applied and not expired
    const now = Date.now();
    const expiresAtMs = redemption.expires_at ? Date.parse(redemption.expires_at) : NaN;
    const notExpired = Number.isNaN(expiresAtMs) ? true : expiresAtMs > now;
    const isValid = redemption.status === 'applied' && notExpired;

    // Optional partner token or cookie-based auth: restrict cross-partner visibility and compute canProcess
    const cookieAuth = getAuthFromRequest(req);
    const tokenPayload = cookieAuth ?? verifyPartnerToken(req.headers.get('authorization'));
    const tokenPartner = tokenPayload?.partnerId?.toLowerCase();
    const redemptionPartner = redemption.partner_id?.toLowerCase() || null;
    if (tokenPartner && redemptionPartner && redemptionPartner !== tokenPartner) {
      log.warn('redemption_wrong_partner', { route: 'partner/check-redemption', code, tokenPartner, redemptionPartner, correlationId: getCorrelationId(req) });
      return withCors(NextResponse.json({ error: 'This redemption belongs to another partner' }, { status: 403 }));
    }

    const canProcess = Boolean(isValid && tokenPartner && (!redemptionPartner || redemptionPartner === tokenPartner));

    return withCors(
      NextResponse.json({
        redemption: {
          code,
          email: redemption.email,
          status: redemption.status,
          redeemedAt: redemption.created_at,
          appliedAt: redemption.applied_at,
          usedAt: redemption.used_at,
          expiresAt: redemption.expires_at,
          partnerId: redemption.partner_id,
        },
        reward: reward
          ? {
              name: reward.name,
              description: reward.description,
              category: reward.category,
              pointsValue: reward.pointsCost,
              instructions: reward.redemptionInstructions,
            }
          : null,
        booking,
        isValid,
        canProcess,
      })
    );
  } catch (err) {
    log.error('check-redemption GET error', err, { route: 'partner/check-redemption', method: req.method, correlationId: getCorrelationId(req) });
    return withCors(NextResponse.json({ error: 'Failed to check redemption' }, { status: 500 }));
  }
}

export async function POST(req: NextRequest) {
  if (!verifyCsrf(req)) {
    return withCors(NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 }));
  }
  const tokenPayload = getAuthFromRequest(req) ?? verifyPartnerToken(req.headers.get('authorization'));
  if (!tokenPayload || (tokenPayload.role !== 'partner' && tokenPayload.role !== 'staff')) {
    log.warn('auth_failed', { route: 'partner/check-redemption', method: req.method, correlationId: getCorrelationId(req), actor: tokenPayload?.role ?? 'unknown' });
    return withCors(NextResponse.json({ error: 'Authentication required' }, { status: 401 }));
  }

  try {
    const { code, action } = (await req.json()) as { code?: string; action?: string };
    if (!code || !action) {
      log.warn('missing_code_or_action', { route: 'partner/check-redemption', method: req.method, correlationId: getCorrelationId(req) });
      return withCors(NextResponse.json({ error: 'Code and action are required' }, { status: 400 }));
    }

    const normalizedPartnerId = tokenPayload.partnerId?.toLowerCase();

    if (action === 'process') {
      const updated = await markRedemptionUsed({ code, partnerId: normalizedPartnerId });
      if (!updated) {
        log.warn('redemption_not_found_or_processed', { route: 'partner/check-redemption', action: 'process', code, correlationId: getCorrelationId(req) });
        return withCors(NextResponse.json({ error: 'Redemption not found or already processed' }, { status: 404 }));
      }

      // Optional webhook
      if (process.env.REDEMPTION_PROCESSED_WEBHOOK_URL) {
        fetch(process.env.REDEMPTION_PROCESSED_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'redemption_processed',
            code,
            partnerId: normalizedPartnerId,
            processedAt: new Date().toISOString(),
            userEmail: updated.email,
          }),
        }).catch(() => {});
      }

      return withCors(
        NextResponse.json({
          success: true,
          message: 'Redemption processed successfully',
          code,
          status: 'used',
          processedAt: updated.used_at,
        })
      );
    }

    if (action === 'reject') {
      const updated = await rejectRedemption({ code, partnerId: normalizedPartnerId });
      if (!updated) {
        log.warn('redemption_not_found_or_processed', { route: 'partner/check-redemption', action: 'reject', code, correlationId: getCorrelationId(req) });
        return withCors(NextResponse.json({ error: 'Redemption not found or already processed' }, { status: 404 }));
      }
      return withCors(
        NextResponse.json({
          success: true,
          message: 'Redemption rejected',
          code,
          status: 'rejected',
          rejectedAt: updated.updated_at,
        })
      );
    }

    return withCors(NextResponse.json({ error: "Invalid action. Use 'process' or 'reject'" }, { status: 400 }));
  } catch (err) {
    log.error('check-redemption POST error', err, { route: 'partner/check-redemption', method: req.method, correlationId: getCorrelationId(req) });
    return withCors(NextResponse.json({ error: 'Failed to process redemption' }, { status: 500 }));
  }
}
