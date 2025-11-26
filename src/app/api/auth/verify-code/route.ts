import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  verifyEmailCode,
  buildVerificationPurpose,
} from "@/lib/data/email-verifications";
import { log, getCorrelationId } from "@/lib/logging";
import { withCors, preflightResponse } from "@/lib/http/cors";

const requestSchema = z.object({
  email: z.string().email(),
  code: z.string().min(4).max(12),
  type: z
    .enum([
      "visit",
      "bonus",
      "generic",
      "admin_login",
      "partner_login",
      "staff_login",
      "admin_signup",
      "partner_signup",
      "staff_signup",
      "admin_password_reset",
      "partner_password_reset",
      "staff_password_reset",
    ])
    .default("generic"),
  partnerId: z.string().min(1).optional(),
});

export function OPTIONS() {
  return preflightResponse({ methods: "POST, OPTIONS", headers: "Content-Type" });
}

export async function POST(req: NextRequest) {
  const correlationId = getCorrelationId(req);
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(
        NextResponse.json(
          { error: "ValidationError", details: parsed.error.flatten() },
          { status: 400 },
        ),
      );
    }

    const { email, code, type, partnerId } = parsed.data;
    const purpose = buildVerificationPurpose({
      partnerId,
      type,
    });

    const result = await verifyEmailCode({
      email,
      purpose,
      code,
    });

    if (!result.valid) {
      log.warn("email_verification_failed", {
        email,
        purpose,
        reason: result.reason,
        correlationId,
      });
      return withCors(
        NextResponse.json(
          {
            error: "Invalid code",
            reason: result.reason,
          },
          { status: 400 },
        ),
      );
    }

    log.info("email_verification_success", {
      email,
      purpose,
      correlationId,
    });

    return withCors(
      NextResponse.json({
        ok: true,
        verifiedAt: result.verifiedAt ?? null,
        alreadyVerified: result.alreadyVerified ?? false,
      }),
    );
  } catch (error) {
    log.error("email_verification_verify_request_error", error, {
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
