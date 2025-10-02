import { z } from 'zod';
import { getSupabaseAdmin } from '../supabase-admin';

export const createPendingSchema = z.object({
  rid: z.string().optional(),
  email: z.string().email().optional(),
  verifyUrl: z.string().url(),
  qrUrl: z.string().url().optional(),
  visitId: z.string().uuid().optional(),
  legacyKey: z.string().optional(),
  expiresAt: z.string().datetime(),
});

export type CreatePendingInput = z.infer<typeof createPendingSchema>;

export interface PendingVerificationRecord {
  id: string;
  rid: string | null;
  email: string | null;
  verify_url: string | null;
  qr_url: string | null;
  visit_id: string | null;
  legacy_key: string | null;
  created_at: string;
  expires_at: string;
}

export async function createPendingVerification(input: CreatePendingInput) {
  const payload = createPendingSchema.parse(input);
  const supabase = getSupabaseAdmin();

  type PendingInsert = {
    rid: string | null;
    email: string | null;
    verify_url: string;
    qr_url: string | null;
    visit_id: string | null;
    legacy_key: string | null;
    expires_at: string;
  };

  const insertPayload: PendingInsert = {
    rid: payload.rid ?? null,
    email: payload.email ? payload.email.trim().toLowerCase() : null,
    verify_url: payload.verifyUrl,
    qr_url: payload.qrUrl ?? null,
    visit_id: payload.visitId ?? null,
    legacy_key: payload.legacyKey ?? null,
    expires_at: payload.expiresAt,
  };

  const insertQuery = supabase
    .from('pending_verifications')
    .insert(insertPayload as unknown as never)
    .select()
    .single();

  let { data, error } = await insertQuery;

  const isDuplicateRid = Boolean(
    error &&
      typeof error === 'object' &&
      ((('code' in error) && (error as { code?: string }).code === '23505') ||
        (('message' in error) &&
          typeof (error as { message?: string }).message === 'string' &&
          (error as { message?: string }).message?.includes('pending_verifications_rid_key')))
  );

  if (isDuplicateRid && payload.rid) {
    const { data: updateData, error: updateError } = await supabase
      .from('pending_verifications')
      .update(insertPayload as unknown as never)
      .eq('rid', payload.rid)
      .select()
      .single();

    data = updateData;
    error = updateError;
  }

  if (error || !data) {
    console.error('createPendingVerification failed', error);
    throw new Error(`Failed to create pending verification: ${error?.message ?? 'unknown error'}`);
  }

  return data as PendingVerificationRecord;
}

export async function getPendingByRid(rid: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('pending_verifications')
    .select('*')
    .eq('rid', rid)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load pending verification: ${error.message}`);
  }

  return data ? (data as PendingVerificationRecord) : null;
}

export async function getPendingByEmail(email: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('pending_verifications')
    .select('*')
    .eq('email', email.trim().toLowerCase())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load pending verification by email: ${error.message}`);
  }

  return data ? (data as PendingVerificationRecord) : null;
}

export async function deletePendingVerification(idOrRid: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('pending_verifications')
    .delete()
    .or(`id.eq.${idOrRid},rid.eq.${idOrRid}`);

  if (error) {
    throw new Error(`Failed to delete pending verification: ${error.message}`);
  }
}

export async function purgeExpiredPending() {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('pending_verifications')
    .delete()
    .lt('expires_at', new Date().toISOString());

  if (error) {
    throw new Error(`Failed to purge pending verifications: ${error.message}`);
  }
}
