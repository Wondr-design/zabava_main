import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { ZodError } from "zod";

import { getAuthFromRequest } from "@/lib/auth/request";
import {
  deletePartnerForm,
  getPartnerFormById,
  updatePartnerForm,
  updatePartnerFormInputSchema,
} from "@/lib/data/partner-forms";
import { revalidatePublicDirectory } from "@/lib/data/site-directory";
import { generatePartnerFormEmbed } from "@/lib/services/partner-form-embed";
import { preflightResponse, withCors } from "@/lib/http/cors";
import { verifyCsrf, generateCsrfToken } from "@/lib/http/csrf";
import { log, getCorrelationId } from "@/lib/logging";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const JWT_SECRET = process.env.JWT_SECRET || "";

const CORS_CONFIG = {
  methods: "GET,PUT,DELETE,OPTIONS",
  headers: "Content-Type, Authorization, x-admin-secret",
} as const;

function isAuthorized(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (auth?.role === "admin") return true;

  const adminSecret = req.headers.get("x-admin-secret");
  if (ADMIN_SECRET && adminSecret === ADMIN_SECRET) {
    return true;
  }

  if (!JWT_SECRET) return false;
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.slice(7).trim();
  if (!token) return false;

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (typeof payload === "object" && payload && "role" in payload) {
      return (payload as { role?: string }).role === "admin";
    }
    return false;
  } catch (err) {
    log.warn("admin_forms_auth_failed", {
      route: "admin/forms/:id",
      error: (err as Error)?.message,
      correlationId: getCorrelationId(req),
    });
    return false;
  }
}

export function OPTIONS() {
  return preflightResponse(CORS_CONFIG);
}

export async function GET(request: Request, context: unknown) {
  const req = request as NextRequest;
  const params =
    (context as { params?: { id?: string } } | undefined)?.params ?? {};
  const id = params.id ?? "";
  if (!id) {
    return withCors(
      NextResponse.json({ error: "Form ID is required" }, { status: 400 }),
      CORS_CONFIG
    );
  }
  if (!isAuthorized(req)) {
    return withCors(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      CORS_CONFIG
    );
  }

  try {
    const form = await getPartnerFormById(id);
    if (!form) {
      return withCors(
        NextResponse.json({ error: "Not found" }, { status: 404 }),
        CORS_CONFIG
      );
    }

    const mode = req.nextUrl.searchParams.get("mode") ?? "json";
    if (mode === "embed") {
      const embed = generatePartnerFormEmbed(form);
      return withCors(
        new NextResponse(embed, {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
          },
        }),
        CORS_CONFIG
      );
    }

    const response = NextResponse.json({ item: form });
    response.headers.set("x-csrf-token", generateCsrfToken());
    return withCors(response, CORS_CONFIG);
  } catch (err) {
    log.error("admin_forms_detail_get_error", err, {
      route: "admin/forms/:id",
      correlationId: getCorrelationId(req),
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      CORS_CONFIG
    );
  }
}

export async function PUT(request: Request, context: unknown) {
  const req = request as NextRequest;
  const params =
    (context as { params?: { id?: string } } | undefined)?.params ?? {};
  const id = params.id ?? "";
  if (!id) {
    return withCors(
      NextResponse.json({ error: "Form ID is required" }, { status: 400 }),
      CORS_CONFIG
    );
  }
  if (!isAuthorized(req)) {
    return withCors(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      CORS_CONFIG
    );
  }
  if (!verifyCsrf(req)) {
    return withCors(
      NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }),
      CORS_CONFIG
    );
  }

  try {
    const body = await req.json();
    const auth = getAuthFromRequest(req);
    const payload = updatePartnerFormInputSchema
      .safeExtend({
        config: updatePartnerFormInputSchema.shape.config.optional(),
      })
      .parse(body ?? {});

    const updated = await updatePartnerForm(id, {
      ...payload,
      updatedBy: auth?.email ?? payload.updatedBy,
    });

    if (!updated) {
      return withCors(
        NextResponse.json({ error: "Not found" }, { status: 404 }),
        CORS_CONFIG
      );
    }

    const response = NextResponse.json({ item: updated });
    revalidatePublicDirectory();
    response.headers.set("x-csrf-token", generateCsrfToken());
    return withCors(response, CORS_CONFIG);
  } catch (err) {
    if (err instanceof ZodError) {
      log.warn("admin_forms_detail_validation_error", {
        route: "admin/forms/:id",
        method: "PUT",
        correlationId: getCorrelationId(req),
        issues: err.flatten?.(),
      });
      return withCors(
        NextResponse.json(
          { error: "ValidationError", issues: err.flatten() },
          { status: 400 }
        ),
        CORS_CONFIG
      );
    }
    log.error("admin_forms_detail_put_error", err, {
      route: "admin/forms/:id",
      correlationId: getCorrelationId(req),
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      CORS_CONFIG
    );
  }
}

export async function DELETE(request: Request, context: unknown) {
  const req = request as NextRequest;
  const params =
    (context as { params?: { id?: string } } | undefined)?.params ?? {};
  const id = params.id ?? "";
  if (!id) {
    return withCors(
      NextResponse.json({ error: "Form ID is required" }, { status: 400 }),
      CORS_CONFIG
    );
  }
  if (!isAuthorized(req)) {
    return withCors(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      CORS_CONFIG
    );
  }
  if (!verifyCsrf(req)) {
    return withCors(
      NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }),
      CORS_CONFIG
    );
  }

  try {
    await deletePartnerForm(id);
    revalidatePublicDirectory();
    const response = NextResponse.json({ ok: true });
    response.headers.set("x-csrf-token", generateCsrfToken());
    return withCors(response, CORS_CONFIG);
  } catch (err) {
    log.error("admin_forms_detail_delete_error", err, {
      route: "admin/forms/:id",
      correlationId: getCorrelationId(req),
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      CORS_CONFIG
    );
  }
}
