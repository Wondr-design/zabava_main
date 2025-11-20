import { randomInt, randomUUID } from "node:crypto";

import { getSupabaseAdmin } from "../supabase-admin";
import { log } from "../logging";

const DEFAULT_CODE_LENGTH = Number(
  process.env.EMAIL_VERIFICATION_CODE_LENGTH ?? "6"
);
const DEFAULT_TTL_MINUTES = Number(
  process.env.EMAIL_VERIFICATION_TTL_MINUTES ?? "15"
);
const REQUEST_COOLDOWN_SECONDS = Number(
  process.env.EMAIL_VERIFICATION_REQUEST_COOLDOWN_SECONDS ?? "60"
);
const MAX_ATTEMPTS = Number(process.env.EMAIL_VERIFICATION_MAX_ATTEMPTS ?? "5");

export type VerificationPurpose =
  | "visit_registration"
  | "bonus_portal"
  | "generic"
  | "admin_signup"
  | "partner_signup"
  | "staff_signup"
  | "admin_password_reset"
  | "partner_password_reset"
  | "staff_password_reset";

interface VerificationRecord {
  id: string;
  email: string;
  purpose: string;
  code: string;
  attempts: number;
  verified_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function generateNumericCode(length: number) {
  const digits = Math.max(4, Math.min(length, 12));
  let code = "";
  while (code.length < digits) {
    const fragment = randomInt(0, 10).toString();
    code += fragment;
  }
  return code.slice(0, digits);
}

function resolveExpiry(minutes: number) {
  const ttlMinutes = Math.max(1, minutes);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  return expiresAt.toISOString();
}

function resolveCooldownTimestamp(seconds: number) {
  const delta = Math.max(0, seconds);
  return new Date(Date.now() - delta * 1000).toISOString();
}

export async function issueVerificationCode({
  email,
  purpose,
  ttlMinutes = DEFAULT_TTL_MINUTES,
  codeLength = DEFAULT_CODE_LENGTH,
}: {
  email: string;
  purpose: VerificationPurpose | string;
  ttlMinutes?: number;
  codeLength?: number;
}) {
  const normalizedEmail = normalizeEmail(email);
  const supabase = getSupabaseAdmin();

  // cooldown check
  const recentThreshold = resolveCooldownTimestamp(REQUEST_COOLDOWN_SECONDS);
  const { data: recentRows, error: recentError } = await supabase
    .from("email_verifications")
    .select("id, updated_at")
    .eq("email", normalizedEmail)
    .eq("purpose", purpose)
    .gte("updated_at", recentThreshold)
    .limit(1);

  if (recentError) {
    log.error("email_verification_issue_recent_error", recentError, {
      email: normalizedEmail,
      purpose,
    });
    throw new Error("Unable to request verification code right now.");
  }

  if (recentRows && recentRows.length > 0) {
    throw new Error("Please wait before requesting another code.");
  }

  const code = generateNumericCode(codeLength);
  const expiresAt = resolveExpiry(ttlMinutes);

  type UpsertPayload = {
    id?: string;
    email: string;
    purpose: string;
    code: string;
    attempts: number;
    verified_at: null;
    expires_at: string;
    updated_at?: string;
    created_at?: string;
  };

  const payload: UpsertPayload = {
    email: normalizedEmail,
    purpose,
    code,
    attempts: 0,
    verified_at: null,
    expires_at: expiresAt,
  };

  const { data, error } = await supabase
    .from("email_verifications")
    .upsert(
      [{ ...payload, id: randomUUID() }] as unknown as never,
      {
        onConflict: "email,purpose",
        ignoreDuplicates: false,
      } as unknown as never
    )
    .select()
    .single();

  if (error || !data) {
    log.error("email_verification_issue_error", error, {
      email: normalizedEmail,
      purpose,
    });
    throw new Error("Unable to request verification code.");
  }

  return {
    code,
    expiresAt,
    record: data as VerificationRecord,
  };
}

export async function verifyEmailCode({
  email,
  purpose,
  code,
}: {
  email: string;
  purpose: VerificationPurpose | string;
  code: string;
}) {
  const normalizedEmail = normalizeEmail(email);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("email_verifications")
    .select("*")
    .eq("email", normalizedEmail)
    .eq("purpose", purpose)
    .maybeSingle();

  if (error) {
    log.error("email_verification_lookup_error", error, {
      email: normalizedEmail,
      purpose,
    });
    throw new Error("Unable to verify code.");
  }

  const record = (data ?? null) as VerificationRecord | null;
  if (!record) {
    return { valid: false, reason: "not_found" as const };
  }

  if (record.verified_at) {
    return {
      valid: true,
      alreadyVerified: true,
      verifiedAt: record.verified_at,
    };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    return { valid: false, reason: "too_many_attempts" as const };
  }

  if (new Date(record.expires_at).getTime() < Date.now()) {
    return { valid: false, reason: "expired" as const };
  }

  const normalizedCode = code.trim();
  const isMatch = normalizedCode === record.code;

  const updates = isMatch
    ? {
        attempts: record.attempts + 1,
        verified_at: new Date().toISOString(),
      }
    : {
        attempts: record.attempts + 1,
      };

  const { error: updateError } = await supabase
    .from("email_verifications")
    .update(updates as unknown as never)
    .eq("id", record.id);

  if (updateError) {
    log.error("email_verification_update_error", updateError, {
      email: normalizedEmail,
      purpose,
    });
  }

  if (!isMatch) {
    return { valid: false, reason: "mismatch" as const };
  }

  return {
    valid: true,
    verifiedAt: (updates as { verified_at: string }).verified_at,
  };
}

export async function isEmailVerified({
  email,
  purpose,
}: {
  email: string;
  purpose: VerificationPurpose | string;
}) {
  const normalizedEmail = normalizeEmail(email);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("email_verifications")
    .select("verified_at, expires_at")
    .eq("email", normalizedEmail)
    .eq("purpose", purpose)
    .maybeSingle();

  if (error) {
    log.error("email_verification_is_verified_error", error, {
      email: normalizedEmail,
      purpose,
    });
    return false;
  }

  const record = (data ?? null) as {
    verified_at: string | null;
    expires_at: string | null;
  } | null;

  if (!record) return false;
  if (!record.verified_at) return false;
  if (!record.expires_at) return false;
  if (new Date(record.expires_at).getTime() < Date.now()) return false;
  return true;
}

export async function clearVerification({
  email,
  purpose,
}: {
  email: string;
  purpose: VerificationPurpose | string;
}) {
  const normalizedEmail = normalizeEmail(email);
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("email_verifications")
    .delete()
    .eq("email", normalizedEmail)
    .eq("purpose", purpose);
  if (error) {
    log.error("email_verification_clear_error", error, {
      email: normalizedEmail,
      purpose,
    });
  }
}

export function buildVerificationPurpose({
  partnerId,
  type,
}: {
  partnerId?: string | null;
  type:
    | "visit"
    | "bonus"
    | "generic"
    | "admin_signup"
    | "partner_signup"
    | "staff_signup"
    | "admin_password_reset"
    | "partner_password_reset"
    | "staff_password_reset";
}) {
  switch (type) {
    case "visit":
      return partnerId ? `visit_${partnerId}` : "visit_registration";
    case "bonus":
      return "bonus_portal";
    case "admin_signup":
      return "admin_signup";
    case "partner_signup":
      return partnerId ? `partner_signup_${partnerId}` : "partner_signup";
    case "staff_signup":
      return partnerId ? `staff_signup_${partnerId}` : "staff_signup";
    case "admin_password_reset":
      return "admin_password_reset";
    case "partner_password_reset":
      return "partner_password_reset";
    case "staff_password_reset":
      return "staff_password_reset";
    default:
      return "generic";
  }
}
