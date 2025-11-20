import { NextRequest, NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { createClient, type Session } from "@supabase/supabase-js";

import { signJwt } from "@/lib/auth/jwt";
import {
  getPartnerUserByEmail,
  touchPartnerUserLogin,
} from "@/lib/data/partner-users";
import {
  getPartnerStaffByEmail,
  touchPartnerStaffLogin,
} from "@/lib/data/staff";
import { preflightResponse, withCors } from "@/lib/http/cors";
import { generateCsrfToken } from "@/lib/http/csrf";
import { log, getCorrelationId } from "@/lib/logging";
import { verifyPassword } from "@/lib/auth/passwords";
import { ensureSupabaseUser } from "@/lib/auth/supabase-admin-auth";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const JWT_SECRET = process.env.JWT_SECRET || "";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "12h";
const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
  role: z.enum(["admin", "partner", "staff"]).optional(),
});

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function requestedRoleMatches(
  recordRole: "admin" | "partner" | "staff",
  requested?: "admin" | "partner" | "staff",
) {
  if (!requested) return true;
  return recordRole === requested;
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

export function OPTIONS() {
  return preflightResponse({
    methods: "POST, OPTIONS",
    headers: "Content-Type, Authorization",
  });
}

function unauthorizedResponse(message = "Invalid credentials") {
  return withCors(
    NextResponse.json({ error: message }, { status: 401 }),
    { methods: "POST, OPTIONS", headers: "Content-Type, Authorization" },
  );
}

function attachSupabaseSessionCookies(
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

export async function POST(req: NextRequest) {
  if (!JWT_SECRET) {
    console.error("JWT_SECRET missing in environment");
    return withCors(
      NextResponse.json({ error: "Server misconfiguration" }, { status: 500 }),
      { methods: "POST, OPTIONS", headers: "Content-Type, Authorization" },
    );
  }

  try {
    const body = await req.json();
    const payload = loginSchema.parse(body ?? {});
    const email = normalizeEmail(payload.email);
    const password = payload.password;
    const requestedRole = payload.role;
    const cid = getCorrelationId(req);
    log.info("auth_login_attempt", {
      email,
      requestedRole,
      correlationId: cid,
    });

    const adminSecretMatched = Boolean(
      ADMIN_SECRET &&
        password === ADMIN_SECRET &&
        (!requestedRole || requestedRole === "admin"),
    );

    if (adminSecretMatched) {
      const token = signJwt({ email, role: "admin" }, { expiresIn: JWT_EXPIRES_IN });
      const response = NextResponse.json(
        {
          token,
          user: {
            email,
            role: "admin",
          },
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
      log.info("auth_login_success_admin", { email, correlationId: cid });
      return withCors(response, {
        methods: "POST, OPTIONS",
        headers: "Content-Type, Authorization",
      });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      log.error("supabase_credentials_missing", null, { correlationId: cid });
      return withCors(
        NextResponse.json({ error: "Server misconfiguration" }, { status: 500 }),
        { methods: "POST, OPTIONS", headers: "Content-Type, Authorization" },
      );
    }

    const partnerRecord = await getPartnerUserByEmail(email);
    const staffRecord = await getPartnerStaffByEmail(email);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    async function attemptSupabaseRecovery(): Promise<Session | null> {
      if (requestedRole === "staff" || (!requestedRole && staffRecord)) {
        if (staffRecord?.password_hash) {
          log.info("auth_login_staff_recovery_attempt", {
            email,
            hasPasswordHash: Boolean(staffRecord.password_hash),
            partnerId: staffRecord.partner_id,
            correlationId: cid,
          });
          log.info("auth_login_staff_hash_snapshot", {
            email,
            partnerId: staffRecord.partner_id,
            hashPrefix: staffRecord.password_hash.slice(0, 8),
            correlationId: cid,
          });
          const passwordMatches = await verifyPassword(
            password,
            staffRecord.password_hash,
          );
          if (passwordMatches) {
            try {
              const supabaseUser = await ensureSupabaseUser({
                supabase,
                email,
                password,
                metadata: {
                  last_login_recovery: "staff",
                  partner_id: staffRecord.partner_id,
                },
              });

              if (
                !staffRecord.auth_user_id ||
                staffRecord.auth_user_id !== supabaseUser.id
              ) {
                await supabase
                  .from("partner_staff")
                  .update({ auth_user_id: supabaseUser.id } as never)
                  .eq("id", staffRecord.id);
              }

              const retry = await supabase.auth.signInWithPassword({
                email,
                password,
              });
              if (!retry.error && retry.data?.session) {
                log.info("auth_login_supabase_recovered_staff", {
                  email,
                  partnerId: staffRecord.partner_id,
                  correlationId: cid,
                });
                return retry.data.session;
              }
              log.warn("auth_login_supabase_recovery_staff_retry_failed", {
                email,
                partnerId: staffRecord.partner_id,
                reason: retry.error?.message ?? "unknown",
                correlationId: cid,
              });
            } catch (error) {
              log.error("auth_login_supabase_recovery_staff_failed", error, {
                email,
                partnerId: staffRecord?.partner_id ?? null,
                correlationId: cid,
              });
            }
          } else {
            log.warn("auth_login_staff_recovery_password_mismatch", {
              email,
              partnerId: staffRecord.partner_id,
              correlationId: cid,
            });
          }
        } else {
          log.warn("auth_login_staff_recovery_missing_hash", {
            email,
            partnerId: staffRecord?.partner_id ?? null,
            correlationId: cid,
          });
        }
      }

      if (partnerRecord) {
        const hashed = partnerRecord.password_hash;
        if (hashed) {
          log.info("auth_login_partner_recovery_attempt", {
            email,
            role: partnerRecord.role,
            partnerId: partnerRecord.partner_id,
            correlationId: cid,
          });
          log.info("auth_login_partner_hash_snapshot", {
            email,
            role: partnerRecord.role,
            partnerId: partnerRecord.partner_id,
            hashPrefix: hashed.slice(0, 8),
            correlationId: cid,
          });
          const passwordMatches = await verifyPassword(password, hashed);
          if (passwordMatches) {
            try {
              const supabaseUser = await ensureSupabaseUser({
                supabase,
                email,
                password,
                metadata: {
                  last_login_recovery: partnerRecord.role,
                  partner_id: partnerRecord.partner_id ?? null,
                },
              });

              if (
                !partnerRecord.auth_user_id ||
                partnerRecord.auth_user_id !== supabaseUser.id
              ) {
                await supabase
                  .from("partner_users")
                  .update({ auth_user_id: supabaseUser.id } as never)
                  .eq("email", email);
              }

              const retry = await supabase.auth.signInWithPassword({
                email,
                password,
              });
              if (!retry.error && retry.data?.session) {
                log.info("auth_login_supabase_recovered_partner", {
                  email,
                  role: partnerRecord.role,
                  partnerId: partnerRecord.partner_id,
                  correlationId: cid,
                });
                return retry.data.session;
              }
              log.warn("auth_login_supabase_recovery_partner_retry_failed", {
                email,
                role: partnerRecord.role,
                partnerId: partnerRecord.partner_id,
                reason: retry.error?.message ?? "unknown",
                correlationId: cid,
              });
            } catch (error) {
              log.error("auth_login_supabase_recovery_partner_failed", error, {
                email,
                role: partnerRecord.role,
                partnerId: partnerRecord.partner_id,
                correlationId: cid,
              });
            }
          } else {
            log.warn("auth_login_partner_recovery_password_mismatch", {
              email,
              role: partnerRecord.role,
              partnerId: partnerRecord.partner_id,
              correlationId: cid,
            });
          }
        } else {
          log.warn("auth_login_partner_recovery_missing_hash", {
            email,
            role: partnerRecord.role,
            partnerId: partnerRecord.partner_id,
            correlationId: cid,
          });
        }
      }

      return null;
    }

    const initialSignIn = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    let supabaseSession = initialSignIn.data?.session ?? null;

    if (initialSignIn.error || !supabaseSession) {
      log.warn("auth_login_supabase_invalid", {
        email,
        requestedRole,
        reason: initialSignIn.error?.message ?? "unknown",
        correlationId: cid,
      });

      supabaseSession = await attemptSupabaseRecovery();
      if (!supabaseSession) {
        log.warn("auth_login_recovery_failed", {
          email,
          requestedRole,
          correlationId: cid,
        });
        return unauthorizedResponse();
      }
    }

    const maxAge = resolveMaxAgeSeconds();

    async function handlePartner(record: NonNullable<typeof partnerRecord>) {
      if (!requestedRoleMatches(record.role, requestedRole)) {
        log.warn("auth_login_partner_role_mismatch", {
          email,
          recordRole: record.role,
          requestedRole,
          correlationId: cid,
        });
        return unauthorizedResponse();
      }

      if (record.role === "partner" && !record.partner_id) {
        log.warn("auth_login_partner_missing_partner_id", {
          email,
          correlationId: cid,
        });
        return unauthorizedResponse();
      }

      await touchPartnerUserLogin(email);

      const tokenPayload: Record<string, unknown> = {
        email,
        role: record.role,
      };

      if (record.role === "partner" && record.partner_id) {
        tokenPayload.partnerId = record.partner_id;
      }
      if (record.name) {
        tokenPayload.name = record.name;
      }

      const token = signJwt(tokenPayload, { expiresIn: JWT_EXPIRES_IN });
      const response = NextResponse.json(
        {
          token,
          user: {
            email,
            role: record.role,
            partnerId: record.partner_id,
            name: record.name,
          },
        },
        { status: 200 },
      );

      response.cookies.set("zabava_token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge,
      });
      response.cookies.set("zabava_role", record.role, {
        httpOnly: false,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge,
      });
      if (record.partner_id) {
        response.cookies.set("zabava_partner", record.partner_id, {
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
      attachSupabaseSessionCookies(response, supabaseSession);

      log.info(
        record.role === "admin"
          ? "auth_login_success_admin"
          : "auth_login_success_partner",
        {
          email,
          partnerId: record.partner_id,
          role: record.role,
          correlationId: cid,
        },
      );
      return withCors(response, {
        methods: "POST, OPTIONS",
        headers: "Content-Type, Authorization",
      });
    }

    async function handleStaff(record: NonNullable<typeof staffRecord>) {
      if (record.status !== "active") {
        log.warn("auth_login_staff_inactive", {
          email,
          status: record.status,
          correlationId: cid,
        });
        return unauthorizedResponse("Account inactive");
      }

      await touchPartnerStaffLogin(record.id);

      const tokenPayload: Record<string, unknown> = {
        email,
        role: "staff",
        partnerId: record.partner_id,
        staffId: record.id,
      };
      if (record.name) {
        tokenPayload.name = record.name;
      }

      const token = signJwt(tokenPayload, { expiresIn: JWT_EXPIRES_IN });
      const response = NextResponse.json(
        {
          token,
          user: {
            email,
            role: "staff",
            partnerId: record.partner_id,
            staffId: record.id,
            name: record.name,
          },
        },
        { status: 200 },
      );

      response.cookies.set("zabava_token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge,
      });
      response.cookies.set("zabava_role", "staff", {
        httpOnly: false,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge,
      });
      response.cookies.set("zabava_partner", record.partner_id, {
        httpOnly: false,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge,
      });
      response.cookies.set("zabava_staff", record.id, {
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

      log.info("auth_login_success_staff", {
        email,
        partnerId: record.partner_id,
        staffId: record.id,
        correlationId: cid,
      });
      return withCors(response, {
        methods: "POST, OPTIONS",
        headers: "Content-Type, Authorization",
      });
    }

    if (requestedRole === "staff") {
      if (!staffRecord) {
        log.warn("auth_login_staff_not_found", { email, correlationId: cid });
        return unauthorizedResponse();
      }
      return handleStaff(staffRecord);
    }

    if (requestedRole === "admin" || requestedRole === "partner") {
      if (!partnerRecord) {
        log.warn("auth_login_partner_not_found", {
          email,
          requestedRole,
          correlationId: cid,
        });
        return unauthorizedResponse();
      }
      return handlePartner(partnerRecord);
    }

    if (partnerRecord) {
      return handlePartner(partnerRecord);
    }

    if (staffRecord) {
      return handleStaff(staffRecord);
    }

    log.warn("auth_login_unmapped_user", { email, correlationId: cid });
    return unauthorizedResponse();
  } catch (err) {
    if (err instanceof ZodError) {
      return withCors(
        NextResponse.json(
          { error: "Validation error", details: err.flatten() },
          { status: 400 },
        ),
        { methods: "POST, OPTIONS", headers: "Content-Type, Authorization" },
      );
    }

    log.error("auth_login_error", err, { correlationId: getCorrelationId(req) });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      { methods: "POST, OPTIONS", headers: "Content-Type, Authorization" },
    );
  }
}
