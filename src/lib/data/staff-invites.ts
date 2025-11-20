import { z } from "zod";
import { getSupabaseAdmin } from "../supabase-admin";
import { getEnv } from "../env";
import { buildLocalizedPath } from "@/i18n/routing";
import { defaultLocale, resolveLocale, type Locale } from "@/i18n/config";

export const staffInviteStatusSchema = z.enum([
  "pending",
  "used",
  "revoked",
  "expired",
]);

export const staffInviteCreateSchema = z.object({
  token: z.string().min(12),
  partnerId: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1).max(120).optional(),
  expiresAt: z.string().datetime().optional(),
  createdBy: z.string().email().optional(),
  locale: z.string().optional(),
});

export type StaffInviteCreateInput = z.infer<typeof staffInviteCreateSchema>;

export interface PartnerStaffInviteRecord {
  token: string;
  partner_id: string;
  email: string | null;
  name: string | null;
  status: "pending" | "used" | "revoked" | "expired";
  expires_at: string | null;
  used: boolean;
  used_at: string | null;
  created_at: string;
  created_by_email: string | null;
}

export interface StaffInviteDTO extends PartnerStaffInviteRecord {
  inviteUrl: string | null;
  locale: Locale;
}

function normalizeEmail(email?: string | null) {
  return email ? email.trim().toLowerCase() : null;
}

function buildStaffInviteUrl(
  token: string,
  email: string | null | undefined,
  name: string | null | undefined,
  locale: Locale,
) {
  const base = getEnv("DASHBOARD_BASE_URL", true) || "";
  if (!base) return null;
  const normalizedBase = base.replace(/\/$/, "");
  const origin = normalizedBase.startsWith("http")
    ? normalizedBase
    : `https://${normalizedBase}`;
  const localizedPath = buildLocalizedPath("/staff/signup", locale);
  const url = new URL(localizedPath, origin);
  url.searchParams.set("token", token);
  if (email) {
    url.searchParams.set("email", email);
  }
  if (name) {
    url.searchParams.set("name", name);
  }
  return url.toString();
}

export function mapStaffInvite(
  record: PartnerStaffInviteRecord,
  options?: { locale?: string | null },
): StaffInviteDTO {
  const email = record.email ? record.email.toLowerCase() : null;
  const locale = resolveLocale(options?.locale, defaultLocale);
  return {
    ...record,
    email,
    inviteUrl: buildStaffInviteUrl(record.token, email, record.name, locale),
    locale,
  };
}

export async function createStaffInvite(input: StaffInviteCreateInput) {
  const payload = staffInviteCreateSchema.parse(input);
  const { locale: _locale, ...rest } = payload;
  void _locale;
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const insertPayload = {
    token: rest.token,
    partner_id: rest.partnerId.trim().toLowerCase(),
    email: normalizeEmail(rest.email),
    name: rest.name ?? null,
    status: "pending" as const,
    expires_at: rest.expiresAt ?? null,
    used: false,
    created_at: now,
    created_by_email: normalizeEmail(rest.createdBy),
  };

  const { data, error } = await supabase
    .from("partner_staff_invites")
    .insert(insertPayload as never)
    .select()
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create staff invite: ${error?.message ?? "unknown error"}`
    );
  }

  return data as PartnerStaffInviteRecord;
}

export async function getStaffInviteByToken(token: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("partner_staff_invites")
    .select("*")
    .eq("token", token.trim())
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load staff invite: ${error.message}`);
  }

  return data ? (data as PartnerStaffInviteRecord) : null;
}

export async function markStaffInviteUsed(token: string) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("partner_staff_invites")
    .update({ status: "used", used: true, used_at: now } as never)
    .eq("token", token.trim())
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to mark staff invite used: ${error.message}`);
  }

  return data ? (data as PartnerStaffInviteRecord) : null;
}

export async function revokeStaffInvite(token: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("partner_staff_invites")
    .update({
      status: "revoked",
      used: true,
      used_at: new Date().toISOString(),
    } as never)
    .eq("token", token.trim())
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to revoke staff invite: ${error.message}`);
  }

  return data ? (data as PartnerStaffInviteRecord) : null;
}

export async function listPartnerStaffInvites(partnerId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('partner_staff_invites')
    .select('*')
    .eq('partner_id', partnerId.trim().toLowerCase())
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list staff invites: ${error.message}`);
  }

  return (data ?? []) as PartnerStaffInviteRecord[];
}
