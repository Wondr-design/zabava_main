import { NextResponse } from "next/server";
import {
  createClient,
  type Session,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";

import { getEnv } from "@/lib/env";
const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

let cachedAdminClient: SupabaseClient | null = null;

export function getSupabaseAuthAdmin(): SupabaseClient {
  if (!cachedAdminClient) {
    const url = SUPABASE_URL || getEnv("SUPABASE_URL", true);
    const key =
      SUPABASE_SERVICE_ROLE_KEY ||
      getEnv("SUPABASE_SERVICE_ROLE_KEY", true);
    cachedAdminClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return cachedAdminClient;
}

export function ensureSupabaseConfigured() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase service role credentials are not configured");
  }
}

export async function findSupabaseUserByEmail(
  supabase: SupabaseClient,
  email: string,
  options?: { maxPages?: number },
): Promise<User | null> {
  const normalized = email.trim().toLowerCase();
  const perPage = 200;
  const maxPages = options?.maxPages ?? 5;

  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(
        error.message || "Failed to enumerate Supabase auth users",
      );
    }

    const candidates = data?.users ?? [];
    const match =
      candidates.find(
        (user) => user.email?.toLowerCase() === normalized,
      ) ?? null;
    if (match) {
      return match;
    }

    if (candidates.length < perPage) {
      break;
    }
  }

  return null;
}

export async function resolveSupabaseAuthUserId(
  supabase: SupabaseClient,
  email: string,
  existingId?: string | null,
): Promise<string | null> {
  if (existingId) return existingId;
  const existing = await findSupabaseUserByEmail(supabase, email);
  return existing?.id ?? null;
}

interface EnsureSupabaseUserParams {
  supabase: SupabaseClient;
  email: string;
  password: string;
  metadata?: Record<string, unknown>;
}

export async function ensureSupabaseUser(params: EnsureSupabaseUserParams) {
  const { supabase, email, password, metadata } = params;
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const existing = await findSupabaseUserByEmail(supabase, normalizedEmail);
    if (existing) {
      const { data, error } = await supabase.auth.admin.updateUserById(
        existing.id,
        {
          password,
          email_confirm: true,
          user_metadata: {
            ...(existing.user_metadata ?? {}),
            ...(metadata ?? {}),
          },
        },
      );
      if (error) {
        throw error;
      }
      return data?.user ?? existing;
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: metadata,
    });
    if (error || !data?.user) {
      throw error ?? new Error("Failed to create Supabase user");
    }
    return data.user;
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : "Supabase user provisioning failed",
    );
  }
}

export function attachSupabaseSessionCookies(
  response: NextResponse,
  session: Session | null,
) {
  if (!session) return;
  const accessMaxAge = session.expires_in ?? 60 * 60;
  response.cookies.set("sb-access-token", session.access_token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: accessMaxAge,
  });
  response.cookies.set("sb-refresh-token", session.refresh_token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}
