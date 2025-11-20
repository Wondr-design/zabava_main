import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import jwt from "jsonwebtoken";

import {
  getTransportService,
  updateTransportService,
  setTransportServiceEnabled,
  type TransportService,
} from "@/lib/data/transport";
import { getAuthFromRequest } from "@/lib/auth/request";
import { verifyCsrf } from "@/lib/http/csrf";
import { withCors, preflightResponse } from "@/lib/http/cors";
import { log, getCorrelationId } from "@/lib/logging";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const JWT_SECRET = process.env.JWT_SECRET || "";

const CORS_CONFIG = {
  methods: "GET,PUT,PATCH,OPTIONS",
  headers: "Content-Type, Authorization, x-admin-secret",
} as const;

const updateSchema = z
  .object({
    name: z.string().min(1).optional(),
    serviceType: z.enum(["taxi", "bus", "limo"]).optional(),
    qrValidityDays: z.number().int().positive().optional(),
    commissionPerRide: z.number().min(0).optional(),
    notes: z.string().optional(),
    enabled: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update.",
  });

const actionSchema = z.union([
  z.object({
    action: z.literal("enable"),
  }),
  z.object({
    action: z.literal("disable"),
  }),
  z.object({
    action: z.literal("toggle"),
  }),
]);

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

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const req = request as NextRequest;
  if (!isAuthorized(req)) {
    return withCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), CORS_CONFIG);
  }

  const { id } = await context.params;
  if (!id) {
    return withCors(NextResponse.json({ error: "Transport service ID is required" }, { status: 400 }), CORS_CONFIG);
  }
  try {
    const service = await getTransportService(id);
    if (!service) {
      return withCors(NextResponse.json({ error: "Not found" }, { status: 404 }), CORS_CONFIG);
    }
    return withCors(NextResponse.json({ service: presentService(service) }), CORS_CONFIG);
  } catch (error) {
    log.error("admin_transport_services_detail_error", error, {
      route: "admin/transport/services/[id]",
      correlationId: getCorrelationId(req),
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      CORS_CONFIG,
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const req = request as NextRequest;
  if (!isAuthorized(req)) {
    return withCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), CORS_CONFIG);
  }
  if (!verifyCsrf(req)) {
    return withCors(NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }), CORS_CONFIG);
  }

  const { id } = await context.params;
  if (!id) {
    return withCors(NextResponse.json({ error: "Transport service ID is required" }, { status: 400 }), CORS_CONFIG);
  }
  try {
    const body = await req.json();
    const payload = updateSchema.parse(body ?? {});
    const updated = await updateTransportService(id, {
      ...payload,
      updatedBy: getAuthFromRequest(req)?.email ?? undefined,
    });
    return withCors(NextResponse.json({ service: presentService(updated) }), CORS_CONFIG);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withCors(
        NextResponse.json({ error: "ValidationError", issues: error.flatten() }, { status: 400 }),
        CORS_CONFIG,
      );
    }
    log.error("admin_transport_services_update_error", error, {
      route: "admin/transport/services/[id]",
      correlationId: getCorrelationId(req),
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      CORS_CONFIG,
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const req = request as NextRequest;
  if (!isAuthorized(req)) {
    return withCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), CORS_CONFIG);
  }
  if (!verifyCsrf(req)) {
    return withCors(NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }), CORS_CONFIG);
  }

  const { id } = await context.params;
  if (!id) {
    return withCors(NextResponse.json({ error: "Transport service ID is required" }, { status: 400 }), CORS_CONFIG);
  }
  try {
    const body = await req.json();
    const payload = actionSchema.parse(body ?? {});
    const current = await getTransportService(id);
    if (!current) {
      return withCors(NextResponse.json({ error: "Not found" }, { status: 404 }), CORS_CONFIG);
    }

    let desiredState = current.enabled;
    if (payload.action === "toggle") {
      desiredState = !current.enabled;
    } else if (payload.action === "enable") {
      desiredState = true;
    } else if (payload.action === "disable") {
      desiredState = false;
    }

    const updated = await setTransportServiceEnabled(id, desiredState, getAuthFromRequest(req)?.email ?? undefined);
    return withCors(NextResponse.json({ service: presentService(updated) }), CORS_CONFIG);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withCors(
        NextResponse.json({ error: "ValidationError", issues: error.flatten() }, { status: 400 }),
        CORS_CONFIG,
      );
    }
    log.error("admin_transport_services_action_error", error, {
      route: "admin/transport/services/[id]",
      correlationId: getCorrelationId(req),
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      CORS_CONFIG,
    );
  }
}
