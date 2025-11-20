import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  issueVerificationCode,
  buildVerificationPurpose,
} from "@/lib/data/email-verifications";
import { log, getCorrelationId } from "@/lib/logging";
import { withCors, preflightResponse } from "@/lib/http/cors";
import { isEmailDeliveryConfigured, sendTemplatedEmail } from "@/lib/services/mailer";
import { EMAIL_TEMPLATE_DEFAULTS } from "@/lib/email-template-constants";

const requestSchema = z.object({
  email: z.string().email(),
  type: z
    .enum([
      "visit",
      "bonus",
      "generic",
      "admin_signup",
      "partner_signup",
      "staff_signup",
      "admin_password_reset",
      "partner_password_reset",
      "staff_password_reset",
    ])
    .default("generic"),
  partnerId: z.string().min(1).optional(),
  ttlMinutes: z.number().int().min(1).max(60).optional(),
});

async function sendNotification(payload: {
  email: string;
  code: string;
  purpose: string;
  expiresAt: string;
  partnerId?: string;
}) {
  try {
    if (!isEmailDeliveryConfigured()) {
      log.warn("email_verification_not_configured", payload);
      return;
    }
    const template = EMAIL_TEMPLATE_DEFAULTS.verification_code;
    await sendTemplatedEmail({
      to: payload.email,
      templateType: "verification_code",
      locale: "en",
      subjectOverride: template.subject,
      bodyOverride: `${template.body}\n\nCode: ${payload.code}\nExpires at: ${payload.expiresAt}`,
      details: [
        { label: "Code", value: payload.code },
        { label: "Expires", value: payload.expiresAt },
        { label: "Purpose", value: payload.purpose },
        { label: "Partner", value: payload.partnerId },
      ],
    });
  } catch (error) {
    log.error("email_verification_resend_error", error, payload);
  }
}

export function OPTIONS() {
  return preflightResponse({
    methods: "POST, OPTIONS",
    headers: "Content-Type",
  });
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
          { status: 400 }
        )
      );
    }

    const { email, type, partnerId, ttlMinutes } = parsed.data;
    const purpose = buildVerificationPurpose({
      partnerId,
      type,
    });

    const issued = await issueVerificationCode({
      email,
      purpose,
      ttlMinutes,
    });

    await sendNotification({
      email,
      code: issued.code,
      purpose,
      expiresAt: issued.expiresAt,
      partnerId: partnerId ?? undefined,
    });

    log.info("email_verification_code_issued", {
      email,
      purpose,
      correlationId,
    });

    return withCors(
      NextResponse.json({
        ok: true,
        expiresAt: issued.expiresAt,
      })
    );
  } catch (error) {
    log.error("email_verification_issue_request_error", error, {
      correlationId,
    });
    const message =
      error instanceof Error ? error.message : "Unable to request code.";
    const status = /wait before requesting|too many/i.test(message) ? 429 : 500;
    return withCors(
      NextResponse.json(
        {
          error: status === 429 ? "Too many requests" : "Internal server error",
          message,
        },
        { status }
      )
    );
  }
}
