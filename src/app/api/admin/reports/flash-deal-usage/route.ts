import { Buffer } from "node:buffer";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import jwt from "jsonwebtoken";

import { generateFlashDealUsageReport } from "@/lib/services/reporting/flash-deal-usage-export";
import { getAuthFromRequest } from "@/lib/auth/request";
import { verifyCsrf } from "@/lib/http/csrf";
import { withCors, preflightResponse } from "@/lib/http/cors";
import { log, getCorrelationId } from "@/lib/logging";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const JWT_SECRET = process.env.JWT_SECRET || "";

const requestSchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  partnerId: z.string().optional(),
});

const CORS_CONFIG = {
  methods: "POST,OPTIONS",
  headers: "Content-Type, Authorization, x-admin-secret",
} as const;

export const runtime = "nodejs";

export function OPTIONS() {
  return preflightResponse(CORS_CONFIG);
}

function bufferToBase64(buffer: Buffer) {
  return buffer.toString("base64");
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
  if (!authHeader || !authHeader.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7).trim();
  if (!token) return false;

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (typeof payload === "object" && payload && "role" in payload) {
      return (payload as { role?: string }).role === "admin";
    }
    return false;
  } catch (error) {
    log.warn("admin_flash_deal_usage_auth_failed", {
      error: error instanceof Error ? error.message : String(error),
      correlationId: getCorrelationId(req),
    });
    return false;
  }
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
  if (!isAuthorized(req)) {
    return withCors(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      CORS_CONFIG,
    );
  }

  if (!verifyCsrf(req)) {
    return withCors(
      NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }),
      CORS_CONFIG,
    );
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
        NextResponse.json(
          { error: "dateFrom must be before dateTo" },
          { status: 400 },
        ),
        CORS_CONFIG,
      );
    }

    const report = await generateFlashDealUsageReport({
      dateFrom,
      dateTo,
      partnerId: parsed.partnerId,
    });

    const partnerSegment = parsed.partnerId
      ? parsed.partnerId.toLowerCase()
      : "all";
    const csvFilename = `flash-deal-usage-${partnerSegment}-${dateFrom.slice(
      0,
      10,
    )}-${dateTo.slice(0, 10)}.csv`;
    const xlsxFilename = csvFilename.replace(".csv", ".xlsx");

    return withCors(
      NextResponse.json({
        summary: report.summary,
        filters: {
          dateFrom,
          dateTo,
          partnerId: parsed.partnerId ?? null,
        },
        files: {
          csv: {
            filename: csvFilename,
            contentType: "text/csv",
            base64: bufferToBase64(report.csvBuffer),
          },
          xlsx: {
            filename: xlsxFilename,
            contentType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            base64: bufferToBase64(report.xlsxBuffer),
          },
        },
      }),
      CORS_CONFIG,
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withCors(
        NextResponse.json(
          { error: "ValidationError", issues: error.flatten() },
          { status: 400 },
        ),
        CORS_CONFIG,
      );
    }

    log.error("admin_flash_deal_usage_export_error", error, {
      route: "admin/reports/flash-deal-usage",
      correlationId,
    });
    return withCors(
      NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      ),
      CORS_CONFIG,
    );
  }
}
