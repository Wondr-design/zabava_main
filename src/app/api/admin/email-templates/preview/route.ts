import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { resolveAllowedOrigin } from "@/lib/http/allowed-origin";
import { preflightResponse, withCors } from "@/lib/http/cors";
import { isAdminRequestAuthorized } from "@/lib/api/admin-auth";
import { generateCsrfToken } from "@/lib/http/csrf";
import { getCorrelationId, log } from "@/lib/logging";
import {
  EMAIL_TEMPLATE_DEFAULTS,
  emailTemplateTypes,
} from "@/lib/email-template-constants";
import { renderEmailTemplate } from "@/emails/render-email";

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

const detailSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number(), z.null()]).optional(),
});

const highlightedCodeSchema = z.object({
  label: z.string().optional(),
  value: z.string().optional().nullable(),
});

const previewSchema = z.object({
  templateType: z.enum(emailTemplateTypes),
  subject: z.string().min(1),
  body: z.string().min(1),
  details: z.array(detailSchema).optional(),
  imageSrc: z.string().url().or(z.literal("")).or(z.null()).optional(),
  ctaHref: z.string().url().optional().nullable(),
  ctaLabel: z.string().optional().nullable(),
  highlightedCode: highlightedCodeSchema.optional(),
  attachmentsNote: z.string().optional().nullable(),
  partnerLabel: z.string().optional().nullable(),
  expiresInLabel: z.string().optional().nullable(),
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

  const correlationId = getCorrelationId(req);

  try {
    const body = await req.json().catch(() => ({}));
    const payload = previewSchema.parse(body ?? {});

    const normalizedDetails = payload.details?.map((detail) => ({
      label: detail.label,
      value:
        detail.value === undefined
          ? null
          : typeof detail.value === "number" || typeof detail.value === "string"
          ? detail.value
          : null,
    }));

    const { html, text } = await renderEmailTemplate({
      templateType: payload.templateType,
      subject: payload.subject,
      body: payload.body,
      details: normalizedDetails,
      imageSrc: payload.imageSrc || undefined,
      ctaHref: payload.ctaHref ?? undefined,
      ctaLabel: payload.ctaLabel ?? undefined,
      highlightedCode: payload.highlightedCode,
      attachmentsNote: payload.attachmentsNote ?? undefined,
      partnerLabel: payload.partnerLabel ?? undefined,
      expiresInLabel: payload.expiresInLabel ?? undefined,
    });

    const response = NextResponse.json({
      html,
      text,
      defaults: EMAIL_TEMPLATE_DEFAULTS[payload.templateType],
    });
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
    log.error("admin_email_template_preview_error", error, {
      correlationId,
    });
    return cors(
      req,
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
    );
  }
}
