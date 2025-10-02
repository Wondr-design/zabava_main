import { z } from 'zod';
import { getSupabaseAdmin } from '../supabase-admin';

export const partnerUserUpsertSchema = z
  .object({
    email: z.string().email(),
    passwordHash: z.string().min(1),
    partnerId: z.string().min(1, 'partnerId is required').optional(),
    role: z.enum(['partner', 'admin']).default('partner'),
    name: z.string().min(1).max(120).optional(),
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
}

export interface PartnerUserDTO {
  email: string;
  role: 'partner' | 'admin';
  partnerId: string | null;
  name: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
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

  type PartnerUserUpsertRow = {
    email: string;
    password_hash: string;
    partner_id: string | null;
    role: 'partner' | 'admin';
    name: string | null;
    updated_at: string;
  };
  const upsertRow: PartnerUserUpsertRow = {
    email: normalizedEmail,
    password_hash: payload.passwordHash,
    partner_id: partnerId,
    role: payload.role,
    name: payload.name ?? null,
    updated_at: now,
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
