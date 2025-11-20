import crypto from "crypto";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

const DEFAULT_TTL_MINUTES = 30;
const TOKEN_BYTES = 24;

function createToken() {
  const random = crypto.randomBytes(TOKEN_BYTES).toString("hex");
  return random;
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createBonusSecureLink(inputEmail: string, ttlMinutes = DEFAULT_TTL_MINUTES) {
  const email = inputEmail.trim().toLowerCase();
  if (!email) {
    throw new Error("Email is required to create a secure link.");
  }

  const supabase = getSupabaseAdmin();
  const token = createToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString();

  const { error } = await supabase
    .from("bonus_secure_links")
    .insert({
      email,
      token_hash: tokenHash,
      expires_at: expiresAt,
    } as never);

  if (error) {
    throw new Error(`Failed to create secure link: ${error.message}`);
  }

  return {
    token,
    expiresAt,
  };
}

export type ConsumeBonusSecureLinkResult =
  | { status: "ok"; email: string; expiresAt: string }
  | { status: "invalid" | "consumed" | "expired" };

export async function consumeBonusSecureLink(token: string): Promise<ConsumeBonusSecureLinkResult> {
  if (!token) {
    return { status: "invalid" };
  }
  const supabase = getSupabaseAdmin();
  const tokenHash = hashToken(token);
  const { data, error } = await supabase
    .from("bonus_secure_links")
    .select("id, email, expires_at, consumed_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to validate secure link: ${error.message}`);
  }
  if (!data) {
    return { status: "invalid" };
  }

  const now = Date.now();
  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0;
  if (!expiresAt || expiresAt <= now) {
    return { status: "expired" };
  }
  if (data.consumed_at) {
    return { status: "consumed" };
  }

  const consumedAt = new Date().toISOString();
  const { error: updateError, data: updated } = await supabase
    .from("bonus_secure_links")
    .update({ consumed_at: consumedAt } as never)
    .eq("id", data.id)
    .is("consumed_at", null)
    .select("email, expires_at")
    .maybeSingle();

  if (updateError) {
    throw new Error(`Failed to consume secure link: ${updateError.message}`);
  }
  if (!updated) {
    return { status: "consumed" };
  }

  return {
    status: "ok",
    email: updated.email,
    expiresAt: updated.expires_at ?? consumedAt,
  };
}
