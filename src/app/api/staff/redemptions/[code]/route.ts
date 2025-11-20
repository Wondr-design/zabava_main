import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withCors, preflightResponse } from "@/lib/http/cors";
import { verifyCsrf } from "@/lib/http/csrf";
import { getAuthFromRequest } from "@/lib/auth/request";
import {
  getRedemptionByCode,
  markRedemptionUsed,
  rejectRedemption,
} from "@/lib/data/redemptions";
import { log, getCorrelationId } from "@/lib/logging";

const ACTION_SCHEMA = z.object({
  action: z.enum(["use", "reject"]),
});

const CORS_CONFIG = {
  methods: "POST,OPTIONS",
  headers: "Content-Type, Authorization",
} as const;

export function OPTIONS() {
  return preflightResponse(CORS_CONFIG);
}

export async function POST(request: NextRequest, context: unknown) {
  const correlationId = getCorrelationId(request);
  if (!verifyCsrf(request)) {
    return withCors(
      NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }),
      CORS_CONFIG,
    );
  }

  const params = (context as { params?: { code?: string } } | undefined)?.params;
  const code = params?.code?.trim();
  if (!code) {
    return withCors(
      NextResponse.json({ error: "Redemption code is required" }, { status: 400 }),
      CORS_CONFIG,
    );
  }

  const auth = getAuthFromRequest(request);
  if (!auth || (auth.role !== "staff" && auth.role !== "admin")) {
    return withCors(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      CORS_CONFIG,
    );
  }

  let payload: { action: "use" | "reject" };
  try {
    const json = await request.json();
    payload = ACTION_SCHEMA.parse(json ?? {});
  } catch (err) {
    const message =
      err instanceof z.ZodError ? "Invalid request" : "Malformed payload";
    return withCors(
      NextResponse.json({ error: message }, { status: 400 }),
      CORS_CONFIG,
    );
  }

  try {
    const redemption = await getRedemptionByCode(code);
    if (!redemption) {
      return withCors(
        NextResponse.json({ error: "Redemption not found" }, { status: 404 }),
        CORS_CONFIG,
      );
    }

    if (payload.action === "use") {
      const updated = await markRedemptionUsed({
        code,
        partnerId: redemption.partner_id ?? undefined,
        processedBy: {
          role: "staff",
          staffId: auth.staffId ?? null,
          email: auth.email ?? null,
          name: auth.name ?? null,
        },
      });
      return withCors(NextResponse.json({ redemption: updated ?? redemption }), CORS_CONFIG);
    }

    const rejected = await rejectRedemption({
      code,
      partnerId: redemption.partner_id ?? undefined,
      processedBy: {
        role: "staff",
        staffId: auth.staffId ?? null,
        email: auth.email ?? null,
        name: auth.name ?? null,
      },
    });
    return withCors(NextResponse.json({ redemption: rejected ?? redemption }), CORS_CONFIG);
  } catch (error) {
    log.error("staff_redemption_update_failed", error, {
      code,
      action: payload.action,
      correlationId,
    });
    return withCors(
      NextResponse.json({ error: "Failed to update redemption" }, { status: 500 }),
      CORS_CONFIG,
    );
  }
}
