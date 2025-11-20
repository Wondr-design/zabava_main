import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { hashPassword } from "@/lib/auth/passwords";
import { signJwt } from "@/lib/auth/jwt";
import { generateCsrfToken } from "@/lib/http/csrf";
import { preflightResponse, withCors } from "@/lib/http/cors";
import { getPartnerUserByEmail, upsertPartnerUser } from "@/lib/data/partner-users";
import {
  buildVerificationPurpose,
  clearVerification,
  isEmailVerified,
} from "@/lib/data/email-verifications";
import { log, getCorrelationId } from "@/lib/logging";
import {
  attachSupabaseSessionCookies,
  ensureSupabaseConfigured,
  ensureSupabaseUser,
  getSupabaseAuthAdmin,
} from "@/lib/auth/supabase-admin-auth";

const JWT_SECRET = process.env.JWT_SECRET || "";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "12h";

const adminSignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1).max(120).optional(),
});

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function resolveMaxAgeSeconds() {
  const value = String(JWT_EXPIRES_IN || "12h").trim();
  const match = /^([0-9]+)([smhd])$/.exec(value);
  if (!match) return 60 * 60 * 12;
  const amount = Number(match[1]);
  const unit = match[2];
  if (unit === "s") return amount;
  if (unit === "m") return amount * 60;
  if (unit === "h") return amount * 60 * 60;
  if (unit === "d") return amount * 60 * 60 * 24;
  return 60 * 60 * 12;
}

export function OPTIONS() {
  return preflightResponse({ methods: "POST,OPTIONS", headers: "Content-Type" });
}

export async function POST(req: NextRequest) {
  const correlationId = getCorrelationId(req);
  try {
    ensureSupabaseConfigured();
  } catch (error) {
    log.error("admin_signup_supabase_not_configured", error, {
      correlationId,
    });
    return withCors(
      NextResponse.json({ error: "Server configuration error" }, { status: 500 }),
      { methods: "POST,OPTIONS", headers: "Content-Type" },
    );
  }

  if (!JWT_SECRET) {
    log.error("admin_signup_missing_jwt_secret", null, {
      correlationId,
    });
    return withCors(
      NextResponse.json({ error: "Server configuration error" }, { status: 500 }),
      { methods: "POST,OPTIONS", headers: "Content-Type" },
    );
  }

  try {
    const body = await req.json();
    const payload = adminSignupSchema.parse(body ?? {});
    const email = normalizeEmail(payload.email);
    const verificationPurpose = buildVerificationPurpose({ type: "admin_signup" });
    const supabase = getSupabaseAuthAdmin();

    const existing = await getPartnerUserByEmail(email);
    if (existing) {
      return withCors(
        NextResponse.json({ error: "Account already exists" }, { status: 409 }),
        { methods: "POST,OPTIONS", headers: "Content-Type" },
      );
    }

    const verified = await isEmailVerified({
      email,
      purpose: verificationPurpose,
    });
    if (!verified) {
      return withCors(
        NextResponse.json(
          { error: "Email verification required", message: "Verify your email with the code we sent before creating an account." },
          { status: 400 },
        ),
        { methods: "POST,OPTIONS", headers: "Content-Type" },
      );
    }

    const passwordHash = await hashPassword(payload.password);

    let supabaseUserId: string;
    try {
      const supabaseUser = await ensureSupabaseUser({
        supabase,
        email,
        password: payload.password,
        metadata: {
          origin: "admin_self_signup",
        },
      });
      supabaseUserId = supabaseUser.id;
    } catch (error) {
      log.error("admin_signup_supabase_user_error", error, {
        email,
        correlationId,
      });
      await clearVerification({ email, purpose: verificationPurpose });
      return withCors(
        NextResponse.json(
          { error: "Unable to create account" },
          { status: 500 },
        ),
        { methods: "POST,OPTIONS", headers: "Content-Type" },
      );
    }

    const account = await upsertPartnerUser({
      email,
      passwordHash,
      role: "admin",
      name: payload.name,
      verifiedAt: new Date(),
      metadata: {
        origin: "admin_self_signup",
      },
      authUserId: supabaseUserId,
    });

    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email,
        password: payload.password,
      });

    if (signInError) {
      log.warn("admin_signup_supabase_signin_failed", {
        email,
        reason: signInError.message,
        correlationId,
      });
    }

    const supabaseSession = signInData?.session ?? null;

    log.info("admin_self_signup_success", {
      email,
      correlationId,
    });

    const token = signJwt(
      {
        email,
        role: "admin",
        name: account.name ?? payload.name ?? null,
      },
      { expiresIn: JWT_EXPIRES_IN },
    );

    const response = NextResponse.json(
      {
        token,
        user: {
          email,
          role: "admin",
          name: account.name ?? payload.name ?? null,
        },
      },
      { status: 201 },
    );

    const maxAge = resolveMaxAgeSeconds();
    response.cookies.set("zabava_token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge,
    });
    response.cookies.set("zabava_role", "admin", {
      httpOnly: false,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge,
    });
    const csrf = generateCsrfToken();
    response.cookies.set("zabava_csrf", csrf, {
      httpOnly: false,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge,
    });
    attachSupabaseSessionCookies(response, supabaseSession);

    await clearVerification({ email, purpose: verificationPurpose });

    return withCors(response, { methods: "POST,OPTIONS", headers: "Content-Type" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withCors(
        NextResponse.json({ error: "ValidationError", details: error.flatten() }, { status: 400 }),
        { methods: "POST,OPTIONS", headers: "Content-Type" },
      );
    }

    log.error("admin_self_signup_error", error, {
      correlationId: getCorrelationId(req),
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      { methods: "POST,OPTIONS", headers: "Content-Type" },
    );
  }
}
