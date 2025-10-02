import { z } from "zod";
import { getSupabaseAdmin } from "../supabase-admin";

export const rewardCategorySchema = z.enum([
  "discount",
  "freebie",
  "experience",
  "merchandise",
  "other",
]);

export const rewardStatusSchema = z.enum(["active", "inactive"]);

const baseRewardSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  pointsCost: z.coerce.number().int().min(1),
  category: rewardCategorySchema,
  availableFor: z.array(z.string()).optional(),
  stock: z.coerce.number().int().nonnegative().optional(),
  imageUrl: z.string().optional(),
  redemptionInstructions: z.string().optional(),
  validUntil: z.string().optional(),
  status: rewardStatusSchema.optional(),
});

export const createRewardSchema = baseRewardSchema;
export const updateRewardSchema = baseRewardSchema.partial();

export type CreateRewardInput = z.infer<typeof createRewardSchema>;
export type UpdateRewardInput = z.infer<typeof updateRewardSchema>;

export interface RewardRecord {
  id: string;
  name: string;
  description: string;
  pointsCost: number;
  category: z.infer<typeof rewardCategorySchema>;
  availableFor: string[];
  stock: number | null;
  imageUrl: string | null;
  redemptionInstructions: string | null;
  validUntil: string | null;
  status: z.infer<typeof rewardStatusSchema>;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

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
  valid_until: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface RewardPartnerRow {
  reward_id: string;
  partner_id: string;
}

function sanitizePartnerIds(values?: string[]) {
  if (!values) return [] as string[];
  const sanitized = values
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
  return Array.from(new Set(sanitized));
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

function mapRow(row: RewardRow, partners: string[]): RewardRecord {
  const parsedCategory = rewardCategorySchema.safeParse(row.category);
  const parsedStatus = rewardStatusSchema.safeParse(row.status);
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    pointsCost: row.points_cost,
    category: parsedCategory.success ? parsedCategory.data : "other",
    availableFor: partners,
    stock: row.stock,
    imageUrl: row.image_url,
    redemptionInstructions: row.redemption_instructions,
    validUntil: row.valid_until,
    status: parsedStatus.success ? parsedStatus.data : "active",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

async function fetchPartnerVisibility(rewardIds: string[]) {
  if (rewardIds.length === 0) {
    return new Map<string, string[]>();
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("reward_partner_visibility")
    .select("reward_id, partner_id")
    .in("reward_id", rewardIds);

  if (error) {
    throw new Error(`Failed to load reward visibility: ${error.message}`);
  }

  const rows = (data ?? []) as RewardPartnerRow[];
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const list = map.get(row.reward_id) ?? [];
    list.push(row.partner_id);
    map.set(row.reward_id, list);
  }
  return map;
}

async function syncRewardPartners(rewardId: string, partnerIds: string[]) {
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

  if (partnerIds.length === 0) {
    return;
  }

  const rows: RewardPartnerRow[] = partnerIds.map((partnerId) => ({
    reward_id: rewardId,
    partner_id: partnerId,
  }));
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
  const visibilityMap = await fetchPartnerVisibility(rows.map((row) => row.id));
  const rewards = rows.map((row) =>
    mapRow(row, visibilityMap.get(row.id) ?? [])
  );

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
  const visibilityMap = await fetchPartnerVisibility([row.id]);
  const reward = mapRow(row, visibilityMap.get(row.id) ?? []);
  const statistics = await computeRewardDetailStatistics(row.id);
  return { reward, statistics };
}

export async function createReward(input: CreateRewardInput & { id?: string }) {
  const payload = createRewardSchema.parse(input);
  const supabase = getSupabaseAdmin();
  const id = (
    input.id ?? `reward-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  ).trim();
  const partnerIds = sanitizePartnerIds(payload.availableFor);
  const validUntil = parseValidUntil(payload.validUntil);
  const nowIso = new Date().toISOString();

  const insertPayload: Partial<RewardRow> & { id: string } = {
    id,
    name: payload.name,
    description: payload.description ?? "",
    points_cost: payload.pointsCost,
    category: payload.category,
    stock: payload.stock ?? null,
    image_url: payload.imageUrl?.trim() || null,
    redemption_instructions: payload.redemptionInstructions?.trim() || null,
    valid_until: validUntil,
    status: payload.status ?? "active",
    created_at: nowIso,
    updated_at: nowIso,
    deleted_at: null,
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

  await syncRewardPartners(id, partnerIds);

  const reward = mapRow(data as RewardRow, partnerIds);
  return reward;
}

export async function updateReward(rewardId: string, input: UpdateRewardInput) {
  const normalized = rewardId.trim();
  if (!normalized) {
    throw new Error("rewardId is required");
  }

  const payload = updateRewardSchema.parse(input);
  const supabase = getSupabaseAdmin();
  const updatePayload: Partial<RewardRow> = {
    updated_at: new Date().toISOString(),
  };

  if (payload.name !== undefined) updatePayload.name = payload.name;
  if (payload.description !== undefined)
    updatePayload.description = payload.description ?? "";
  if (payload.pointsCost !== undefined)
    updatePayload.points_cost = payload.pointsCost;
  if (payload.category !== undefined) updatePayload.category = payload.category;
  if (payload.stock !== undefined) updatePayload.stock = payload.stock ?? null;
  if (payload.imageUrl !== undefined)
    updatePayload.image_url = payload.imageUrl?.trim() || null;
  if (payload.redemptionInstructions !== undefined) {
    updatePayload.redemption_instructions =
      payload.redemptionInstructions?.trim() || null;
  }
  if (payload.validUntil !== undefined) {
    updatePayload.valid_until = parseValidUntil(payload.validUntil);
  }
  if (payload.status !== undefined) {
    updatePayload.status = payload.status;
  }

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

  const partnerIds = payload.availableFor
    ? sanitizePartnerIds(payload.availableFor)
    : undefined;
  if (partnerIds) {
    await syncRewardPartners(normalized, partnerIds);
  }

  const visibilityMap = await fetchPartnerVisibility([normalized]);
  return mapRow(
    data as RewardRow,
    visibilityMap.get(normalized) ?? partnerIds ?? []
  );
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
