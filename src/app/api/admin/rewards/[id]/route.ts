import { NextRequest, NextResponse } from 'next/server';

import { getAuthFromRequest } from '@/lib/auth/request';
import { verifyCsrf } from '@/lib/http/csrf';
import { withCors, preflightResponse } from '@/lib/http/cors';
import { log, getCorrelationId } from '@/lib/logging';
import {
  archiveReward,
  getRewardById,
  updateReward,
  type RewardRecord,
  type RewardPartnerConfig,
} from '@/lib/data/rewards';
import { listRedemptionsForReward } from '@/lib/data/redemptions';

function isAdmin(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (auth?.role === 'admin') return true;
  const secret = req.headers.get('x-admin-secret');
  return secret && secret === (process.env.ADMIN_SECRET || '');
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

export function OPTIONS() {
  return preflightResponse({
    methods: 'GET,PUT,DELETE,OPTIONS',
    headers: 'Content-Type, x-admin-secret',
  });
}

export async function GET(request: Request, context: unknown) {
  const req = request as NextRequest;
  const params =
    (context as { params?: { id?: string } } | undefined)?.params ?? {};
  const rewardId = params.id ?? "";

  if (!isAdmin(req)) {
    log.warn('admin_rewards_unauthorized', {
      route: 'admin/rewards/[id]',
      method: req.method,
      correlationId: getCorrelationId(req),
    });
    return withCors(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    );
  }

  if (!rewardId) {
    return withCors(
      NextResponse.json({ error: 'Reward ID is required' }, { status: 400 }),
    );
  }

  try {
    const result = await getRewardById(rewardId);
    if (!result) {
      log.warn('admin_reward_not_found', {
        route: 'admin/rewards/[id]',
        correlationId: getCorrelationId(req),
        rewardId,
      });
      return withCors(
        NextResponse.json({ error: 'Reward not found' }, { status: 404 }),
      );
    }
    const usage = await listRedemptionsForReward(rewardId, 500);
    return withCors(
      NextResponse.json({
        ...result,
        reward: serializeReward(result.reward),
        usage: usage.items,
        usageTotals: usage.totals,
      }),
    );
  } catch (err) {
    log.error('admin_rewards_get_error', err, {
      route: 'admin/rewards/[id]',
      correlationId: getCorrelationId(req),
      rewardId,
    });
    return withCors(
      NextResponse.json({ error: 'Internal server error' }, { status: 500 }),
    );
  }
}

export async function PUT(request: Request, context: unknown) {
  const req = request as NextRequest;
  const params =
    (context as { params?: { id?: string } } | undefined)?.params ?? {};
  const rewardId = params.id ?? "";

  if (!isAdmin(req))
    return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
  if (!verifyCsrf(req))
    return withCors(
      NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 }),
    );

  if (!rewardId) {
    return withCors(
      NextResponse.json({ error: 'Reward ID is required' }, { status: 400 }),
    );
  }

  try {
    const body = await req.json();
    const updated = await updateReward(rewardId, body);
    if (!updated) {
      log.warn('admin_reward_not_found', {
        route: 'admin/rewards/[id]',
        correlationId: getCorrelationId(req),
        rewardId,
      });
      return withCors(
        NextResponse.json({ error: 'Reward not found' }, { status: 404 }),
      );
    }
    return withCors(NextResponse.json(serializeReward(updated)));
  } catch (err) {
    log.error('admin_rewards_update_error', err, {
      route: 'admin/rewards/[id]',
      correlationId: getCorrelationId(req),
      rewardId,
    });
    return withCors(
      NextResponse.json({ error: 'Failed to update reward' }, { status: 500 }),
    );
  }
}

export async function DELETE(request: Request, context: unknown) {
  const req = request as NextRequest;
  const params =
    (context as { params?: { id?: string } } | undefined)?.params ?? {};
  const rewardId = params.id ?? "";

  if (!isAdmin(req))
    return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
  if (!verifyCsrf(req))
    return withCors(
      NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 }),
    );

  if (!rewardId) {
    return withCors(
      NextResponse.json({ error: 'Reward ID is required' }, { status: 400 }),
    );
  }

  try {
    const archived = await archiveReward(rewardId);
    if (!archived) {
      log.warn('admin_reward_not_found', {
        route: 'admin/rewards/[id]',
        correlationId: getCorrelationId(req),
        rewardId,
      });
      return withCors(
        NextResponse.json({ error: 'Reward not found' }, { status: 404 }),
      );
    }
    return withCors(NextResponse.json({ success: true, id: rewardId }));
  } catch (err) {
    log.error('admin_rewards_delete_error', err, {
      route: 'admin/rewards/[id]',
      correlationId: getCorrelationId(req),
      rewardId,
    });
    return withCors(
      NextResponse.json({ error: 'Failed to delete reward' }, { status: 500 }),
    );
  }
}
