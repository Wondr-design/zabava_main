import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withCors, preflightResponse } from "@/lib/http/cors";
import { generateCsrfToken, verifyCsrf } from "@/lib/http/csrf";
import { log, getCorrelationId } from "@/lib/logging";
import { isAdminRequestAuthorized } from "@/lib/api/admin-auth";
import {
  deleteGlobalValue,
  getGlobalValueById,
  updateGlobalValue,
  updateGlobalValueSchema,
} from "@/lib/data/global-values";
import { resolveAllowedOrigin } from "@/lib/http/allowed-origin";
import { revalidatePublicDirectory } from "@/lib/data/site-directory";

const BASE_CORS = {
  methods: "GET,PUT,DELETE,OPTIONS",
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

export function OPTIONS(req: NextRequest) {
  return preflightResponse(corsOptions(req));
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequestAuthorized(req)) {
    return cors(req, NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }
  const { id } = await context.params;
  try {
    const item = await getGlobalValueById(id);
    if (!item) {
      return cors(req, NextResponse.json({ error: "Not Found" }, { status: 404 }));
    }
    const response = NextResponse.json({ item });
    response.headers.set("x-csrf-token", generateCsrfToken());
    return cors(req, response);
  } catch (error) {
    log.error("admin_global_fetch_error", error, {
      route: "admin/globals/[id]",
      correlationId: getCorrelationId(req),
      id,
    });
    return cors(
      req,
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
    );
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequestAuthorized(req)) {
    return cors(req, NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }
  if (!verifyCsrf(req)) {
    return cors(
      req,
      NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }),
    );
  }

  const { id } = await context.params;

  try {
    const body = await req.json();
    const payload = updateGlobalValueSchema.parse(body ?? {});
    const updated = await updateGlobalValue(id, payload);
    if (!updated) {
      return cors(req, NextResponse.json({ error: "Not Found" }, { status: 404 }));
    }
    if (updated.type === "category") {
      revalidatePublicDirectory();
    }
    const response = NextResponse.json({ item: updated });
    response.headers.set("x-csrf-token", generateCsrfToken());
    log.info("admin_global_updated", {
      id,
      correlationId: getCorrelationId(req),
    });
    return cors(req, response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      log.warn("admin_globals_update_validation_error", {
        route: "admin/globals/[id]",
        method: "PUT",
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
    log.error("admin_global_update_error", error, {
      route: "admin/globals/[id]",
      correlationId: getCorrelationId(req),
      id,
    });
    return cors(
      req,
      NextResponse.json(
        { error: (error as Error)?.message ?? "Failed to update global" },
        { status: 500 },
      ),
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequestAuthorized(req)) {
    return cors(req, NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }
  if (!verifyCsrf(req)) {
    return cors(
      req,
      NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }),
    );
  }
  const { id } = await context.params;
  try {
    const existing = await getGlobalValueById(id);
    if (!existing) {
      return cors(req, NextResponse.json({ error: "Not Found" }, { status: 404 }));
    }
    await deleteGlobalValue(id);
    if (existing.type === "category") {
      revalidatePublicDirectory();
    }
    const response = NextResponse.json({ ok: true });
    response.headers.set("x-csrf-token", generateCsrfToken());
    log.info("admin_global_deleted", {
      id,
      correlationId: getCorrelationId(req),
    });
    return cors(req, response);
  } catch (error) {
    log.error("admin_global_delete_error", error, {
      route: "admin/globals/[id]",
      correlationId: getCorrelationId(req),
      id,
    });
    return cors(
      req,
      NextResponse.json({ error: "Failed to delete global" }, { status: 500 }),
    );
  }
}
