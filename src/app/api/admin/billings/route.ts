import { NextRequest, NextResponse } from "next/server";

import { withCors, preflightResponse } from "@/lib/http/cors";
import { isAdminRequestAuthorized } from "@/lib/api/admin-auth";
import { listPartnerBillingSummaries } from "@/lib/data/billing";
import { resolveAllowedOrigin } from "@/lib/http/allowed-origin";

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

export function OPTIONS(req: NextRequest) {
  return preflightResponse(corsOptions(req));
}

export async function GET(req: NextRequest) {
  if (!isAdminRequestAuthorized(req)) {
    return cors(req, NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }
  try {
    const items = await listPartnerBillingSummaries();
    return cors(req, NextResponse.json({ items }));
  } catch (error) {
    return cors(
      req,
      NextResponse.json(
        { error: (error as Error)?.message ?? "Failed to load billing summaries" },
        { status: 500 },
      ),
    );
  }
}
