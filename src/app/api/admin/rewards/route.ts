import { NextRequest, NextResponse } from 'next/server';
import { withCors, preflightResponse } from '@/lib/http/cors';
import { verifyCsrf } from '@/lib/http/csrf';
import { log, getCorrelationId } from '@/lib/logging';
import { listRewards, createReward, updateReward, getRewardById, archiveReward } from '@/lib/data/rewards';
import { getAuthFromRequest } from '@/lib/auth/request';

function isAdmin(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (auth?.role === 'admin') return true;
  const s = req.headers.get('x-admin-secret');
  return s && s === (process.env.ADMIN_SECRET || '');
}

export function OPTIONS() {
  return preflightResponse({ methods: 'GET,POST,PUT,DELETE,OPTIONS', headers: 'Content-Type, x-admin-secret' });
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    log.warn('admin_rewards_unauthorized', { route: 'admin/rewards', method: req.method, correlationId: getCorrelationId(req) });
    return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
  }
  const url = req.nextUrl;
  // If path ends with /rewards, list all
  if (url.pathname.endsWith('/rewards')) {
    try {
      const result = await listRewards();
      return withCors(NextResponse.json(result));
    } catch (err) {
    log.error('admin_rewards_list_error', err, { route: 'admin/rewards', correlationId: getCorrelationId(req) });
      return withCors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
    }
  }
  // If /rewards/:id
  const segments = url.pathname.split('/');
  const maybeId = segments[segments.length - 1];
  if (maybeId && maybeId !== 'rewards') {
    try {
      const result = await getRewardById(maybeId);
      if (!result) {
        log.warn('admin_reward_not_found', { route: 'admin/rewards', correlationId: getCorrelationId(req) });
        return withCors(NextResponse.json({ error: 'Reward not found' }, { status: 404 }));
      }
      return withCors(NextResponse.json(result));
    } catch (err) {
      log.error('admin_rewards_get_error', err, { route: 'admin/rewards', correlationId: getCorrelationId(req) });
      return withCors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }));
    }
  }
  return withCors(NextResponse.json({ error: 'Not found' }, { status: 404 }));
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
  if (!verifyCsrf(req)) return withCors(NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 }));
  if (!isAdmin(req)) {
    log.warn('admin_rewards_unauthorized', { route: 'admin/rewards', method: req.method, correlationId: getCorrelationId(req) });
    return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
  }
  try {
    const body = await req.json();
    const reward = await createReward(body);
    return withCors(NextResponse.json(reward, { status: 201 }));
  } catch (err) {
    log.error('admin_rewards_create_error', err, { route: 'admin/rewards', correlationId: getCorrelationId(req) });
    return withCors(NextResponse.json({ error: 'Failed to create reward' }, { status: 500 }));
  }
}

export async function PUT(req: NextRequest) {
  if (!isAdmin(req)) return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
  if (!verifyCsrf(req)) return withCors(NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 }));
  if (!isAdmin(req)) {
    log.warn('admin_rewards_unauthorized', { route: 'admin/rewards', method: req.method, correlationId: getCorrelationId(req) });
    return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
  }
  const id = req.nextUrl.pathname.split('/').pop();
  if (!id || id === 'rewards') return withCors(NextResponse.json({ error: 'Reward ID is required' }, { status: 400 }));
  try {
    const body = await req.json();
    const updated = await updateReward(id, body);
    if (!updated) {
      log.warn('admin_reward_not_found', { route: 'admin/rewards', correlationId: getCorrelationId(req) });
      return withCors(NextResponse.json({ error: 'Reward not found' }, { status: 404 }));
    }
    return withCors(NextResponse.json(updated));
  } catch (err) {
    log.error('admin_rewards_update_error', err, { route: 'admin/rewards', correlationId: getCorrelationId(req) });
    return withCors(NextResponse.json({ error: 'Failed to update reward' }, { status: 500 }));
  }
}

export async function DELETE(req: NextRequest) {
  if (!isAdmin(req)) return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
  if (!verifyCsrf(req)) return withCors(NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 }));
  if (!isAdmin(req)) {
    log.warn('admin_rewards_unauthorized', { route: 'admin/rewards', method: req.method, correlationId: getCorrelationId(req) });
    return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
  }
  const id = req.nextUrl.pathname.split('/').pop();
  if (!id || id === 'rewards') return withCors(NextResponse.json({ error: 'Reward ID is required' }, { status: 400 }));
  try {
    const archived = await archiveReward(id);
    if (!archived) {
      log.warn('admin_reward_not_found', { route: 'admin/rewards', correlationId: getCorrelationId(req) });
      return withCors(NextResponse.json({ error: 'Reward not found' }, { status: 404 }));
    }
    return withCors(NextResponse.json({ success: true, id }));
  } catch (err) {
    log.error('admin_rewards_delete_error', err, { route: 'admin/rewards', correlationId: getCorrelationId(req) });
    return withCors(NextResponse.json({ error: 'Failed to delete reward' }, { status: 500 }));
  }
}