import { getSupabaseAdmin } from "../supabase-admin";
import { getRewardById } from "./rewards";
import { addPointsHistoryEntry } from "./points";

export type RedemptionStatus = "pending" | "applied" | "used" | "rejected";

export interface RedemptionRecord {
  id: string;
  code: string;
  email: string;
  reward_id: string;
  partner_id: string | null;
  status: RedemptionStatus;
  created_at: string;
  updated_at: string;
  applied_at: string | null;
  used_at: string | null;
  expires_at: string | null;
  applied_to_visit_id: string | null;
  metadata: Record<string, unknown>;
}

export interface RedemptionCheckRedemption {
  code: string;
  email: string;
  rewardId: string | null;
  rewardName: string | null;
  pointsCost: number | null;
  status: string;
  redeemedAt?: string;
  appliedAt?: string | null;
  usedAt?: string | null;
  expiresAt?: string | null;
  partnerId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface RedemptionCheckReward {
  name: string;
  description?: string | null;
  category?: string | null;
  pointsCost: number | null;
  instructions?: string | null;
}

export interface RedemptionCheckBooking {
  email?: string;
  visitDate?: string;
  partnerId?: string | null;
  ticketType?: string | null;
  numPeople?: number | null;
  hasVisited?: boolean;
  visitedAt?: string | null;
}

export interface RedemptionCheckResponse {
  redemption: RedemptionCheckRedemption;
  reward: RedemptionCheckReward | null;
  booking: RedemptionCheckBooking | null;
  isValid: boolean;
  canProcess: boolean;
}

export interface RedemptionActor {
  role: "partner" | "staff" | "admin" | "system";
  staffId: string | null;
  email: string | null;
  name: string | null;
  processedAt: string | null;
}

export interface RedemptionHistoryItem {
  code: string;
  email: string;
  rewardId: string;
  rewardName: string | null;
  pointsCost: number | null;
  partnerId: string | null;
  status: RedemptionStatus;
  redeemedAt: string | null;
  appliedAt: string | null;
  processedAt: string | null;
  processedBy: RedemptionActor | null;
  metadata: Record<string, unknown>;
  rewardCategory: string | null;
}

export interface RedemptionHistoryResult {
  items: RedemptionHistoryItem[];
  totals: {
    used: number;
    rejected: number;
  };
}

export interface RewardUsageResult {
  items: RedemptionHistoryItem[];
  totals: {
    used: number;
    rejected: number;
  };
}

type SupabaseRedemptionRow = {
  code: string;
  email: string;
  reward_id: string;
  partner_id: string | null;
  status: RedemptionStatus;
  created_at: string | null;
  applied_at: string | null;
  used_at: string | null;
  updated_at: string | null;
  metadata: Record<string, unknown> | null;
  reward?: {
    id: string;
    name: string | null;
    points_cost: number | null;
    category: string | null;
  } | null;
};

function generateCode() {
  const rand = Math.random().toString(36).slice(2, 9).toUpperCase();
  return `RDM-${Date.now()}-${rand}`;
}

export async function createRedemption(args: {
  email: string;
  rewardId: string;
  partnerId?: string | null;
  visitId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = getSupabaseAdmin();
  const normalizedEmail = args.email.trim().toLowerCase();
  const rewardResp = await getRewardById(args.rewardId);
  if (!rewardResp) throw new Error("Reward not found");
  const reward = rewardResp.reward;

  const code = generateCode();
  const nowIso = new Date().toISOString();

  type RedemptionInsert = {
    code: string;
    email: string;
    reward_id: string;
    partner_id: string | null;
    status: RedemptionStatus;
    created_at: string;
    updated_at: string;
    expires_at: string | null;
    metadata: Record<string, unknown>;
  };

  function resolveExpiration(): string | null {
    if (reward.validUntil) {
      const parsed = new Date(reward.validUntil);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
    const defaultTtlHours = 24 * 7; // 7 days
    const ttlHoursRaw = process.env.REDEMPTION_EXPIRES_IN_HOURS;
    const ttlHours = ttlHoursRaw ? Number(ttlHoursRaw) : defaultTtlHours;
    if (!Number.isFinite(ttlHours) || ttlHours <= 0) return null;
    const expiresDate = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
    return expiresDate.toISOString();
  }

  const expiresAt = resolveExpiration();

  const insertPayload: RedemptionInsert = {
    code,
    email: normalizedEmail,
    reward_id: reward.id,
    partner_id: args.partnerId ?? null,
    status: "pending",
    created_at: nowIso,
    updated_at: nowIso,
    expires_at: expiresAt,
    metadata: {
      email: normalizedEmail,
      rewardId: reward.id,
      rewardName: reward.name,
      partnerId: args.partnerId ?? null,
      pointsCost: reward.pointsCost,
      expiresAt,
      visitId: args.visitId ?? null,
      redemptionCode: code,
      ...((args.metadata ?? {}) as Record<string, unknown>),
    },
  };

  const { data, error } = await supabase
    .from("redemptions")
    .insert(insertPayload as unknown as never)
    .select("*")
    .single();

  if (error || !data)
    throw new Error(
      `Failed to create redemption: ${error?.message ?? "unknown error"}`
    );

  // Immediately record a redemption points history entry (match KV behavior)
  await addPointsHistoryEntry({
    email: normalizedEmail,
    type: "redemption",
    points: reward.pointsCost,
    partnerId: args.partnerId ?? null,
    partnerName: null,
    visitId: args.visitId ?? null,
    meta: {
      rewardId: reward.id,
      rewardName: reward.name,
      redemptionCode: code,
      visitId: args.visitId ?? null,
    },
    source: "reward_redemption",
    note: "Reward redemption initiated",
  });

  const applied =
    (await markRedemptionApplied({ code, visitId: args.visitId ?? null })) ??
    (await getRedemptionByCode(code));

  return {
    code,
    reward,
    redemption: applied ?? (data as RedemptionRecord),
  };
}

export async function getRedemptionByCode(code: string) {
  const supabase = getSupabaseAdmin();
  const normalized = code.trim();
  const { data, error } = await supabase
    .from("redemptions")
    .select("*")
    .eq("code", normalized)
    .maybeSingle();
  if (error) throw new Error(`Failed to load redemption: ${error.message}`);
  return data ? (data as RedemptionRecord) : null;
}

export async function markRedemptionApplied(args: {
  code: string;
  visitId?: string | null;
}) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("redemptions")
    .update({
      status: "applied",
      applied_at: now,
      updated_at: now,
      applied_to_visit_id: args.visitId ?? null,
    } as unknown as never)
    .eq("code", args.code)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`Failed to apply redemption: ${error.message}`);
  return data ? (data as RedemptionRecord) : null;
}

export async function markRedemptionUsed(args: {
  code: string;
  partnerId?: string | null;
  processedBy?: {
    role?: "partner" | "staff" | "admin";
    staffId?: string | null;
    email?: string | null;
    name?: string | null;
  };
}) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const existing = await getRedemptionByCode(args.code);
  const metadata = {
    ...(existing?.metadata ?? {}),
    processedBy: {
      role:
        args.processedBy?.role ??
        (args.processedBy?.staffId ? "staff" : "partner"),
      staffId: args.processedBy?.staffId ?? null,
      email: args.processedBy?.email ?? null,
      name: args.processedBy?.name ?? null,
      processedAt: now,
    },
  };
  const { data, error } = await supabase
    .from("redemptions")
    .update({
      status: "used",
      used_at: now,
      updated_at: now,
      partner_id: args.partnerId ?? null,
      metadata,
    } as unknown as never)
    .eq("code", args.code)
    .in("status", ["pending", "applied"])
    .select("*")
    .maybeSingle();
  if (error)
    throw new Error(`Failed to mark redemption used: ${error.message}`);
  return data ? (data as RedemptionRecord) : null;
}

export async function rejectRedemption(args: {
  code: string;
  partnerId?: string | null;
  processedBy?: {
    role?: "partner" | "staff" | "admin";
    staffId?: string | null;
    email?: string | null;
    name?: string | null;
  };
}) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const existing = await getRedemptionByCode(args.code);
  const metadata = {
    ...(existing?.metadata ?? {}),
    processedBy: {
      role:
        args.processedBy?.role ??
        (args.processedBy?.staffId ? "staff" : "partner"),
      staffId: args.processedBy?.staffId ?? null,
      email: args.processedBy?.email ?? null,
      name: args.processedBy?.name ?? null,
      processedAt: now,
    },
  };
  const { data, error } = await supabase
    .from("redemptions")
    .update({
      status: "rejected",
      updated_at: now,
      partner_id: args.partnerId ?? null,
      metadata,
    } as unknown as never)
    .eq("code", args.code)
    .in("status", ["pending", "applied"])
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`Failed to reject redemption: ${error.message}`);
  return data ? (data as RedemptionRecord) : null;
}

function parseProcessedBy(meta: Record<string, unknown> | null | undefined) {
  const processed = meta?.processedBy as Record<string, unknown> | undefined;
  if (!processed || typeof processed !== "object") {
    return null;
  }
  const rawRole =
    typeof processed.role === "string" && processed.role.trim()
      ? processed.role.trim().toLowerCase()
      : undefined;
  const allowedRoles = new Set<RedemptionActor["role"]>([
    "partner",
    "staff",
    "admin",
    "system",
  ]);
  const resolvedRole: RedemptionActor["role"] = rawRole && allowedRoles.has(rawRole as RedemptionActor["role"])
    ? (rawRole as RedemptionActor["role"])
    : processed.staffId
    ? "staff"
    : "partner";
  return {
    role: resolvedRole,
    staffId:
      typeof processed.staffId === "string" && processed.staffId.trim()
        ? processed.staffId
        : null,
    email:
      typeof processed.email === "string" && processed.email.trim()
        ? processed.email
        : null,
    name:
      typeof processed.name === "string" && processed.name.trim()
        ? processed.name
        : null,
    processedAt:
      typeof processed.processedAt === "string" && processed.processedAt.trim()
        ? processed.processedAt
        : null,
  } satisfies RedemptionActor;
}

function mapHistoryRow(row: SupabaseRedemptionRow): RedemptionHistoryItem {
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  const rewardName =
    typeof metadata.rewardName === "string" && metadata.rewardName
      ? metadata.rewardName
      : row.reward?.name ?? null;
  let pointsCost: number | null = null;
  if (typeof metadata.pointsCost === "number") {
    pointsCost = metadata.pointsCost;
  } else if (
    typeof metadata.pointsCost === "string" &&
    metadata.pointsCost.trim()
  ) {
    const parsed = Number(metadata.pointsCost);
    pointsCost = Number.isFinite(parsed) ? parsed : null;
  } else if (typeof row.reward?.points_cost === "number") {
    pointsCost = row.reward.points_cost;
  }

  return {
    code: row.code,
    email: row.email,
    rewardId: row.reward_id,
    rewardName,
    pointsCost,
    partnerId: row.partner_id,
    status: row.status,
    redeemedAt: row.created_at,
    appliedAt: row.applied_at,
    processedAt: row.used_at ?? row.updated_at ?? null,
    processedBy: parseProcessedBy(metadata),
    metadata,
    rewardCategory: row.reward?.category ?? null,
  };
}

export async function listRedemptionsForPartner(
  partnerId: string,
  limit = 50,
): Promise<RedemptionHistoryResult> {
  if (!partnerId) {
    return {
      items: [],
      totals: { used: 0, rejected: 0 },
    };
  }

  const supabase = getSupabaseAdmin();
  const normalized = partnerId.trim().toLowerCase();
  const { data, error } = await supabase
    .from("redemptions")
    .select(
      `
        code,
        email,
        reward_id,
        partner_id,
        status,
        created_at,
        applied_at,
        used_at,
        updated_at,
        metadata,
        reward:rewards(id,name,points_cost,category)
      `,
    )
    .eq("partner_id", normalized)
    .in("status", ["used", "rejected"])
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(
      `Failed to load redemption history for partner: ${error.message}`,
    );
  }

  const rows = (data ?? []) as unknown as SupabaseRedemptionRow[];
  const items = rows.map(mapHistoryRow);
  const totals = {
    used: items.filter((item) => item.status === "used").length,
    rejected: items.filter((item) => item.status === "rejected").length,
  };

  return { items, totals };
}

export async function listRedemptionsForReward(
  rewardId: string,
  limit = 200,
): Promise<RewardUsageResult> {
  if (!rewardId) {
    return {
      items: [],
      totals: { used: 0, rejected: 0 },
    };
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("redemptions")
    .select(
      `
        code,
        email,
        reward_id,
        partner_id,
        status,
        created_at,
        applied_at,
        used_at,
        updated_at,
        metadata,
        reward:rewards(id,name,points_cost,category)
      `,
    )
    .eq("reward_id", rewardId)
    .in("status", ["used", "rejected"])
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(
      `Failed to load redemption usage for reward: ${error.message}`,
    );
  }

  const rows = (data ?? []) as unknown as SupabaseRedemptionRow[];
  const items = rows.map(mapHistoryRow);
  const totals = {
    used: items.filter((item) => item.status === "used").length,
    rejected: items.filter((item) => item.status === "rejected").length,
  };

  return { items, totals };
}
