import { z } from "zod";
import { getSupabaseAdmin } from "../supabase-admin";

const visitPayloadSchema = z.record(z.string(), z.any()).optional();

export const visitRegistrationInputSchema = z.object({
  id: z.string().uuid().optional(),
  email: z.string().email(),
  partnerId: z.string().min(1).optional(),
  status: z.enum(["pending", "visited", "cancelled"]).optional(),
  qrType: z.enum(["standard", "bonus", "flash"]).optional(),
  rewardId: z.string().optional(),
  submissionId: z.string().optional(),
  payload: visitPayloadSchema,
  estimatedPoints: z.number().int().nonnegative().default(0),
  pointsAwarded: z.number().int().nonnegative().default(0),
  totalPrice: z.number().optional(),
  numPeople: z.number().int().positive().default(1),
  ticketType: z.string().optional(),
  transport: z.string().optional(),
  categories: z.string().optional(),
  hasRedemption: z.boolean().optional(),
  redemptionCode: z.string().optional(),
  redemptionReward: z.string().optional(),
  redemptionValue: z.number().int().optional(),
  legacyQrKey: z.string().optional(),
});

export type VisitRegistrationInput = z.infer<
  typeof visitRegistrationInputSchema
>;

export interface VisitRegistrationRecord {
  id: string;
  submission_id: string | null;
  email: string;
  partner_id: string | null;
  qr_type: "standard" | "bonus" | "flash";
  reward_id: string | null;
  status: "pending" | "visited" | "cancelled";
  payload: Record<string, unknown>;
  estimated_points: number;
  points_awarded: number;
  total_price: number;
  num_people: number;
  ticket_type: string | null;
  transport: string | null;
  categories: string | null;
  visited_at: string | null;
  visit_notes: string | null;
  has_redemption: boolean;
  redemption_code: string | null;
  redemption_reward: string | null;
  redemption_value: number | null;
  legacy_qr_key: string | null;
  checked_in_by_staff_id: string | null;
  created_at: string;
  updated_at: string;
}

const updateVisitStatusSchema = z.object({
  visitId: z.string().uuid(),
  status: z.enum(["pending", "visited", "cancelled"]).optional(),
  visitedAt: z.string().datetime().optional(),
  pointsAwarded: z.number().int().nonnegative().optional(),
  estimatedPoints: z.number().int().nonnegative().optional(),
  totalPrice: z.number().optional(),
  numPeople: z.number().int().positive().optional(),
  ticketType: z.string().optional(),
  transport: z.string().optional(),
  categories: z.string().optional(),
  visitNotes: z.string().optional(),
  checkedInByStaffId: z.string().uuid().nullable().optional(),
});

export type UpdateVisitStatusInput = z.infer<typeof updateVisitStatusSchema>;

export function estimateVisitPoints({
  estimatedPoints,
  totalPrice,
  ticketType,
  numPeople,
  transport,
}: {
  estimatedPoints?: number | null;
  totalPrice?: unknown;
  ticketType?: unknown;
  numPeople?: unknown;
  transport?: unknown;
}) {
  if (
    typeof estimatedPoints === "number" &&
    Number.isFinite(estimatedPoints) &&
    estimatedPoints >= 0
  ) {
    return Math.floor(estimatedPoints);
  }

  const toNumber = (value: unknown, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  const normalizedPeople = toNumber(numPeople, 1) || 1;
  const normalizedTicket = typeof ticketType === "string"
    ? ticketType.toLowerCase()
    : "";
  const hasTransport = (() => {
    const value =
      typeof transport === "string"
        ? transport.toLowerCase()
        : String(transport || "").toLowerCase();
    return (
      value === "yes" ||
      value === "true" ||
      value === "1" ||
      value === "checked" ||
      value === "selected"
    );
  })();

  let points = 0;
  switch (normalizedTicket) {
    case "vip":
      points = 50 * normalizedPeople;
      break;
    case "family":
      points = 30 * normalizedPeople;
      break;
    case "group":
      points = 20 * normalizedPeople;
      break;
    case "student":
      points = 15 * normalizedPeople;
      break;
    default:
      points = 10 * normalizedPeople;
      break;
  }

  const numericPrice = toNumber(totalPrice, 0);
  if (numericPrice > 0) {
    points = Math.max(points, Math.floor(numericPrice / 100));
  }

  if (hasTransport) points += 5;
  return Math.max(0, points);
}

export async function createVisitRegistration(input: VisitRegistrationInput) {
  const supabase = getSupabaseAdmin();
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedPartnerId = input.partnerId?.trim().toLowerCase() || null;

  let existing: VisitRegistrationRecord | null = null;
  if (input.id) {
    existing = await getVisitById(input.id).catch(() => null);
  }
  const normalizedSubmissionIdInput = input.submissionId
    ? input.submissionId.trim().toLowerCase()
    : undefined;

  if (!existing && normalizedSubmissionIdInput) {
    existing = await getVisitBySubmissionId(normalizedSubmissionIdInput).catch(
      () => null
    );
  }
  if (!existing && input.legacyQrKey) {
    existing = await getVisitByLegacyKey(input.legacyQrKey).catch(() => null);
  }

  const submissionIdToStore =
    normalizedSubmissionIdInput ?? existing?.submission_id ?? null;
  const legacyKeyToStore = input.legacyQrKey
    ? input.legacyQrKey.trim()
    : existing?.legacy_qr_key ?? null;

  const qrTypeToStore =
    input.qrType ??
    (existing ? (existing.qr_type as "standard" | "bonus") : "standard");
  const rewardIdToStore =
    input.rewardId ??
    (existing ? existing.reward_id ?? null : null);

  let statusToStore = input.status as
    | VisitRegistrationRecord["status"]
    | undefined;
  if (existing) {
    if (!statusToStore) {
      statusToStore = existing.status;
    } else if (statusToStore === "pending" && existing.status === "visited") {
      statusToStore = existing.status;
    }
  }

  const insertPayload: Record<string, unknown> = {
    submission_id: submissionIdToStore,
    email: normalizedEmail,
    partner_id: normalizedPartnerId,
    qr_type: qrTypeToStore,
    reward_id: rewardIdToStore,
    payload: input.payload ?? {},
    estimated_points: input.estimatedPoints ?? 0,
    points_awarded: input.pointsAwarded ?? 0,
    total_price: input.totalPrice ?? 0,
    num_people: input.numPeople ?? 1,
    ticket_type: input.ticketType ?? null,
    transport: input.transport ?? null,
    categories: input.categories ?? null,
    has_redemption: input.hasRedemption ?? false,
    redemption_code: input.redemptionCode ?? null,
    redemption_reward: input.redemptionReward ?? null,
    redemption_value: input.redemptionValue ?? null,
    legacy_qr_key: legacyKeyToStore,
  };

  if (input.id) {
    insertPayload.id = input.id;
  }

  if (statusToStore) {
    insertPayload.status = statusToStore;
  }

  const payloadToStore = existing
    ? {
        ...(existing.payload ?? {}),
        ...(insertPayload.payload as Record<string, unknown>),
      }
    : (insertPayload.payload as Record<string, unknown>);
  insertPayload.payload = payloadToStore;

  if (existing) {
    const updatePayload = {
      ...insertPayload,
      updated_at: new Date().toISOString(),
    };
    delete (updatePayload as Record<string, unknown>).id;
    const { data, error } = await supabase
      .from("visit_registrations")
      .update(updatePayload as unknown as never)
      .eq("id", existing.id)
      .select()
      .maybeSingle();

    if (error || !data) {
      throw new Error(
        `Failed to update visit registration: ${
          error?.message ?? "unknown error"
        }`
      );
    }
    return data as VisitRegistrationRecord;
  }

  const { data, error } = await supabase
    .from("visit_registrations")
    .insert(insertPayload as unknown as never)
    .select()
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create visit registration: ${
        error?.message ?? "unknown error"
      }`
    );
  }

  if (normalizedPartnerId) {
    await supabase.from("partner_members").upsert(
      {
        partner_id: normalizedPartnerId,
        email: normalizedEmail,
      } as unknown as never,
      {
        onConflict: "partner_id,email",
        ignoreDuplicates: true,
      } as unknown as never
    );
  }

  return data as VisitRegistrationRecord;
}

export async function getVisitById(visitId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("visit_registrations")
    .select("*")
    .eq("id", visitId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load visit: ${error.message}`);
  }

  return data ? (data as VisitRegistrationRecord) : null;
}

export async function getVisitByLegacyKey(legacyKey: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("visit_registrations")
    .select("*")
    .eq("legacy_qr_key", legacyKey)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load visit by legacy key: ${error.message}`);
  }

  return data ? (data as VisitRegistrationRecord) : null;
}

export async function getVisitBySubmissionId(submissionId: string) {
  const supabase = getSupabaseAdmin();
  const normalized = submissionId.trim().toLowerCase();
  if (!normalized) return null;
  const { data, error } = await supabase
    .from("visit_registrations")
    .select("*")
    .eq("submission_id", normalized)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load visit by submission id: ${error.message}`);
  }

  return data ? (data as VisitRegistrationRecord) : null;
}

export async function getLatestPendingVisit(email: string, partnerId?: string) {
  return getLatestPendingVisitByTypes(email, partnerId, {
    qrTypes: ["standard", "flash"],
  });
}

export async function getLatestPendingVisitByTypes(
  email: string,
  partnerId?: string,
  opts?: { qrTypes?: Array<"standard" | "bonus" | "flash"> },
) {
  const supabase = getSupabaseAdmin();
  const normalizedEmail = email.trim().toLowerCase();
  const qrTypes =
    opts?.qrTypes && opts.qrTypes.length > 0 ? opts.qrTypes : ["standard"];
  let query = supabase
    .from("visit_registrations")
    .select("*")
    .eq("email", normalizedEmail)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1);

  if (partnerId) {
    query = query.eq("partner_id", partnerId.trim().toLowerCase());
  }
  if (qrTypes && qrTypes.length > 0) {
    query = query.in("qr_type", qrTypes);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch pending visit: ${error.message}`);
  }

  return data ? (data as VisitRegistrationRecord) : null;
}

export async function updateVisitStatus(input: UpdateVisitStatusInput) {
  const payload = updateVisitStatusSchema.parse(input);
  const supabase = getSupabaseAdmin();

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (payload.status) updates.status = payload.status;
  if (payload.visitedAt) updates.visited_at = payload.visitedAt;
  if (payload.pointsAwarded !== undefined)
    updates.points_awarded = payload.pointsAwarded;
  if (payload.estimatedPoints !== undefined)
    updates.estimated_points = payload.estimatedPoints;
  if (payload.totalPrice !== undefined)
    updates.total_price = payload.totalPrice;
  if (payload.numPeople !== undefined) updates.num_people = payload.numPeople;
  if (payload.ticketType !== undefined)
    updates.ticket_type = payload.ticketType;
  if (payload.transport !== undefined) updates.transport = payload.transport;
  if (payload.categories !== undefined) updates.categories = payload.categories;
  if (payload.visitNotes !== undefined)
    updates.visit_notes = payload.visitNotes;
  if (payload.checkedInByStaffId !== undefined)
    updates.checked_in_by_staff_id = payload.checkedInByStaffId;

  const { data, error } = await supabase
    .from("visit_registrations")
    .update(updates as unknown as never)
    .eq("id", payload.visitId)
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update visit: ${error.message}`);
  }

  return data ? (data as VisitRegistrationRecord) : null;
}

export async function listVisitsForEmail(email: string, limit = 100) {
  const supabase = getSupabaseAdmin();
  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } = await supabase
    .from("visit_registrations")
    .select("*")
    .eq("email", normalizedEmail)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list visits: ${error.message}`);
  }

  return (data ?? []) as VisitRegistrationRecord[];
}

export async function fetchVisitWithHistory(visitId: string) {
  const visit = await getVisitById(visitId);
  if (!visit) return null;
  return visit;
}
