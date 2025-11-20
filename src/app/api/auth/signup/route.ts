import { NextRequest, NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { signJwt } from "@/lib/auth/jwt";
import { getPartnerInviteByToken, markInviteUsed } from "@/lib/data/invites";
import {
  getPartnerUserByEmail,
  upsertPartnerUser,
} from "@/lib/data/partner-users";
import {
  getStaffInviteByToken,
  markStaffInviteUsed,
} from "@/lib/data/staff-invites";
import { getPartnerStaffByEmail, upsertPartnerStaff } from "@/lib/data/staff";
import { hashPassword } from "@/lib/auth/passwords";
import { preflightResponse, withCors } from "@/lib/http/cors";
import { generateCsrfToken } from "@/lib/http/csrf";
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

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  token: z.string().min(10, "Invite token is required"),
  name: z.string().min(1).max(120).optional(),
});

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function isInviteExpired(expiresAt: string | null | undefined) {
  if (!expiresAt) return false;
  const expires = new Date(expiresAt).getTime();
  if (Number.isNaN(expires)) return false;
  return Date.now() > expires;
}

function resolveMaxAgeSeconds() {
  const v = String(JWT_EXPIRES_IN || "12h");
  const m = /^([0-9]+)([smhd])$/.exec(v.trim());
  if (!m) return 60 * 60 * 12;
  const n = Number(m[1]);
  const unit = m[2];
  if (unit === "s") return n;
  if (unit === "m") return n * 60;
  if (unit === "h") return n * 60 * 60;
  if (unit === "d") return n * 60 * 60 * 24;
  return 60 * 60 * 12;
}

async function isEmailVerifiedForPurposes(
  email: string,
  purposes: Array<string | null | undefined>,
) {
  for (const purpose of purposes) {
    if (!purpose) continue;
    const verified = await isEmailVerified({ email, purpose });
    if (verified) {
      return true;
    }
  }
  return false;
}

async function clearVerificationForPurposes(
  email: string,
  purposes: Array<string | null | undefined>,
) {
  for (const purpose of purposes) {
    if (!purpose) continue;
    await clearVerification({ email, purpose });
  }
}

function corsOptions() {
  return { methods: "POST, OPTIONS", headers: "Content-Type" } as const;
}

function corsResponse(response: NextResponse) {
  return withCors(response, corsOptions());
}

export function OPTIONS() {
  return preflightResponse(corsOptions());
}

export async function POST(req: NextRequest) {
  const correlationId = getCorrelationId(req);

  if (!JWT_SECRET) {
    log.error("auth_signup_missing_secret", null, { correlationId });
    return corsResponse(
      NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      ),
    );
  }

  try {
    ensureSupabaseConfigured();
  } catch (error) {
    log.error("auth_signup_supabase_unconfigured", error, { correlationId });
    return corsResponse(
      NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      ),
    );
  }

  const supabase = getSupabaseAuthAdmin();

  try {
    const body = await req.json();
    const payload = signupSchema.parse(body ?? {});
    const email = normalize(payload.email);

    log.info("auth_signup_attempt", {
      email,
      correlationId,
    });

    const partnerInvite = await getPartnerInviteByToken(payload.token);
    const staffInvite = partnerInvite
      ? null
      : await getStaffInviteByToken(payload.token);

    if (!partnerInvite && !staffInvite) {
      log.warn("auth_signup_invalid_token", {
        email,
        token: payload.token,
        correlationId,
      });
      return corsResponse(
        NextResponse.json(
          { error: "Invalid or expired invite" },
          { status: 400 },
        ),
      );
    }

    if (staffInvite) {
      if (staffInvite.used || staffInvite.status !== "pending") {
        log.warn("auth_signup_staff_invite_used", {
          email,
          token: staffInvite.token,
          status: staffInvite.status,
          correlationId,
        });
        return corsResponse(
          NextResponse.json(
            { error: "Invite already used" },
            { status: 400 },
          ),
        );
      }

      if (isInviteExpired(staffInvite.expires_at)) {
        log.warn("auth_signup_staff_invite_expired", {
          email,
          token: staffInvite.token,
          correlationId,
        });
        return corsResponse(
          NextResponse.json(
            { error: "Invite has expired" },
            { status: 400 },
          ),
        );
      }

      if (staffInvite.email && normalize(staffInvite.email) !== email) {
        log.warn("auth_signup_staff_email_mismatch", {
          inviteEmail: staffInvite.email,
          submittedEmail: email,
          token: staffInvite.token,
          correlationId,
        });
        return corsResponse(
          NextResponse.json(
            { error: "Invite email mismatch" },
            { status: 400 },
          ),
        );
      }

      const existingStaff = await getPartnerStaffByEmail(email);
      if (existingStaff && existingStaff.email) {
        log.warn("auth_signup_staff_exists", {
          email,
          correlationId,
        });
        return corsResponse(
          NextResponse.json(
            { error: "Account already exists" },
            { status: 409 },
          ),
        );
      }

      if (!staffInvite.partner_id) {
        log.error("auth_signup_staff_invite_missing_partner", null, {
          email,
          token: staffInvite.token,
          correlationId,
        });
        return corsResponse(
          NextResponse.json(
            { error: "Invite is misconfigured" },
            { status: 400 },
          ),
        );
      }

      const staffVerificationPurpose = buildVerificationPurpose({
        type: "staff_signup",
        partnerId: staffInvite.partner_id ?? undefined,
      });
      const staffVerificationFallback = buildVerificationPurpose({
        type: "staff_signup",
      });
      const staffEmailVerified = await isEmailVerifiedForPurposes(email, [
        staffVerificationPurpose,
        staffVerificationFallback,
      ]);
      if (!staffEmailVerified) {
        log.warn("auth_signup_staff_unverified", {
          email,
          partnerId: staffInvite.partner_id,
          correlationId,
        });
        return corsResponse(
          NextResponse.json(
            {
              error: "Email verification required",
              message:
                "Verify your email before accepting the staff invite.",
            },
            { status: 400 },
          ),
        );
      }

      const passwordHash = await hashPassword(payload.password);
      const staffName = payload.name || staffInvite.name || null;

      const supabaseUser = await ensureSupabaseUser({
        supabase,
        email,
        password: payload.password,
        metadata: {
          last_invite_role: "staff",
          last_invite_partner_id: staffInvite.partner_id,
        },
      });

      const staffRecord = await upsertPartnerStaff({
        partnerId: staffInvite.partner_id,
        email,
        passwordHash,
        name: staffName ?? undefined,
        status: "active",
        authUserId: supabaseUser.id,
      });

      await markStaffInviteUsed(staffInvite.token);

      await clearVerificationForPurposes(email, [
        staffVerificationPurpose,
        staffVerificationFallback,
      ]);

      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password: payload.password,
        });

      if (signInError) {
        log.warn("auth_signup_staff_supabase_signin_failed", {
          email,
          reason: signInError.message,
          correlationId,
        });
      }

      const session = signInData?.session ?? null;

      const token = signJwt(
        {
          sub: email,
          partnerId: staffRecord.partner_id,
          staffId: staffRecord.id,
          role: "staff",
          name: staffRecord.name ?? staffName ?? undefined,
        },
        { expiresIn: JWT_EXPIRES_IN },
      );

      const response = NextResponse.json(
        {
          token,
          user: {
            email,
            partnerId: staffRecord.partner_id,
            role: "staff",
            staffId: staffRecord.id,
            name: staffRecord.name ?? staffName ?? null,
          },
          expiresIn: JWT_EXPIRES_IN,
        },
        { status: 200 },
      );

      const maxAgeStaff = resolveMaxAgeSeconds();
      response.cookies.set("zabava_token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: maxAgeStaff,
      });
      response.cookies.set("zabava_role", "staff", {
        httpOnly: false,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: maxAgeStaff,
      });
      response.cookies.set("zabava_partner", staffRecord.partner_id, {
        httpOnly: false,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: maxAgeStaff,
      });
      response.cookies.set("zabava_staff", staffRecord.id, {
        httpOnly: false,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: maxAgeStaff,
      });
      const csrfStaff = generateCsrfToken();
      response.cookies.set("zabava_csrf", csrfStaff, {
        httpOnly: false,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: maxAgeStaff,
      });
      attachSupabaseSessionCookies(response, session);

      log.info("auth_signup_staff_success", {
        email,
        partnerId: staffRecord.partner_id,
        staffId: staffRecord.id,
        correlationId,
      });

      return corsResponse(response);
    }

    const invite = partnerInvite!;
    if (invite.used) {
      log.warn("auth_signup_partner_invite_used", {
        email,
        token: invite.token,
        correlationId,
      });
      return corsResponse(
        NextResponse.json(
          { error: "Invite already used" },
          { status: 400 },
        ),
      );
    }

    if (isInviteExpired(invite.expires_at)) {
      log.warn("auth_signup_partner_invite_expired", {
        email,
        token: invite.token,
        correlationId,
      });
      return corsResponse(
        NextResponse.json(
          { error: "Invite has expired" },
          { status: 400 },
        ),
      );
    }

    if (invite.email && normalize(invite.email) !== email) {
      log.warn("auth_signup_partner_email_mismatch", {
        inviteEmail: invite.email,
        submittedEmail: email,
        token: invite.token,
        correlationId,
      });
      return corsResponse(
        NextResponse.json(
          { error: "Invite email mismatch" },
          { status: 400 },
        ),
      );
    }

    const existingUser = await getPartnerUserByEmail(email);
    if (existingUser && existingUser.email) {
      log.warn("auth_signup_partner_exists", {
        email,
        role: existingUser.role,
        correlationId,
      });
      return corsResponse(
        NextResponse.json(
          { error: "Account already exists" },
          { status: 409 },
        ),
      );
    }

    const partnerId = invite.partner_id;
    if (!partnerId && invite.role !== "admin") {
      log.error("auth_signup_partner_missing_partner_id", null, {
        email,
        token: invite.token,
        correlationId,
      });
      return corsResponse(
        NextResponse.json(
          { error: "Invite is misconfigured" },
          { status: 400 },
        ),
      );
    }

    const partnerVerificationPurpose = buildVerificationPurpose({
      type: "partner_signup",
      partnerId: partnerId ?? undefined,
    });
    const partnerVerificationFallback = buildVerificationPurpose({
      type: "partner_signup",
    });
    const partnerEmailVerified = await isEmailVerifiedForPurposes(email, [
      partnerVerificationPurpose,
      partnerVerificationFallback,
    ]);
    if (!partnerEmailVerified) {
      log.warn("auth_signup_partner_unverified", {
        email,
        partnerId: partnerId ?? null,
        correlationId,
      });
      return corsResponse(
        NextResponse.json(
          {
            error: "Email verification required",
            message:
              "Verify your email before completing the partner signup.",
          },
          { status: 400 },
        ),
      );
    }

    const passwordHash = await hashPassword(payload.password);
    const role = invite.role || "partner";
    const name = payload.name || invite.name || null;

    const supabaseUser = await ensureSupabaseUser({
      supabase,
      email,
      password: payload.password,
      metadata: {
        last_invite_role: role,
        last_invite_partner_id: partnerId ?? null,
      },
    });

    await upsertPartnerUser({
      email,
      passwordHash,
      partnerId: partnerId ?? undefined,
      role,
      name: name ?? undefined,
      authUserId: supabaseUser.id,
    });

    const marked = await markInviteUsed(invite.token);
    if (!marked) {
      log.warn("auth_signup_partner_mark_invite_empty", {
        token: invite.token,
        correlationId,
      });
    }

    await clearVerificationForPurposes(email, [
      partnerVerificationPurpose,
      partnerVerificationFallback,
    ]);

    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email,
        password: payload.password,
      });

    if (signInError) {
      log.warn("auth_signup_partner_supabase_signin_failed", {
        email,
        reason: signInError.message,
        correlationId,
      });
    }

    const session = signInData?.session ?? null;

    const token = signJwt(
      {
        sub: email,
        partnerId: partnerId ?? undefined,
        role,
        name: name ?? undefined,
      },
      { expiresIn: JWT_EXPIRES_IN },
    );

    const response = NextResponse.json(
      {
        token,
        user: {
          email,
          partnerId: partnerId ?? null,
          role,
          name,
        },
        expiresIn: JWT_EXPIRES_IN,
      },
      { status: 200 },
    );

    const maxAge = resolveMaxAgeSeconds();

    response.cookies.set("zabava_token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge,
    });
    response.cookies.set("zabava_role", role, {
      httpOnly: false,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge,
    });
    if (partnerId) {
      response.cookies.set("zabava_partner", partnerId, {
        httpOnly: false,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge,
      });
    }
    const csrf = generateCsrfToken();
    response.cookies.set("zabava_csrf", csrf, {
      httpOnly: false,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge,
    });
    attachSupabaseSessionCookies(response, session);

    log.info("auth_signup_partner_success", {
      email,
      partnerId: partnerId ?? null,
      role,
      correlationId,
    });

    return corsResponse(response);
  } catch (err) {
    if (err instanceof ZodError) {
      return corsResponse(
        NextResponse.json(
          { error: "ValidationError", issues: err.flatten() },
          { status: 400 },
        ),
      );
    }

    log.error("auth_signup_error", err, { correlationId });
    return corsResponse(
      NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      ),
    );
  }
}
