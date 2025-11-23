import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withCors, preflightResponse } from "@/lib/http/cors";
import { resolveAllowedOrigin } from "@/lib/http/allowed-origin";
import { isAdminRequestAuthorized } from "@/lib/api/admin-auth";
import { verifyCsrf, generateCsrfToken } from "@/lib/http/csrf";
import { getCorrelationId, log } from "@/lib/logging";
import { listCmsPagesWithVersions, createCmsPage } from "@/lib/data/cms";
import { locales } from "@/i18n/config";

const BASE_CORS = {
  methods: "GET,POST,OPTIONS",
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

const createPageSchema = z.object({
  slug: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().optional(),
  seedLocale: z.enum(locales).optional(),
});

export function OPTIONS(req: NextRequest) {
  return preflightResponse(corsOptions(req));
}

export async function GET(req: NextRequest) {
  if (!isAdminRequestAuthorized(req)) {
    return cors(
      req,
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
  }

  try {
    const pages = await listCmsPagesWithVersions();
    const response = NextResponse.json({ pages });
    response.headers.set("x-csrf-token", generateCsrfToken());
    return cors(req, response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return cors(
        req,
        NextResponse.json(
          { error: "ValidationError", issues: error.flatten() },
          { status: 400 }
        )
      );
    }
    log.error("admin_cms_list_error", error, {
      correlationId: getCorrelationId(req),
    });
    return cors(
      req,
      NextResponse.json({ error: "Internal server error" }, { status: 500 })
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminRequestAuthorized(req)) {
    return cors(
      req,
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
  }
  if (!verifyCsrf(req)) {
    return cors(
      req,
      NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
    );
  }

  try {
    const payload = await req.json().catch(() => ({}));
    const parsed = createPageSchema.parse(payload ?? {});
    const page = await createCmsPage({
      slug: parsed.slug,
      displayName: parsed.displayName,
      description: parsed.description,
      actorEmail: req.headers.get("x-admin-email"),
      seedLocale: parsed.seedLocale,
    });
    const response = NextResponse.json({ page });
    response.headers.set("x-csrf-token", generateCsrfToken());
    return cors(req, response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return cors(
        req,
        NextResponse.json(
          { error: "ValidationError", issues: error.flatten() },
          { status: 400 }
        )
      );
    }
    log.error("admin_cms_upsert_error", error, {
      correlationId: getCorrelationId(req),
    });
    return cors(
      req,
      NextResponse.json({ error: "Internal server error" }, { status: 500 })
    );
  }
}
