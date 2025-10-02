import { z } from "zod";
import { getSupabaseAdmin } from "../supabase-admin";

export const staffStatusSchema = z.enum(["active", "inactive", "revoked"]);

export const staffUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  partnerId: z.string().min(1),
  email: z.string().email(),
  passwordHash: z.string().min(1),
  name: z.string().min(1).max(120).optional(),
  status: staffStatusSchema.optional(),
});

export type PartnerStaffUpsertInput = z.infer<typeof staffUpsertSchema>;

export interface PartnerStaffRecord {
  id: string;
  partner_id: string;
  email: string;
  password_hash: string;
  name: string | null;
  status: "active" | "inactive" | "revoked";
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function getPartnerStaffByEmail(email: string) {
  const supabase = getSupabaseAdmin();
  const normalized = normalizeEmail(email);
  const { data, error } = await supabase
    .from("partner_staff")
    .select("*")
    .eq("email", normalized)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load partner staff: ${error.message}`);
  }

  return data ? (data as PartnerStaffRecord) : null;
}

export async function getPartnerStaffByIds(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter((id) => Boolean(id))));
  if (uniqueIds.length === 0) {
    return [] as PartnerStaffRecord[];
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("partner_staff")
    .select("*")
    .in("id", uniqueIds as unknown as never);

  if (error) {
    throw new Error(`Failed to load staff by ids: ${error.message}`);
  }

  return (data ?? []) as PartnerStaffRecord[];
}

export async function listPartnerStaff(partnerId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("partner_staff")
    .select("*")
    .eq("partner_id", partnerId.trim().toLowerCase())
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list partner staff: ${error.message}`);
  }

  return (data ?? []) as PartnerStaffRecord[];
}

export async function upsertPartnerStaff(input: PartnerStaffUpsertInput) {
  const payload = staffUpsertSchema.parse(input);
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const insertPayload = {
    id: payload.id ?? undefined,
    partner_id: payload.partnerId.trim().toLowerCase(),
    email: normalizeEmail(payload.email),
    password_hash: payload.passwordHash,
    name: payload.name ?? null,
    status: payload.status ?? "active",
    updated_at: now,
  };

  const query = payload.id
    ? supabase
        .from("partner_staff")
        .update(insertPayload as never)
        .eq("id", payload.id)
        .select()
        .single()
    : supabase
        .from("partner_staff")
        .insert({ ...insertPayload, created_at: now } as never)
        .select()
        .single();

  const { data, error } = await query;

  if (error || !data) {
    throw new Error(
      `Failed to upsert staff: ${error?.message ?? "unknown error"}`
    );
  }

  return data as PartnerStaffRecord;
}

export async function updatePartnerStaffStatus(
  id: string,
  status: "active" | "inactive" | "revoked"
) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("partner_staff")
    .update({ status, updated_at: new Date().toISOString() } as never)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update staff status: ${error.message}`);
  }

  return data ? (data as PartnerStaffRecord) : null;
}

export async function deletePartnerStaff(id: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("partner_staff").delete().eq("id", id);
  if (error) {
    throw new Error(`Failed to delete staff: ${error.message}`);
  }
}

export async function touchPartnerStaffLogin(id: string) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("partner_staff")
    .update({ last_login_at: now, updated_at: now } as never)
    .eq("id", id);
  if (error) {
    throw new Error(`Failed to update staff login: ${error.message}`);
  }
}
