import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withCors, preflightResponse } from '@/lib/http/cors';
import { verifyCsrf } from '@/lib/http/csrf';
import { log, getCorrelationId } from '@/lib/logging';
import {
  listRewards,
  createReward,
  createRewardSchema,
  type RewardRecord,
  type RewardPartnerConfig,
} from '@/lib/data/rewards';
import { getAuthFromRequest } from '@/lib/auth/request';

function isAdmin(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (auth?.role === 'admin') return true;
  const s = req.headers.get('x-admin-secret');
  return s && s === (process.env.ADMIN_SECRET || '');
}

export function OPTIONS() {
  return preflightResponse({ methods: 'GET,POST,OPTIONS', headers: 'Content-Type, x-admin-secret' });
}

function serializePartnerConfigs(value: RewardRecord['partnerConfigs']) {
  if (!value) return {};
  if (value instanceof Map) {
    return Object.fromEntries(value.entries());
  }
  return value as Record<string, RewardPartnerConfig>;
}

function serializeReward(reward: RewardRecord) {
  return {
    ...reward,
    partnerConfigs: serializePartnerConfigs(reward.partnerConfigs),
  };
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    log.warn('admin_rewards_unauthorized', { route: 'admin/rewards', method: req.method, correlationId: getCorrelationId(req) });
    return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
  }
  try {
    const result = await listRewards();
    const serialized = {
      ...result,
      rewards: result.rewards.map((reward) => serializeReward(reward)),
    };
    return withCors(NextResponse.json(serialized));
  } catch (err) {
    log.error('admin_rewards_list_error', err, { route: 'admin/rewards', correlationId: getCorrelationId(req) });
    return withCors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
  }
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
  if (!verifyCsrf(req)) return withCors(NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 }));
  try {
    const body = await req.json();
    const payload = createRewardSchema.parse(body ?? {});
    const reward = await createReward(payload);
    return withCors(NextResponse.json(serializeReward(reward), { status: 201 }));
  } catch (err) {
    if (err instanceof z.ZodError) {
      log.warn('admin_rewards_create_validation_error', {
        route: 'admin/rewards',
        method: 'POST',
        correlationId: getCorrelationId(req),
        issues: err.flatten?.(),
      });
      return withCors(
        NextResponse.json({ error: 'ValidationError', issues: err.flatten() }, { status: 400 }),
      );
    }
    log.error('admin_rewards_create_error', err, { route: 'admin/rewards', correlationId: getCorrelationId(req) });
    return withCors(NextResponse.json({ error: 'Failed to create reward' }, { status: 500 }));
  }
}
