import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withCors, preflightResponse } from "@/lib/http/cors";
import { resolveAllowedOrigin } from "@/lib/http/allowed-origin";
import { isAdminRequestAuthorized } from "@/lib/api/admin-auth";
import { verifyCsrf, generateCsrfToken } from "@/lib/http/csrf";
import { getCorrelationId, log } from "@/lib/logging";
import {
  ensureDraftVersion,
  getCmsVersionWithBlocks,
  saveCmsDraftVersion,
} from "@/lib/data/cms";
import { cmsBlockTypes } from "@/lib/cms/block-registry";

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

const getSchema = z.object({
  id: z.string().uuid(),
});

const blockSchema = z.object({
  id: z.string().optional(),
  type: z.enum(cmsBlockTypes),
  visible: z.boolean().optional(),
  data: z.record(z.string(), z.unknown()),
});

const saveSchema = z.object({
  pageId: z.string().uuid(),
  slug: z.string().min(1),
  locale: z.string().min(2),
  versionId: z.string().uuid().optional(),
  summary: z.string().optional().nullable(),
  blocks: blockSchema.array(),
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
    const params = getSchema.parse(
      Object.fromEntries(req.nextUrl.searchParams.entries())
    );
    const payload = await getCmsVersionWithBlocks(params.id);
    const response = NextResponse.json(payload);
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
    log.error("admin_cms_version_get_error", error, {
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
    const body = await req.json().catch(() => ({}));
    const parsed = saveSchema.parse(body ?? {});
    const versionId =
      parsed.versionId ??
      (
        await ensureDraftVersion({
          pageId: parsed.pageId,
          locale: parsed.locale,
          actorEmail: req.headers.get("x-admin-email"),
          slug: parsed.slug,
        })
      ).id;

    const payload = await saveCmsDraftVersion({
      versionId,
      summary: parsed.summary,
      blocks: parsed.blocks,
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
          { status: 400 }
        )
      );
    }
    log.error("admin_cms_version_save_error", error, {
      correlationId: getCorrelationId(req),
    });
    return cors(
      req,
      NextResponse.json({ error: "Internal server error" }, { status: 500 })
    );
  }
}
