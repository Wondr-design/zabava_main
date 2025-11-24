import { randomUUID } from "node:crypto";
import { z } from "zod";

import { getSupabaseAdminTyped } from "../supabase-admin";
import { normalizePartnerId } from "./partners";
import type { Database, Json } from "@/supabase/types";
import { listQrEvents, type QrEventType, type QrType } from "./qr-events";
import type { PostgrestError } from "@supabase/supabase-js";
import { log } from "@/lib/logging";
import { getPartnerById } from "@/lib/data/site-directory";
import { getActiveTimezoneSetting } from "@/lib/data/timezone-settings";
import { formatTimeZoneLabel } from "@/lib/timezone";
import type { DealTicketRequirement } from "@/lib/deals/ticket-requirements";

export const flashDealStatusSchema = z.enum([
  "draft",
  "scheduled",
  "live",
  "paused",
  "expired",
]);

export const dealTypeSchema = z.enum(["flash", "weekly_promo", "group"]);

const flashDealRowSchema = z.object({
  id: z.string().uuid(),
  partner_id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  deal_type: dealTypeSchema,
  slug: z.string().nullable(),
  discount_percent: z.number(),
  min_visitors: z.number(),
  valid_from: z.string().datetime({ offset: true }).nullable(),
  valid_to: z.string().datetime({ offset: true }).nullable(),
  valid_days: z.array(z.number()).nullable(),
  commission_percent: z.number(),
  price_override_czk: z.number().nullable(),
  bonus_points_override: z.number().nullable(),
  is_featured: z.boolean(),
  banner_lead_hours: z.number(),
  form_id: z.string().nullable().optional(),
  ticket_requirements: z
    .array(
      z.object({
        ticketType: z.string(),
        subType: z.string().optional(),
        quantity: z.number().int().min(1),
      }),
    )
    .nullable(),
  ticket_types: z.array(z.string()).nullable(),
  qr_validity_seconds: z.number(),
  usage_limit: z.number().nullable(),
  usage_limit_daily: z.number().nullable(),
  usage_count: z.number(),
  auto_expire: z.boolean(),
  send_reminders: z.boolean(),
  tags: z.array(z.string()),
  audience: z.array(z.string()),
  city: z.string().nullable(),
  time_zone: z.string(),
  status: flashDealStatusSchema,
  created_by: z.string().nullable(),
  updated_by: z.string().nullable(),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});

const slugSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9-]+$/i, {
    message: "Slug may only contain letters, numbers, and hyphens.",
  });

const flashDealInsertSchema = z.object({
  partnerId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  dealType: dealTypeSchema.optional(),
  formId: z.string().min(1).optional().nullable(),
  slug: slugSchema.optional(),
  discountPercent: z.number().min(0).max(100),
  minVisitors: z.number().int().min(1).default(1),
  validFrom: z.string().datetime({ offset: true }).optional(),
  validTo: z.string().datetime({ offset: true }).optional(),
  validDays: z.array(z.number().int().min(0).max(6)).optional(),
  commissionPercent: z.number().min(0).max(100),
  priceOverrideCzk: z.number().positive().optional(),
  bonusPointsOverride: z.number().int().nonnegative().optional(),
  isFeatured: z.boolean().optional(),
  bannerLeadHours: z.number().int().nonnegative().optional(),
  ticketRequirements: z
    .array(
      z.object({
        ticketType: z.string().min(1),
        subType: z.string().optional(),
        quantity: z.number().int().min(1),
      }),
    )
    .optional(),
  qrValiditySeconds: z.number().int().positive().default(864000),
  usageLimit: z.number().int().positive().optional(),
  usageLimitDaily: z.number().int().positive().optional(),
  autoExpire: z.boolean().optional(),
  sendReminders: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  audience: z.array(z.string()).optional(),
  ticketTypes: z.array(z.string()).optional(),
  city: z.string().optional(),
  timeZone: z.string().optional(),
  status: flashDealStatusSchema.default("draft"),
  createdBy: z.string().optional(),
  media: z
    .array(
      z.object({
        url: z.string().url(),
        mediaType: z.string().min(1).optional(),
        altText: z.string().optional(),
        sortOrder: z.number().int().optional(),
      }),
    )
    .optional(),
});

const flashDealUpdateSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    dealType: dealTypeSchema.optional(),
    slug: slugSchema.nullable().optional(),
    discountPercent: z.number().min(0).max(100).optional(),
    minVisitors: z.number().int().min(1).optional(),
    validFrom: z.string().datetime({ offset: true }).nullable().optional(),
    validTo: z.string().datetime({ offset: true }).nullable().optional(),
    validDays: z.array(z.number().int().min(0).max(6)).nullable().optional(),
    formId: z.string().min(1).nullable().optional(),
    commissionPercent: z.number().min(0).max(100).optional(),
    priceOverrideCzk: z.number().positive().nullable().optional(),
    bonusPointsOverride: z.number().int().nonnegative().nullable().optional(),
    isFeatured: z.boolean().optional(),
    bannerLeadHours: z.number().int().nonnegative().optional(),
    ticketRequirements: z
      .array(
        z.object({
          ticketType: z.string().min(1),
          subType: z.string().optional(),
          quantity: z.number().int().min(1),
        }),
      )
      .nullable()
      .optional(),
    qrValiditySeconds: z.number().int().positive().optional(),
    usageLimit: z.number().int().positive().nullable().optional(),
    usageLimitDaily: z.number().int().positive().nullable().optional(),
    autoExpire: z.boolean().optional(),
    sendReminders: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
    audience: z.array(z.string()).optional(),
    ticketTypes: z.array(z.string()).optional(),
    city: z.string().nullable().optional(),
    timeZone: z.string().nullable().optional(),
    status: flashDealStatusSchema.optional(),
    updatedBy: z.string().optional(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "No update fields provided.",
  });

const flashDealUsageSchema = z.object({
  total: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
  used: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
  expired: z.number().int().nonnegative(),
});

export type FlashDeal = z.infer<typeof flashDealRowSchema>;
export type FlashDealStatus = z.infer<typeof flashDealStatusSchema>;
export type DealType = z.infer<typeof dealTypeSchema>;
export type FlashDealInput = z.infer<typeof flashDealInsertSchema>;
export type FlashDealUpdate = z.infer<typeof flashDealUpdateSchema>;
export type FlashDealUsage = z.infer<typeof flashDealUsageSchema>;

const flashDealRedemptionRowSchema = z.object({
  id: z.string().uuid(),
  flash_deal_id: z.string().uuid(),
  visit_id: z.string().uuid().nullable(),
  status: z.string(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullable().optional(),
});

type FlashDealRedemptionRow = z.infer<typeof flashDealRedemptionRowSchema>;
type FlashDealRow = Database["public"]["Tables"]["flash_deals"]["Row"];
type FlashDealInsertRow = Database["public"]["Tables"]["flash_deals"]["Insert"];
type FlashDealUpdateRow = Database["public"]["Tables"]["flash_deals"]["Update"];
type FlashDealRedemptionInsertRow =
  Database["public"]["Tables"]["flash_deal_redemptions"]["Insert"];
type DealUsageRow = Database["public"]["Tables"]["deal_usage_stats"]["Row"];
type DealMediaRow = Database["public"]["Tables"]["deal_media"]["Row"];
type DealMediaInsertRow = Database["public"]["Tables"]["deal_media"]["Insert"];
type DealReminderInsertRow =
  Database["public"]["Tables"]["deal_reminder_queue"]["Insert"];

const OPTIONAL_FLASH_DEAL_COLUMNS = new Set([
  "tags",
  "audience",
  "ticket_types",
  "city",
  "auto_expire",
  "send_reminders",
  "usage_limit_daily",
  "usage_limit",
  "price_override_czk",
  "bonus_points_override",
  "valid_days",
  "valid_from",
  "valid_to",
  "slug",
  "deal_type",
]);

function computeRequirementMinimum(
  requirements?: Array<{ quantity: number }> | null,
): number {
  if (!requirements || requirements.length === 0) return 0;
  return requirements.reduce(
    (max, item) => Math.max(max, Math.max(0, item.quantity)),
    0,
  );
}

function normalizeTicketTypeList(
  values: string[] | null | undefined,
): string[] | null {
  if (!values || values.length === 0) {
    return null;
  }
  const result = Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );
  return result.length > 0 ? result : null;
}

function isUniqueConstraintViolation(
  error: unknown,
  constraint: string,
) {
  if (
    !error ||
    typeof error !== "object" ||
    !(error as { code?: unknown }).code ||
    !(error as { message?: unknown }).message
  ) {
    return false;
  }

  const { code, message, details, hint } = error as PostgrestError;
  if (code !== "23505") return false;

  const haystack = [message, details, hint]
    .filter((value): value is string => Boolean(value))
    .join(" ");
  return haystack.includes(constraint);
}

function extractMissingColumnName(
  error: PostgrestError,
): string | null {
  const sources = [error.message, (error as { details?: string }).details, (error as { hint?: string }).hint].filter(
    (value): value is string => Boolean(value),
  );
  const combined = sources.join(" ");
  const match = combined.match(/'([a-zA-Z0-9_]+)' column/);
  return match ? match[1] : null;
}

function coerceDateTime(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    // Ensure the string parses and normalise to ISO 8601
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString();
  }
  return null;
}

async function resolveDealTimezone(
  partnerId: string,
  override?: string | null,
): Promise<string> {
  const trimmedOverride = override?.trim();
  if (trimmedOverride) {
    return trimmedOverride;
  }
  const setting = await getActiveTimezoneSetting();
  if (setting.source === "partner") {
    const partnerResponse = await getPartnerById(partnerId);
    const candidate =
      partnerResponse?.partner?.info?.timeZone?.trim() ||
      partnerResponse?.partner?.info?.businessAddress?.timeZone?.trim() ||
      partnerResponse?.partner?.info?.companyAddress?.timeZone?.trim() ||
      null;
    if (candidate) {
      return candidate;
    }
  }
  return setting.adminTimeZone;
}

async function insertFlashDealWithFallback(
  supabase: ReturnType<typeof getSupabaseAdminTyped>,
  payload: Record<string, unknown>,
): Promise<FlashDealRow> {
  const disabled = new Set<string>();
  let attemptPayload: Record<string, unknown> = { ...payload };
  for (let attempt = 0; attempt < OPTIONAL_FLASH_DEAL_COLUMNS.size + 1; attempt += 1) {
    const { data, error } = await supabase
      .from("flash_deals")
      .insert(attemptPayload as FlashDealInsertRow)
      .select()
      .single();
    if (!error) {
      return data as FlashDealRow;
    }
    const missingColumn = extractMissingColumnName(error);
    if (!missingColumn || disabled.has(missingColumn) || !OPTIONAL_FLASH_DEAL_COLUMNS.has(missingColumn)) {
      throw error;
    }
    disabled.add(missingColumn);
    const nextPayload = { ...attemptPayload };
    delete nextPayload[missingColumn];
    attemptPayload = nextPayload;
  }
  throw new Error("Failed to create flash deal: incompatible schema (missing required columns).");
}

async function updateFlashDealWithFallback(
  supabase: ReturnType<typeof getSupabaseAdminTyped>,
  id: string,
  payload: Record<string, unknown>,
): Promise<FlashDealRow> {
  const disabled = new Set<string>();
  let attemptPayload: Record<string, unknown> = { ...payload };
  for (let attempt = 0; attempt < OPTIONAL_FLASH_DEAL_COLUMNS.size + 1; attempt += 1) {
    const { data, error } = await supabase
      .from("flash_deals")
      .update(attemptPayload as FlashDealUpdateRow)
      .eq("id", id)
      .select()
      .single();
    if (!error) {
      return data as FlashDealRow;
    }
    const missingColumn = extractMissingColumnName(error);
    if (!missingColumn || disabled.has(missingColumn) || !OPTIONAL_FLASH_DEAL_COLUMNS.has(missingColumn)) {
      throw error;
    }
    disabled.add(missingColumn);
    const nextPayload = { ...attemptPayload };
    delete nextPayload[missingColumn];
    attemptPayload = nextPayload;
  }
  throw new Error("Failed to update flash deal: incompatible schema (missing required columns).");
}

async function fetchMediaForDeals(
  supabase: ReturnType<typeof getSupabaseAdminTyped>,
  dealIds: string[],
): Promise<Map<string, DealMediaRow[]>> {
  const mediaMap = new Map<string, DealMediaRow[]>();
  if (dealIds.length === 0) {
    return mediaMap;
  }

  const { data, error } = await supabase
    .from("deal_media")
    .select(
      "id, deal_id, media_type, url, alt_text, sort_order, created_at, updated_at",
    )
    .in("deal_id", dealIds);

  if (error) {
    if (error.code === "42P01") {
      // Table not yet available in this environment; skip media to keep UI functional.
      return mediaMap;
    }
    throw new Error(`Failed to load deal media: ${error.message}`);
  }

  for (const item of data ?? []) {
    const entry = item as DealMediaRow;
    if (!mediaMap.has(entry.deal_id)) {
      mediaMap.set(entry.deal_id, []);
    }
    mediaMap.get(entry.deal_id)!.push(entry);
  }
  return mediaMap;
}

async function fetchUsageStatsForDeals(
  supabase: ReturnType<typeof getSupabaseAdminTyped>,
  dealIds: string[],
): Promise<Map<string, DealUsageRow>> {
  const usageMap = new Map<string, DealUsageRow>();
  if (dealIds.length === 0) {
    return usageMap;
  }

  const { data, error } = await supabase
    .from("deal_usage_stats")
    .select(
      "deal_id, qr_generated, qr_scanned, qr_rejected, commission_czk, bonus_awarded, updated_at",
    )
    .in("deal_id", dealIds);

  if (error) {
    if (error.code === "42P01") {
      // Usage stats table not present yet; treat as no stats.
      return usageMap;
    }
    throw new Error(`Failed to load deal usage stats: ${error.message}`);
  }

  for (const item of data ?? []) {
    const entry = item as DealUsageRow;
    usageMap.set(entry.deal_id, entry);
  }

  return usageMap;
}

type DealRowWithRelations = FlashDealRow & {
  deal_usage_stats?: DealUsageRow | null;
  deal_media?: DealMediaRow[] | null;
};

export interface DealWithMeta {
  deal: FlashDeal;
  usageStats?: DealUsageRow;
  media?: DealMediaRow[];
  partnerName?: string | null;
}

export interface FlashDealRedemptionDetail {
  id: string;
  status: string;
  visitId: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface FlashDealQrEventDetail {
  id: string;
  eventType: QrEventType;
  qrType: QrType;
  occurredAt: string;
  source: string;
  visitId: string | null;
  metadata: Record<string, unknown>;
}

export interface FlashDealTimelinePoint {
  date: string;
  redemptions: number;
  qrGenerated: number;
  qrScans: number;
  qrRedeemed: number;
  qrExpired: number;
}

export interface FlashDealAnalytics {
  usage: FlashDealUsage;
  redemptions: FlashDealRedemptionDetail[];
  qrEvents: FlashDealQrEventDetail[];
  qrSummary: Record<QrEventType, number> & { total: number };
  timeline: FlashDealTimelinePoint[];
}

export interface DealReminderSummary {
  id: string;
  dealId: string;
  qrId: string | null;
  userEmail: string | null;
  reminderType: string;
  scheduledAt: string;
  status: string;
  metadata: Record<string, unknown>;
  deal: {
    title: string;
    slug: string | null;
    partnerId: string;
    partnerName: string | null;
  };
}

export interface PublicDealSummary {
  id: string;
  slug: string | null;
  title: string;
  partnerId: string;
  partnerName: string | null;
  descriptionSnippet: string | null;
  dealType: DealType;
  status: FlashDealStatus;
  discountPercent: number;
  minVisitors: number;
  validFrom: string | null;
  validTo: string | null;
  tags: string[];
  audience: string[];
  ticketTypes: string[];
   formId: string | null;
  ticketRequirements: Array<{ ticketType: string; subType?: string; quantity: number }>;
  timeZone: string;
  timeZoneLabel: string;
  city: string | null;
  priceOverrideCzk: number | null;
  usageLimit: number | null;
  usageCount: number;
  usageRemaining: number | null;
  isFeatured: boolean;
  isActive: boolean;
  isUpcoming: boolean;
  isExpiringSoon: boolean;
  heroImage: { url: string; altText: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicDealListResult {
  items: PublicDealSummary[];
  facets: {
    cities: string[];
    tags: string[];
    audiences: string[];
    dealTypes: DealType[];
  };
  generatedAt: string;
}

export interface PublicDealFilters {
  city?: string | null;
  tag?: string | null;
  audience?: string | null;
  dealType?: DealType | null;
  onlyActive?: boolean;
  limit?: number;
}

function mapFlashDeal(row: FlashDealRow | DealRowWithRelations): FlashDeal {
  const normalizedRow = {
    ...row,
    valid_from: coerceDateTime((row as Record<string, unknown>).valid_from) ?? null,
    valid_to: coerceDateTime((row as Record<string, unknown>).valid_to) ?? null,
    created_at: coerceDateTime((row as Record<string, unknown>).created_at) ?? new Date().toISOString(),
    updated_at: coerceDateTime((row as Record<string, unknown>).updated_at) ?? new Date().toISOString(),
  };
  try {
    return flashDealRowSchema.parse(normalizedRow);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const withDefaults = {
      tags: [],
      audience: [],
      ticket_types: null,
      ticket_requirements: null,
      is_featured: false,
      form_id: null,
      banner_lead_hours: 0,
      city: null,
      auto_expire: true,
      send_reminders: false,
        usage_limit: null,
        usage_limit_daily: null,
        price_override_czk: null,
        bonus_points_override: null,
        valid_days: null,
        valid_from: normalizedRow.valid_from,
        valid_to: normalizedRow.valid_to,
        slug: null,
        deal_type: "flash",
        ...(normalizedRow as Record<string, unknown>),
      };
      return flashDealRowSchema.parse(withDefaults);
    }
    throw error;
  }
}

export async function fetchPartnerDisplayNames(
  partnerIds: string[],
): Promise<Record<string, string | null>> {
  if (partnerIds.length === 0) {
    return {};
  }
  const supabase = getSupabaseAdminTyped();
  const unique = Array.from(
    new Set(
      partnerIds
        .map((id) => normalizePartnerId(id))
        .filter((value) => value.length > 0),
    ),
  );
  if (unique.length === 0) {
    return {};
  }
  const { data, error } = await supabase
    .from("partners")
    .select("id, display_name")
    .in("id", unique);
  if (error) {
    throw new Error(`Failed to load partner names: ${error.message}`);
  }
  const nameMap: Record<string, string | null> = {};
  for (const row of data ?? []) {
    const record = row as { id?: string; display_name?: string | null };
    if (!record?.id) continue;
    const key = normalizePartnerId(record.id);
    nameMap[key] = record.display_name ?? null;
  }
  return nameMap;
}

export async function listFlashDeals(
  params: {
    partnerId?: string;
    status?: FlashDealStatus;
    search?: string;
  } = {}
): Promise<FlashDeal[]> {
  const supabase = getSupabaseAdminTyped();
  let query = supabase
    .from("flash_deals")
    .select("*")
    .order("created_at", { ascending: false });

  if (params.partnerId) {
    query = query.eq("partner_id", normalizePartnerId(params.partnerId));
  }
  if (params.status) {
    query = query.eq("status", params.status);
  }
  if (params.search) {
    query = query.ilike("title", `%${params.search}%`);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to list flash deals: ${error.message}`);
  }
  return (data ?? []).map(mapFlashDeal);
}

export async function getFlashDeal(id: string): Promise<FlashDeal | null> {
  const supabase = getSupabaseAdminTyped();
  const { data, error } = await supabase
    .from("flash_deals")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load flash deal: ${error.message}`);
  }
  return data ? mapFlashDeal(data) : null;
}

export async function createFlashDeal(
  input: FlashDealInput
): Promise<FlashDeal> {
  const payload = flashDealInsertSchema.parse(input);
  const { media: mediaItems = [], ticketTypes, ...rest } = payload;
  const supabase = getSupabaseAdminTyped();
  const normalizedTicketTypes = normalizeTicketTypeList(ticketTypes);
  const ticketRequirements =
    payload.ticketRequirements && payload.ticketRequirements.length > 0
      ? payload.ticketRequirements.map((item) => ({
          ticketType: item.ticketType,
          subType: item.subType?.trim() || undefined,
          quantity: item.quantity,
        }))
      : null;
  const requirementMinimum = computeRequirementMinimum(ticketRequirements);
  const configuredMin = Math.max(1, rest.minVisitors);
  const requiredVisitors = Math.max(configuredMin, requirementMinimum || 0);

  const generatedSlug = rest.title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  const providedSlug = rest.slug?.trim().toLowerCase();
  const fallbackSlug = generatedSlug || `deal-${randomUUID().replace(/[^a-z0-9]/gi, "").slice(0, 8)}`;
  const baseSlug = providedSlug && providedSlug.length > 0 ? providedSlug : fallbackSlug;
  const autoGeneratedSlug = !providedSlug;

  const resolvedTimeZone = await resolveDealTimezone(
    rest.partnerId,
    rest.timeZone ?? null,
  );
  const insertBasePayload: Record<string, unknown> = {
    partner_id: normalizePartnerId(rest.partnerId),
    title: rest.title,
    description: rest.description ?? null,
    deal_type: rest.dealType ?? "flash",
    form_id: rest.formId ?? null,
    discount_percent: rest.discountPercent,
    min_visitors: requiredVisitors,
    valid_from: rest.validFrom ?? null,
    valid_to: rest.validTo ?? null,
    valid_days: rest.validDays ?? null,
    commission_percent: rest.commissionPercent,
    price_override_czk: rest.priceOverrideCzk ?? null,
    bonus_points_override: rest.bonusPointsOverride ?? null,
    is_featured: rest.isFeatured ?? false,
    banner_lead_hours: rest.bannerLeadHours ?? 0,
    ticket_requirements: ticketRequirements,
    ticket_types: normalizedTicketTypes,
    qr_validity_seconds: rest.qrValiditySeconds,
    usage_limit: rest.usageLimit ?? null,
    usage_limit_daily: rest.usageLimitDaily ?? null,
    usage_count: 0,
    auto_expire: rest.autoExpire ?? true,
    send_reminders: rest.sendReminders ?? false,
    tags: rest.tags ?? [],
    audience: rest.audience ?? [],
    city: rest.city ?? null,
    time_zone: resolvedTimeZone,
    status: rest.status ?? "draft",
    created_by: rest.createdBy ?? null,
    updated_by: rest.createdBy ?? null,
  };

  let dealRow: FlashDealRow;
  let slugCandidate = baseSlug;
  let slugSuffix = 2;
  // Attempt to insert, adding numeric suffixes for auto-generated slugs if the slug already exists.
  while (true) {
    try {
      dealRow = await insertFlashDealWithFallback(supabase, {
        ...insertBasePayload,
        slug: slugCandidate,
      });
      break;
    } catch (error) {
      if (isUniqueConstraintViolation(error, "flash_deals_slug_unique")) {
        if (!autoGeneratedSlug) {
          const duplicateError = new Error(`Slug "${slugCandidate}" is already in use.`);
          duplicateError.name = "DuplicateSlugError";
          (duplicateError as { code?: string }).code = "duplicate_slug";
          (duplicateError as { slug?: string }).slug = slugCandidate;
          throw duplicateError;
        }
        slugCandidate = `${baseSlug}-${slugSuffix}`;
        slugSuffix += 1;
        continue;
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to create flash deal.");
    }
  }
  const deal = mapFlashDeal(dealRow);

  const attachments: DealMediaInsertRow[] = mediaItems.reduce(
    (acc, item, index) => {
      const url = item.url.trim();
      if (!url) return acc;
      acc.push({
        deal_id: deal.id,
        media_type: item.mediaType ?? "image",
        url,
        alt_text: item.altText ?? null,
        sort_order: item.sortOrder ?? index,
      });
      return acc;
    },
    [] as DealMediaInsertRow[],
  );

  if (attachments.length > 0) {
    const { error: mediaError } = await supabase
      .from("deal_media")
      .insert(attachments);
    if (mediaError && mediaError.code !== "42P01") {
      throw new Error(`Failed to attach deal media: ${mediaError.message}`);
    }
  }

  return deal;
}

export async function updateFlashDeal(
  id: string,
  input: FlashDealUpdate
): Promise<FlashDeal> {
  const payload = flashDealUpdateSchema.parse(input);
  if (!Object.keys(payload).length) {
    const deal = await getFlashDeal(id);
    if (!deal) throw new Error("Flash deal not found");
    return deal;
  }

  const supabase = getSupabaseAdminTyped();
  let cachedExistingDeal: FlashDeal | null | undefined;
  const ensureExistingDeal = async () => {
    if (cachedExistingDeal === undefined) {
      cachedExistingDeal = await getFlashDeal(id);
    }
    if (!cachedExistingDeal) {
      throw new Error("Flash deal not found");
    }
    return cachedExistingDeal;
  };

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (payload.title !== undefined) updatePayload.title = payload.title;
  if (payload.description !== undefined)
    updatePayload.description = payload.description ?? null;
  if (payload.dealType !== undefined) updatePayload.deal_type = payload.dealType;
  if (payload.slug !== undefined) {
    const trimmed =
      payload.slug === null
        ? null
        : payload.slug.trim().toLowerCase() || null;
    updatePayload.slug = trimmed;
  }
  if (payload.discountPercent !== undefined)
    updatePayload.discount_percent = payload.discountPercent;
  if (payload.minVisitors !== undefined)
    updatePayload.min_visitors = payload.minVisitors;
  if (payload.validFrom !== undefined)
    updatePayload.valid_from = payload.validFrom ?? null;
  if (payload.validTo !== undefined) updatePayload.valid_to = payload.validTo ?? null;
  if (payload.validDays !== undefined)
    updatePayload.valid_days = payload.validDays ?? null;
  if (payload.commissionPercent !== undefined)
    updatePayload.commission_percent = payload.commissionPercent;
  if (payload.formId !== undefined) updatePayload.form_id = payload.formId ?? null;
  if (payload.priceOverrideCzk !== undefined)
    updatePayload.price_override_czk = payload.priceOverrideCzk ?? null;
  if (payload.bonusPointsOverride !== undefined)
    updatePayload.bonus_points_override = payload.bonusPointsOverride ?? null;
  if (payload.isFeatured !== undefined)
    updatePayload.is_featured = payload.isFeatured;
  if (payload.bannerLeadHours !== undefined)
    updatePayload.banner_lead_hours = payload.bannerLeadHours;
  if (payload.ticketRequirements !== undefined) {
    const normalized =
      payload.ticketRequirements?.map((item) => ({
        ticketType: item.ticketType,
        subType: item.subType?.trim() || undefined,
        quantity: item.quantity,
      })) ?? null;
    updatePayload.ticket_requirements = normalized;
    const requirementMinimum = computeRequirementMinimum(normalized);
    if (requirementMinimum > 0) {
      const baseMin =
        payload.minVisitors !== undefined
          ? payload.minVisitors
          : (await ensureExistingDeal()).min_visitors ?? 1;
      updatePayload.min_visitors = Math.max(
        typeof baseMin === "number" && baseMin > 0 ? baseMin : 1,
        requirementMinimum,
      );
    }
  }
  if (payload.qrValiditySeconds !== undefined)
    updatePayload.qr_validity_seconds = payload.qrValiditySeconds;
  if (payload.ticketTypes !== undefined) {
    updatePayload.ticket_types = normalizeTicketTypeList(payload.ticketTypes);
  }
  if (payload.usageLimit !== undefined)
    updatePayload.usage_limit = payload.usageLimit ?? null;
  if (payload.usageLimitDaily !== undefined)
    updatePayload.usage_limit_daily = payload.usageLimitDaily ?? null;
  if (payload.autoExpire !== undefined) updatePayload.auto_expire = payload.autoExpire;
  if (payload.sendReminders !== undefined)
    updatePayload.send_reminders = payload.sendReminders;
  if (payload.tags !== undefined) updatePayload.tags = payload.tags;
  if (payload.audience !== undefined) updatePayload.audience = payload.audience;
  if (payload.city !== undefined) updatePayload.city = payload.city ?? null;
  if (payload.timeZone !== undefined) {
    const existingDeal = await ensureExistingDeal();
    const normalized =
      payload.timeZone === null ? "" : (payload.timeZone?.trim() ?? "");
    if (normalized.length > 0) {
      updatePayload.time_zone = normalized;
    } else {
      updatePayload.time_zone = await resolveDealTimezone(existingDeal.partner_id, null);
    }
  }
  if (payload.status !== undefined) updatePayload.status = payload.status;
  if (payload.updatedBy !== undefined)
    updatePayload.updated_by = payload.updatedBy ?? null;

  let updatedRow: FlashDealRow;
  try {
    updatedRow = await updateFlashDealWithFallback(supabase, id, updatePayload);
  } catch (error) {
    if (isUniqueConstraintViolation(error, "flash_deals_slug_unique")) {
      const slug =
        typeof payload.slug === "string" && payload.slug.trim().length > 0
          ? payload.slug.trim().toLowerCase()
          : null;
      const duplicateError = new Error(
        slug ? `Slug "${slug}" is already in use.` : "Slug is already in use.",
      );
      duplicateError.name = "DuplicateSlugError";
      (duplicateError as { code?: string }).code = "duplicate_slug";
      if (slug) {
        (duplicateError as { slug?: string }).slug = slug;
      }
      throw duplicateError;
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to update flash deal.");
  }
  return mapFlashDeal(updatedRow);
}

export async function duplicateFlashDeal(
  id: string,
  overrides: Partial<FlashDealInput> = {}
): Promise<FlashDeal> {
  const existing = await getFlashDeal(id);
  if (!existing) {
    throw new Error("Flash deal not found");
  }

  const payload: FlashDealInput = {
    partnerId: overrides.partnerId ?? existing.partner_id,
    title: overrides.title ?? `${existing.title} (copy)`,
    description: overrides.description ?? existing.description ?? undefined,
    dealType: overrides.dealType ?? existing.deal_type,
    slug: overrides.slug,
    discountPercent: overrides.discountPercent ?? existing.discount_percent,
    minVisitors: overrides.minVisitors ?? existing.min_visitors,
    validFrom: overrides.validFrom ?? existing.valid_from ?? undefined,
    validTo: overrides.validTo ?? existing.valid_to ?? undefined,
    validDays: overrides.validDays ?? existing.valid_days ?? undefined,
    commissionPercent:
      overrides.commissionPercent ?? existing.commission_percent,
    priceOverrideCzk:
      overrides.priceOverrideCzk ?? existing.price_override_czk ?? undefined,
    bonusPointsOverride:
      overrides.bonusPointsOverride ??
      existing.bonus_points_override ??
      undefined,
    qrValiditySeconds:
      overrides.qrValiditySeconds ?? existing.qr_validity_seconds,
    usageLimit: overrides.usageLimit ?? existing.usage_limit ?? undefined,
    usageLimitDaily:
      overrides.usageLimitDaily ?? existing.usage_limit_daily ?? undefined,
    autoExpire: overrides.autoExpire ?? existing.auto_expire,
    sendReminders: overrides.sendReminders ?? existing.send_reminders,
    tags: overrides.tags ?? existing.tags,
    audience: overrides.audience ?? existing.audience,
    city: overrides.city ?? existing.city ?? undefined,
    ticketTypes: overrides.ticketTypes ?? existing.ticket_types ?? undefined,
    timeZone: overrides.timeZone ?? existing.time_zone ?? undefined,
    status: overrides.status ?? "draft",
    createdBy: overrides.createdBy,
  };

  const supabase = getSupabaseAdminTyped();
  const mediaMap = await fetchMediaForDeals(supabase, [existing.id]);
  const existingMedia = mediaMap.get(existing.id) ?? [];
  if (existingMedia.length > 0 && !payload.media) {
    payload.media = existingMedia.map((item, index) => ({
      url: item.url,
      mediaType: item.media_type ?? undefined,
      altText: item.alt_text ?? undefined,
      sortOrder: item.sort_order ?? index,
    }));
  }

  return createFlashDeal(payload);
}

export async function disableFlashDeal(id: string, actor?: string) {
  const existing = await getFlashDeal(id);
  if (!existing) {
    throw new Error("Flash deal not found");
  }
  if (existing.status === "paused") {
    return existing;
  }
  return updateFlashDeal(id, { status: "paused", updatedBy: actor });
}

export async function listDealsWithMeta(
  params: {
    partnerId?: string;
    status?: FlashDealStatus;
    search?: string;
    dealType?: DealType;
  } = {}
): Promise<DealWithMeta[]> {
  const supabase = getSupabaseAdminTyped();
  let query = supabase
    .from("flash_deals")
    .select("*")
    .order("created_at", { ascending: false });

  if (params.partnerId) {
    query = query.eq("partner_id", normalizePartnerId(params.partnerId));
  }
  if (params.status) {
    query = query.eq("status", params.status);
  }
  if (params.search) {
    query = query.ilike("title", `%${params.search}%`);
  }
  if (params.dealType) {
    query = query.eq("deal_type", params.dealType);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to list deals: ${error.message}`);
  }

  const dealRows = ((data ?? []) as unknown) as FlashDealRow[];
  const dealIds = dealRows.map((row) => row.id);

  const [usageStatsMap, mediaMap, partnerNameMap] = await Promise.all([
    fetchUsageStatsForDeals(supabase, dealIds),
    fetchMediaForDeals(supabase, dealIds),
    fetchPartnerDisplayNames(
      dealRows
        .map((row) => {
          const typedRow = row as { partner_id?: string | null };
          return typedRow.partner_id ?? null;
        })
        .filter((value): value is string => typeof value === "string"),
    ),
  ]);

  return dealRows.map((row) => {
    const deal = mapFlashDeal(row);
    const usageStats = usageStatsMap.get(deal.id) ?? undefined;
    const mediaRows = mediaMap.get(deal.id) ?? [];
    const media =
      mediaRows.length > 0
        ? mediaRows.slice().sort((a, b) => a.sort_order - b.sort_order)
        : undefined;
    const partnerName =
      partnerNameMap[normalizePartnerId(deal.partner_id)] ?? null;
    return {
      deal,
      usageStats,
      media,
      partnerName,
    };
  });
}

export async function getDealWithMeta(
  id: string
): Promise<DealWithMeta | null> {
  const supabase = getSupabaseAdminTyped();
  const { data, error } = await supabase
    .from("flash_deals")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load deal: ${error.message}`);
  }
  if (!data) return null;
  const dealRow = data as unknown as FlashDealRow;
  const deal = mapFlashDeal(dealRow);

  const [usageStatsMap, mediaMap, partnerNameMap] = await Promise.all([
    fetchUsageStatsForDeals(supabase, [deal.id]),
    fetchMediaForDeals(supabase, [deal.id]),
    fetchPartnerDisplayNames([deal.partner_id]),
  ]);

  const usageStats = usageStatsMap.get(deal.id) ?? undefined;
  const mediaRows = mediaMap.get(deal.id) ?? [];
  const media =
    mediaRows.length > 0
      ? mediaRows.slice().sort((a, b) => a.sort_order - b.sort_order)
      : undefined;
  return {
    deal,
    usageStats,
    media,
    partnerName: partnerNameMap[normalizePartnerId(deal.partner_id)] ?? null,
  };
}

function createDescriptionSnippet(description: string | null): string | null {
  if (!description) return null;
  const normalized = description.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (normalized.length <= 160) return normalized;
  return `${normalized.slice(0, 157)}…`;
}

function pickHeroImage(media: DealMediaRow[] | undefined) {
  if (!media?.length) return null;
  return (
    media.find((item) =>
      (item.media_type ?? "").toLowerCase().startsWith("image"),
    ) ?? null
  );
}

interface PublicDealDetailExtras {
  description: string | null;
  validDays: number[] | null;
  qrValiditySeconds: number;
  bonusPointsOverride: number | null;
  ticketTypes: string[];
  ticketRequirements: Array<{ ticketType: string; subType?: string; quantity: number }>;
  bannerLeadHours: number;
  usageLimitDaily: number | null;
  media: Array<{
    id: string;
    mediaType: string;
    url: string;
    altText: string | null;
    sortOrder: number;
  }>;
  timeZoneLabel: string;
}

interface PublicDealTransform {
  summary: PublicDealSummary;
  detail: PublicDealDetailExtras;
}

function transformDealToPublic(entry: DealWithMeta): PublicDealTransform | null {
  return transformDealToPublicWithForm(entry, null);
}

function transformDealToPublicWithForm(
  entry: DealWithMeta,
  formIdMap: Map<string, string> | null,
): PublicDealTransform | null {
  const { deal, media, partnerName } = entry;
  const status = deal.status;
  if (status === "draft" || status === "paused" || status === "expired") {
    return null;
  }

  const parseIso = (value: string | null) => {
    if (!value) return null;
    const time = Date.parse(value);
    return Number.isNaN(time) ? null : time;
  };

  const nowMs = Date.now();
  const validFromMs = parseIso(deal.valid_from);
  const validToMs = parseIso(deal.valid_to);

  if (validToMs !== null && validToMs < nowMs) {
    return null;
  }

  const usageRemaining =
    typeof deal.usage_limit === "number"
      ? Math.max(0, deal.usage_limit - deal.usage_count)
      : null;
  const hasCapacity = usageRemaining === null || usageRemaining > 0;
  if (!hasCapacity) {
    return null;
  }

  const withinWindow =
    (validFromMs === null || validFromMs <= nowMs) &&
    (validToMs === null || validToMs >= nowMs);
  const upcomingWindow = validFromMs !== null && validFromMs > nowMs;
  const isActive = status === "live" && withinWindow;
  const isUpcoming = !isActive && (status === "scheduled" || upcomingWindow);
  const isExpiringSoon =
    validToMs !== null && validToMs > nowMs && validToMs - nowMs <= 72 * 60 * 60 * 1000;

  const sortedMedia =
    media && media.length > 0
      ? media.slice().sort((a, b) => a.sort_order - b.sort_order)
      : undefined;
  const hero = pickHeroImage(sortedMedia);

  const timezone = deal.time_zone;
  const timeZoneLabel = formatTimeZoneLabel(timezone);
  const summary: PublicDealSummary = {
    id: deal.id,
    slug: deal.slug ?? null,
    title: deal.title,
    partnerId: deal.partner_id,
    partnerName: partnerName ?? null,
    descriptionSnippet: createDescriptionSnippet(deal.description),
    dealType: deal.deal_type,
    status: deal.status,
    discountPercent: deal.discount_percent,
    minVisitors: deal.min_visitors,
    validFrom: deal.valid_from,
    validTo: deal.valid_to,
    tags: deal.tags ?? [],
    audience: deal.audience ?? [],
    ticketTypes: deal.ticket_types ?? [],
    formId: formIdMap?.get(deal.id) ?? null,
    ticketRequirements:
      (deal.ticket_requirements as Array<{
        ticketType: string;
        subType?: string;
        quantity: number;
      }> | null) ?? [],
    timeZone: timezone,
    timeZoneLabel,
    city: deal.city ?? null,
    priceOverrideCzk: deal.price_override_czk,
    usageLimit: deal.usage_limit,
    usageCount: deal.usage_count,
    usageRemaining,
    isFeatured: deal.is_featured,
    isActive,
    isUpcoming,
    isExpiringSoon,
    heroImage: hero
      ? {
          url: hero.url,
          altText: hero.alt_text ?? null,
        }
      : null,
    createdAt: deal.created_at,
    updatedAt: deal.updated_at,
  };

  const detail: PublicDealDetailExtras = {
    description: deal.description,
    validDays: deal.valid_days,
    qrValiditySeconds: deal.qr_validity_seconds,
    bonusPointsOverride: deal.bonus_points_override ?? null,
    ticketTypes: deal.ticket_types ?? [],
    ticketRequirements: (deal.ticket_requirements as Array<{ ticketType: string; subType?: string; quantity: number }> | null) ?? [],
    bannerLeadHours: deal.banner_lead_hours,
    usageLimitDaily: deal.usage_limit_daily ?? null,
    media:
      sortedMedia?.map((item) => ({
        id: item.id,
        mediaType: item.media_type,
        url: item.url,
        altText: item.alt_text ?? null,
        sortOrder: item.sort_order,
      })) ?? [],
    timeZoneLabel,
  };

  return { summary, detail };
}

export async function listPublicDeals(
  filters: PublicDealFilters = {},
): Promise<PublicDealListResult> {
  const supabase = getSupabaseAdminTyped();
  const formMap = await fetchPublishedDealFormMap();
  const selectColumns = [
    "*",
  ].join(", ");

  const { data, error } = await supabase
    .from("flash_deals")
    .select(selectColumns)
    .in("status", ["live", "scheduled"])
    .order("valid_to", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list deals: ${error.message}`);
  }

  const dealRows = ((data ?? []) as unknown) as FlashDealRow[];
  const mediaMap = await fetchMediaForDeals(
    supabase,
    dealRows.map((row) => row.id),
  );

  const partnerNameMap = await fetchPartnerDisplayNames(
    dealRows
      .map((row) => (row as { partner_id?: string | null }).partner_id ?? null)
      .filter((value): value is string => typeof value === "string"),
  );

  const entries: DealWithMeta[] = dealRows.map((row) => {
    const deal = mapFlashDeal(row);
    const mediaRows = mediaMap.get(deal.id) ?? [];
    const media =
      mediaRows.length > 0
        ? mediaRows.slice().sort((a, b) => a.sort_order - b.sort_order)
        : undefined;
    return {
      deal,
      usageStats: undefined,
      media,
      partnerName: partnerNameMap[normalizePartnerId(deal.partner_id)] ?? null,
    };
  });

  const transformed = entries
    .map((entry) => transformDealToPublic(entry))
    .filter((value): value is PublicDealTransform => value !== null);

  const baseSummaries = transformed.map((entry) => entry.summary);

  const citySet = new Set<string>();
  const tagSet = new Set<string>();
  const audienceSet = new Set<string>();
  const dealTypeSet = new Set<DealType>();

  for (const deal of baseSummaries) {
    if (deal.city) {
      const trimmed = deal.city.trim();
      if (trimmed) citySet.add(trimmed);
    }
    for (const tag of deal.tags ?? []) {
      const trimmed = tag.trim();
      if (trimmed) tagSet.add(trimmed);
    }
    for (const aud of deal.audience ?? []) {
      const trimmed = aud.trim();
      if (trimmed) audienceSet.add(trimmed);
    }
    dealTypeSet.add(deal.dealType);
  }

  const facets = {
    cities: Array.from(citySet).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    ),
    tags: Array.from(tagSet).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    ),
    audiences: Array.from(audienceSet).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    ),
    dealTypes: Array.from(dealTypeSet).sort(),
  };

  const normalize = (value: string | null | undefined) =>
    (value ?? "").trim().toLowerCase();

  const normalizedCity = normalize(filters.city);
  const normalizedTag = normalize(filters.tag);
  const normalizedAudience = normalize(filters.audience);
  const onlyActive = filters.onlyActive === true;

  const filteredItems = baseSummaries
    .filter((deal) => {
      if (onlyActive && !deal.isActive) return false;
      if (
        normalizedCity &&
        (!deal.city || deal.city.toLowerCase() !== normalizedCity)
      ) {
        return false;
      }
      if (
        filters.dealType &&
        deal.dealType !== filters.dealType
      ) {
        return false;
      }
      if (
        normalizedTag &&
        !deal.tags.some((tag) => tag.toLowerCase() === normalizedTag)
      ) {
        return false;
      }
      if (
        normalizedAudience &&
        !deal.audience.some((aud) => aud.toLowerCase() === normalizedAudience)
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      if (a.isUpcoming !== b.isUpcoming) return a.isUpcoming ? -1 : 1;
      const parseOrInf = (value: string | null) => {
        if (!value) return Number.POSITIVE_INFINITY;
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
      };
      const aValid = parseOrInf(a.validTo);
      const bValid = parseOrInf(b.validTo);
      if (aValid !== bValid) return aValid - bValid;
      const aCreated = Date.parse(a.createdAt);
      const bCreated = Date.parse(b.createdAt);
      if (!Number.isNaN(aCreated) && !Number.isNaN(bCreated)) {
        return bCreated - aCreated;
      }
      return a.title.localeCompare(b.title, undefined, {
        sensitivity: "base",
      });
    });

  const limit =
    typeof filters.limit === "number" && filters.limit > 0
      ? Math.min(filters.limit, filteredItems.length)
      : filteredItems.length;

  const items = filteredItems.slice(0, limit);

  return {
    items: items.map((item) => ({
      ...item,
      formId: formMap.get(item.id) ?? null,
    })),
    facets,
    generatedAt: new Date().toISOString(),
  };
}

export interface DealSummaryForForms {
  id: string;
  title: string;
  slug: string | null;
  status: FlashDealStatus;
  partnerId: string;
  partnerName: string | null;
  dealType: DealType;
  minVisitors: number;
  validTo: string | null;
  ticketRequirements: DealTicketRequirement[];
  timeZone: string | null;
  timeZoneLabel: string;
}

export async function listDealSummariesForForms(
  options: { statuses?: FlashDealStatus[] } = {},
): Promise<DealSummaryForForms[]> {
  const entries = await listDealsWithMeta();
  const allowedStatuses = options.statuses;
  return entries
    .filter((entry) =>
      allowedStatuses ? allowedStatuses.includes(entry.deal.status) : true,
    )
    .map((entry) => ({
      id: entry.deal.id,
      title: entry.deal.title,
      slug: entry.deal.slug ?? null,
      status: entry.deal.status,
      partnerId: entry.deal.partner_id,
      partnerName: entry.partnerName ?? null,
      dealType: entry.deal.deal_type,
      minVisitors: entry.deal.min_visitors,
      validTo: entry.deal.valid_to ?? null,
      ticketRequirements:
        (entry.deal.ticket_requirements as DealTicketRequirement[] | null) ?? [],
      timeZone: entry.deal.time_zone ?? null,
      timeZoneLabel: formatTimeZoneLabel(entry.deal.time_zone ?? null),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export async function getDealWithMetaBySlug(
  slug: string,
): Promise<DealWithMeta | null> {
  const supabase = getSupabaseAdminTyped();
  const { data, error } = await supabase
    .from("flash_deals")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load deal: ${error.message}`);
  }
  if (!data) return null;

  const dealRow = data as unknown as FlashDealRow;
  const deal = mapFlashDeal(dealRow);

  const [usageStatsMap, mediaMap, partnerNameMap] = await Promise.all([
    fetchUsageStatsForDeals(supabase, [deal.id]),
    fetchMediaForDeals(supabase, [deal.id]),
    fetchPartnerDisplayNames([deal.partner_id]),
  ]);

  const usageStats = usageStatsMap.get(deal.id) ?? undefined;
  const mediaRows = mediaMap.get(deal.id) ?? [];
  const media =
    mediaRows.length > 0
      ? mediaRows.slice().sort((a, b) => a.sort_order - b.sort_order)
      : undefined;

  return {
    deal,
    usageStats,
    media,
    partnerName: partnerNameMap[normalizePartnerId(deal.partner_id)] ?? null,
  };
}

export interface PublicDealDetail
  extends PublicDealSummary,
    PublicDealDetailExtras {}

export async function getPublicDealBySlug(
  slug: string,
): Promise<PublicDealDetail | null> {
  const formMap = await fetchPublishedDealFormMap();
  const entry = await getDealWithMetaBySlug(slug);
  if (!entry) return null;
  const transformed = transformDealToPublicWithForm(entry, formMap);
  if (!transformed) return null;
  return {
    ...transformed.summary,
    ...transformed.detail,
  };
}

async function fetchPublishedDealFormMap(): Promise<Map<string, string>> {
  const supabase = getSupabaseAdminTyped();
  const { data, error } = await supabase
    .from("partner_forms")
    .select("id, deal_id, usage_type, status")
    .eq("usage_type", "deal")
    .eq("status", "published");

  if (error) {
    console.error("list_public_deal_forms_error", error);
    return new Map();
  }

  const map = new Map<string, string>();
  (data ?? []).forEach((row) => {
    const dealId = (row as { deal_id?: string | null }).deal_id;
    const id = (row as { id?: string | null }).id;
    if (dealId && id) {
      if (!map.has(dealId)) {
        map.set(dealId, id);
      }
    }
  });
  return map;
}

export async function setFlashDealStatus(
  id: string,
  status: FlashDealStatus,
  updatedBy?: string
): Promise<FlashDeal> {
  return updateFlashDeal(id, { status, updatedBy });
}

async function refreshFlashDealUsageCount(flashDealId: string) {
  const supabase = getSupabaseAdminTyped();
  const { count, error } = await supabase
    .from("flash_deal_redemptions")
    .select("id", { head: true, count: "exact" })
    .eq("flash_deal_id", flashDealId)
    .in("status", ["pending", "used"]);
  if (error) {
    throw new Error(
      `Failed to refresh flash deal usage count: ${error.message}`,
    );
  }
  await supabase
    .from("flash_deals")
    .update({ usage_count: count ?? 0 })
    .eq("id", flashDealId);
}

export async function recordFlashRedemption(params: {
  flashDealId: string;
  visitId?: string | null;
  status?: "pending" | "used" | "rejected" | "expired";
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = getSupabaseAdminTyped();

  const insertPayload: FlashDealRedemptionInsertRow = {
    flash_deal_id: params.flashDealId,
    visit_id: params.visitId ?? null,
    status: params.status ?? "pending",
    metadata: (params.metadata ?? {}) as Json,
  };

  const { error } = await supabase
    .from("flash_deal_redemptions")
    .insert(insertPayload);
  if (error) {
    throw new Error(`Failed to record flash redemption: ${error.message}`);
  }

  await refreshFlashDealUsageCount(params.flashDealId);
}

export async function updateFlashRedemptionStatus(params: {
  flashDealId: string;
  visitId: string;
  status: "pending" | "used" | "rejected" | "expired";
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = getSupabaseAdminTyped();

  const { data: existing, error: fetchError } = await supabase
    .from("flash_deal_redemptions")
    .select("metadata")
    .eq("flash_deal_id", params.flashDealId)
    .eq("visit_id", params.visitId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(
      `Failed to load redemption for update: ${fetchError.message}`,
    );
  }
  if (!existing) {
    throw new Error("Flash deal redemption not found for visit");
  }

  const existingMetadata =
    (existing.metadata as Record<string, unknown> | null) ?? {};
  const mergedMetadata = {
    ...existingMetadata,
    ...(params.metadata ?? {}),
  };

  const { error } = await supabase
    .from("flash_deal_redemptions")
    .update({
      status: params.status,
      metadata: mergedMetadata as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("flash_deal_id", params.flashDealId)
    .eq("visit_id", params.visitId);

  if (error) {
    throw new Error(
      `Failed to update flash redemption: ${error.message}`,
    );
  }

  await refreshFlashDealUsageCount(params.flashDealId);
}

export async function markFlashRedemptionUsed(params: {
  flashDealId: string;
  visitId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await updateFlashRedemptionStatus({
    ...params,
    status: "used",
  });
}

export async function markFlashRedemptionRejected(params: {
  flashDealId: string;
  visitId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await updateFlashRedemptionStatus({
    ...params,
    status: "rejected",
  });
}

export async function enqueueDealReminders(now: Date = new Date()) {
  const supabase = getSupabaseAdminTyped();
  const timestamp = now.toISOString();

  const { data: redemptions, error: redemptionError } = await supabase
    .from("flash_deal_redemptions")
    .select("id, flash_deal_id, visit_id, metadata, created_at, status")
    .eq("status", "pending");

  if (redemptionError) {
    throw new Error(
      `Failed to load flash deal redemptions: ${redemptionError.message}`,
    );
  }

  if (!redemptions || redemptions.length === 0) {
    return { processed: 0, created: 0, skipped: 0 };
  }

  const dealIds = Array.from(
    new Set(
      redemptions
        .map((row) => row.flash_deal_id)
        .filter((value): value is string => Boolean(value))
    ),
  );

  if (dealIds.length === 0) {
    return { processed: 0, created: 0, skipped: 0 };
  }

  const { data: dealsData, error: dealsError } = await supabase
    .from("flash_deals")
    .select(
      "id, title, deal_type, partner_id, send_reminders, qr_validity_seconds, valid_from, valid_to, min_visitors",
    )
    .in("id", dealIds);

  if (dealsError) {
    throw new Error(`Failed to load deals: ${dealsError.message}`);
  }

  const dealsById = new Map<string, (typeof dealsData)[number]>();
  const partnerIds = new Set<string>();
  for (const deal of dealsData ?? []) {
    dealsById.set(deal.id, deal);
    if (deal.partner_id) partnerIds.add(deal.partner_id);
  }

  const partnerNameMap = await fetchPartnerDisplayNames(
    Array.from(partnerIds),
  );

  const { data: existingQueue, error: queueError } = await supabase
    .from("deal_reminder_queue")
    .select("deal_id, qr_id, reminder_type")
    .in("deal_id", dealIds);

  if (queueError) {
    throw new Error(`Failed to load reminder queue: ${queueError.message}`);
  }

  const existingKeys = new Set(
    (existingQueue ?? []).map((row) =>
      `${row.deal_id ?? ""}:${row.qr_id ?? ""}:${row.reminder_type}`,
    ),
  );

  const inserts: DealReminderInsertRow[] = [];
  let skipped = 0;

  for (const redemption of redemptions) {
    const deal = redemption.flash_deal_id
      ? dealsById.get(redemption.flash_deal_id)
      : undefined;
    if (!deal || !deal.send_reminders) {
      skipped += 1;
      continue;
    }

    const createdAt = redemption.created_at
      ? new Date(redemption.created_at)
      : null;
    if (!createdAt || Number.isNaN(createdAt.getTime())) {
      skipped += 1;
      continue;
    }

    const metadata = (redemption.metadata ?? {}) as Record<string, unknown>;
    const userEmail =
      typeof metadata.email === "string" ? metadata.email : null;

    const minVisitors =
      typeof metadata.visitors === "number"
        ? metadata.visitors
        : deal.min_visitors ?? null;

    const scheduleCandidates: Array<{
      reminderType: string;
      scheduledAt: Date;
      metadata: Record<string, unknown>;
    }> = [];

    const day3 = new Date(createdAt.getTime());
    day3.setDate(day3.getDate() + 3);
    scheduleCandidates.push({
      reminderType: "day3",
      scheduledAt: day3,
      metadata: {
        email: userEmail,
        visitors: minVisitors,
        reminder: "day3",
      },
    });

    const validitySeconds =
      typeof deal.qr_validity_seconds === "number"
        ? deal.qr_validity_seconds
        : 864000;
    const expiryCandidate = deal.valid_to
      ? new Date(deal.valid_to)
      : new Date(createdAt.getTime() + validitySeconds * 1000);

    if (Number.isFinite(expiryCandidate.getTime())) {
      const preExpiry = new Date(expiryCandidate.getTime());
      preExpiry.setDate(preExpiry.getDate() - 2);
      if (preExpiry.getTime() > createdAt.getTime()) {
        scheduleCandidates.push({
          reminderType: "pre_expiry",
          scheduledAt: preExpiry,
          metadata: {
            email: userEmail,
            visitors: minVisitors,
            reminder: "pre_expiry",
            expiresAt: expiryCandidate.toISOString(),
          },
        });
      }
    }

    const partnerName = partnerNameMap[normalizePartnerId(deal.partner_id)] ?? null;

    for (const candidate of scheduleCandidates) {
      const scheduledAtMs = candidate.scheduledAt.getTime();
      if (!Number.isFinite(scheduledAtMs)) {
        skipped += 1;
        continue;
      }

      const scheduledIso = new Date(scheduledAtMs).toISOString();
      const qrKey = redemption.visit_id ?? redemption.id;
      const key = `${deal.id}:${qrKey ?? ""}:${candidate.reminderType}`;
      if (existingKeys.has(key)) {
        skipped += 1;
        continue;
      }

      inserts.push({
        deal_id: deal.id,
        qr_id: qrKey ?? null,
        user_email: userEmail,
        reminder_type: candidate.reminderType,
        scheduled_at: scheduledIso,
        status: "pending",
        metadata: {
          ...candidate.metadata,
          dealTitle: deal.title,
          partnerName,
          dealType: deal.deal_type,
          flashDealId: deal.id,
          redemptionId: redemption.id,
        } as Json,
      });
      existingKeys.add(key);
    }
  }

  if (inserts.length > 0) {
    const { error: insertError } = await supabase
      .from("deal_reminder_queue")
      .insert(inserts as unknown as DealReminderInsertRow[]);
    if (insertError) {
      throw new Error(`Failed to enqueue reminders: ${insertError.message}`);
    }
  }

  return {
    processed: redemptions.length,
    created: inserts.length,
    skipped,
    timestamp,
  };
}

export async function listDueDealReminders(options: {
  now?: Date;
  limit?: number;
} = {}): Promise<DealReminderSummary[]> {
  const now = options.now ?? new Date();
  const limit = Math.max(1, Math.min(options.limit ?? 50, 500));
  const supabase = getSupabaseAdminTyped();

  const { data, error } = await supabase
    .from("deal_reminder_queue")
    .select(
      "id, deal_id, qr_id, user_email, reminder_type, scheduled_at, status, metadata, flash_deals:deal_id (id, title, slug, partner_id)"
    )
    .eq("status", "pending")
    .lte("scheduled_at", now.toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list due reminders: ${error.message}`);
  }

  const partnerIds = new Set<string>();
  for (const row of data ?? []) {
    const deal = (row as unknown as { flash_deals?: { partner_id?: string | null } }).flash_deals;
    if (deal?.partner_id) partnerIds.add(deal.partner_id);
  }

  const partnerNames = await fetchPartnerDisplayNames(Array.from(partnerIds));

  return (data ?? []).map((row) => {
    const dealInfo = (row as unknown as {
      flash_deals?: { id: string; title: string; slug: string | null; partner_id: string | null };
    }).flash_deals;
    const metadata = (row.metadata as Record<string, unknown> | null) ?? {};
    const partnerId = dealInfo?.partner_id ?? "";
    return {
      id: row.id,
      dealId: row.deal_id,
      qrId: row.qr_id ?? null,
      userEmail: row.user_email ?? null,
      reminderType: row.reminder_type,
      scheduledAt: row.scheduled_at,
      status: row.status,
      metadata,
      deal: {
        title: dealInfo?.title ?? "",
        slug: dealInfo?.slug ?? null,
        partnerId,
        partnerName: partnerNames[normalizePartnerId(partnerId)] ?? null,
      },
    };
  });
}

export async function updateDealReminderStatuses(entries: Array<{
  id: string;
  status: "sent" | "failed";
  metadata?: Record<string, unknown>;
}>, attemptedAt: Date = new Date()) {
  if (entries.length === 0) {
    return { updated: 0 };
  }
  const supabase = getSupabaseAdminTyped();
  const ids = entries.map((entry) => entry.id);

  const { data, error } = await supabase
    .from("deal_reminder_queue")
    .select("id, metadata")
    .in("id", ids);

  if (error) {
    throw new Error(`Failed to load reminder metadata: ${error.message}`);
  }

  const existingMeta = new Map<string, Record<string, unknown>>();
  for (const row of data ?? []) {
    existingMeta.set(
      row.id,
      ((row.metadata as Record<string, unknown> | null) ?? {}) as Record<
        string,
        unknown
      >,
    );
  }

  const updates = entries.map((entry) => {
    const mergedMetadata = {
      ...(existingMeta.get(entry.id) ?? {}),
      ...(entry.metadata ?? {}),
      lastStatus: entry.status,
    };
    return {
      id: entry.id,
      status: entry.status,
      last_attempt_at: attemptedAt.toISOString(),
      metadata: mergedMetadata as Json,
    };
  });

  const { error: updateError } = await supabase
    .from("deal_reminder_queue")
    .upsert(updates as unknown as DealReminderInsertRow[], {
      onConflict: "id",
    });

  if (updateError) {
    throw new Error(`Failed to update reminder statuses: ${updateError.message}`);
  }

  return { updated: updates.length };
}

export async function getFlashDealUsage(
  flashDealId: string
): Promise<FlashDealUsage> {
  const supabase = getSupabaseAdminTyped();
  const usage: FlashDealUsage = {
    total: 0,
    pending: 0,
    used: 0,
    rejected: 0,
    expired: 0,
  };

  for (const status of ["pending", "used", "rejected", "expired"] as const) {
    const { count, error } = await supabase
      .from("flash_deal_redemptions")
      .select("id", { head: true, count: "exact" })
      .eq("flash_deal_id", flashDealId)
      .eq("status", status);
    if (error) {
      if ((error as { code?: string }).code === "42P01") {
        // Table not deployed yet; treat as empty usage.
        return flashDealUsageSchema.parse(usage);
      }
      throw new Error(`Failed to load flash deal usage: ${error.message}`);
    }
    const value = count ?? 0;
    usage.total += value;
    usage[status] = value;
  }

  return flashDealUsageSchema.parse(usage);
}

function normaliseStatus(value: string) {
  const normalised = value.toLowerCase();
  if (["pending", "used", "rejected", "expired"].includes(normalised)) {
    return normalised;
  }
  return value;
}

export async function getFlashDealAnalytics(
  flashDealId: string,
  options: { days?: number; limit?: number } = {}
): Promise<FlashDealAnalytics> {
  const supabase = getSupabaseAdminTyped();
  const days = Math.min(Math.max(options.days ?? 30, 1), 90);
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 200);

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const fromStart = new Date(now);
  fromStart.setDate(fromStart.getDate() - (days - 1));
  const fromIso = fromStart.toISOString();

  const redemptionsQuery = supabase
    .from("flash_deal_redemptions")
    .select(
      "id, flash_deal_id, visit_id, status, metadata, created_at, updated_at"
    )
    .eq("flash_deal_id", flashDealId)
    .gte("created_at", fromIso)
    .order("created_at", { ascending: false })
    .limit(Math.max(limit * 3, days * 4));

  const [redemptionsResult, usage, qrEvents] = await Promise.all([
    redemptionsQuery,
    getFlashDealUsage(flashDealId),
    listQrEvents({
      flashDealId,
      from: fromIso,
      limit: Math.max(limit * 3, days * 4),
    }),
  ]);

  if (redemptionsResult.error) {
    if ((redemptionsResult.error as { code?: string }).code === "42P01") {
      return {
        usage,
        redemptions: [],
        qrSummary: {
          generated: 0,
          scanned: 0,
          redeemed: 0,
          expired: 0,
          rejected: 0,
          total: 0,
        },
        qrEvents: [],
        timeline: [],
      };
    }
    throw new Error(
      `Failed to load flash deal redemptions: ${redemptionsResult.error.message}`
    );
  }

  const redemptionRowsRaw = redemptionsResult.data ?? [];
  const redemptionRows: FlashDealRedemptionRow[] = redemptionRowsRaw
    .map((row) => flashDealRedemptionRowSchema.safeParse(row))
    .flatMap((result) => {
      if (result.success) return [result.data];
      log.warn?.("flash_deal_redemption_parse_error", {
        flashDealId,
        issues: result.error.flatten?.() ?? result.error,
      });
      return [];
    });

  const redemptions: FlashDealRedemptionDetail[] = redemptionRows
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      status: normaliseStatus(row.status),
      visitId: row.visit_id,
      createdAt: row.created_at,
      metadata: row.metadata ?? {},
    }));

  const qrSummary: Record<QrEventType, number> & { total: number } = {
    generated: 0,
    scanned: 0,
    redeemed: 0,
    expired: 0,
    rejected: 0,
    total: 0,
  };

  for (const event of qrEvents) {
    const type = qrSummary.hasOwnProperty(event.event_type)
      ? event.event_type
      : "generated";
    qrSummary[type as QrEventType] += 1;
    qrSummary.total += 1;
  }

  const qrEventsEnriched: FlashDealQrEventDetail[] = qrEvents
    .slice(0, limit)
    .map((event) => ({
      id: event.id,
      eventType: event.event_type,
      qrType: event.qr_type,
      occurredAt: event.occurred_at,
      source: event.source,
      visitId: event.visit_id,
      metadata: event.metadata ?? {},
    }));

  const timelineBuckets = new Map<
    string,
    {
      redemptions: number;
      qrGenerated: number;
      qrScans: number;
      qrRedeemed: number;
      qrExpired: number;
    }
  >();

  const toDayKey = (iso: string | null | undefined) => {
    if (!iso) return null;
    return iso.slice(0, 10);
  };

  for (let i = 0; i < days; i += 1) {
    const day = new Date(fromStart);
    day.setDate(fromStart.getDate() + i);
    const key = day.toISOString().slice(0, 10);
    timelineBuckets.set(key, {
      redemptions: 0,
      qrGenerated: 0,
      qrScans: 0,
      qrRedeemed: 0,
      qrExpired: 0,
    });
  }

  for (const row of redemptionRows) {
    const key = toDayKey(row.created_at);
    if (!key) continue;
    const bucket = timelineBuckets.get(key);
    if (bucket) {
      bucket.redemptions += 1;
    }
  }

  for (const event of qrEvents) {
    const key = toDayKey(event.occurred_at);
    if (!key) continue;
    const bucket = timelineBuckets.get(key);
    if (!bucket) continue;
    if (event.event_type === "generated") bucket.qrGenerated += 1;
    else if (event.event_type === "scanned") bucket.qrScans += 1;
    else if (event.event_type === "redeemed") bucket.qrRedeemed += 1;
    else if (event.event_type === "expired") bucket.qrExpired += 1;
  }

  const timeline: FlashDealTimelinePoint[] = Array.from(
    timelineBuckets.entries()
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, entry]) => ({
      date,
      redemptions: entry.redemptions,
      qrGenerated: entry.qrGenerated,
      qrScans: entry.qrScans,
      qrRedeemed: entry.qrRedeemed,
      qrExpired: entry.qrExpired,
    }));

  return {
    usage,
    redemptions,
    qrEvents: qrEventsEnriched,
    qrSummary,
    timeline,
  };
}
