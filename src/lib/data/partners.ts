import { z } from 'zod';
import { getSupabaseAdmin } from '../supabase-admin';

const DEFAULT_CONTRACT = {
  monthlyFee: 0,
  discountRate: 0,
  commissionRate: 0,
  commissionBasis: 'discounted' as const,
};

const DEFAULT_TICKETING = {
  ticketTypes: [] as string[],
  familyRule: '',
};

const DEFAULT_INFO = {
  contactName: '',
  contactEmail: '',
  payments: [] as string[],
  facilities: [] as string[],
  website: '',
};

const DEFAULT_MEDIA = {
  logoUrl: '',
  heroImageUrl: '',
};

export const partnerStatusSchema = z.enum(['active', 'pending', 'inactive', 'hidden']);

const contractSchema = z
  .object({
    monthlyFee: z.coerce.number().min(0).optional(),
    discountRate: z.coerce.number().min(0).max(100).optional(),
    commissionRate: z.coerce.number().min(0).max(100).optional(),
    commissionBasis: z.enum(['original', 'discounted']).optional(),
  })
  .partial();

const ticketingSchema = z
  .object({
    ticketTypes: z.array(z.string()).optional(),
    familyRule: z.string().optional(),
  })
  .partial();

const infoSchema = z
  .object({
    contactName: z.string().optional(),
    contactEmail: z.string().optional(),
    payments: z.array(z.string()).optional(),
    facilities: z.array(z.string()).optional(),
    website: z.string().optional(),
  })
  .partial();

const mediaSchema = z
  .object({
    logoUrl: z.string().optional(),
    heroImageUrl: z.string().optional(),
  })
  .partial();

export const partnerMetaUpdateSchema = z
  .object({
    displayName: z.string().optional(),
    status: partnerStatusSchema.optional(),
    contract: contractSchema.optional(),
    ticketing: ticketingSchema.optional(),
    info: infoSchema.optional(),
    media: mediaSchema.optional(),
    bonusProgramEnabled: z.boolean().optional(),
    notes: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })
  .partial();

export type PartnerMetaUpdateInput = z.infer<typeof partnerMetaUpdateSchema>;

export interface PartnerMetaContract {
  monthlyFee: number;
  discountRate: number;
  commissionRate: number;
  commissionBasis: 'original' | 'discounted';
}

export interface PartnerMetaTicketing {
  ticketTypes: string[];
  familyRule: string;
}

export interface PartnerMetaInfo {
  contactName: string;
  contactEmail: string;
  payments: string[];
  facilities: string[];
  website: string;
}

export interface PartnerMetaMedia {
  logoUrl: string;
  heroImageUrl: string;
}

export interface PartnerMeta {
  partnerId: string;
  displayName: string | null;
  status: 'active' | 'pending' | 'hidden';
  contract: PartnerMetaContract;
  ticketing: PartnerMetaTicketing;
  info: PartnerMetaInfo;
  media: PartnerMetaMedia;
  bonusProgramEnabled: boolean;
  notes: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface PartnerRow {
  id: string;
  display_name: string | null;
  status: string | null;
  contact_email: string | null;
  contact_name: string | null;
  tags: string[] | null;
  website: string | null;
  contract: Record<string, unknown> | null;
  ticketing: Record<string, unknown> | null;
  info: Record<string, unknown> | null;
  media: Record<string, unknown> | null;
  bonus_program_enabled: boolean | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

function sanitizeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => value.length > 0);
}

export function normalizePartnerId(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

function normalizeStatusForDb(status: string | null | undefined) {
  const normalized = (status ?? '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'hidden') return 'inactive';
  if (['active', 'pending', 'inactive'].includes(normalized)) {
    return normalized;
  }
  return null;
}

function statusFromRow(value: string | null | undefined): 'active' | 'pending' | 'hidden' {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized === 'pending') return 'pending';
  if (normalized === 'inactive') return 'hidden';
  return 'active';
}

function buildDefaultPartnerMeta(partnerId: string): PartnerMeta {
  const timestamp = new Date().toISOString();
  return {
    partnerId,
    displayName: partnerId,
    status: 'active',
    contract: { ...DEFAULT_CONTRACT },
    ticketing: { ...DEFAULT_TICKETING, ticketTypes: [...DEFAULT_TICKETING.ticketTypes] },
    info: {
      ...DEFAULT_INFO,
      payments: [...DEFAULT_INFO.payments],
      facilities: [...DEFAULT_INFO.facilities],
    },
    media: { ...DEFAULT_MEDIA },
    bonusProgramEnabled: false,
    notes: '',
    tags: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function mergeArrays(existing: string[], updates?: string[]) {
  if (!updates) return existing;
  return sanitizeStringArray(updates);
}

function mergePartnerMeta(base: PartnerMeta, updates: PartnerMetaUpdateInput): PartnerMeta {
  const merged: PartnerMeta = {
    ...base,
    contract: { ...base.contract },
    ticketing: { ...base.ticketing, ticketTypes: [...base.ticketing.ticketTypes] },
    info: {
      ...base.info,
      payments: [...base.info.payments],
      facilities: [...base.info.facilities],
    },
    media: { ...base.media },
  };

  if (typeof updates.displayName === 'string') {
    merged.displayName = updates.displayName || base.displayName;
  }

  if (updates.status) {
    const normalized = normalizeStatusForDb(updates.status);
    if (normalized === 'pending') merged.status = 'pending';
    else if (normalized === 'inactive') merged.status = 'hidden';
    else merged.status = 'active';
  }

  if (updates.contract) {
    merged.contract = {
      ...merged.contract,
      ...updates.contract,
    };
    if (updates.contract?.monthlyFee !== undefined) {
      merged.contract.monthlyFee = updates.contract.monthlyFee;
    }
    if (updates.contract?.discountRate !== undefined) {
      merged.contract.discountRate = updates.contract.discountRate;
    }
    if (updates.contract?.commissionRate !== undefined) {
      merged.contract.commissionRate = updates.contract.commissionRate;
    }
    if (updates.contract?.commissionBasis) {
      merged.contract.commissionBasis = updates.contract.commissionBasis;
    }
  }

  if (updates.ticketing) {
    merged.ticketing = {
      ...merged.ticketing,
      ...updates.ticketing,
    };
    if (updates.ticketing?.ticketTypes) {
      merged.ticketing.ticketTypes = mergeArrays(merged.ticketing.ticketTypes, updates.ticketing.ticketTypes);
    }
    if (typeof updates.ticketing?.familyRule === 'string') {
      merged.ticketing.familyRule = updates.ticketing.familyRule;
    }
  }

  if (updates.info) {
    merged.info = {
      ...merged.info,
      ...updates.info,
    };
    if (updates.info.payments) {
      merged.info.payments = mergeArrays(merged.info.payments, updates.info.payments);
    }
    if (updates.info.facilities) {
      merged.info.facilities = mergeArrays(merged.info.facilities, updates.info.facilities);
    }
    if (typeof updates.info.contactName === 'string') {
      merged.info.contactName = updates.info.contactName;
    }
    if (typeof updates.info.contactEmail === 'string') {
      merged.info.contactEmail = updates.info.contactEmail;
    }
    if (typeof updates.info.website === 'string') {
      merged.info.website = updates.info.website;
    }
  }

  if (updates.media) {
    merged.media = {
      ...merged.media,
      ...updates.media,
    };
  }

  if (typeof updates.bonusProgramEnabled === 'boolean') {
    merged.bonusProgramEnabled = updates.bonusProgramEnabled;
  }

  if (typeof updates.notes === 'string') {
    merged.notes = updates.notes;
  }

  if (updates.tags) {
    merged.tags = sanitizeStringArray(updates.tags);
  }

  merged.updatedAt = new Date().toISOString();
  return merged;
}

function mapRowToMeta(row: PartnerRow | null, partnerIdFallback: string): PartnerMeta {
  if (!row) {
    return buildDefaultPartnerMeta(partnerIdFallback);
  }

  const base = buildDefaultPartnerMeta(row.id || partnerIdFallback);

  const contract = {
    ...base.contract,
    ...(row.contract ?? {}),
  } as PartnerMetaContract;

  const ticketing = {
    ...base.ticketing,
    ...(row.ticketing ?? {}),
  } as PartnerMetaTicketing;
  ticketing.ticketTypes = sanitizeStringArray(ticketing.ticketTypes);

  const info = {
    ...base.info,
    ...(row.info ?? {}),
  } as PartnerMetaInfo;
  info.payments = sanitizeStringArray(info.payments);
  info.facilities = sanitizeStringArray(info.facilities);
  if (row.contact_email) {
    info.contactEmail = row.contact_email;
  }
  if (row.contact_name) {
    info.contactName = row.contact_name;
  }
  if (row.website) {
    info.website = row.website;
  }

  const media = {
    ...base.media,
    ...(row.media ?? {}),
  } as PartnerMetaMedia;

  return {
    partnerId: row.id,
    displayName: row.display_name ?? row.id,
    status: statusFromRow(row.status),
    contract,
    ticketing,
    info,
    media,
    bonusProgramEnabled: Boolean(row.bonus_program_enabled ?? base.bonusProgramEnabled),
    notes: row.notes ?? base.notes,
    tags: sanitizeStringArray(row.tags ?? base.tags),
    createdAt: row.created_at ?? base.createdAt,
    updatedAt: row.updated_at ?? base.updatedAt,
  };
}

function metaToRow(
  meta: PartnerMeta,
  existingRow: PartnerRow | null,
): Partial<PartnerRow> & { id: string } {
  const rowStatus = normalizeStatusForDb(meta.status) ?? 'active';
  const timestamp = new Date().toISOString();

  return {
    id: meta.partnerId,
    display_name: meta.displayName ?? meta.partnerId,
    status: rowStatus,
    contact_email: meta.info.contactEmail || null,
    contact_name: meta.info.contactName || null,
    tags: meta.tags,
    website: meta.info.website || null,
    contract: {
      monthlyFee: meta.contract.monthlyFee,
      discountRate: meta.contract.discountRate,
      commissionRate: meta.contract.commissionRate,
      commissionBasis: meta.contract.commissionBasis,
    },
    ticketing: {
      ticketTypes: meta.ticketing.ticketTypes,
      familyRule: meta.ticketing.familyRule,
    },
    info: {
      contactName: meta.info.contactName,
      contactEmail: meta.info.contactEmail,
      payments: meta.info.payments,
      facilities: meta.info.facilities,
      website: meta.info.website,
    },
    media: {
      logoUrl: meta.media.logoUrl,
      heroImageUrl: meta.media.heroImageUrl,
    },
    bonus_program_enabled: meta.bonusProgramEnabled,
    notes: meta.notes || null,
    updated_at: timestamp,
  };
}

async function fetchPartnerRow(partnerId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('partners')
    .select('*')
    .eq('id', partnerId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load partner: ${error.message}`);
  }

  return data ? (data as PartnerRow) : null;
}

export async function loadPartnerMeta(partnerId: string) {
  const normalized = normalizePartnerId(partnerId);
  if (!normalized) {
    throw new Error('partnerId is required');
  }

  const row = await fetchPartnerRow(normalized);
  return mapRowToMeta(row, normalized);
}

export interface ListPartnerMetaOptions {
  status?: string | null;
  search?: string | null;
}

function matchesSearch(meta: PartnerMeta, searchTerm?: string | null) {
  if (!searchTerm) return true;
  const needle = searchTerm.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    meta.partnerId,
    meta.displayName ?? '',
    meta.info.contactEmail,
    meta.info.contactName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

export async function listPartnerMetas(options: ListPartnerMetaOptions = {}) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('partners')
    .select('*')
    .order('created_at', { ascending: false });

  const normalizedStatus = normalizeStatusForDb(options.status ?? '');
  if (normalizedStatus) {
    query = query.eq('status', normalizedStatus);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to list partners: ${error.message}`);
  }

  const rows = (data ?? []) as PartnerRow[];
  const metas = rows.map((row) => mapRowToMeta(row, row.id));
  const filtered = metas.filter((meta) => matchesSearch(meta, options.search));
  filtered.sort((a, b) => a.partnerId.localeCompare(b.partnerId));
  return filtered;
}

export async function savePartnerMeta(partnerId: string, updates: PartnerMetaUpdateInput) {
  const normalized = normalizePartnerId(partnerId);
  if (!normalized) {
    throw new Error('partnerId is required');
  }

  const existingRow = await fetchPartnerRow(normalized);
  const baseMeta = mapRowToMeta(existingRow, normalized);
  const mergedMeta = mergePartnerMeta(baseMeta, updates);
  const supabase = getSupabaseAdmin();

  const payload = metaToRow(mergedMeta, existingRow);
  payload.id = normalized;

  const { data, error } = await supabase
    .from('partners')
    .upsert(payload as unknown as never, { onConflict: 'id', ignoreDuplicates: false } as unknown as never)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save partner meta: ${error.message}`);
  }

  return mapRowToMeta((data as PartnerRow) ?? null, normalized);
}

export async function partnerExists(partnerId: string) {
  const supabase = getSupabaseAdmin();
  const normalized = normalizePartnerId(partnerId);
  if (!normalized) return false;
  const { data, error } = await supabase
    .from('partners')
    .select('id')
    .eq('id', normalized)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to check partner: ${error.message}`);
  }
  return Boolean(data);
}
