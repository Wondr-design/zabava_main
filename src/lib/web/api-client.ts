export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface RequestOptions {
  token?: string | null;
  adminSecret?: string | null;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

import { getCsrfToken } from '@/lib/web/csrf';
import { getCorrelationId } from '@/lib/web/correlation';
import type { PartnerMeta, PartnerRelationship } from '@/lib/data/partners';
import type {
  PartnerCategory,
  PartnerShowcaseDirectory,
  PartnerShowcaseRecord,
} from '@/lib/data/partner-showcase';
import type {
  RewardDetailStatistics,
  RewardRecord,
  RewardStatistics,
  CreateRewardInput,
  UpdateRewardInput,
} from '@/lib/data/rewards';
import type { PartnerInviteDTO } from '@/lib/data/invites';
import type { RedemptionCheckResponse, RedemptionHistoryItem } from '@/lib/data/redemptions';
import type { FlashDealStatus } from '@/lib/data/flash-deals';
import type { TransportServiceType } from '@/lib/data/transport';
import type { PartnerBillingSummary } from '@/lib/services/reporting/billing-export';
import type { GlobalValueRecord, GlobalValueType } from '@/lib/data/global-values';
import type { AdminAccountOverview } from '@/lib/data/admin-account-overview';

function buildHeaders(opts?: RequestOptions, contentType: string | null = 'application/json') {
  const h: Record<string, string> = {};
  if (contentType) {
    h['Content-Type'] = contentType;
  }
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
  const headers = buildHeaders(opts, init.body instanceof FormData ? null : 'application/json');
  // Attach CSRF token for non-GET methods
  const method = (init.method || 'GET').toUpperCase();
  if (method !== 'GET' && !headers['x-csrf-token']) {
    const csrf = getCsrfToken();
    if (csrf) headers['x-csrf-token'] = csrf;
  }
  const res = await fetch(url, { ...init, headers, signal: opts?.signal, credentials: 'include' });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const errorBody: unknown = await res.json();
      if (
        typeof errorBody === 'object' &&
        errorBody !== null &&
        'error' in errorBody
      ) {
        const errorValue = (errorBody as { error: unknown }).error;
        if (typeof errorValue === 'string') {
          msg = errorValue;
        }
      }
    } catch {
      // Ignore JSON parsing errors and fall back to HTTP status.
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

// Admin API
export const adminApi = {
  uploadImage: (
    file: File,
    params: { folder?: string; contentType?: string } = {},
    opts: RequestOptions = {}
  ) => {
    const formData = new FormData();
    formData.append("file", file);
    if (params.folder) formData.append("folder", params.folder);
    if (params.contentType) formData.append("contentType", params.contentType);
    return json<{ path: string; url: string | null; contentType: string | null }>(
      `/api/admin/uploads/image`,
      { method: 'POST', body: formData },
      opts,
    );
  },
  uploadFile: (
    file: File,
    params: { folder?: string; contentType?: string } = {},
    opts: RequestOptions = {}
  ) => {
    const formData = new FormData();
    formData.append("file", file);
    if (params.folder) formData.append("folder", params.folder);
    if (params.contentType) formData.append("contentType", params.contentType);
    return json<{ path: string; url: string | null; contentType: string | null }>(
      `/api/admin/uploads/image`,
      { method: "POST", body: formData },
      opts,
    );
  },
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
  analyticsQrEvents: (
    params: { limit?: number; eventType?: string; qrType?: string; from?: string; to?: string } = {},
    opts: RequestOptions = {},
  ) => {
    const qs = new URLSearchParams();
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.eventType) qs.set('eventType', params.eventType);
    if (params.qrType) qs.set('qrType', params.qrType);
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    const url = `/api/admin/analytics?mode=qr-events${qs.toString() ? `&${qs.toString()}` : ''}`;
    return json<{ items?: unknown[] }>(url, { method: 'GET' }, opts);
  },
  partnersList: (opts: RequestOptions & { status?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (opts.status) qs.set('status', opts.status);
    if (opts.search) qs.set('search', opts.search);
    const url = `/api/admin/partners${qs.toString() ? `?${qs.toString()}` : ''}`;
    return json<{ items?: PartnerMeta[] }>(url, { method: 'GET' }, opts);
  },
  partnersCreate: (body: unknown, opts: RequestOptions = {}) =>
    json(`/api/admin/partners`, { method: 'POST', body: JSON.stringify(body) }, opts),
  partnerGet: (partnerId: string, opts: RequestOptions = {}) =>
    json<{
      item: PartnerMeta | null;
      relationships?: PartnerRelationship[];
      children?: PartnerRelationship[];
    }>(
      `/api/admin/partners?partnerId=${encodeURIComponent(partnerId)}`,
      { method: 'GET' },
      opts,
    ),
  partnerUpdate: (partnerId: string, body: unknown, opts: RequestOptions = {}) => json(`/api/admin/partners?partnerId=${encodeURIComponent(partnerId)}`, { method: 'PUT', body: JSON.stringify(body) }, opts),
  partnerSendBill: (
    partnerId: string,
    body: { periodStart?: string; periodEnd?: string; notes?: string } = {},
    opts: RequestOptions = {},
  ) =>
    json(
      `/api/admin/partners/${encodeURIComponent(partnerId)}/bill`,
      { method: 'POST', body: JSON.stringify(body) },
      opts,
    ),
  rewardsList: (opts: RequestOptions) =>
    json<{ rewards: RewardRecord[]; statistics: RewardStatistics }>(
      `/api/admin/rewards`,
      { method: 'GET' },
      opts,
    ),
  rewardGet: (id: string, opts: RequestOptions) =>
    json<{
      reward: RewardRecord;
      statistics: RewardDetailStatistics;
      usage?: RedemptionHistoryItem[];
      usageTotals?: { used?: number; rejected?: number };
    }>(
      `/api/admin/rewards/${id}`,
      { method: 'GET' },
      opts,
    ),
  rewardCreate: (body: CreateRewardInput, opts: RequestOptions) =>
    json<RewardRecord>(
      `/api/admin/rewards`,
      { method: 'POST', body: JSON.stringify(body) },
      opts,
    ),
  rewardUpdate: (id: string, body: UpdateRewardInput, opts: RequestOptions) =>
    json<RewardRecord>(
      `/api/admin/rewards/${id}`,
      { method: 'PUT', body: JSON.stringify(body) },
      opts,
    ),
  rewardDelete: (id: string, opts: RequestOptions) =>
    json<{ success: boolean; id: string }>(
      `/api/admin/rewards/${id}`,
      { method: 'DELETE' },
      opts,
    ),
  dealRemindersQueue: (opts: RequestOptions = {}) =>
    json<{ ok: boolean; processed?: number; created?: number; skipped?: number; timestamp?: string }>(
      `/api/admin/deals/reminders/queue`,
      { method: 'POST' },
      opts,
    ),
  dealRemindersList: (opts: RequestOptions = {}) =>
    json<{ reminders: unknown[] }>(
      `/api/admin/deals/reminders/dispatch`,
      { method: 'GET' },
      opts,
    ),
  dealRemindersDispatch: (
    payload: { reminders: Array<{ id: string; status: 'sent' | 'failed'; metadata?: Record<string, unknown> }> },
    opts: RequestOptions = {},
  ) =>
    json<{ ok: boolean; updated: number }>(
      `/api/admin/deals/reminders/dispatch`,
      { method: 'POST', body: JSON.stringify(payload) },
      opts,
  ),
  emailTemplatesSave: (
    body: { templates: unknown[] },
    opts: RequestOptions = {},
  ) =>
    json<{ ok: boolean }>(
      `/api/admin/email-templates`,
      { method: "POST", body: JSON.stringify(body) },
      opts,
    ),
  invitesList: (
    params: { cursor?: string; limit?: number },
    opts: RequestOptions = {},
  ) => {
    const qs = new URLSearchParams();
    if (params.cursor) qs.set('cursor', params.cursor);
    if (params.limit) qs.set('limit', String(params.limit));
    const url = `/api/admin/invites${qs.toString() ? `?${qs.toString()}` : ''}`;
    return json<{ items: PartnerInviteDTO[]; nextCursor?: string | null }>(
      url,
      { method: 'GET' },
      opts,
    );
  },
  inviteCreate: (body: { email: string; partnerId: string; role?: 'partner'|'admin'; name?: string; expiresInMinutes?: number }, opts: RequestOptions = {}) => json(`/api/admin/invites`, { method: 'POST', body: JSON.stringify(body) }, opts),
  inviteDelete: (token: string, opts: RequestOptions = {}) => json(`/api/admin/invites?token=${encodeURIComponent(token)}`, { method: 'DELETE' }, opts),
  accountsOverview: (opts: RequestOptions = {}) =>
    json<{ overview: AdminAccountOverview }>(
      `/api/admin/accounts/overview`,
      { method: 'GET' },
      opts,
    ),
  globalsList: (
    params: { type?: GlobalValueType; includeInactive?: boolean } = {},
    opts: RequestOptions = {},
  ) => {
    const qs = new URLSearchParams();
    if (params.type) qs.set('type', params.type);
    if (params.includeInactive) qs.set('includeInactive', 'true');
    const url = `/api/admin/globals${qs.toString() ? `?${qs.toString()}` : ''}`;
    return json<{ items: GlobalValueRecord[] }>(url, { method: 'GET' }, opts);
  },
  globalCreate: (
    body: { type: GlobalValueType; label: string; key?: string; description?: string | null; sortOrder?: number; isActive?: boolean },
    opts: RequestOptions = {},
  ) =>
    json<{ item: GlobalValueRecord }>(
      `/api/admin/globals`,
      { method: 'POST', body: JSON.stringify(body) },
      opts,
    ),
  globalUpdate: (
    id: string,
    body: { label?: string; key?: string; description?: string | null; sortOrder?: number; isActive?: boolean },
    opts: RequestOptions = {},
  ) =>
    json<{ item: GlobalValueRecord }>(
      `/api/admin/globals/${encodeURIComponent(id)}`,
      { method: 'PUT', body: JSON.stringify(body) },
      opts,
    ),
  globalDelete: (id: string, opts: RequestOptions = {}) =>
    json<{ ok: boolean }>(
      `/api/admin/globals/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
      opts,
    ),
  formsList: (
    params: { partnerId?: string; status?: 'draft' | 'published' | 'archived'; limit?: number; usageType?: 'visit' | 'reward' | 'deal' },
    opts: RequestOptions = {},
  ) => {
    const qs = new URLSearchParams();
    if (params.partnerId) qs.set('partnerId', params.partnerId);
    if (params.status) qs.set('status', params.status);
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.usageType) qs.set('usageType', params.usageType);
    const url = `/api/admin/forms${qs.toString() ? `?${qs.toString()}` : ''}`;
    return json<{ items: unknown[] }>(url, { method: 'GET' }, opts);
  },
  formCreate: (body: { partnerId: string; name: string; slug?: string; status?: 'draft' | 'published' | 'archived'; description?: string | null; config?: unknown; usageType?: 'visit' | 'reward' | 'deal'; rewardId?: string | null; dealId?: string | null }, opts: RequestOptions = {}) =>
    json<{ item: unknown }>(
      `/api/admin/forms`,
      { method: 'POST', body: JSON.stringify(body) },
      opts,
    ),
  formGet: (id: string, opts: RequestOptions = {}) =>
    json<{ item: unknown }>(`/api/admin/forms/${encodeURIComponent(id)}`, { method: 'GET' }, opts),
  formUpdate: (id: string, body: unknown, opts: RequestOptions = {}) =>
    json<{ item: unknown }>(
      `/api/admin/forms/${encodeURIComponent(id)}`,
      { method: 'PUT', body: JSON.stringify(body) },
      opts,
    ),
  formDelete: (id: string, opts: RequestOptions = {}) =>
    json<{ ok: boolean }>(
      `/api/admin/forms/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
      opts,
    ),
  pointRatioGet: (opts: RequestOptions = {}) =>
    json<{
      ratioCzk: number;
      source: 'default' | 'database';
      setting?: { id: number; ratioCzk: number; createdBy: string | null; createdAt: string } | null;
      history: Array<{ id: number; ratioCzk: number; createdBy: string | null; createdAt: string }>;
    }>(`/api/admin/settings/point-ratio`, { method: 'GET' }, opts),
  pointRatioUpdate: (body: { ratioCzk: number }, opts: RequestOptions = {}) =>
    json<{ ratioCzk: number }>(
      `/api/admin/settings/point-ratio`,
      { method: 'PUT', body: JSON.stringify(body) },
      opts,
    ),
  formEmbed: async (id: string, opts: RequestOptions = {}) => {
    const headers = buildHeaders(opts, null);
    const res = await fetch(`/api/admin/forms/${encodeURIComponent(id)}?mode=embed`, {
      method: 'GET',
      headers,
      credentials: 'include',
      signal: opts?.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return res.text();
  },
  showcaseOverview: (opts: RequestOptions = {}) =>
    json<{ directory: PartnerShowcaseDirectory }>(
      `/api/admin/showcase/overview`,
      { method: 'GET' },
      opts,
    ),
  showcaseCategorySave: (
    body: { id?: string; name: string; slug?: string; description?: string; sortOrder?: number },
    opts: RequestOptions = {},
  ) =>
    json<{ item: PartnerCategory }>(
      `/api/admin/showcase/categories`,
      { method: 'POST', body: JSON.stringify(body) },
      opts,
    ),
  showcaseCategoryDelete: (id: string, opts: RequestOptions = {}) =>
    json<{ success: boolean }>(
      `/api/admin/showcase/categories?id=${encodeURIComponent(id)}`,
      { method: 'DELETE' },
      opts,
    ),
  showcasePartnerGet: (partnerId: string, opts: RequestOptions = {}) =>
    json<{ item: { showcase: PartnerShowcaseRecord; categoryIds: string[] } }>(
      `/api/admin/showcase/partners/${encodeURIComponent(partnerId)}`,
      { method: 'GET' },
      opts,
    ),
  showcasePartnerUpdate: (
    partnerId: string,
    body: { categoryIds?: string[]; showcase?: Record<string, unknown> },
    opts: RequestOptions = {},
  ) =>
    json<{ item: { showcase: PartnerShowcaseRecord; categoryIds: string[] } }>(
      `/api/admin/showcase/partners/${encodeURIComponent(partnerId)}`,
      { method: 'PUT', body: JSON.stringify(body) },
      opts,
    ),
  billingList: (opts: RequestOptions = {}) =>
    json<{ items: Array<{
      partnerId: string;
      partnerName: string | null;
      billingEmail: string | null;
      contactEmail?: string | null;
      autoSendEnabled: boolean;
      autoSendDay?: number;
      commissionBasis: string;
      listingFeeAmount: number;
      listingFeeCurrency: string;
      listingOnly?: boolean;
      lastSentAt: string | null;
    }> }>(`/api/admin/billings`, { method: "GET" }, opts),
  billingSettingsGet: (
    partnerId: string,
    params: { summary?: boolean; dateFrom?: string; dateTo?: string } = {},
    opts: RequestOptions = {},
  ) => {
    const qs = new URLSearchParams();
    if (params.summary) qs.set("summary", "true");
    if (params.dateFrom) qs.set("dateFrom", params.dateFrom);
    if (params.dateTo) qs.set("dateTo", params.dateTo);
    const url = `/api/admin/billings/${encodeURIComponent(partnerId)}${
      qs.toString() ? `?${qs.toString()}` : ""
    }`;
    return json<{ settings: unknown; summary?: unknown; visits?: unknown }>(
      url,
      { method: "GET" },
      opts,
    );
  },
  billingSettingsUpdate: (partnerId: string, body: unknown, opts: RequestOptions = {}) =>
    json<{ ok: boolean }>(
      `/api/admin/billings/${encodeURIComponent(partnerId)}`,
      { method: "PATCH", body: JSON.stringify(body) },
      opts,
    ),
  billingSend: (
    partnerId: string,
    body: { dateFrom?: string; dateTo?: string },
    opts: RequestOptions = {},
  ) =>
    json<{ ok: boolean }>(
      `/api/admin/billings/${encodeURIComponent(partnerId)}`,
      { method: "POST", body: JSON.stringify(body) },
      opts,
    ),
  billingDownload: (
    partnerId: string,
    params: { dateFrom?: string; dateTo?: string } = {},
    opts: RequestOptions = {},
  ) => {
    const qs = new URLSearchParams();
    if (params.dateFrom) qs.set("dateFrom", params.dateFrom);
    if (params.dateTo) qs.set("dateTo", params.dateTo);
    const url = `/api/admin/billings/${encodeURIComponent(partnerId)}/download${
      qs.toString() ? `?${qs.toString()}` : ""
    }`;
    return json<{
      summary: unknown;
      files: {
        csv: { filename: string; contentType: string; base64: string };
        xlsx: { filename: string; contentType: string; base64: string };
      };
    }>(url, { method: "GET" }, opts);
  },
  showcaseEmbed: async (
    params: {
      type: 'categories' | 'list' | 'detail';
      listPageUrl?: string;
      detailPageUrl?: string;
      categoriesPageUrl?: string;
      defaultImageUrl?: string;
      categoryStorageKey?: string;
      partnerStorageKey?: string;
      partnerId?: string;
    },
    opts: RequestOptions = {},
  ) => {
    const qs = new URLSearchParams();
    qs.set('type', params.type);
    if (params.listPageUrl) qs.set('listPageUrl', params.listPageUrl);
    if (params.detailPageUrl) qs.set('detailPageUrl', params.detailPageUrl);
    if (params.categoriesPageUrl) qs.set('categoriesPageUrl', params.categoriesPageUrl);
    if (params.defaultImageUrl) qs.set('defaultImageUrl', params.defaultImageUrl);
    if (params.categoryStorageKey) qs.set('categoryStorageKey', params.categoryStorageKey);
    if (params.partnerStorageKey) qs.set('partnerStorageKey', params.partnerStorageKey);
    if (params.partnerId) qs.set('partnerId', params.partnerId);
    const headers = buildHeaders(opts, null);
    const res = await fetch(`/api/admin/showcase/embed?${qs.toString()}`, {
      method: 'GET',
      headers,
      credentials: 'include',
      signal: opts?.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return res.text();
  },
  flashDealsList: (
    params: { partnerId?: string; status?: FlashDealStatus; search?: string } = {},
    opts: RequestOptions = {},
  ) => {
    const qs = new URLSearchParams();
    if (params.partnerId) qs.set('partnerId', params.partnerId);
    if (params.status) qs.set('status', params.status);
    if (params.search) qs.set('search', params.search);
    return json<{ items: AdminFlashDealDTO[] }>(
      `/api/admin/flash-deals${qs.toString() ? `?${qs.toString()}` : ''}`,
      { method: 'GET' },
      opts,
    );
  },
  flashDealCreate: (
    body: {
      partnerId: string;
      title: string;
      description?: string;
      discountPercent: number;
      minVisitors?: number;
      validFrom?: string | null;
      validTo?: string | null;
      validDays?: number[] | null;
      commissionPercent: number;
      qrValiditySeconds?: number;
      usageLimit?: number | null;
      status?: FlashDealStatus;
    },
    opts: RequestOptions = {},
  ) =>
    json<{ deal: AdminFlashDealDTO }>(
      `/api/admin/flash-deals`,
      { method: 'POST', body: JSON.stringify(body) },
      opts,
    ),
  flashDealGet: (id: string, opts: RequestOptions = {}) =>
    json<{ deal: AdminFlashDealDTO }>(
      `/api/admin/flash-deals/${encodeURIComponent(id)}`,
      { method: 'GET' },
      opts,
    ),
  flashDealUpdate: (
    id: string,
    body: Partial<{
      title: string;
      description?: string;
      discountPercent: number;
      minVisitors: number;
      validFrom: string | null;
      validTo: string | null;
      validDays: number[] | null;
      commissionPercent: number;
      qrValiditySeconds: number;
      usageLimit: number | null;
      status: FlashDealStatus;
    }>,
    opts: RequestOptions = {},
  ) =>
    json<{ deal: AdminFlashDealDTO }>(
      `/api/admin/flash-deals/${encodeURIComponent(id)}`,
      { method: 'PUT', body: JSON.stringify(body) },
      opts,
    ),
  flashDealDuplicate: (
    id: string,
    overrides: Record<string, unknown> | undefined,
    opts: RequestOptions = {},
  ) =>
    json<{ deal: AdminFlashDealDTO }>(
      `/api/admin/flash-deals/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify({ action: 'duplicate', overrides }) },
      opts,
    ),
  flashDealSetStatus: (
    id: string,
    status: FlashDealStatus,
    opts: RequestOptions = {},
  ) =>
    json<{ deal: AdminFlashDealDTO }>(
      `/api/admin/flash-deals/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify({ action: 'status', status }) },
      opts,
    ),
  flashDealAnalytics: (
    id: string,
    params: { days?: number; limit?: number } = {},
    opts: RequestOptions = {},
  ) => {
    const qs = new URLSearchParams();
    if (typeof params.days === 'number') qs.set('days', String(params.days));
    if (typeof params.limit === 'number') qs.set('limit', String(params.limit));
    return json<{ analytics: FlashDealAnalyticsResponse }>(
      `/api/admin/flash-deals/${encodeURIComponent(id)}/analytics${qs.toString() ? `?${qs.toString()}` : ''}`,
      { method: 'GET' },
      opts,
    );
  },
  transportServicesList: (
    params: { partnerId?: string; includeDisabled?: boolean } = {},
    opts: RequestOptions = {},
  ) => {
    const qs = new URLSearchParams();
    if (params.partnerId) qs.set('partnerId', params.partnerId);
    if (params.includeDisabled !== undefined) qs.set('includeDisabled', String(params.includeDisabled));
    return json<{ items: AdminTransportServiceDTO[] }>(
      `/api/admin/transport/services${qs.toString() ? `?${qs.toString()}` : ''}`,
      { method: 'GET' },
      opts,
    );
  },
  transportServiceCreate: (
    body: {
      partnerId: string;
      name: string;
      serviceType: TransportServiceType;
      qrValidityDays?: number;
      commissionPerRide: number;
      notes?: string;
      enabled?: boolean;
    },
    opts: RequestOptions = {},
  ) =>
    json<{ service: AdminTransportServiceDTO }>(
      `/api/admin/transport/services`,
      { method: 'POST', body: JSON.stringify(body) },
      opts,
    ),
  transportServiceGet: (id: string, opts: RequestOptions = {}) =>
    json<{ service: AdminTransportServiceDTO }>(
      `/api/admin/transport/services/${encodeURIComponent(id)}`,
      { method: 'GET' },
      opts,
    ),
  transportServiceUpdate: (
    id: string,
    body: Partial<{
      name: string;
      serviceType: TransportServiceType;
      qrValidityDays: number;
      commissionPerRide: number;
      notes?: string;
      enabled: boolean;
    }>,
    opts: RequestOptions = {},
  ) =>
    json<{ service: AdminTransportServiceDTO }>(
      `/api/admin/transport/services/${encodeURIComponent(id)}`,
      { method: 'PUT', body: JSON.stringify(body) },
      opts,
    ),
  transportServiceToggle: (
    id: string,
    enabled: boolean,
    opts: RequestOptions = {},
  ) =>
    json<{ service: AdminTransportServiceDTO }>(
      `/api/admin/transport/services/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify({ action: enabled ? 'enable' : 'disable' }) },
      opts,
    ),
  transportRidesExport: (
    body: { partnerId?: string; serviceId?: string; dateFrom?: string; dateTo?: string },
    opts: RequestOptions = {},
  ) =>
    json<TransportRideExportResponse>(
      `/api/admin/transport/rides/export`,
      { method: 'POST', body: JSON.stringify(body) },
      opts,
    ),
  partnerBillingExport: (
    body: { partnerId: string; dateFrom?: string; dateTo?: string; forwardToN8n?: boolean },
    opts: RequestOptions = {},
  ) =>
    json<AdminPartnerBillingExportResponse>(
      `/api/admin/reports/partner-billing`,
      { method: 'POST', body: JSON.stringify(body) },
      opts,
    ),
  flashDealUsageExport: (
    body: { dateFrom?: string; dateTo?: string; partnerId?: string },
    opts: RequestOptions = {},
  ) =>
    json<FlashDealUsageExportResponse>(
      `/api/admin/reports/flash-deal-usage`,
      { method: 'POST', body: JSON.stringify(body) },
      opts,
    ),
};

interface FilePayload {
  filename: string;
  contentType: string;
  base64: string;
}

interface FlashDealUsageExportSummary {
  total: number;
  used: number;
  rejected: number;
  pending: number;
}

interface FlashDealUsageExportResponse {
  summary: FlashDealUsageExportSummary;
  files: {
    csv: FilePayload;
    xlsx: FilePayload;
  };
  filters?: {
    dateFrom: string;
    dateTo: string;
    partnerId?: string | null;
  };
}

type FlashDealUsageSummary = {
  total: number;
  pending: number;
  used: number;
  rejected: number;
  expired: number;
};

type FlashDealRedemptionItem = {
  id: string;
  status: string;
  visitId: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
};

type FlashDealEventItem = {
  id: string;
  eventType: string;
  qrType: string;
  occurredAt: string;
  source: string;
  visitId: string | null;
  metadata: Record<string, unknown>;
};

type FlashDealTimelineItem = {
  date: string;
  redemptions: number;
  qrGenerated: number;
  qrScans: number;
  qrRedeemed: number;
  qrExpired: number;
};

type FlashDealQrSummary = {
  generated: number;
  scanned: number;
  redeemed: number;
  expired: number;
  total: number;
};

export interface FlashDealAnalyticsResponse {
  usage: FlashDealUsageSummary;
  redemptions: FlashDealRedemptionItem[];
  qrEvents: FlashDealEventItem[];
  qrSummary: FlashDealQrSummary;
  timeline: FlashDealTimelineItem[];
}

interface AdminFlashDealDTO {
  id: string;
  partnerId: string;
  title: string;
  description: string | null;
  discountPercent: number;
  minVisitors: number;
  validFrom: string | null;
  validTo: string | null;
  validDays: number[] | null;
  commissionPercent: number;
  qrValiditySeconds: number;
  usageLimit: number | null;
  usageCount: number;
  status: FlashDealStatus;
  createdAt: string;
  updatedAt: string;
}

interface AdminTransportServiceDTO {
  id: string;
  partnerId: string;
  name: string;
  serviceType: TransportServiceType;
  qrValidityDays: number;
  commissionPerRide: number;
  notes: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TransportRideExportResponse {
  summary: {
    rideCount: number;
    totalFare: number;
    totalCommission: number;
    dateFrom: string;
    dateTo: string;
  };
  files: {
    csv: FilePayload;
    xlsx: FilePayload;
  };
}

interface AdminPartnerBillingExportResponse {
  summary: PartnerBillingSummary;
  files: {
    csv: FilePayload;
    xlsx: FilePayload;
  };
  forwarded?: { forwarded: boolean; status?: number };
}

interface PartnerBillingExportResponse {
  summary: PartnerBillingSummary;
  files: {
    csv: FilePayload;
    xlsx: FilePayload;
  };
}

// Partner API
export const partnerApi = {
  dashboard: (partnerId: string, opts: RequestOptions) => json(`/api/partner/${partnerId}`, { method: 'GET' }, opts),
  checkRedemption: (code: string, opts?: RequestOptions) =>
    json<RedemptionCheckResponse>(
      `/api/partner/check-redemption?code=${encodeURIComponent(code)}`,
      { method: 'GET' },
      opts,
    ),
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
  billingExport: (
    body: { dateFrom?: string; dateTo?: string },
    opts: RequestOptions = {},
  ) =>
    json<PartnerBillingExportResponse>(
      `/api/partner/reports/export`,
      { method: 'POST', body: JSON.stringify(body) },
      opts,
    ),
  flashDealUsageExport: (
    body: { dateFrom?: string; dateTo?: string },
    opts: RequestOptions = {},
  ) =>
    json<FlashDealUsageExportResponse>(
      `/api/partner/reports/flash-deals`,
      { method: 'POST', body: JSON.stringify(body) },
      opts,
    ),
};

export const visitApi = {
  qrPreview: (visitId: string, opts: RequestOptions = {}) =>
    json<{ url: string; expiresAt: string }>(
      `/api/visit/${encodeURIComponent(visitId)}/qr`,
      { method: 'GET' },
      opts,
    ),
};

// Bonus API
export const bonusApi = {
  userPoints: (email: string) =>
    json(`/api/bonus/user-points?email=${encodeURIComponent(email)}`, {
      method: "GET",
    }),
  redeemReward: (payload: {
    email: string;
    rewardId: string;
    form: {
      values: Record<string, unknown>;
      hidden?: Record<string, unknown>;
      labels?: Record<string, string>;
    };
    metadata?: Record<string, unknown>;
  }) =>
    json(`/api/bonus/redeem-reward`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  rewardDetails: (rewardId: string) =>
    json(`/api/bonus/rewards/${encodeURIComponent(rewardId)}`, {
      method: "GET",
    }),
  debugUser: (email: string) =>
    json(`/api/bonus/debug-user?email=${encodeURIComponent(email)}`, {
      method: "GET",
    }),
};

// Notifications API
export const notificationsApi = {
  pointsUsed: (
    payload: { email: string; code: string; rewardName: string; pointsSpent: number; partnerId?: string },
    opts: RequestOptions = {},
  ) => json(`/api/notifications/points-used`, { method: 'POST', body: JSON.stringify(payload) }, opts),
};
