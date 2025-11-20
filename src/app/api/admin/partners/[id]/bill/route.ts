import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import jwt from "jsonwebtoken";

import { verifyCsrf } from "@/lib/http/csrf";
import { loadPartnerMeta } from "@/lib/data/partners";
import { log, getCorrelationId } from "@/lib/logging";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const JWT_SECRET = process.env.JWT_SECRET || "";
const BILLING_WEBHOOK = process.env.N8N_PARTNER_BILLING_WEBHOOK || "";

const payloadSchema = z
  .object({
    periodStart: z.string().optional(),
    periodEnd: z.string().optional(),
    notes: z.string().optional(),
  })
  .optional();

function isAuthorized(req: NextRequest) {
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
  } catch (error) {
    log.warn("admin_partner_bill_decode_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export function OPTIONS() {
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request, context: unknown) {
  const req = request as NextRequest;
  const params = (context as { params?: { id?: string } } | undefined)?.params ?? {};
  const correlationId = getCorrelationId(req);

  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyCsrf(req)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = payloadSchema.parse(body ?? {});

    const partnerIdRaw = params.id ?? "";
    if (!partnerIdRaw) {
      return NextResponse.json(
        { error: "Partner ID is required" },
        { status: 400 },
      );
    }

    const partnerId = partnerIdRaw.trim().toLowerCase();
    const meta = await loadPartnerMeta(partnerId);

    if (!BILLING_WEBHOOK) {
      log.info("admin_partner_billing_webhook_missing", {
        partnerId,
        correlationId,
      });
      return NextResponse.json({ ok: true, skipped: true });
    }

    const payload = {
      partnerId: meta.partnerId,
      partnerName: meta.displayName ?? meta.partnerId,
      commissionRate: meta.contract.commissionRate,
      commissionBasis: meta.contract.commissionBasis,
      monthlyFee: meta.contract.monthlyFee,
      notes: parsed?.notes ?? null,
      periodStart: parsed?.periodStart ?? null,
      periodEnd: parsed?.periodEnd ?? null,
      triggeredAt: new Date().toISOString(),
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (process.env.N8N_PARTNER_BILLING_WEBHOOK_AUTH) {
      headers.Authorization = process.env.N8N_PARTNER_BILLING_WEBHOOK_AUTH;
    }

    const response = await fetch(BILLING_WEBHOOK, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      log.error("admin_partner_billing_webhook_failed", text, {
        partnerId,
        status: response.status,
        correlationId,
      });
      return NextResponse.json(
        { error: "Billing webhook failed", status: response.status },
        { status: 502 }
      );
    }

    log.info("admin_partner_billing_triggered", {
      partnerId,
      correlationId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "ValidationError", issues: error.flatten() },
        { status: 400 }
      );
    }
    log.error("admin_partner_billing_error", error, {
      partnerId: params.id ?? null,
      correlationId,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
