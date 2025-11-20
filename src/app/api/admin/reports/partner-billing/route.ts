import { Buffer } from "node:buffer";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import jwt from "jsonwebtoken";

import { generatePartnerBillingReport } from "@/lib/services/reporting/billing-export";
import { getAuthFromRequest } from "@/lib/auth/request";
import { verifyCsrf } from "@/lib/http/csrf";
import { withCors, preflightResponse } from "@/lib/http/cors";
import { log, getCorrelationId } from "@/lib/logging";
import { loadPartnerMeta } from "@/lib/data/partners";
import { sendTemplatedEmail, isEmailDeliveryConfigured } from "@/lib/services/mailer";
import { EMAIL_TEMPLATE_DEFAULTS } from "@/lib/email-template-constants";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const JWT_SECRET = process.env.JWT_SECRET || "";
const BILLING_FALLBACK_EMAIL = process.env.BILLING_FALLBACK_EMAIL || "";

const requestSchema = z.object({
  partnerId: z.string().min(1),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  forwardToN8n: z.boolean().optional(),
});

const CORS_CONFIG = {
  methods: "POST,OPTIONS",
  headers: "Content-Type, Authorization, x-admin-secret",
} as const;

export function OPTIONS() {
  return preflightResponse(CORS_CONFIG);
}

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
  } catch (error) {
    log.warn("admin_partner_billing_auth_failed", {
      error: error instanceof Error ? error.message : String(error),
      correlationId: getCorrelationId(req),
    });
    return false;
  }
}

function bufferToBase64(buffer: Buffer) {
  return buffer.toString("base64");
}

function defaultRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  return {
    from: start.toISOString(),
    to: now.toISOString(),
  };
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return withCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), CORS_CONFIG);
  }
  if (!verifyCsrf(req)) {
    return withCors(NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }), CORS_CONFIG);
  }

  const correlationId = getCorrelationId(req);

  try {
    const raw = await req.json();
    const parsed = requestSchema.parse(raw ?? {});

    const defaults = defaultRange();
    const dateFrom = parsed.dateFrom ?? defaults.from;
    const dateTo = parsed.dateTo ?? defaults.to;

    if (new Date(dateFrom) > new Date(dateTo)) {
      return withCors(
        NextResponse.json({ error: "dateFrom must be before dateTo" }, { status: 400 }),
        CORS_CONFIG,
      );
    }

    const report = await generatePartnerBillingReport({
      partnerId: parsed.partnerId,
      dateFrom,
      dateTo,
    });

    const csvFilename = `partner-${parsed.partnerId}-${dateFrom.slice(0, 10)}-${dateTo.slice(
      0,
      10,
    )}.csv`;
    const xlsxFilename = `partner-${parsed.partnerId}-${dateFrom.slice(0, 10)}-${dateTo.slice(
      0,
      10,
    )}.xlsx`;

    const forward = parsed.forwardToN8n ?? true;
    let emailed = false;
    let emailError: string | null = null;
    if (forward && isEmailDeliveryConfigured()) {
      try {
        const partnerMeta = await loadPartnerMeta(parsed.partnerId);
        const recipient =
          partnerMeta.info.contactEmail ||
          BILLING_FALLBACK_EMAIL;
        if (!recipient) {
          throw new Error("No billing email configured");
        }
        const template = EMAIL_TEMPLATE_DEFAULTS.billing_report;
        const details = [
          { label: "Partner", value: parsed.partnerId },
          { label: "Period start", value: dateFrom },
          { label: "Period end", value: dateTo },
          { label: "Visits", value: report.summary.visitCount.toString() },
          { label: "Flash deals", value: report.summary.flashDealCount.toString() },
          { label: "Transport rides", value: report.summary.transportRideCount.toString() },
        ];
        await sendTemplatedEmail({
          to: recipient,
          templateType: "billing_report",
          locale: "en",
          subjectOverride: template.subject,
          bodyOverride: template.body,
          details,
          attachments: [
            { filename: csvFilename, content: report.csvBuffer, contentType: "text/csv" },
            {
              filename: xlsxFilename,
              content: report.xlsxBuffer,
              contentType:
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            },
          ],
        });
        emailed = true;
      } catch (error) {
        emailError = error instanceof Error ? error.message : String(error);
        log.error("admin_partner_billing_resend_error", error, { correlationId });
      }
    }

    return withCors(
      NextResponse.json({
        summary: report.summary,
        files: {
          csv: {
            filename: csvFilename,
            contentType: "text/csv",
            base64: bufferToBase64(report.csvBuffer),
          },
          xlsx: {
            filename: xlsxFilename,
            contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            base64: bufferToBase64(report.xlsxBuffer),
          },
        },
        emailed,
        emailError,
      }),
      CORS_CONFIG,
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withCors(
        NextResponse.json({ error: "ValidationError", issues: error.flatten() }, { status: 400 }),
        CORS_CONFIG,
      );
    }

    log.error("admin_partner_billing_export_error", error, {
      route: "admin/reports/partner-billing",
      correlationId,
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      CORS_CONFIG,
    );
  }
}
