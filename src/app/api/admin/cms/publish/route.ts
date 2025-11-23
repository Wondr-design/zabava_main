import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withCors, preflightResponse } from "@/lib/http/cors";
import { resolveAllowedOrigin } from "@/lib/http/allowed-origin";
import { isAdminRequestAuthorized } from "@/lib/api/admin-auth";
import { verifyCsrf, generateCsrfToken } from "@/lib/http/csrf";
import { getCorrelationId, log } from "@/lib/logging";
import { publishCmsVersion } from "@/lib/data/cms";

const BASE_CORS = {
  methods: "POST,OPTIONS",
  headers: "Content-Type, Authorization, x-admin-secret, x-csrf-token",
} as const;

function corsOptions(req: NextRequest) {
  return {
    ...BASE_CORS,
    origin: resolveAllowedOrigin(req),
    credentials: true,
  } as const;
}

function cors(req: NextRequest, response: NextResponse) {
  return withCors(response, corsOptions(req));
}

const publishSchema = z.object({
  versionId: z.string().uuid(),
});

export function OPTIONS(req: NextRequest) {
  return preflightResponse(corsOptions(req));
}

export async function POST(req: NextRequest) {
  if (!isAdminRequestAuthorized(req)) {
    return cors(
      req,
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }
  if (!verifyCsrf(req)) {
    return cors(
      req,
      NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }),
    );
  }
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = publishSchema.parse(body ?? {});
    const payload = await publishCmsVersion({
      versionId: parsed.versionId,
      actorEmail: req.headers.get("x-admin-email"),
    });
    const response = NextResponse.json(payload);
    response.headers.set("x-csrf-token", generateCsrfToken());
    return cors(req, response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return cors(
        req,
        NextResponse.json(
          { error: "ValidationError", issues: error.flatten() },
          { status: 400 },
        ),
      );
    }
    log.error("admin_cms_publish_error", error, {
      correlationId: getCorrelationId(req),
    });
    return cors(
      req,
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
    );
  }
}

