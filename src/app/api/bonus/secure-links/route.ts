import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createBonusSecureLink } from "@/lib/data/bonus-secure-links";
import { withCors, preflightResponse } from "@/lib/http/cors";
import { log, getCorrelationId } from "@/lib/logging";

const requestSchema = z.object({
  email: z.string().email(),
  ttlMinutes: z.number().int().min(5).max(24 * 60).optional(),
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

    const { email, ttlMinutes } = parsed.data;
    const link = await createBonusSecureLink(email, ttlMinutes);

    log.info("bonus_secure_link_created", {
      email,
      correlationId,
    });

    return withCors(
      NextResponse.json({
        token: link.token,
        expiresAt: link.expiresAt,
      }),
    );
  } catch (error) {
    log.error("bonus_secure_link_create_error", error, { correlationId });
    return withCors(
      NextResponse.json({ error: "Unable to create secure link" }, { status: 500 }),
    );
  }
}
