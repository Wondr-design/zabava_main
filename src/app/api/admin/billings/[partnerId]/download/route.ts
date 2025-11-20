import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isAdminRequestAuthorized } from "@/lib/api/admin-auth";
import { generatePartnerBilling } from "@/lib/data/billing";
import { resolveAllowedOrigin } from "@/lib/http/allowed-origin";
import { withCors, preflightResponse } from "@/lib/http/cors";

const BASE_CORS = {
  methods: "GET,OPTIONS",
  headers: "Content-Type, Authorization, x-admin-secret",
} as const;

function corsOptions(req: NextRequest) {
  return {
    ...BASE_CORS,
    origin: resolveAllowedOrigin(req),
    credentials: true,
  } as const;
}

function cors(req: NextRequest, res: NextResponse) {
  return withCors(res, corsOptions(req));
}

const querySchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
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
  const { partnerId } = await params;
  if (!partnerId) {
    return cors(req, NextResponse.json({ error: "Partner ID required" }, { status: 400 }));
  }

  try {
    const parsed = querySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams.entries()),
    );
    const { report, dateFrom, dateTo } = await generatePartnerBilling(partnerId, parsed);
    const csvFilename = `partner-${partnerId}-${dateFrom.slice(0, 10)}-${dateTo.slice(0, 10)}.csv`;
    const xlsxFilename = `partner-${partnerId}-${dateFrom.slice(0, 10)}-${dateTo.slice(0, 10)}.xlsx`;
    return cors(
      req,
      NextResponse.json({
        summary: report.summary,
        files: {
          csv: {
            filename: csvFilename,
            contentType: "text/csv",
            base64: report.csvBuffer.toString("base64"),
          },
          xlsx: {
            filename: xlsxFilename,
            contentType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            base64: report.xlsxBuffer.toString("base64"),
          },
        },
      }),
    );
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
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
    );
  }
}
