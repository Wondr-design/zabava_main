import { NextRequest, NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { withCors, preflightResponse } from '@/lib/http/cors';
import { log, getCorrelationId } from '@/lib/logging';
import { getRewardById } from '@/lib/data/rewards';
import { getTotalPointsForEmail } from '@/lib/data/points';
import { createRedemption } from '@/lib/data/redemptions';

const postSchema = z.object({
  email: z.string().email(),
  rewardId: z.string().min(1),
  partnerId: z.string().optional(),
});

export function OPTIONS() {
  return preflightResponse({ methods: 'POST, OPTIONS', headers: 'Content-Type' });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const payload = postSchema.parse(body ?? {});
    const email = payload.email.trim().toLowerCase();
    const rewardResp = await getRewardById(payload.rewardId);
    if (!rewardResp) {
      log.warn('reward_not_found', { route: 'bonus/redeem-reward', method: req.method, rewardId: payload.rewardId, correlationId: getCorrelationId(req) });
      return withCors(
        NextResponse.json({ error: 'Reward not found' }, { status: 404 }),
        { methods: 'POST, OPTIONS', headers: 'Content-Type' }
      );
    }
    const reward = rewardResp.reward;

    // Optional partner eligibility check (legacy behavior):
    // If reward.availableFor is non-empty and partnerId is provided, ensure it's in the list.
    type RewardLike = { availableFor?: string[] };
    const availability = Array.isArray((reward as RewardLike).availableFor)
      ? (((reward as RewardLike).availableFor) as string[])
      : [];
    const normalizedAvail = availability.map((v) => String(v || '').trim().toLowerCase());
    const normalizedPartnerId = payload.partnerId ? payload.partnerId.trim().toLowerCase() : null;
    if (normalizedAvail.length > 0 && normalizedPartnerId && !normalizedAvail.includes(normalizedPartnerId)) {
      log.warn('reward_not_available_for_partner', { route: 'bonus/redeem-reward', method: req.method, rewardId: payload.rewardId, partnerId: normalizedPartnerId, allowed: normalizedAvail, correlationId: getCorrelationId(req) });
      return withCors(
        NextResponse.json(
          {
            error: 'Reward not available for the selected partner',
            allowedPartners: normalizedAvail,
            providedPartnerId: normalizedPartnerId,
          },
          { status: 400 }
        ),
        { methods: 'POST, OPTIONS', headers: 'Content-Type' }
      );
    }

    const available = await getTotalPointsForEmail(email);
    const cost = reward.pointsCost;

    if (available < cost) {
      log.info('insufficient_points', { route: 'bonus/redeem-reward', method: req.method, email, required: cost, available, correlationId: getCorrelationId(req) });
      return withCors(
        NextResponse.json(
          { error: 'Insufficient points', required: cost, available },
          { status: 400 }
        ),
        { methods: 'POST, OPTIONS', headers: 'Content-Type' }
      );
    }

    const { code } = await createRedemption({ email, rewardId: reward.id, partnerId: payload.partnerId });

    return withCors(
      NextResponse.json(
        {
          success: true,
          message: 'Reward redeemed successfully',
          redemption: {
            code,
            rewardName: reward.name,
            pointsSpent: cost,
            partnerId: payload.partnerId ?? null,
            expiresAt: null,
          },
        },
        { status: 200 }
      ),
      { methods: 'POST, OPTIONS', headers: 'Content-Type' }
    );
  } catch (err) {
    if (err instanceof ZodError) {
      log.warn('validation_error', { route: 'bonus/redeem-reward', method: req.method, correlationId: getCorrelationId(req), issues: err.flatten?.() });
      return withCors(
        NextResponse.json({ error: 'ValidationError', details: err.flatten() }, { status: 400 }),
        { methods: 'POST, OPTIONS', headers: 'Content-Type' }
      );
    }
    log.error('redeem-reward error', err, { route: 'bonus/redeem-reward', method: req.method, correlationId: getCorrelationId(req) });
    return withCors(
      NextResponse.json({ error: 'Internal server error' }, { status: 500 }),
      { methods: 'POST, OPTIONS', headers: 'Content-Type' }
    );
  }
}