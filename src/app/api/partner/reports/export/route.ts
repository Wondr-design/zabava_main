import { Buffer } from "node:buffer";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { generatePartnerBillingReport } from "@/lib/services/reporting/billing-export";
import { getAuthFromRequest } from "@/lib/auth/request";
import { verifyCsrf } from "@/lib/http/csrf";
import { log, getCorrelationId } from "@/lib/logging";

const requestSchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

function bufferToBase64(buffer: Buffer) {
  return buffer.toString("base64");
}

function defaultRange() {
  const now = new Date();
  const start = new Date(now);
  start.setMonth(start.getMonth() - 1);
  return {
    from: start.toISOString(),
    to: now.toISOString(),
  };
}

export async function POST(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth || auth.role !== "partner" || !auth.partnerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!verifyCsrf(req)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const correlationId = getCorrelationId(req);

  try {
    const raw = await req.json();
    const parsed = requestSchema.parse(raw ?? {});
    const defaults = defaultRange();
    const dateFrom = parsed.dateFrom ?? defaults.from;
    const dateTo = parsed.dateTo ?? defaults.to;

    if (new Date(dateFrom) > new Date(dateTo)) {
      return NextResponse.json({ error: "dateFrom must be before dateTo" }, { status: 400 });
    }

    const report = await generatePartnerBillingReport({
      partnerId: auth.partnerId,
      dateFrom,
      dateTo,
    });

    const csvFilename = `partner-${auth.partnerId}-${dateFrom.slice(0, 10)}-${dateTo.slice(0, 10)}.csv`;
    const xlsxFilename = `partner-${auth.partnerId}-${dateFrom.slice(0, 10)}-${dateTo.slice(0, 10)}.xlsx`;

    return NextResponse.json({
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
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "ValidationError", issues: error.flatten() }, { status: 400 });
    }
    log.error("partner_report_export_error", error, {
      route: "partner/reports/export",
      correlationId,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
