import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { ZodError, z } from "zod";

import { getAuthFromRequest } from "@/lib/auth/request";
import { createPartnerForm, listPartnerForms } from "@/lib/data/partner-forms";
import type { PartnerFormConfig } from "@/lib/data/partner-forms";
import { preflightResponse, withCors } from "@/lib/http/cors";
import { verifyCsrf, generateCsrfToken } from "@/lib/http/csrf";
import { log, getCorrelationId } from "@/lib/logging";
import { revalidatePublicDirectory } from "@/lib/data/site-directory";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const JWT_SECRET = process.env.JWT_SECRET || "";

const CORS_CONFIG = {
  methods: "GET,POST,OPTIONS",
  headers: "Content-Type, Authorization, x-admin-secret",
} as const;

function isAuthorized(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (auth?.role === "admin") return true;

  const adminSecret = req.headers.get("x-admin-secret");
  if (ADMIN_SECRET && adminSecret === ADMIN_SECRET) {
    return true;
  }

  if (!JWT_SECRET) {
    return false;
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return false;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (typeof payload === "object" && payload && "role" in payload) {
      return (payload as { role?: string }).role === "admin";
    }
    return false;
  } catch (err) {
    log.warn("admin_forms_auth_failed", {
      route: "admin/forms",
      error: (err as Error)?.message,
      correlationId: getCorrelationId(req),
    });
    return false;
  }
}

export function OPTIONS() {
  return preflightResponse(CORS_CONFIG);
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    log.warn("admin_forms_unauthorized", {
      route: "admin/forms",
      method: req.method,
      correlationId: getCorrelationId(req),
    });
    return withCors(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      CORS_CONFIG
    );
  }

  try {
    const url = req.nextUrl;
    const partnerId = url.searchParams.get("partnerId") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : undefined;
    const usageType = url.searchParams.get("usageType") ?? undefined;

    const items = await listPartnerForms({
      partnerId: partnerId?.trim() || undefined,
      status:
        status && ["draft", "published", "archived"].includes(status)
          ? (status as "draft" | "published" | "archived")
          : undefined,
      usageType:
        usageType && ["visit", "reward", "deal"].includes(usageType)
          ? (usageType as "visit" | "reward" | "deal")
          : undefined,
      limit: limit && Number.isFinite(limit) ? limit : undefined,
    });
    const response = NextResponse.json({ items });
    response.headers.set("x-csrf-token", generateCsrfToken());
    return withCors(response, CORS_CONFIG);
  } catch (err) {
    log.error("admin_forms_get_error", err, {
      route: "admin/forms",
      correlationId: getCorrelationId(req),
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      CORS_CONFIG
    );
  }
}

export async function POST(req: NextRequest) {
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
    const payload = createFormBodySchema.parse(body ?? {});
    const {
      config: rawConfig,
      createdBy: providedCreatedBy,
      ...restPayload
    } = payload;

    const created = await createPartnerForm({
      ...restPayload,
      ...(rawConfig ? { config: rawConfig as PartnerFormConfig } : {}),
      createdBy: auth?.email ?? providedCreatedBy,
    });
    revalidatePublicDirectory();
    const response = NextResponse.json({ item: created });
    response.headers.set("x-csrf-token", generateCsrfToken());
    return withCors(response, CORS_CONFIG);
  } catch (err) {
    if (err instanceof ZodError) {
      log.warn("admin_forms_validation_error", {
        route: "admin/forms",
        method: "POST",
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

    log.error("admin_forms_post_error", err, {
      route: "admin/forms",
      correlationId: getCorrelationId(req),
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      CORS_CONFIG
    );
  }
}

const createFormBodySchema = z
  .object({
    partnerId: z.string().min(1),
    name: z.string().min(1),
    slug: z.string().min(1).optional(),
    status: z.enum(["draft", "published", "archived"]).optional(),
    description: z.string().optional(),
    config: z.unknown().optional(),
    createdBy: z.string().email().optional(),
    usageType: z.enum(["visit", "reward", "deal"]).optional(),
    rewardId: z.string().min(1).optional(),
    dealId: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.usageType === "reward" && !value.rewardId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "rewardId is required for reward forms",
        path: ["rewardId"],
      });
    }
    if (value.usageType === "deal" && !value.dealId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "dealId is required for deal forms",
        path: ["dealId"],
      });
    }
  });
