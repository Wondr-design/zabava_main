import { randomBytes, createHash } from "node:crypto";

import { z } from "zod";

import { getSupabaseAdminTyped } from "@/lib/supabase-admin";
import { log } from "@/lib/logging";
import type { Json } from "@/supabase/types";

const ADMIN_INVITE_DEFAULT_EXPIRY_HOURS = 168; // 7 days

const adminInviteRowSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  inviter_email: z.string().email().nullable(),
  token: z.string(),
  role: z.string(),
  expires_at: z.string().datetime({ offset: true }),
  accepted_at: z.string().datetime({ offset: true }).nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});

export type AdminInvite = z.infer<typeof adminInviteRowSchema>;

export interface CreateAdminInviteInput {
  email: string;
  inviterEmail?: string | null;
  role?: "admin";
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface CreateAdminInviteResult {
  invite: AdminInvite;
  token: string;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateInviteToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createAdminInvite(
  input: CreateAdminInviteInput,
): Promise<CreateAdminInviteResult> {
  const supabase = getSupabaseAdminTyped();
  const token = generateInviteToken();
  const now = new Date();
  const expiresAt =
    input.expiresAt ??
    new Date(now.getTime() + ADMIN_INVITE_DEFAULT_EXPIRY_HOURS * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("admin_invites")
    .insert({
      email: normalizeEmail(input.email),
      inviter_email: input.inviterEmail ? normalizeEmail(input.inviterEmail) : null,
      token: hashToken(token),
      role: input.role ?? "admin",
      expires_at: expiresAt.toISOString(),
      metadata: (input.metadata as Json | undefined) ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create admin invite: ${error?.message ?? "unknown error"}`);
  }

  return { invite: adminInviteRowSchema.parse(data), token };
}

export async function listAdminInvites(): Promise<AdminInvite[]> {
  const supabase = getSupabaseAdminTyped();
  const { data, error } = await supabase
    .from("admin_invites")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`Failed to list admin invites: ${error.message}`);
  }
  return (data ?? []).map((row) => adminInviteRowSchema.parse(row));
}

export async function getAdminInviteByToken(
  token: string,
): Promise<AdminInvite | null> {
  const supabase = getSupabaseAdminTyped();
  const hashed = hashToken(token);
  const { data, error } = await supabase
    .from("admin_invites")
    .select("*")
    .eq("token", hashed)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load admin invite: ${error.message}`);
  }
  return data ? adminInviteRowSchema.parse(data) : null;
}

export async function markAdminInviteAccepted(
  id: string,
  metadata?: Record<string, unknown>,
): Promise<AdminInvite> {
  const supabase = getSupabaseAdminTyped();
  const { data, error } = await supabase
    .from("admin_invites")
    .update({
      accepted_at: new Date().toISOString(),
      metadata: (metadata as Json | undefined) ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error || !data) {
    throw new Error(`Failed to mark admin invite accepted: ${error?.message ?? "unknown error"}`);
  }
  return adminInviteRowSchema.parse(data);
}

export async function cancelAdminInvite(id: string): Promise<void> {
  const supabase = getSupabaseAdminTyped();
  const { error } = await supabase.from("admin_invites").delete().eq("id", id);
  if (error) {
    throw new Error(`Failed to cancel admin invite: ${error.message}`);
  }
}

export function isInviteExpired(invite: AdminInvite): boolean {
  const expiresAt = Date.parse(invite.expires_at);
  if (Number.isNaN(expiresAt)) {
    log.warn("admin_invite_invalid_expiry", { id: invite.id, expiresAt: invite.expires_at });
    return true;
  }
  return expiresAt < Date.now();
}

export function isInviteConsumable(invite: AdminInvite): boolean {
  return !invite.accepted_at && !isInviteExpired(invite);
}
