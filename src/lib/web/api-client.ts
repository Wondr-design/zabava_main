export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface RequestOptions {
  token?: string | null;
  adminSecret?: string | null;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

import { getCsrfToken } from '@/lib/web/csrf';
import { getCorrelationId } from '@/lib/web/correlation';

function buildHeaders(opts?: RequestOptions) {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts?.token) h['Authorization'] = `Bearer ${opts.token}`;
  if (opts?.adminSecret) h['x-admin-secret'] = opts.adminSecret;
  // attach correlation id if not explicitly provided
  try {
    if (!h['x-correlation-id'] && !opts?.headers?.['x-correlation-id']) {
      const cid = getCorrelationId();
      if (cid) h['x-correlation-id'] = cid;
    }
  } catch {}
  if (opts?.headers) Object.assign(h, opts.headers);
  return h;
}

async function json<T = unknown>(path: string, init: RequestInit = {}, opts?: RequestOptions): Promise<T> {
  const url = path.startsWith('/') ? path : `/${path.replace(/^\/*/, '')}`;
  const headers = buildHeaders(opts);
  // Attach CSRF token for non-GET methods
  const method = (init.method || 'GET').toUpperCase();
  if (method !== 'GET' && !headers['x-csrf-token']) {
    const csrf = getCsrfToken();
    if (csrf) headers['x-csrf-token'] = csrf;
  }
  const res = await fetch(url, { ...init, headers, signal: opts?.signal, credentials: 'include' });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const e = await res.json(); if ((e as any)?.error) msg = (e as any).error as string; } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

// Admin API
export const adminApi = {
  overview: (opts: RequestOptions) => json<{ totals?: unknown; quickActions?: unknown }>(`/api/admin/overview`, { method: 'GET' }, opts),
  analyticsMetrics: (opts: RequestOptions) => json(`/api/admin/analytics?mode=metrics`, { method: 'GET' }, opts),
  analyticsSubmissions: (params: { limit?: number; partnerId?: string; search?: string }, opts: RequestOptions) => {
    const qs = new URLSearchParams();
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.partnerId) qs.set('partnerId', params.partnerId);
    if (params.search) qs.set('search', params.search);
    const url = `/api/admin/analytics?mode=submissions&${qs.toString()}`;
    return json<{ items?: unknown[] }>(url, { method: 'GET' }, opts);
  },
  partnersList: (opts: RequestOptions & { status?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (opts.status) qs.set('status', opts.status);
    if (opts.search) qs.set('search', opts.search);
    const url = `/api/admin/partners${qs.toString() ? `?${qs.toString()}` : ''}`;
    return json<{ items?: unknown[] }>(url, { method: 'GET' }, opts);
  },
  partnersCreate: (body: unknown, opts: RequestOptions = {}) =>
    json(`/api/admin/partners`, { method: 'POST', body: JSON.stringify(body) }, opts),
  partnerGet: (partnerId: string, opts: RequestOptions = {}) => json<{ item: any }>(`/api/admin/partners?partnerId=${encodeURIComponent(partnerId)}`, { method: 'GET' }, opts),
  partnerUpdate: (partnerId: string, body: unknown, opts: RequestOptions = {}) => json(`/api/admin/partners?partnerId=${encodeURIComponent(partnerId)}`, { method: 'PUT', body: JSON.stringify(body) }, opts),
  rewardsList: (opts: RequestOptions) => json<{ rewards: unknown[]; statistics: unknown }>(`/api/admin/rewards`, { method: 'GET' }, opts),
  rewardGet: (id: string, opts: RequestOptions) => json<{ reward: unknown; statistics: unknown }>(`/api/admin/rewards/${id}`, { method: 'GET' }, opts),
  rewardCreate: (body: unknown, opts: RequestOptions) => json(`/api/admin/rewards`, { method: 'POST', body: JSON.stringify(body) }, opts),
  rewardUpdate: (id: string, body: unknown, opts: RequestOptions) => json(`/api/admin/rewards/${id}`, { method: 'PUT', body: JSON.stringify(body) }, opts),
  rewardDelete: (id: string, opts: RequestOptions) => json(`/api/admin/rewards/${id}`, { method: 'DELETE' }, opts),
  invitesList: (params: { cursor?: string; limit?: number }, opts: RequestOptions = {}) => {
    const qs = new URLSearchParams();
    if (params.cursor) qs.set('cursor', params.cursor);
    if (params.limit) qs.set('limit', String(params.limit));
    const url = `/api/admin/invites${qs.toString() ? `?${qs.toString()}` : ''}`;
    return json<{ items: any[]; nextCursor?: string | null }>(url, { method: 'GET' }, opts);
  },
  inviteCreate: (body: { email: string; partnerId: string; role?: 'partner'|'admin'; name?: string; expiresInMinutes?: number }, opts: RequestOptions = {}) => json(`/api/admin/invites`, { method: 'POST', body: JSON.stringify(body) }, opts),
  inviteDelete: (token: string, opts: RequestOptions = {}) => json(`/api/admin/invites?token=${encodeURIComponent(token)}`, { method: 'DELETE' }, opts),
};

// Partner API
export const partnerApi = {
  dashboard: (partnerId: string, opts: RequestOptions) => json(`/api/partner/${partnerId}`, { method: 'GET' }, opts),
  checkRedemption: (code: string, opts?: RequestOptions) => json(`/api/partner/check-redemption?code=${encodeURIComponent(code)}`, { method: 'GET' }, opts),
  processRedemption: (code: string, action: 'process' | 'reject', opts: RequestOptions) => json(`/api/partner/check-redemption`, { method: 'POST', body: JSON.stringify({ code, action }) }, opts),
  createVisit: (payload: unknown, opts: RequestOptions) => json(`/api/partner/visit`, { method: 'POST', body: JSON.stringify(payload) }, opts),
  markVisited: (payload: unknown, opts: RequestOptions) => json(`/api/partner/mark-visited`, { method: 'POST', body: JSON.stringify(payload) }, opts),
  staffList: (opts: RequestOptions = {}) => json<{ items: unknown[] }>(`/api/partner/staff`, { method: 'GET' }, opts),
  staffCreate: (payload: unknown, opts: RequestOptions = {}) => json(`/api/partner/staff`, { method: 'POST', body: JSON.stringify(payload) }, opts),
  staffUpdateStatus: (staffId: string, status: 'active' | 'inactive' | 'revoked', opts: RequestOptions = {}) =>
    json(`/api/partner/staff?staffId=${encodeURIComponent(staffId)}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }, opts),
  staffDelete: (staffId: string, opts: RequestOptions = {}) => json(`/api/partner/staff?staffId=${encodeURIComponent(staffId)}`, { method: 'DELETE' }, opts),
  staffInvitesList: (opts: RequestOptions = {}) => json<{ items: unknown[] }>(`/api/partner/staff/invites`, { method: 'GET' }, opts),
  staffInviteCreate: (payload: unknown, opts: RequestOptions = {}) =>
    json(`/api/partner/staff/invites`, { method: 'POST', body: JSON.stringify(payload) }, opts),
  staffInviteDelete: (token: string, opts: RequestOptions = {}) =>
    json(`/api/partner/staff/invites?token=${encodeURIComponent(token)}`, { method: 'DELETE' }, opts),
};

// Bonus API
export const bonusApi = {
  userPoints: (email: string) => json(`/api/bonus/user-points?email=${encodeURIComponent(email)}`, { method: 'GET' }),
  redeemReward: (email: string, rewardId: string, partnerId?: string) => json(`/api/bonus/redeem-reward`, { method: 'POST', body: JSON.stringify({ email, rewardId, partnerId }) }),
  debugUser: (email: string) => json(`/api/bonus/debug-user?email=${encodeURIComponent(email)}`, { method: 'GET' }),
};
