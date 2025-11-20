import { z } from 'zod';
import { getSupabaseAdmin } from '../supabase-admin';

export const partnerUserUpsertSchema = z
  .object({
    email: z.string().email(),
    passwordHash: z.string().min(1).optional(),
    partnerId: z.string().min(1, 'partnerId is required').optional(),
    role: z.enum(['partner', 'admin']).default('partner'),
    name: z.string().min(1).max(120).optional(),
    verifiedAt: z.date().optional(),
    lastInvitedAt: z.date().optional(),
    invitedBy: z.string().email().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    authUserId: z.string().uuid().optional(),
  })
  .refine(
    (payload) => payload.role === 'admin' || Boolean(payload.partnerId),
    {
      message: 'partnerId is required for partner accounts',
      path: ['partnerId'],
    }
  );

export type PartnerUserUpsertInput = z.infer<typeof partnerUserUpsertSchema>;

export interface PartnerUserRecord {
  email: string;
  password_hash: string | null;
  partner_id: string | null;
  role: 'partner' | 'admin';
  name: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  verified_at: string | null;
  last_invited_at: string | null;
  invited_by: string | null;
  auth_user_id: string | null;
}

export interface PartnerUserDTO {
  email: string;
  role: 'partner' | 'admin';
  partnerId: string | null;
  name: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  verifiedAt: string | null;
  lastInvitedAt: string | null;
  invitedBy: string | null;
  metadata: Record<string, unknown> | null;
  authUserId: string | null;
}

function mapPartnerUser(record: PartnerUserRecord): PartnerUserDTO {
  return {
    email: record.email.toLowerCase(),
    role: record.role,
    partnerId: record.partner_id,
    name: record.name,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    lastLoginAt: record.last_login_at,
    verifiedAt: record.verified_at,
    lastInvitedAt: record.last_invited_at,
    invitedBy: record.invited_by,
    metadata: record.metadata ?? null,
    authUserId: record.auth_user_id ?? null,
  };
}

export async function getPartnerUserByEmail(email: string) {
  const supabase = getSupabaseAdmin();
  const normalized = email.trim().toLowerCase();
  const { data, error } = await supabase
    .from('partner_users')
    .select('*')
    .eq('email', normalized)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load partner user: ${error.message}`);
  }

  return data ? (data as PartnerUserRecord) : null;
}

export async function upsertPartnerUser(input: PartnerUserUpsertInput) {
  const payload = partnerUserUpsertSchema.parse(input);
  const supabase = getSupabaseAdmin();
  const normalizedEmail = payload.email.trim().toLowerCase();
  const now = new Date().toISOString();

  const partnerId = payload.partnerId?.trim() || null;
  let metadataValue = payload.metadata;
  let authUserIdValue = payload.authUserId ?? null;

  if (metadataValue === undefined) {
    const { data: existingMetaRow, error: existingMetaError } = await supabase
      .from('partner_users')
      .select('metadata, auth_user_id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingMetaError) {
      throw new Error(`Failed to inspect existing partner user metadata: ${existingMetaError.message}`);
    }

    metadataValue = (existingMetaRow?.metadata as Record<string, unknown> | null) ?? {};
    if (!authUserIdValue) {
      authUserIdValue =
        (existingMetaRow?.auth_user_id as string | null | undefined) ?? null;
    }
  }

  const upsertRow = {
    email: normalizedEmail,
    password_hash: payload.passwordHash,
    partner_id: partnerId,
    role: payload.role,
    name: payload.name ?? null,
    metadata: metadataValue,
    updated_at: now,
    verified_at: payload.verifiedAt?.toISOString() ?? null,
    last_invited_at: payload.lastInvitedAt?.toISOString() ?? null,
    invited_by: payload.invitedBy ? payload.invitedBy.toLowerCase() : null,
    auth_user_id: authUserIdValue,
  };

  const { data, error } = await supabase
    .from('partner_users')
    .upsert(upsertRow as unknown as never, {
      onConflict: 'email',
      ignoreDuplicates: false,
    } as unknown as never)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to upsert partner user: ${error?.message ?? 'unknown error'}`);
  }

  return mapPartnerUser(data as PartnerUserRecord);
}

export async function touchPartnerUserLogin(email: string) {
  const supabase = getSupabaseAdmin();
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await supabase
    .from('partner_users')
    .update({ last_login_at: new Date().toISOString() } as unknown as never)
    .eq('email', normalizedEmail)
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update last login: ${error.message}`);
  }

  return data ? (data as PartnerUserRecord) : null;
}

export async function listAdminUsers(): Promise<PartnerUserDTO[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('partner_users')
    .select('*')
    .eq('role', 'admin')
    .order('created_at', { ascending: false });
  if (error) {
    throw new Error(`Failed to list admin users: ${error.message}`);
  }
  return (data ?? []).map((record) => mapPartnerUser(record as PartnerUserRecord));
}

export async function updatePartnerUserPassword(params: {
  email: string;
  passwordHash: string;
}) {
  const supabase = getSupabaseAdmin();
  const normalized = params.email.trim().toLowerCase();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('partner_users')
    .update({ password_hash: params.passwordHash, updated_at: now } as unknown as never)
    .eq('email', normalized)
    .select('*')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to reset partner user password: ${error.message}`);
  }

  return data ? (data as PartnerUserRecord) : null;
}

export async function recordAdminInviteMetadata(params: {
  email: string;
  inviterEmail?: string | null;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const normalized = params.email.trim().toLowerCase();
  const inviter = params.inviterEmail ? params.inviterEmail.trim().toLowerCase() : null;
  const { error } = await supabase
    .from('partner_users')
    .update({
      last_invited_at: new Date().toISOString(),
      invited_by: inviter,
    } as unknown as never)
    .eq('email', normalized);
  if (error) {
    throw new Error(`Failed to record admin invite metadata: ${error.message}`);
  }
}
