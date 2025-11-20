import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withCors, preflightResponse } from "@/lib/http/cors";
import { generateCsrfToken, verifyCsrf } from "@/lib/http/csrf";
import { log, getCorrelationId } from "@/lib/logging";
import { isAdminRequestAuthorized } from "@/lib/api/admin-auth";
import {
  createGlobalValue,
  createGlobalValueSchema,
  globalValueTypeSchema,
  listGlobalValues,
} from "@/lib/data/global-values";
import { resolveAllowedOrigin } from "@/lib/http/allowed-origin";

const BASE_CORS = {
  methods: "GET,POST,OPTIONS",
  headers: "Content-Type, Authorization, x-admin-secret",
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

const listQuerySchema = z.object({
  type: globalValueTypeSchema.optional(),
  includeInactive: z
    .string()
    .optional()
    .transform((value) => value === "true"),
});

export function OPTIONS(req: NextRequest) {
  return preflightResponse(corsOptions(req));
}

export async function GET(req: NextRequest) {
  if (!isAdminRequestAuthorized(req)) {
    log.warn("admin_globals_unauthorized", {
      route: "admin/globals",
      method: req.method,
      correlationId: getCorrelationId(req),
    });
    return cors(req, NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }

  try {
    const params = listQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams.entries()),
    );
    const items = await listGlobalValues({
      type: params.type,
      includeInactive: params.includeInactive,
    });
    const response = NextResponse.json({ items });
    response.headers.set("x-csrf-token", generateCsrfToken());
    return cors(req, response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      log.warn("admin_globals_list_validation_error", {
        route: "admin/globals",
        method: req.method,
        correlationId: getCorrelationId(req),
        issues: error.flatten?.(),
      });
      return cors(
        req,
        NextResponse.json(
          { error: "ValidationError", issues: error.flatten() },
          { status: 400 },
        ),
      );
    }

    log.error("admin_globals_list_error", error, {
      route: "admin/globals",
      correlationId: getCorrelationId(req),
    });
    return cors(
      req,
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminRequestAuthorized(req)) {
    return cors(req, NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }
  if (!verifyCsrf(req)) {
    return cors(
      req,
      NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }),
    );
  }

  try {
    const body = await req.json();
    const payload = createGlobalValueSchema.parse(body ?? {});
    const created = await createGlobalValue(payload);
    const response = NextResponse.json({ item: created });
    response.headers.set("x-csrf-token", generateCsrfToken());
    log.info("admin_global_created", {
      type: created.type,
      key: created.key,
      id: created.id,
      correlationId: getCorrelationId(req),
    });
    return cors(req, response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      log.warn("admin_globals_create_validation_error", {
        route: "admin/globals",
        method: "POST",
        correlationId: getCorrelationId(req),
        issues: error.flatten?.(),
      });
      return cors(
        req,
        NextResponse.json(
          { error: "ValidationError", issues: error.flatten() },
          { status: 400 },
        ),
      );
    }
    log.error("admin_globals_create_error", error, {
      route: "admin/globals",
      correlationId: getCorrelationId(req),
    });
    return cors(
      req,
      NextResponse.json(
        { error: (error as Error)?.message ?? "Failed to create global" },
        { status: 500 },
      ),
    );
  }
}
