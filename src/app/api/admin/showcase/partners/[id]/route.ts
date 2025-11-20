import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { z } from "zod";

import { getAuthFromRequest } from "@/lib/auth/request";
import {
  getPartnerShowcase,
  listPartnerCategoryAssignments,
  partnerShowcaseSchema,
  savePartnerShowcase,
  setPartnerCategories,
} from "@/lib/data/partner-showcase";
import { revalidatePublicDirectory } from "@/lib/data/site-directory";
import { preflightResponse, withCors } from "@/lib/http/cors";
import { verifyCsrf, generateCsrfToken } from "@/lib/http/csrf";
import { log, getCorrelationId } from "@/lib/logging";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const JWT_SECRET = process.env.JWT_SECRET || "";

const CORS_CONFIG = {
  methods: "GET,PUT,OPTIONS",
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
    log.warn("admin_showcase_auth_failed", {
      route: "admin/showcase/partners/:id",
      error: (err as Error)?.message,
      correlationId: getCorrelationId(req),
    });
    return false;
  }
}

const updateSchema = z.object({
  categoryIds: z.array(z.string()).optional(),
  showcase: z.unknown().optional(),
});

export function OPTIONS() {
  return preflightResponse(CORS_CONFIG);
}

export async function GET(
  request: Request,
  context: unknown,
) {
  const req = request as NextRequest;
  const params = (context as { params?: { id?: string } } | undefined)?.params ?? {};
  const id = params.id ?? "";
  if (!id) {
    return withCors(
      NextResponse.json({ error: "Partner ID is required" }, { status: 400 }),
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
    const [showcase, assignments] = await Promise.all([
      getPartnerShowcase(id),
      listPartnerCategoryAssignments(id),
    ]);
    const response = NextResponse.json({
      item: {
        showcase,
        categoryIds: assignments.map((entry) => entry.categoryId),
      },
    });
    response.headers.set("x-csrf-token", generateCsrfToken());
    return withCors(response, CORS_CONFIG);
  } catch (error) {
    log.error("admin_showcase_partner_get_error", error, {
      route: "admin/showcase/partners/:id",
      correlationId: getCorrelationId(req),
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      CORS_CONFIG
    );
  }
}

export async function PUT(
  request: Request,
  context: unknown,
) {
  const req = request as NextRequest;
  const params = (context as { params?: { id?: string } } | undefined)?.params ?? {};
  const id = params.id ?? "";
  if (!id) {
    return withCors(
      NextResponse.json({ error: "Partner ID is required" }, { status: 400 }),
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
    const payload = updateSchema.parse(body ?? {});

    if (payload.categoryIds) {
      await setPartnerCategories(id, payload.categoryIds);
    }

    if (payload.showcase) {
      const parsedShowcase = partnerShowcaseSchema.parse({
        partnerId: id,
        ...(payload.showcase as Record<string, unknown>),
      });
      await savePartnerShowcase(parsedShowcase);
    }

    revalidatePublicDirectory();

    const [showcase, assignments] = await Promise.all([
      getPartnerShowcase(id),
      listPartnerCategoryAssignments(id),
    ]);

    const response = NextResponse.json({
      item: {
        showcase,
        categoryIds: assignments.map((entry) => entry.categoryId),
      },
    });
    response.headers.set("x-csrf-token", generateCsrfToken());
    return withCors(response, CORS_CONFIG);
  } catch (error) {
    if (error instanceof z.ZodError) {
      log.warn("admin_showcase_partner_validation_error", {
        route: "admin/showcase/partners/:id",
        correlationId: getCorrelationId(req),
        issues: error.flatten?.(),
      });
      return withCors(
        NextResponse.json(
          { error: "ValidationError", issues: error.flatten() },
          { status: 400 }
        ),
        CORS_CONFIG
      );
    }
    log.error("admin_showcase_partner_put_error", error, {
      route: "admin/showcase/partners/:id",
      correlationId: getCorrelationId(req),
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      CORS_CONFIG
    );
  }
}
