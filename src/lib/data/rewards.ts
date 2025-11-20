import { z } from "zod";
import { getSupabaseAdmin } from "../supabase-admin";
import {
  ensureGlobalValueExists,
  ensureGlobalValuesExist,
} from "./global-values";
import {
  getPartnerFormById,
  updatePartnerForm,
  type PartnerFormConfig,
} from "./partner-forms";

export const rewardCategorySchema = z
  .string()
  .trim()
  .min(1)
  .max(120);

export const rewardStatusSchema = z.enum(["active", "inactive"]);

const baseRewardSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  pointsCost: z.coerce.number().int().nonnegative().default(0),
  category: rewardCategorySchema,
  availableFor: z.array(z.string()).optional(),
  stock: z
    .union([z.coerce.number().int().nonnegative(), z.null()])
    .optional(),
  imageUrl: z.string().optional(),
  redemptionInstructions: z.string().optional(),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
  status: rewardStatusSchema.optional(),
  ticketType: z.string().optional(),
  transportIncluded: z.boolean().default(false),
  isAvailable: z.boolean().default(true),
  showAvailabilityDate: z.boolean().default(false),
  stockWindowDays: z
    .union([z.coerce.number().int().min(1), z.null()])
    .optional(),
  monthlyRedemptionLimit: z.coerce
    .number()
    .int()
    .nonnegative()
    .nullable()
    .optional(),
  dailyRedemptionLimit: z.coerce
    .number()
    .int()
    .nonnegative()
    .nullable()
    .optional(),
});

export const rewardAgeGroupSchema = z.enum([
  "child",
  "teen",
  "adult",
  "family",
]);

export const createRewardSchema = baseRewardSchema.extend({
  ageGroups: z.array(rewardAgeGroupSchema).optional(),
  tags: z.array(z.string()).optional(),
  savingsValue: z.coerce.number().nonnegative().optional(),
  heroImages: z.array(z.string()).optional(),
  partnerLogoUrl: z.string().optional(),
  redemptionFormId: z.string().optional(), // Optional now - each partner must have their own form
});

export const updateRewardSchema = createRewardSchema.partial();

export type CreateRewardInput = z.infer<typeof createRewardSchema>;
export type UpdateRewardInput = z.infer<typeof updateRewardSchema>;

export interface RewardRecord {
  id: string;
  name: string;
  description: string;
  pointsCost: number;
  category: z.infer<typeof rewardCategorySchema>;
  availableFor: string[];
  ageGroups: Array<z.infer<typeof rewardAgeGroupSchema>>;
  tags: string[];
  stock: number | null;
  imageUrl: string | null;
  heroImages: string[];
  partnerLogoUrl: string | null;
  redemptionInstructions: string | null;
  savingsValue: number;
  validFrom: string | null;
  validUntil: string | null;
  stockWindowDays: number | null;
  monthlyRedemptionLimit: number | null;
  status: z.infer<typeof rewardStatusSchema>;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  redemptionFormId: string | null;
  ticketType: string | null;
  transportIncluded: boolean;
  isAvailable: boolean;
  showAvailabilityDate: boolean;
  ticketPoints: TicketPointsEntry[];
  partnerConfigs: Map<string, RewardPartnerConfig>;
  dailyRedemptionLimit: number | null;
}

export type RewardPartnerTicket = {
  key: string;
  label: string;
  points: number;
  inclusions?: {
    adults?: number | null;
    children?: number | null;
    teens?: number | null;
  };
};

export type RewardPartnerConfig = {
  formId: string | null;
  tickets: RewardPartnerTicket[];
};

export interface RewardStatistics {
  totalRewards: number;
  activeRewards: number;
  categories: string[];
  totalStock: number;
}

export interface RewardDetailStatistics {
  redemptions: number;
  totalPointsSpent: number;
}

interface RewardRow {
  id: string;
  name: string;
  description: string | null;
  points_cost: number;
  category: string;
  stock: number | null;
  image_url: string | null;
  redemption_instructions: string | null;
  valid_from: string | null;
  valid_until: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  redemption_form_id: string | null;
  age_groups?: string[] | null;
  tags?: string[] | null;
  savings_value?: number | null;
  hero_images?: string[] | null;
  partner_logo_url?: string | null;
  ticket_type?: string | null;
  transport_included?: boolean | null;
  is_available?: boolean | null;
  show_availability_date?: boolean | null;
  ticket_points?: TicketPointsEntry[] | null;
  monthly_redemption_limit?: number | null;
  stock_window_days?: number | null;
  daily_redemption_limit?: number | null;
}

interface RewardPartnerRow {
  reward_id: string;
  partner_id: string;
  form_id?: string | null;
  ticket_points?: RewardPartnerTicket[] | null;
}

interface TicketPointsEntry {
  value: string;
  label: string;
  points: number;
}

type PartnerConfigCollection =
  | Map<string, RewardPartnerConfig>
  | Record<string, RewardPartnerConfig>
  | undefined;

function parseInclusionValue(value: unknown) {
  if (value === null) return null;
  if (value === undefined) return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function normalizePartnerTicket(input: unknown): RewardPartnerTicket | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const key =
    typeof raw.key === "string" && raw.key.trim().length > 0
      ? raw.key.trim()
      : "";
  if (!key) return null;
  const points = Number(raw.points);
  if (!Number.isFinite(points) || points <= 0) return null;
  const label =
    typeof raw.label === "string" && raw.label.trim().length > 0
      ? raw.label.trim()
      : key;
  const inclusionsRaw = raw.inclusions;
  let inclusions: RewardPartnerTicket["inclusions"] | undefined;
  if (inclusionsRaw && typeof inclusionsRaw === "object") {
    const record = inclusionsRaw as Record<string, unknown>;
    const normalized: RewardPartnerTicket["inclusions"] = {};
    const adults = parseInclusionValue(record.adults);
    const children = parseInclusionValue(record.children);
    const teens = parseInclusionValue(record.teens);
    if (adults !== undefined) normalized.adults = adults;
    if (children !== undefined) normalized.children = children;
    if (teens !== undefined) normalized.teens = teens;
    if (
      normalized.adults !== undefined ||
      normalized.children !== undefined ||
      normalized.teens !== undefined
    ) {
      inclusions = normalized;
    }
  }
  return { key, label, points, inclusions };
}

function buildPartnerConfigMap(
  partnerIds: string[],
  collection: PartnerConfigCollection
) {
  const normalized = new Map<string, RewardPartnerConfig>();
  const upsert = (partnerId: string, config?: RewardPartnerConfig | null) => {
    const tickets = Array.isArray(config?.tickets)
      ? config.tickets
          .map((ticket) => normalizePartnerTicket(ticket))
          .filter(
            (ticket): ticket is RewardPartnerTicket => ticket !== null
          )
      : [];
    normalized.set(partnerId, {
      formId: config?.formId ?? null,
      tickets,
    });
  };

  partnerIds.forEach((partnerId) => {
    if (!partnerId || normalized.has(partnerId)) return;
    upsert(partnerId, null);
  });

  if (collection) {
    const entries =
      collection instanceof Map
        ? Array.from(collection.entries())
        : Object.entries(collection);
    entries.forEach(([partnerId, config]) => {
      if (!partnerId) return;
      upsert(partnerId, config);
    });
  }

  return normalized.size > 0 ? normalized : undefined;
}

function computeDisplayedPointsCost(
  fallback: number | null | undefined,
  configs?: Map<string, RewardPartnerConfig>
) {
  if (configs && configs.size > 0) {
    const points = Array.from(configs.values())
      .flatMap((config) =>
        Array.isArray(config.tickets)
          ? config.tickets
              .map((ticket) =>
                typeof ticket.points === "number" ? ticket.points : null
              )
              .filter(
                (value): value is number =>
                  value !== null && value !== undefined && value >= 0
              )
          : []
      )
      .filter((value): value is number => Number.isFinite(value));
    if (points.length > 0) {
      return Math.min(...points);
    }
  }
  if (typeof fallback === "number" && Number.isFinite(fallback)) {
    return fallback;
  }
  return 0;
}

function sanitizePartnerIds(values?: string[]) {
  if (!values) return [] as string[];
  const sanitized = values
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
  return Array.from(new Set(sanitized));
}

function normalizeCategoryValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Category is required");
  }
  return trimmed;
}

function normalizeTicketTypeValue(value: string) {
  const trimmed = value.trim();
  return trimmed || "";
}

function normalizeTagKeys(values?: string[]) {
  if (!values) return [] as string[];
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );
}

function parseValidUntil(value?: string) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const timestamp = new Date(trimmed);
  if (Number.isNaN(timestamp.getTime())) {
    return null;
  }
  return timestamp.toISOString();
}

function parseValidFrom(value?: string) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const timestamp = new Date(trimmed);
  if (Number.isNaN(timestamp.getTime())) {
    return null;
  }
  return timestamp.toISOString();
}

function mapRow(row: RewardRow, partners: string[]): RewardRecord {
  const parsedStatus = rewardStatusSchema.safeParse(row.status);
  const dynamicRow = row as unknown as Record<string, unknown>;
  const ageGroupsRaw = Array.isArray(dynamicRow.age_groups)
    ? (dynamicRow.age_groups as string[])
    : [];
  const tagsRaw = Array.isArray(dynamicRow.tags)
    ? (dynamicRow.tags as string[])
    : [];
  const heroImagesRaw = Array.isArray(dynamicRow.hero_images)
    ? (dynamicRow.hero_images as string[])
    : [];
  const savingsValueRaw = dynamicRow.savings_value;
  const ticketTypeRaw = dynamicRow.ticket_type;
  const transportIncludedRaw = dynamicRow.transport_included;
  const isAvailableRaw = dynamicRow.is_available;
  const showAvailabilityDateRaw = dynamicRow.show_availability_date;
  const ticketPointsRaw = dynamicRow.ticket_points;
  const stockWindowDaysRaw = dynamicRow.stock_window_days;
  const dailyLimitRaw = dynamicRow.daily_redemption_limit;
  const monthlyLimitRaw = dynamicRow.monthly_redemption_limit;

  // Parse ticket points
  let ticketPoints: TicketPointsEntry[] = [];
  if (Array.isArray(ticketPointsRaw)) {
    ticketPoints = ticketPointsRaw
      .map((entry) => {
        if (
          typeof entry === "object" &&
          entry !== null &&
          "value" in entry &&
          "label" in entry &&
          "points" in entry
        ) {
          const value = String(entry.value ?? "");
          const label = String(entry.label ?? "");
          const points = Number(entry.points ?? 0);
          if (value && label && Number.isFinite(points) && points >= 1) {
            return { value, label, points };
          }
        }
        return null;
      })
      .filter((entry): entry is TicketPointsEntry => entry !== null);
  }

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    pointsCost: row.points_cost,
    category:
      typeof row.category === "string" && row.category.trim()
        ? row.category.trim()
        : "uncategorized",
    availableFor: partners,
    ageGroups: ageGroupsRaw
      .map((entry) => {
        const parsed = rewardAgeGroupSchema.safeParse(entry);
        return parsed.success ? parsed.data : null;
      })
      .filter((value): value is z.infer<typeof rewardAgeGroupSchema> =>
        Boolean(value)
      ),
    tags: normalizeTagKeys(tagsRaw),
    stock: row.stock,
    imageUrl: row.image_url,
    heroImages: heroImagesRaw.filter(Boolean),
    partnerLogoUrl: (dynamicRow.partner_logo_url as string | null) ?? null,
    redemptionInstructions: row.redemption_instructions,
    savingsValue:
      typeof savingsValueRaw === "number"
        ? savingsValueRaw
        : Number(savingsValueRaw ?? 0) || 0,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    status: parsedStatus.success ? parsedStatus.data : "active",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    redemptionFormId: row.redemption_form_id,
    ticketType:
      typeof ticketTypeRaw === "string" && ticketTypeRaw.trim().length > 0
        ? ticketTypeRaw.trim()
        : "general",
    transportIncluded: Boolean(transportIncludedRaw),
    isAvailable: isAvailableRaw !== false,
    showAvailabilityDate: Boolean(showAvailabilityDateRaw),
    stockWindowDays:
      typeof stockWindowDaysRaw === "number" && stockWindowDaysRaw > 0
        ? stockWindowDaysRaw
        : null,
    dailyRedemptionLimit:
      typeof dailyLimitRaw === "number" && dailyLimitRaw >= 0
        ? dailyLimitRaw
        : null,
    monthlyRedemptionLimit:
      typeof monthlyLimitRaw === "number" && monthlyLimitRaw >= 0
        ? monthlyLimitRaw
        : null,
    ticketPoints,
    partnerConfigs: new Map(), // Will be populated by fetchPartnerVisibility
  };
}

async function fetchPartnerVisibility(
  rewardIds: string[]
): Promise<{
  partnerMap: Map<string, string[]>;
  configMap: Map<string, Map<string, RewardPartnerConfig>>;
}> {
  if (rewardIds.length === 0) {
    return {
      partnerMap: new Map(),
      configMap: new Map(),
    };
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("reward_partner_visibility")
    .select("reward_id, partner_id, form_id, points_cost, ticket_points")
    .in("reward_id", rewardIds);

  if (error) {
    throw new Error(`Failed to load reward visibility: ${error.message}`);
  }

  const rows = (data ?? []) as RewardPartnerRow[];
  const partnerMap = new Map<string, string[]>();
  const configMap = new Map<string, Map<string, RewardPartnerConfig>>();

  for (const row of rows) {
    // Build partner list map
    const partnerList = partnerMap.get(row.reward_id) ?? [];
    if (!partnerList.includes(row.partner_id)) {
      partnerList.push(row.partner_id);
      partnerMap.set(row.reward_id, partnerList);
    }

    // Build config map
    let rewardConfigs = configMap.get(row.reward_id);
    if (!rewardConfigs) {
      rewardConfigs = new Map();
      configMap.set(row.reward_id, rewardConfigs);
    }
    const tickets = Array.isArray(row.ticket_points)
      ? (row.ticket_points as unknown[])
          .map((entry) => normalizePartnerTicket(entry))
          .filter(
            (entry): entry is RewardPartnerTicket => entry !== null
          )
      : [];
    rewardConfigs.set(row.partner_id, {
      formId: row.form_id ?? null,
      tickets,
    });
  }

  return { partnerMap, configMap };
}

async function syncRewardPartners(
  rewardId: string,
  partnerConfigs?: Map<string, RewardPartnerConfig>
) {
  const supabase = getSupabaseAdmin();

  const { error: deleteError } = await supabase
    .from("reward_partner_visibility")
    .delete()
    .eq("reward_id", rewardId);
  if (deleteError) {
    throw new Error(
      `Failed to clear reward visibility: ${deleteError.message}`
    );
  }

  if (!partnerConfigs || partnerConfigs.size === 0) {
    return;
  }

  const rows: RewardPartnerRow[] = Array.from(partnerConfigs.entries()).map(
    ([partnerId, config]) => ({
      reward_id: rewardId,
      partner_id: partnerId,
      form_id: config.formId ?? null,
      points_cost: null,
      ticket_points: Array.isArray(config.tickets)
        ? config.tickets.map((ticket) => ({
            key: ticket.key,
            label: ticket.label,
            points: ticket.points,
            inclusions: ticket.inclusions ?? undefined,
          }))
        : [],
    })
  );
  const { error: insertError } = await supabase
    .from("reward_partner_visibility")
    .upsert(
      rows as unknown as never,
      {
        onConflict: "reward_id,partner_id",
        ignoreDuplicates: false,
      } as unknown as never
    );
  if (insertError) {
    throw new Error(`Failed to save reward visibility: ${insertError.message}`);
  }
}

async function overwritePartnerFormPricing(
  partnerId: string,
  formId: string,
  tickets: RewardPartnerTicket[],
  basePoints: number
) {
  if (!tickets || tickets.length === 0) {
    return;
  }
  const form = await getPartnerFormById(formId);
  if (!form || form.partnerId !== partnerId) return;

  const pricingBundles = tickets.map((ticket) => ({
    id: ticket.key,
    sourceId: ticket.key,
    ticketType: ticket.key,
    label: ticket.label,
    price: null,
    discountedPrice: null,
    maxGuests: null,
    inclusions: ticket.inclusions ?? undefined,
    description: `${ticket.points} pts`,
  }));

  const pricingStep = {
    id: form.config.steps[0]?.id ?? "pricing-override",
    title: "Pricing",
    subtitle: "Select ticket type",
    description: "Ticket types are managed in reward settings.",
    nextLabel: "Continue",
    previousLabel: "",
    fields: [],
    variant: "pricing" as const,
    pricing: {
      currency: "CZK",
      allowCustomTotals: true,
      bundles: pricingBundles,
      addons: [],
    },
    logic: { behavior: "show", conditions: [] },
  } satisfies PartnerFormConfig["steps"][number];

  const updatedConfig: PartnerFormConfig = {
    ...form.config,
    steps: [pricingStep, ...form.config.steps.slice(1)],
    summary: {
      ...form.config.summary,
      pointsLabel: "Estimated points",
    },
  };

  await updatePartnerForm(formId, {
    config: updatedConfig,
    // Leave updatedBy undefined to avoid email validation issues
  });
}

async function computeRewardDetailStatistics(
  rewardId: string
): Promise<RewardDetailStatistics> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("points_history")
    .select("points, meta")
    .eq("type", "redemption")
    .eq("meta->>rewardId", rewardId);

  if (error) {
    throw new Error(`Failed to load reward statistics: ${error.message}`);
  }

  type PointsEntry = {
    points: number | string | null;
    meta: Record<string, unknown> | null;
  };
  const entries: PointsEntry[] = data ?? [];
  let redemptions = 0;
  let totalPointsSpent = 0;
  for (const entry of entries) {
    redemptions += 1;
    const points = Number(entry.points) || 0;
    totalPointsSpent += points;
  }

  return { redemptions, totalPointsSpent };
}

export async function listRewards() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("rewards")
    .select("*")
    .order("points_cost", { ascending: true });

  if (error) {
    throw new Error(`Failed to list rewards: ${error.message}`);
  }

  const rows = (data ?? []) as RewardRow[];
  const rewardIds = rows.map((row) => row.id);
  const { configMap } = await fetchPartnerVisibility(rewardIds);
  const rewards = rows.map((row) => {
    const partnerConfigs = configMap.get(row.id) ?? new Map();
    const reward = mapRow(row, Array.from(partnerConfigs.keys()));
    reward.partnerConfigs = partnerConfigs;
    reward.pointsCost = computeDisplayedPointsCost(
      reward.pointsCost,
      partnerConfigs
    );
    return reward;
  });

  const statistics: RewardStatistics = {
    totalRewards: rewards.length,
    activeRewards: rewards.filter((reward) => reward.status === "active")
      .length,
    categories: Array.from(
      new Set(rewards.map((reward) => reward.category))
    ).sort(),
    totalStock: rewards.reduce((sum, reward) => sum + (reward.stock ?? 0), 0),
  };

  return { rewards, statistics };
}

export async function getRewardById(rewardId: string) {
  const normalized = rewardId.trim();
  if (!normalized) {
    throw new Error("rewardId is required");
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("rewards")
    .select("*")
    .eq("id", normalized)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load reward: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const row = data as RewardRow;
  const { configMap } = await fetchPartnerVisibility([row.id]);
  const partnerConfigs = configMap.get(row.id) ?? new Map();
  const reward = mapRow(row, Array.from(partnerConfigs.keys()));
  reward.partnerConfigs = partnerConfigs;
  const statistics = await computeRewardDetailStatistics(row.id);
  reward.pointsCost = computeDisplayedPointsCost(
    reward.pointsCost,
    partnerConfigs
  );
  return { reward, statistics };
}

export async function createReward(
  input: CreateRewardInput & { 
    id?: string;
    partnerConfigs?: Map<string, RewardPartnerConfig> | Record<string, RewardPartnerConfig>;
  }
) {
  const payload = createRewardSchema.parse(input);
  const supabase = getSupabaseAdmin();
  const id = (
    input.id ?? `reward-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  ).trim();
  const partnerIds = sanitizePartnerIds(
    Array.isArray(payload.availableFor) ? payload.availableFor : []
  );
  const normalizedStock =
    payload.stock === null || payload.stock === undefined
      ? null
      : payload.stock;
  const normalizedStockWindow =
    normalizedStock !== null &&
    payload.stockWindowDays !== undefined &&
    payload.stockWindowDays !== null
      ? payload.stockWindowDays
      : null;
  const validFrom = parseValidFrom(payload.validFrom);
  const validUntil = parseValidUntil(payload.validUntil);
  const nowIso = new Date().toISOString();
  const categoryKey = normalizeCategoryValue(payload.category);
  await ensureGlobalValueExists("category", categoryKey);
  const ticketTypeKey = payload.ticketType
    ? normalizeTicketTypeValue(payload.ticketType)
    : "general"; // Default ticket type when not specified
  if (ticketTypeKey) {
    await ensureGlobalValueExists("ticket_type", ticketTypeKey);
  }
  const tagKeys = normalizeTagKeys(payload.tags);
  if (tagKeys.length > 0) {
    await ensureGlobalValuesExist("tag", tagKeys);
  }

  const partnerConfigs = buildPartnerConfigMap(
    partnerIds,
    input.partnerConfigs
  );
  const computedPointsCost = computeDisplayedPointsCost(
    payload.pointsCost ?? 0,
    partnerConfigs
  );

  const insertPayload: Partial<RewardRow> & { id: string } = {
    id,
    name: payload.name,
    description: payload.description ?? "",
    points_cost: computedPointsCost,
    category: categoryKey,
    stock: normalizedStock,
    image_url: payload.imageUrl?.trim() || null,
    redemption_instructions: payload.redemptionInstructions?.trim() || null,
    valid_from: validFrom,
    valid_until: validUntil,
    status: payload.status ?? "active",
    created_at: nowIso,
    updated_at: nowIso,
    deleted_at: null,
    redemption_form_id: payload.redemptionFormId?.trim() || null,
    age_groups: payload.ageGroups ?? [],
    tags: tagKeys,
    savings_value: payload.savingsValue ?? 0,
    hero_images:
      payload.heroImages?.map((img) => img.trim()).filter(Boolean) ?? [],
    partner_logo_url: payload.partnerLogoUrl?.trim() || null,
    ticket_type: ticketTypeKey,
    transport_included: Boolean(payload.transportIncluded),
    is_available:
      payload.isAvailable === undefined ? true : Boolean(payload.isAvailable),
    show_availability_date: Boolean(payload.showAvailabilityDate),
    ticket_points: null,
    monthly_redemption_limit:
      typeof payload.monthlyRedemptionLimit === "number"
        ? payload.monthlyRedemptionLimit
        : null,
    stock_window_days:
      normalizedStock !== null ? normalizedStockWindow : null,
    daily_redemption_limit:
      typeof payload.dailyRedemptionLimit === "number"
        ? payload.dailyRedemptionLimit
        : null,
  };

  const { data, error } = await supabase
    .from("rewards")
    .insert(insertPayload as unknown as never)
    .select()
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create reward: ${error?.message ?? "unknown error"}`
    );
  }

  await syncRewardPartners(id, partnerConfigs);

  if (partnerConfigs && partnerConfigs.size > 0) {
    for (const [partnerId, config] of partnerConfigs.entries()) {
      if (config.formId) {
        await overwritePartnerFormPricing(
          partnerId,
          config.formId,
          config.tickets ?? [],
          computedPointsCost || 0
        );
      }
    }
  }

  const { configMap } = await fetchPartnerVisibility([id]);
  const finalPartnerConfigs = configMap.get(id) ?? partnerConfigs ?? new Map();
  const reward = mapRow(data as RewardRow, Array.from(finalPartnerConfigs.keys()));
  reward.partnerConfigs = finalPartnerConfigs;
  reward.pointsCost = computeDisplayedPointsCost(
    reward.pointsCost,
    finalPartnerConfigs
  );
  return reward;
}

export async function updateReward(
  rewardId: string,
  input: UpdateRewardInput & {
    partnerConfigs?: Map<string, RewardPartnerConfig> | Record<string, RewardPartnerConfig>;
  }
) {
  const normalized = rewardId.trim();
  if (!normalized) {
    throw new Error("rewardId is required");
  }

  const payload = updateRewardSchema.parse(input);
  const supabase = getSupabaseAdmin();
  const updatePayload: Partial<RewardRow> = {
    updated_at: new Date().toISOString(),
  };

  const rawPartnerConfigs = (input as {
    partnerConfigs?: PartnerConfigCollection;
  }).partnerConfigs;
  const availableForProvided = payload.availableFor !== undefined;
  const sanitizedAvailableFor = availableForProvided
    ? sanitizePartnerIds(payload.availableFor ?? [])
    : [];
  const partnerConfigs = buildPartnerConfigMap(
    availableForProvided ? sanitizedAvailableFor : [],
    rawPartnerConfigs
  );
  let computedPointsCost: number | undefined;
  if (partnerConfigs || payload.pointsCost !== undefined) {
    computedPointsCost = computeDisplayedPointsCost(
      payload.pointsCost ?? 0,
      partnerConfigs
    );
    updatePayload.points_cost = computedPointsCost;
  }

  let categoryKey: string | undefined;
  let ticketTypeKey: string | null | undefined;
  let tagKeys: string[] | undefined;

  if (payload.category !== undefined) {
    categoryKey = normalizeCategoryValue(payload.category);
    await ensureGlobalValueExists("category", categoryKey);
  }
  if (payload.tags !== undefined) {
    tagKeys = normalizeTagKeys(payload.tags);
    if (tagKeys.length > 0) {
      await ensureGlobalValuesExist("tag", tagKeys);
    }
  }
  if (payload.ticketType !== undefined) {
    ticketTypeKey = payload.ticketType
      ? normalizeTicketTypeValue(payload.ticketType)
      : null;
    if (ticketTypeKey) {
      await ensureGlobalValueExists("ticket_type", ticketTypeKey);
    }
  }

  if (payload.name !== undefined) updatePayload.name = payload.name;
  if (payload.description !== undefined)
    updatePayload.description = payload.description ?? "";
  if (payload.pointsCost !== undefined)
    updatePayload.points_cost = computedPointsCost ?? payload.pointsCost;
  if (payload.category !== undefined) updatePayload.category = categoryKey!;
  const incomingStock =
    payload.stock !== undefined ? payload.stock ?? null : undefined;
  const incomingStockWindow =
    payload.stockWindowDays !== undefined
      ? payload.stockWindowDays ?? null
      : undefined;
  if (incomingStock !== undefined) {
    updatePayload.stock = incomingStock;
    updatePayload.stock_window_days =
      incomingStock !== null ? incomingStockWindow ?? null : null;
  } else if (incomingStockWindow !== undefined) {
    updatePayload.stock_window_days = incomingStockWindow ?? null;
  }
  if (payload.imageUrl !== undefined)
    updatePayload.image_url = payload.imageUrl?.trim() || null;
  if (payload.heroImages !== undefined)
    updatePayload.hero_images =
      payload.heroImages?.map((img) => img.trim()).filter(Boolean) ?? [];
  if (payload.partnerLogoUrl !== undefined)
    updatePayload.partner_logo_url = payload.partnerLogoUrl?.trim() || null;
  if (payload.redemptionInstructions !== undefined) {
    updatePayload.redemption_instructions =
      payload.redemptionInstructions?.trim() || null;
  }
  if (payload.validFrom !== undefined) {
    updatePayload.valid_from = parseValidFrom(payload.validFrom);
  }
  if (payload.validUntil !== undefined) {
    updatePayload.valid_until = parseValidUntil(payload.validUntil);
  }
  if (payload.status !== undefined) {
    updatePayload.status = payload.status;
  }
  if (payload.redemptionFormId !== undefined) {
    updatePayload.redemption_form_id = payload.redemptionFormId?.trim() || null;
  }
  if (payload.ageGroups !== undefined) {
    updatePayload.age_groups = payload.ageGroups ?? [];
  }
  if (payload.tags !== undefined) {
    updatePayload.tags = tagKeys ?? [];
  }
  if (payload.savingsValue !== undefined) {
    updatePayload.savings_value = payload.savingsValue ?? 0;
  }
  if (payload.ticketType !== undefined) {
    updatePayload.ticket_type = ticketTypeKey ?? null;
  }
  if (payload.transportIncluded !== undefined) {
    updatePayload.transport_included = Boolean(payload.transportIncluded);
  }
  if (payload.isAvailable !== undefined) {
    updatePayload.is_available = Boolean(payload.isAvailable);
  }
  if (payload.showAvailabilityDate !== undefined) {
    updatePayload.show_availability_date = Boolean(payload.showAvailabilityDate);
  }
  if (payload.dailyRedemptionLimit !== undefined) {
    updatePayload.daily_redemption_limit =
      payload.dailyRedemptionLimit ?? null;
  }
  if (payload.monthlyRedemptionLimit !== undefined) {
    updatePayload.monthly_redemption_limit =
      payload.monthlyRedemptionLimit ?? null;
  }
  // ticket_points are managed per-partner; legacy column left empty

  const { data, error } = await supabase
    .from("rewards")
    .update(updatePayload as unknown as never)
    .eq("id", normalized)
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update reward: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const shouldSync =
    availableForProvided || rawPartnerConfigs !== undefined;
  if (shouldSync) {
    await syncRewardPartners(normalized, partnerConfigs);
  }

  // Overwrite partner forms' first step with configured tickets
  if (partnerConfigs && partnerConfigs.size > 0 && shouldSync) {
    for (const [partnerId, config] of partnerConfigs.entries()) {
      if (config.formId) {
        await overwritePartnerFormPricing(
          partnerId,
          config.formId,
          config.tickets ?? [],
          computedPointsCost ?? payload.pointsCost ?? 0
        );
      }
    }
  }

  const { configMap } = await fetchPartnerVisibility([normalized]);
  const finalPartnerConfigs = configMap.get(normalized) ?? partnerConfigs ?? new Map();
  const reward = mapRow(data as RewardRow, Array.from(finalPartnerConfigs.keys()));
  reward.partnerConfigs = finalPartnerConfigs;
  reward.pointsCost = computeDisplayedPointsCost(
    reward.pointsCost,
    finalPartnerConfigs
  );
  return reward;
}

export async function archiveReward(rewardId: string) {
  const normalized = rewardId.trim();
  if (!normalized) {
    throw new Error("rewardId is required");
  }

  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("rewards")
    .update({
      status: "inactive",
      deleted_at: nowIso,
      updated_at: nowIso,
    } as unknown as never)
    .eq("id", normalized)
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to delete reward: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const { error: visibilityError } = await supabase
    .from("reward_partner_visibility")
    .delete()
    .eq("reward_id", normalized);
  if (visibilityError) {
    throw new Error(
      `Failed to clear reward visibility: ${visibilityError.message}`
    );
  }

  return mapRow(data as RewardRow, []);
}

export async function setRewardRedemptionForm(
  rewardId: string,
  formId: string | null
) {
  const normalizedReward = rewardId.trim();
  if (!normalizedReward) {
    throw new Error("rewardId is required to link redemption form");
  }
  const supabase = getSupabaseAdmin();

  if (formId) {
    const { error: clearError } = await supabase
      .from("rewards")
      .update({ redemption_form_id: null } as never)
      .eq("redemption_form_id", formId);
    if (clearError) {
      throw new Error(
        `Failed to clear existing reward redemption form linkage: ${clearError.message}`
      );
    }
  }

  const { error } = await supabase
    .from("rewards")
    .update({ redemption_form_id: formId } as never)
    .eq("id", normalizedReward);

  if (error) {
    throw new Error(
      `Failed to update reward redemption form: ${error.message}`
    );
  }
}
