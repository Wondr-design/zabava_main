import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withCors, preflightResponse } from "@/lib/http/cors";
import { resolveAllowedOrigin } from "@/lib/http/allowed-origin";
import { getAuthFromRequest } from "@/lib/auth/request";
import { log, getCorrelationId } from "@/lib/logging";
import { verifyCsrf } from "@/lib/http/csrf";
import {
  createStaffInvite,
  staffInviteCreateSchema,
  getStaffInviteByToken,
  revokeStaffInvite,
  listPartnerStaffInvites,
  mapStaffInvite,
} from "@/lib/data/staff-invites";
import { notifyStaffInvite } from "@/lib/services/invites/notify";
import { defaultLocale, resolveLocale } from "@/i18n/config";

const BASE_CORS = {
  methods: "POST,DELETE,GET,OPTIONS",
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
    log.info("partner_staff_invites_list", {
      partnerId,
      correlationId: getCorrelationId(req),
    });
    const localeParam = req.nextUrl.searchParams.get("locale") ?? undefined;
    const locale = resolveLocale(localeParam, defaultLocale);
    const records = await listPartnerStaffInvites(partnerId);
    const items = records.map((record) => mapStaffInvite(record, { locale }));
    return cors(req, NextResponse.json({ items }));
  } catch (err) {
    log.error("partner_staff_invite_get_error", err, {
      route: "partner/staff/invites",
      correlationId: getCorrelationId(req),
    });
    return cors(
      req,
      NextResponse.json({ error: "Internal server error" }, { status: 500 })
    );
  }
}

function unauthorized(req: NextRequest) {
  return cors(req, NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
}

function forbidden(req: NextRequest, message = "Forbidden") {
  return cors(req, NextResponse.json({ error: message }, { status: 403 }));
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
    const payload = staffInviteCreateSchema.parse({
      ...body,
      partnerId,
      token: randomUUID().replace(/-/g, ""),
      createdBy: getAuthFromRequest(req)?.email,
      expiresAt: body.expiresInMinutes
        ? new Date(
            Date.now() + Number(body.expiresInMinutes) * 60 * 1000
          ).toISOString()
        : null,
    });

    const headerLocale = req.headers.get("x-locale") ?? undefined;
    const locale = resolveLocale(payload.locale ?? headerLocale, defaultLocale);

    const inviteRecord = await createStaffInvite(payload);
    const invite = mapStaffInvite(inviteRecord, { locale });
    await notifyStaffInvite(invite);
    log.info("partner_staff_invite_created", {
      partnerId,
      token: invite.token,
      email: invite.email,
      correlationId: getCorrelationId(req),
    });
    return cors(req, NextResponse.json({ invite }));
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
    log.error("partner_staff_invite_post_error", err, {
      route: "partner/staff/invites",
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
    const token = req.nextUrl.searchParams.get("token")?.trim();
    if (!token) {
      return cors(
        req,
        NextResponse.json({ error: "token is required" }, { status: 400 })
      );
    }

    const invite = await getStaffInviteByToken(token);
    if (!invite || invite.partner_id !== partnerId) {
      return forbidden(req, "Invite not found");
    }

    await revokeStaffInvite(token);
    log.info("partner_staff_invite_revoked", {
      partnerId,
      token,
      correlationId: getCorrelationId(req),
    });
    return cors(req, NextResponse.json({ ok: true }));
  } catch (err) {
    log.error("partner_staff_invite_delete_error", err, {
      route: "partner/staff/invites",
      correlationId: getCorrelationId(req),
    });
    return cors(
      req,
      NextResponse.json({ error: "Internal server error" }, { status: 500 })
    );
  }
}
