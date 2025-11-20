import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { log, getCorrelationId } from "@/lib/logging";
import { preflightResponse, withCors } from "@/lib/http/cors";

const WEBHOOK_URL =
  process.env.REDEMPTION_EMAIL_WEBHOOK ||
  process.env.POINTS_EMAIL_WEBHOOK ||
  process.env.ZAPIER_POINTS_EMAIL_HOOK ||
  "";

const CORS_OPTIONS = {
  methods: "POST,OPTIONS",
  headers: "Content-Type, Authorization",
} as const;

const requestSchema = z.object({
  email: z.string().email(),
  code: z.string().min(6),
  rewardName: z.string().min(1),
  pointsSpent: z.number().int().nonnegative(),
  partnerId: z.string().optional(),
});

export function OPTIONS() {
  return preflightResponse(CORS_OPTIONS);
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const payload = requestSchema.parse(raw ?? {});
    const correlationId = getCorrelationId(req);

    if (!WEBHOOK_URL) {
      log.warn("points_email_webhook_missing", {
        correlationId,
        email: payload.email,
        code: payload.code,
      });
      return withCors(
        NextResponse.json(
          {
            success: true,
            message:
              "No webhook configured; email was not sent but request was accepted.",
          },
          { status: 202 }
        ),
        CORS_OPTIONS
      );
    }

    const body = {
      type: "points_used",
      email: payload.email,
      code: payload.code,
      rewardName: payload.rewardName,
      pointsSpent: payload.pointsSpent,
      partnerId: payload.partnerId ?? null,
      sentAt: new Date().toISOString(),
    };

    try {
      await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      log.info("points_email_webhook_sent", {
        correlationId,
        email: payload.email,
        code: payload.code,
      });
    } catch (error) {
      log.error("points_email_webhook_failed", error, {
        correlationId,
        email: payload.email,
        code: payload.code,
      });
      return withCors(
        NextResponse.json(
          { error: "Failed to deliver webhook notification" },
          { status: 502 }
        ),
        CORS_OPTIONS
      );
    }

    return withCors(
      NextResponse.json(
        {
          success: true,
          message: "Notification queued",
        },
        { status: 200 }
      ),
      CORS_OPTIONS
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withCors(
        NextResponse.json(
          { error: "ValidationError", issues: error.flatten() },
          { status: 400 }
        ),
        CORS_OPTIONS
      );
    }
    log.error("points_email_endpoint_error", error, {
      correlationId: getCorrelationId(req),
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      CORS_OPTIONS
    );
  }
}
