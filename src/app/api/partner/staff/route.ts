import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withCors, preflightResponse } from "@/lib/http/cors";
import { resolveAllowedOrigin } from "@/lib/http/allowed-origin";
import { getAuthFromRequest } from "@/lib/auth/request";
import { log, getCorrelationId } from "@/lib/logging";
import { generateCsrfToken, verifyCsrf } from "@/lib/http/csrf";
import { hashPassword } from "@/lib/auth/passwords";
import {
  listPartnerStaff,
  upsertPartnerStaff,
  deletePartnerStaff,
  updatePartnerStaffStatus,
} from "@/lib/data/staff";

const staffCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120).optional(),
  password: z.string().min(8),
});

const statusSchema = z.object({
  status: z.enum(["active", "inactive", "revoked"]),
});

const BASE_CORS = {
  methods: "GET,POST,PUT,DELETE,OPTIONS",
  headers: "Content-Type, Authorization, x-partner-secret",
} as const;

function corsOptions(req: NextRequest) {
  return {
    ...BASE_CORS,
    origin: resolveAllowedOrigin(req),
    credentials: true,
  } as const;
}

function cors(req: NextRequest, response: NextResponse) {
  return withCors(response, corsOptions(req));
}

function unauthorized(req: NextRequest) {
  return cors(req, NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
}

function forbidden(req: NextRequest, message = "Forbidden") {
  return cors(req, NextResponse.json({ error: message }, { status: 403 }));
}

function getPartnerScope(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth) return null;
  if (auth.role === "partner" && auth.partnerId) {
    return auth.partnerId;
  }
  return null;
}

export function OPTIONS(req: NextRequest) {
  return preflightResponse(corsOptions(req));
}

export async function GET(req: NextRequest) {
  const partnerId = getPartnerScope(req);
  if (!partnerId) {
    return unauthorized(req);
  }

  try {
    log.info("partner_staff_list", {
      partnerId,
      correlationId: getCorrelationId(req),
    });
    const items = await listPartnerStaff(partnerId);
    const response = NextResponse.json({ items });
    response.headers.set("x-csrf-token", generateCsrfToken());
    return cors(req, response);
  } catch (err) {
    log.error("partner_staff_get_error", err, {
      route: "partner/staff",
      correlationId: getCorrelationId(req),
    });
    return cors(
      req,
      NextResponse.json({ error: "Internal server error" }, { status: 500 })
    );
  }
}

export async function POST(req: NextRequest) {
  const partnerId = getPartnerScope(req);
  if (!partnerId) {
    return unauthorized(req);
  }
  if (!verifyCsrf(req)) {
    return forbidden(req, "Invalid CSRF token");
  }

  try {
    const body = await req.json();
    const payload = staffCreateSchema.parse(body ?? {});

    const passwordHash = await hashPassword(payload.password);

    const staff = await upsertPartnerStaff({
      partnerId,
      email: payload.email,
      passwordHash,
      name: payload.name,
    });
    log.info("partner_staff_created", {
      partnerId,
      staffId: staff.id,
      email: staff.email,
      correlationId: getCorrelationId(req),
    });

    const response = NextResponse.json({ ok: true, staff });
    response.headers.set("x-csrf-token", generateCsrfToken());
    return cors(req, response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return cors(
        req,
        NextResponse.json(
          { error: "ValidationError", issues: err.flatten() },
          { status: 400 }
        )
      );
    }
    log.error("partner_staff_post_error", err, {
      route: "partner/staff",
      correlationId: getCorrelationId(req),
    });
    return cors(
      req,
      NextResponse.json({ error: "Internal server error" }, { status: 500 })
    );
  }
}

export async function PUT(req: NextRequest) {
  const partnerId = getPartnerScope(req);
  if (!partnerId) {
    return unauthorized(req);
  }
  if (!verifyCsrf(req)) {
    return forbidden(req, "Invalid CSRF token");
  }

  try {
    const body = await req.json();
    const payload = statusSchema.parse(body ?? {});
    const staffId = req.nextUrl.searchParams.get("staffId")?.trim();
    if (!staffId) {
      return cors(
        req,
        NextResponse.json({ error: "staffId is required" }, { status: 400 })
      );
    }

    const updated = await updatePartnerStaffStatus(staffId, payload.status);
    log.info("partner_staff_status_update", {
      partnerId,
      staffId,
      status: payload.status,
      correlationId: getCorrelationId(req),
    });
    return cors(req, NextResponse.json({ ok: true, staff: updated }));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return cors(
        req,
        NextResponse.json(
          { error: "ValidationError", issues: err.flatten() },
          { status: 400 }
        )
      );
    }
    log.error("partner_staff_put_error", err, {
      route: "partner/staff",
      correlationId: getCorrelationId(req),
    });
    return cors(
      req,
      NextResponse.json({ error: "Internal server error" }, { status: 500 })
    );
  }
}

export async function DELETE(req: NextRequest) {
  const partnerId = getPartnerScope(req);
  if (!partnerId) {
    return unauthorized(req);
  }
  if (!verifyCsrf(req)) {
    return forbidden(req, "Invalid CSRF token");
  }

  try {
    const staffId = req.nextUrl.searchParams.get("staffId")?.trim();
    if (!staffId) {
      return cors(
        req,
        NextResponse.json({ error: "staffId is required" }, { status: 400 })
      );
    }

    await deletePartnerStaff(staffId);
    log.info("partner_staff_deleted", {
      partnerId,
      staffId,
      correlationId: getCorrelationId(req),
    });
    return cors(req, NextResponse.json({ ok: true }));
  } catch (err) {
    log.error("partner_staff_delete_error", err, {
      route: "partner/staff",
      correlationId: getCorrelationId(req),
    });
    return cors(
      req,
      NextResponse.json({ error: "Internal server error" }, { status: 500 })
    );
  }
}
