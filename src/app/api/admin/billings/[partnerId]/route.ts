import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withCors, preflightResponse } from "@/lib/http/cors";
import { verifyCsrf, generateCsrfToken } from "@/lib/http/csrf";
import { isAdminRequestAuthorized } from "@/lib/api/admin-auth";
import {
  generatePartnerBilling,
  getPartnerBillingSettings,
  upsertPartnerBillingSettings,
} from "@/lib/data/billing";
import { log, getCorrelationId } from "@/lib/logging";
import { sendTemplatedEmail, isEmailDeliveryConfigured } from "@/lib/services/mailer";
import { loadPartnerMeta } from "@/lib/data/partners";

const BASE_CORS = {
  methods: "GET,POST,PATCH,OPTIONS",
  headers: "Content-Type, Authorization, x-admin-secret, x-csrf-token",
} as const;

function corsOptions(req: NextRequest) {
  return {
    ...BASE_CORS,
    origin: req.headers.get("origin") ?? "*",
    credentials: true,
  } as const;
}

function cors(req: NextRequest, res: NextResponse) {
  return withCors(res, corsOptions(req));
}

const sendSchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

const settingsSchema = z.object({
  billingEmail: z.string().email().optional().nullable(),
  autoSendEnabled: z.boolean().optional(),
  autoSendDay: z.number().int().min(1).max(28).optional(),
  commissionBasis: z.enum(["discounted", "original"]).optional(),
});

export function OPTIONS(req: NextRequest) {
  return preflightResponse(corsOptions(req));
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> },
) {
  if (!isAdminRequestAuthorized(req)) {
    return cors(req, NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }
  const search = req.nextUrl.searchParams;
  const dateFrom = search.get("dateFrom") || undefined;
  const dateTo = search.get("dateTo") || undefined;
  const includeSummary = search.get("summary") === "true";
  const { partnerId } = await params;
  if (!partnerId) {
    return cors(req, NextResponse.json({ error: "Partner ID required" }, { status: 400 }));
  }
  try {
    const settings = await getPartnerBillingSettings(partnerId);
    let summary: unknown = null;
    let visits: unknown = null;
    if (includeSummary) {
      const { report } = await generatePartnerBilling(partnerId, { dateFrom, dateTo });
      summary = report.summary;
      visits = report.visits;
    }
    const response = NextResponse.json({ settings, summary, visits });
    response.headers.set("x-csrf-token", generateCsrfToken());
    return cors(req, response);
  } catch (error) {
    return cors(
      req,
      NextResponse.json(
        { error: (error as Error)?.message ?? "Failed to load billing settings" },
        { status: 500 },
      ),
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> },
) {
  if (!isAdminRequestAuthorized(req)) {
    return cors(req, NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }
  if (!verifyCsrf(req)) {
    return cors(req, NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }));
  }
  const { partnerId } = await params;
  if (!partnerId) {
    return cors(req, NextResponse.json({ error: "Partner ID required" }, { status: 400 }));
  }
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = settingsSchema.parse(body ?? {});
    await upsertPartnerBillingSettings(partnerId, parsed);
    const response = NextResponse.json({ ok: true });
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
    return cors(
      req,
      NextResponse.json(
        { error: (error as Error)?.message ?? "Failed to update billing settings" },
        { status: 500 },
      ),
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> },
) {
  const correlationId = getCorrelationId(req);
  if (!isAdminRequestAuthorized(req)) {
    return cors(req, NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }
  if (!verifyCsrf(req)) {
    return cors(req, NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }));
  }
  const { partnerId } = await params;
  if (!partnerId) {
    return cors(req, NextResponse.json({ error: "Partner ID required" }, { status: 400 }));
  }

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = sendSchema.parse(body ?? {});
    const { report, dateFrom, dateTo, template, settings } = await generatePartnerBilling(
      partnerId,
      parsed,
    );

    if (!isEmailDeliveryConfigured()) {
      return cors(
        req,
        NextResponse.json({ error: "Email delivery not configured" }, { status: 503 }),
      );
    }
    const partnerMeta = await loadPartnerMeta(partnerId);
    const recipient =
      settings.billingEmail || partnerMeta.info.contactEmail;
    if (!recipient) {
      return cors(
        req,
        NextResponse.json({ error: "No billing email for partner" }, { status: 400 }),
      );
    }
    const csvFilename = `partner-${partnerId}-${dateFrom.slice(0, 10)}-${dateTo.slice(
      0,
      10,
    )}.csv`;
    const xlsxFilename = `partner-${partnerId}-${dateFrom.slice(0, 10)}-${dateTo.slice(
      0,
      10,
    )}.xlsx`;

    await sendTemplatedEmail({
      to: recipient,
      templateType: "billing_report",
      locale: "en",
      subjectOverride: template.subject,
      bodyOverride: template.body,
      details: [
        { label: "Partner", value: partnerId },
        { label: "Period start", value: dateFrom },
        { label: "Period end", value: dateTo },
        { label: "Visits", value: report.summary.visitCount.toString() },
        { label: "Flash deals", value: report.summary.flashDealCount.toString() },
        { label: "Transport rides", value: report.summary.transportRideCount.toString() },
      ],
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

    const response = NextResponse.json({ ok: true });
    response.headers.set("x-csrf-token", generateCsrfToken());
    log.info("billing_report_sent", { partnerId, dateFrom, dateTo, correlationId });
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
    log.error("billing_report_send_error", error, { partnerId, correlationId });
    return cors(
      req,
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
    );
  }
}
