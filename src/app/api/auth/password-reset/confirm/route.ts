import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { hashPassword, verifyPassword } from "@/lib/auth/passwords";
import {
  verifyEmailCode,
  buildVerificationPurpose,
  clearVerification,
} from "@/lib/data/email-verifications";
import {
  getPartnerUserByEmail,
  updatePartnerUserPassword,
} from "@/lib/data/partner-users";
import {
  getPartnerStaffByEmail,
  updatePartnerStaffPassword,
} from "@/lib/data/staff";
import { preflightResponse, withCors } from "@/lib/http/cors";
import { log, getCorrelationId } from "@/lib/logging";
import {
  ensureSupabaseConfigured,
  ensureSupabaseUser,
  getSupabaseAuthAdmin,
} from "@/lib/auth/supabase-admin-auth";

const confirmSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "partner", "staff"]),
  code: z.string().min(4).max(12),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export function OPTIONS() {
  return preflightResponse({
    methods: "POST, OPTIONS",
    headers: "Content-Type",
  });
}

export async function POST(req: NextRequest) {
  const correlationId = getCorrelationId(req);
  try {
    ensureSupabaseConfigured();
  } catch (error) {
    log.error(
      "password_reset_supabase_not_configured",
      error instanceof Error ? error : null,
      {
        correlationId,
      },
    );
    return withCors(
      NextResponse.json(
        { error: "Server misconfiguration" },
        { status: 500 },
      ),
    );
  }
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = confirmSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(
        NextResponse.json(
          { error: "ValidationError", details: parsed.error.flatten() },
          { status: 400 },
        ),
      );
    }

    const { email, role, code, password } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();
    const supabase = getSupabaseAuthAdmin();

    log.info("password_reset_confirm_attempt", {
      email: normalizedEmail,
      role,
      correlationId,
    });

    let purposeType: Parameters<typeof buildVerificationPurpose>[0]["type"];

    if (role === "admin") {
      purposeType = "admin_password_reset";
    } else if (role === "partner") {
      purposeType = "partner_password_reset";
    } else {
      purposeType = "staff_password_reset";
    }

    const purpose = buildVerificationPurpose({ type: purposeType });

    const verification = await verifyEmailCode({
      email: normalizedEmail,
      purpose,
      code,
    });

    if (!verification.valid) {
      log.warn("password_reset_invalid_code", {
        email: normalizedEmail,
        role,
        purpose,
        reason: verification.reason,
        correlationId,
      });
      return withCors(
        NextResponse.json(
          {
            error: "Invalid code",
            reason: verification.reason,
          },
          { status: 400 },
        ),
      );
    }

    const passwordHash = await hashPassword(password);

    if (role === "admin" || role === "partner") {
      const user = await getPartnerUserByEmail(normalizedEmail);
      if (!user || user.role !== role) {
        await clearVerification({ email: normalizedEmail, purpose });
        return withCors(
          NextResponse.json(
            { error: "Account not found" },
            { status: 404 },
          ),
        );
      }

      const supabaseUser = await ensureSupabaseUser({
        supabase,
        email: normalizedEmail,
        password,
        metadata: {
          last_password_reset_role: role,
          last_password_reset_partner_id: user.partner_id ?? null,
        },
      });

      await updatePartnerUserPassword({
        email: normalizedEmail,
        passwordHash,
      });
      log.info("password_reset_partner_hash_updated", {
        email: normalizedEmail,
        role,
        hashPrefix: passwordHash.slice(0, 8),
        correlationId,
      });
      if (!user.auth_user_id || user.auth_user_id !== supabaseUser.id) {
        try {
          await supabase
            .from("partner_users")
            .update({ auth_user_id: supabaseUser.id } as never)
            .eq("email", normalizedEmail);
        } catch (updateError) {
          log.warn("password_reset_partner_auth_id_update_failed", {
            email: normalizedEmail,
            authUserId: supabaseUser.id,
            error: updateError instanceof Error ? updateError.message : updateError,
            correlationId,
          });
        }
      }
      const refreshedUser = await getPartnerUserByEmail(normalizedEmail);
      const passwordOk = refreshedUser
        ? await verifyPassword(password, refreshedUser.password_hash ?? "")
        : false;
      if (!passwordOk) {
        log.error("password_reset_partner_mismatch", {
          email: normalizedEmail,
          role,
          correlationId,
        });
        await clearVerification({ email: normalizedEmail, purpose });
        return withCors(
          NextResponse.json(
            { error: "Unable to persist password" },
            { status: 500 },
          ),
        );
      }
      log.info("password_reset_partner_success", {
        email: normalizedEmail,
        role,
        correlationId,
      });
    } else {
      const staff = await getPartnerStaffByEmail(normalizedEmail);
      if (!staff) {
        await clearVerification({ email: normalizedEmail, purpose });
        return withCors(
          NextResponse.json(
            { error: "Account not found" },
            { status: 404 },
          ),
        );
      }

      const supabaseUser = await ensureSupabaseUser({
        supabase,
        email: normalizedEmail,
        password,
        metadata: {
          last_password_reset_role: "staff",
          last_password_reset_partner_id: staff.partner_id,
        },
      });

      const updatedStaff = await updatePartnerStaffPassword({
        email: normalizedEmail,
        passwordHash,
        staffId: staff.id,
      });
      log.info("password_reset_staff_hash_updated", {
        email: normalizedEmail,
        staffId: staff.id,
        hashPrefix: passwordHash.slice(0, 8),
        correlationId,
      });
      if (!updatedStaff) {
        await clearVerification({ email: normalizedEmail, purpose });
        return withCors(
          NextResponse.json(
            { error: "Account not found" },
            { status: 404 },
          ),
        );
      }
      if (!staff.auth_user_id || staff.auth_user_id !== supabaseUser.id) {
        try {
          await supabase
            .from("partner_staff")
            .update({ auth_user_id: supabaseUser.id } as never)
            .eq("id", staff.id);
        } catch (updateError) {
          log.warn("password_reset_staff_auth_id_update_failed", {
            email: normalizedEmail,
            staffId: staff.id,
            authUserId: supabaseUser.id,
            error: updateError instanceof Error ? updateError.message : updateError,
            correlationId,
          });
        }
      }

      const refreshedStaff = await getPartnerStaffByEmail(normalizedEmail);
      const passwordOk = refreshedStaff
        ? await verifyPassword(password, refreshedStaff.password_hash ?? "")
        : false;
      if (!passwordOk) {
        log.error("password_reset_staff_mismatch", {
          email: normalizedEmail,
          staffId: staff.id,
          correlationId,
        });
        await clearVerification({ email: normalizedEmail, purpose });
        return withCors(
          NextResponse.json(
            { error: "Unable to persist password" },
            { status: 500 },
          ),
        );
      }
    }

    await clearVerification({ email: normalizedEmail, purpose });

    log.info("password_reset_confirmed", {
      email: normalizedEmail,
      role,
      purpose,
      correlationId,
    });

    return withCors(
      NextResponse.json({ ok: true }),
    );
  } catch (error) {
    log.error("password_reset_confirm_error", error, {
      correlationId,
    });
    return withCors(
      NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      ),
    );
  }
}
