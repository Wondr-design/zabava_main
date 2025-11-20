import { Buffer } from "node:buffer";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { generateFlashDealUsageReport } from "@/lib/services/reporting/flash-deal-usage-export";
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
  start.setDate(start.getDate() - 30);
  return {
    from: start.toISOString(),
    to: now.toISOString(),
  };
}

export async function POST(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth || !auth.partnerId || (auth.role !== "partner" && auth.role !== "staff")) {
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
      return NextResponse.json(
        { error: "dateFrom must be before dateTo" },
        { status: 400 },
      );
    }

    const report = await generateFlashDealUsageReport({
      dateFrom,
      dateTo,
      partnerId: auth.partnerId,
    });

    const csvFilename = `flash-deal-usage-${auth.partnerId}-${dateFrom.slice(
      0,
      10,
    )}-${dateTo.slice(0, 10)}.csv`;
    const xlsxFilename = csvFilename.replace(".csv", ".xlsx");

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
      filters: {
        dateFrom,
        dateTo,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "ValidationError", issues: error.flatten() },
        { status: 400 },
      );
    }

    log.error("partner_flash_deal_usage_export_error", error, {
      route: "partner/reports/flash-deals",
      correlationId,
      partnerId: auth.partnerId,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
