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

function generateCode() {
  const rand = Math.random().toString(36).slice(2, 9).toUpperCase();
  return `RDM-${Date.now()}-${rand}`;
}

export async function createRedemption(args: {
  email: string;
  rewardId: string;
  partnerId?: string | null;
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
    metadata: Record<string, unknown>;
  };

  const insertPayload: RedemptionInsert = {
    code,
    email: normalizedEmail,
    reward_id: reward.id,
    partner_id: args.partnerId ?? null,
    status: "pending",
    created_at: nowIso,
    updated_at: nowIso,
    metadata: {},
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
    visitId: null,
    meta: { rewardId: reward.id, rewardName: reward.name },
  });

  return { code, reward };
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
}) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("redemptions")
    .update({
      status: "used",
      used_at: now,
      updated_at: now,
      partner_id: args.partnerId ?? null,
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
}) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("redemptions")
    .update({
      status: "rejected",
      updated_at: now,
      partner_id: args.partnerId ?? null,
    } as unknown as never)
    .eq("code", args.code)
    .in("status", ["pending", "applied"])
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`Failed to reject redemption: ${error.message}`);
  return data ? (data as RedemptionRecord) : null;
}
