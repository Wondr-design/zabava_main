import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import jwt from "jsonwebtoken";

import {
  listTransportServices,
  createTransportService,
  type TransportService,
} from "@/lib/data/transport";
import { getAuthFromRequest } from "@/lib/auth/request";
import { verifyCsrf, generateCsrfToken } from "@/lib/http/csrf";
import { withCors, preflightResponse } from "@/lib/http/cors";
import { log, getCorrelationId } from "@/lib/logging";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const JWT_SECRET = process.env.JWT_SECRET || "";

const CORS_CONFIG = {
  methods: "GET,POST,OPTIONS",
  headers: "Content-Type, Authorization, x-admin-secret",
} as const;

const listQuerySchema = z.object({
  partnerId: z.string().optional(),
  includeDisabled: z
    .string()
    .transform((value) => value === "true")
    .optional(),
});

const createPayloadSchema = z.object({
  partnerId: z.string().min(1),
  name: z.string().min(1),
  serviceType: z.enum(["taxi", "bus", "limo"]),
  qrValidityDays: z.number().int().positive().default(3),
  commissionPerRide: z.number().min(0),
  notes: z.string().optional(),
  enabled: z.boolean().optional(),
});

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
    log.warn("admin_transport_services_auth_failed", {
      error: error instanceof Error ? error.message : String(error),
      correlationId: getCorrelationId(req),
    });
    return false;
  }
}

function presentService(service: TransportService) {
  return {
    id: service.id,
    partnerId: service.partner_id,
    name: service.name,
    serviceType: service.service_type,
    qrValidityDays: service.qr_validity_days,
    commissionPerRide: service.commission_per_ride,
    notes: service.notes,
    enabled: service.enabled,
    createdAt: service.created_at,
    updatedAt: service.updated_at,
  };
}

export function OPTIONS() {
  return preflightResponse(CORS_CONFIG);
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return withCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), CORS_CONFIG);
  }

  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = listQuerySchema.parse(params);
    const services = await listTransportServices({
      partnerId: parsed.partnerId,
      includeDisabled: parsed.includeDisabled,
    });
    const response = NextResponse.json({
      items: services.map(presentService),
    });
    response.headers.set("x-csrf-token", generateCsrfToken());
    return withCors(response, CORS_CONFIG);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withCors(
        NextResponse.json({ error: "ValidationError", issues: error.flatten() }, { status: 400 }),
        CORS_CONFIG,
      );
    }
    log.error("admin_transport_services_list_error", error, {
      route: "admin/transport/services",
      correlationId: getCorrelationId(req),
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      CORS_CONFIG,
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return withCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), CORS_CONFIG);
  }
  if (!verifyCsrf(req)) {
    return withCors(NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }), CORS_CONFIG);
  }

  try {
    const body = await req.json();
    const payload = createPayloadSchema.parse(body ?? {});
    const service = await createTransportService({
      ...payload,
      createdBy: getAuthFromRequest(req)?.email ?? undefined,
    });
    return withCors(
      NextResponse.json({ service: presentService(service) }, { status: 201 }),
      CORS_CONFIG,
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withCors(
        NextResponse.json({ error: "ValidationError", issues: error.flatten() }, { status: 400 }),
        CORS_CONFIG,
      );
    }
    log.error("admin_transport_services_create_error", error, {
      route: "admin/transport/services",
      correlationId: getCorrelationId(req),
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      CORS_CONFIG,
    );
  }
}

