import { randomBytes } from "node:crypto";
import { z } from "zod";
import { getEnv } from "../env";
import { getSupabaseAdmin } from "../supabase-admin";
import { defaultLocale, resolveLocale, type Locale } from "@/i18n/config";
import { buildLocalizedPath } from "@/i18n/routing";

export const createInviteInputSchema = z.object({
  email: z.string().email(),
  partnerId: z.string().min(1, "partnerId is required"),
  role: z.enum(["partner", "admin"]).default("partner"),
  name: z.string().min(1).max(120).optional(),
  locale: z.string().optional(),
  expiresInMinutes: z
    .number()
    .int()
    .positive()
    .max(60 * 24 * 30)
    .optional(),
});

export const listInvitesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z
    .preprocess(
      (value) => (value ? Number(value) : undefined),
      z.number().int().positive().max(200)
    )
    .optional(),
});

export type CreateInviteInput = z.infer<typeof createInviteInputSchema>;
export type ListInvitesQuery = z.infer<typeof listInvitesQuerySchema>;

export interface PartnerInviteRecord {
  id: string;
  token: string;
  email: string;
  partner_id: string | null;
  role: "partner" | "admin";
  name: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  expires_at: string | null;
  used: boolean;
  used_at: string | null;
}

export interface PartnerInviteDTO {
  token: string;
  email: string | null;
  partnerId: string | null;
  role: "partner" | "admin";
  name: string | null;
  createdAt: string;
  expiresAt: string | null;
  used: boolean;
  usedAt: string | null;
  inviteUrl: string | null;
  locale: Locale;
}

function buildInviteUrl(token: string, email: string | null | undefined, locale: Locale) {
  const base = getEnv("DASHBOARD_BASE_URL", true) || "";
  if (!base) return null;
  const normalizedBase = base.replace(/\/$/, "");
  const origin = normalizedBase.startsWith("http")
    ? normalizedBase
    : `https://${normalizedBase}`;
  const localizedPath = buildLocalizedPath("/partner/signup", locale);
  const url = new URL(localizedPath, origin);
  url.searchParams.set("token", token);
  if (email) {
    url.searchParams.set("email", email);
  }
  return url.toString();
}

function mapInviteRecord(record: PartnerInviteRecord): PartnerInviteDTO {
  const email = record.email?.toLowerCase() ?? null;
  const metadata = (record.metadata ?? {}) as { locale?: string } | null;
  const locale = resolveLocale(metadata?.locale, defaultLocale);
  return {
    token: record.token,
    email,
    partnerId: record.partner_id,
    role: record.role,
    name: record.name,
    createdAt: record.created_at,
    expiresAt: record.expires_at,
    used: Boolean(record.used),
    usedAt: record.used_at,
    inviteUrl: buildInviteUrl(record.token, email ?? undefined, locale),
    locale,
  };
}

export async function getPartnerInviteByToken(token: string) {
  const supabase = getSupabaseAdmin();
  const normalizedToken = token.trim();

  const { data, error } = await supabase
    .from("partner_invites")
    .select("*")
    .eq("token", normalizedToken)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load invite: ${error.message}`);
  }

  return data ? (data as PartnerInviteRecord) : null;
}

export async function createPartnerInvite(input: CreateInviteInput) {
  const payload = createInviteInputSchema.parse(input);
  const supabase = getSupabaseAdmin();
  const locale = resolveLocale(payload.locale, defaultLocale);

  const token = randomBytes(24).toString("hex");
  const now = new Date();
  const createdAtIso = now.toISOString();
  const expiresInMinutes = payload.expiresInMinutes ?? 60 * 24 * 7;
  const expiresAt = new Date(
    now.getTime() + expiresInMinutes * 60_000
  ).toISOString();

  type PartnerInviteInsert = {
    token: string;
    email: string;
    partner_id: string | null;
    role: "partner" | "admin";
    name: string | null;
    created_at: string;
    expires_at: string;
    used: boolean;
    metadata: Record<string, unknown>;
  };

  const insertPayload: PartnerInviteInsert = {
    token,
    email: payload.email.toLowerCase(),
    partner_id: payload.partnerId,
    role: payload.role,
    name: payload.name ?? null,
    created_at: createdAtIso,
    expires_at: expiresAt,
    used: false,
    metadata: { locale },
  };

  const { data, error } = await supabase
    .from("partner_invites")
    .insert(insertPayload as unknown as never)
    .select()
    .single();

  if (error || !data) {
    const code = (error as { code?: string } | null)?.code;
    const message =
      (error as { message?: string } | null)?.message || "unknown error";
    if (
      code === "23503" ||
      message.includes("partner_invites_partner_id_fkey")
    ) {
      throw new Error(
        "Partner ID does not exist. Create the partner first, then issue an invite."
      );
    }
    throw new Error(`Failed to create invite: ${message}`);
  }

  return mapInviteRecord(data as PartnerInviteRecord);
}

export async function markInviteUsed(token: string) {
  const supabase = getSupabaseAdmin();
  const usedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("partner_invites")
    .update({ used: true, used_at: usedAt } as unknown as never)
    .eq("token", token)
    .eq("used", false)
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to mark invite used: ${error.message}`);
  }

  return data ? mapInviteRecord(data as PartnerInviteRecord) : null;
}

async function resolveCursorTimestamp(cursor: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("partner_invites")
    .select("created_at")
    .eq("token", cursor)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve cursor: ${error.message}`);
  }

  const row = (data as { created_at: string } | null) ?? null;
  return row?.created_at ?? null;
}

export async function listPartnerInvites(query: ListInvitesQuery) {
  const params = listInvitesQuerySchema.parse(query);
  const supabase = getSupabaseAdmin();
  const limit = params.limit ?? 50;

  let createdBefore: string | null = null;
  if (params.cursor) {
    createdBefore = await resolveCursorTimestamp(params.cursor);
  }

  let request = supabase
    .from("partner_invites")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (createdBefore) {
    request = request.lt("created_at", createdBefore);
  }

  const { data, error } = await request;

  if (error || !data) {
    throw new Error(
      `Failed to list invites: ${error?.message ?? "unknown error"}`
    );
  }

  const invites = data as PartnerInviteRecord[];
  const items = invites.slice(0, limit).map(mapInviteRecord);
  const nextCursor = invites.length > limit ? invites[limit].token : null;

  return {
    items,
    nextCursor,
  };
}

export async function deletePartnerInvite(token: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("partner_invites")
    .delete()
    .eq("token", token);
  if (error) {
    throw new Error(`Failed to delete invite: ${error.message}`);
  }
}
