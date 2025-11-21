import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withCors, preflightResponse } from "@/lib/http/cors";
import { resolveAllowedOrigin } from "@/lib/http/allowed-origin";
import { isAdminRequestAuthorized } from "@/lib/api/admin-auth";
import { verifyCsrf, generateCsrfToken } from "@/lib/http/csrf";
import { getCorrelationId, log } from "@/lib/logging";
import {
  EMAIL_TEMPLATE_DEFAULTS,
  emailTemplateTypes,
} from "@/lib/email-template-constants";
import {
  listEmailTemplates,
  upsertEmailTemplates,
} from "@/lib/data/email-templates";

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

const listSchema = z.object({
  locale: z.string().optional(),
});

const templateSchema = z.object({
  templateType: z.enum(emailTemplateTypes),
  locale: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  description: z.string().optional().nullable(),
  structure: z.any().optional().nullable(), // JSON structure for template elements
});

const upsertSchema = z.object({
  templates: templateSchema.array().min(1),
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
    const params = listSchema.parse(
      Object.fromEntries(req.nextUrl.searchParams.entries())
    );
    const locale = params.locale || "en";
    const items = await listEmailTemplates(locale);
    const response = NextResponse.json({
      templates: items,
      defaults: EMAIL_TEMPLATE_DEFAULTS,
    });
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
    log.error("admin_email_templates_list_error", error, {
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
    const parsed = upsertSchema.parse(body ?? {});
    await upsertEmailTemplates(parsed.templates, {
      actor: { email: req.headers.get("x-admin-email") },
    });
    const response = NextResponse.json({ ok: true });
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
    log.error("admin_email_templates_upsert_error", error, {
      correlationId: getCorrelationId(req),
    });
    return cors(
      req,
      NextResponse.json({ error: "Internal server error" }, { status: 500 })
    );
  }
}
