import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAdminInviteByToken, isInviteConsumable, markAdminInviteAccepted } from "@/lib/data/admin-invites";
import { getPartnerUserByEmail, recordAdminInviteMetadata, upsertPartnerUser } from "@/lib/data/partner-users";
import { hashPassword } from "@/lib/auth/passwords";
import { signJwt } from "@/lib/auth/jwt";
import { generateCsrfToken } from "@/lib/http/csrf";
import { preflightResponse, withCors } from "@/lib/http/cors";
import { getCorrelationId, log } from "@/lib/logging";

const JWT_SECRET = process.env.JWT_SECRET || "";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "12h";

const acceptSchema = z.object({
  token: z.string().min(10, "Invite token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1).max(120).optional(),
});

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function resolveMaxAgeSeconds() {
  const value = String(JWT_EXPIRES_IN || "12h").trim();
  const match = /^([0-9]+)([smhd])$/.exec(value);
  if (!match) return 60 * 60 * 12;
  const amount = Number(match[1]);
  const unit = match[2];
  if (unit === "s") return amount;
  if (unit === "m") return amount * 60;
  if (unit === "h") return amount * 60 * 60;
  if (unit === "d") return amount * 60 * 60 * 24;
  return 60 * 60 * 12;
}

export function OPTIONS() {
  return preflightResponse({ methods: "GET,POST,OPTIONS", headers: "Content-Type" });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return withCors(
      NextResponse.json({ error: "token query parameter is required" }, { status: 400 }),
      { methods: "GET,POST,OPTIONS", headers: "Content-Type" },
    );
  }

  try {
    const invite = await getAdminInviteByToken(token);
    if (!invite) {
      return withCors(NextResponse.json({ error: "Invite not found" }, { status: 404 }), {
        methods: "GET,POST,OPTIONS",
        headers: "Content-Type",
      });
    }

    const status = invite.accepted_at
      ? "accepted"
      : isInviteConsumable(invite)
      ? "pending"
      : "expired";

    return withCors(
      NextResponse.json({
        invite: {
          id: invite.id,
          email: invite.email,
          inviterEmail: invite.inviter_email,
          expiresAt: invite.expires_at,
          acceptedAt: invite.accepted_at,
          status,
        },
      }),
      { methods: "GET,POST,OPTIONS", headers: "Content-Type" },
    );
  } catch (error) {
    log.error("admin_invite_lookup_error", error, {
      correlationId: getCorrelationId(req),
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      { methods: "GET,POST,OPTIONS", headers: "Content-Type" },
    );
  }
}

export async function POST(req: NextRequest) {
  if (!JWT_SECRET) {
    log.error("admin_invite_accept_missing_secret", null, {
      correlationId: getCorrelationId(req),
    });
    return withCors(
      NextResponse.json({ error: "Server configuration error" }, { status: 500 }),
      { methods: "GET,POST,OPTIONS", headers: "Content-Type" },
    );
  }

  try {
    const body = await req.json();
    const payload = acceptSchema.parse(body ?? {});
    const invite = await getAdminInviteByToken(payload.token);

    if (!invite) {
      return withCors(
        NextResponse.json({ error: "Invite not found" }, { status: 404 }),
        { methods: "GET,POST,OPTIONS", headers: "Content-Type" },
      );
    }

    if (!isInviteConsumable(invite)) {
      const status = invite.accepted_at ? "accepted" : "expired";
      return withCors(
        NextResponse.json({ error: `Invite ${status}` }, { status: 409 }),
        { methods: "GET,POST,OPTIONS", headers: "Content-Type" },
      );
    }

    const email = normalizeEmail(invite.email);
    const existing = await getPartnerUserByEmail(email);
    if (existing) {
      return withCors(
        NextResponse.json({ error: "Account already exists" }, { status: 409 }),
        { methods: "GET,POST,OPTIONS", headers: "Content-Type" },
      );
    }

    const passwordHash = await hashPassword(payload.password);
    const metadata = invite.metadata && typeof invite.metadata === "object" ? invite.metadata : {};

    const account = await upsertPartnerUser({
      email,
      passwordHash,
      role: "admin",
      name: payload.name || (metadata && typeof metadata === "object" ? (metadata as { name?: string }).name : undefined),
      verifiedAt: new Date(),
      invitedBy: invite.inviter_email ?? undefined,
      metadata: {
        ...(metadata ?? {}),
        origin: "admin_invite",
        inviteId: invite.id,
      },
    });

    await markAdminInviteAccepted(invite.id, {
      acceptedEmail: email,
    });

    await recordAdminInviteMetadata({
      email,
      inviterEmail: invite.inviter_email ?? undefined,
    }).catch((metaError) =>
      log.warn("admin_invite_accept_metadata_error", {
        error: metaError instanceof Error ? metaError.message : String(metaError),
        inviteId: invite.id,
      }),
    );

    const token = signJwt(
      {
        email,
        role: "admin",
        name: account.name ?? payload.name ?? null,
      },
      { expiresIn: JWT_EXPIRES_IN },
    );

    const response = NextResponse.json(
      {
        token,
        user: {
          email,
          role: "admin",
          name: account.name ?? payload.name ?? null,
        },
      },
      { status: 201 },
    );

    const maxAge = resolveMaxAgeSeconds();
    response.cookies.set("zabava_token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge,
    });
    response.cookies.set("zabava_role", "admin", {
      httpOnly: false,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge,
    });
    const csrf = generateCsrfToken();
    response.cookies.set("zabava_csrf", csrf, {
      httpOnly: false,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge,
    });

    return withCors(response, { methods: "GET,POST,OPTIONS", headers: "Content-Type" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withCors(
        NextResponse.json({ error: "ValidationError", issues: error.flatten() }, { status: 400 }),
        { methods: "GET,POST,OPTIONS", headers: "Content-Type" },
      );
    }

    log.error("admin_invite_accept_error", error, {
      correlationId: getCorrelationId(req),
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      { methods: "GET,POST,OPTIONS", headers: "Content-Type" },
    );
  }
}
