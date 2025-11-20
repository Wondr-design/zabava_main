import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { preflightResponse, withCors } from "@/lib/http/cors";
import { getCorrelationId, log } from "@/lib/logging";
import { createAdminInvite, isInviteConsumable, listAdminInvites } from "@/lib/data/admin-invites";
import { isAdminRequestAuthorized } from "@/lib/api/admin-auth";
import { recordAdminInviteMetadata } from "@/lib/data/partner-users";
import { getAuthFromRequest } from "@/lib/auth/request";

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120).optional(),
  expiresInHours: z.number().int().positive().max(24 * 30).optional(),
});

function resolveBaseUrl(req: NextRequest) {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.BASE_URL ||
    req.nextUrl.origin
  );
}

export function OPTIONS() {
  return preflightResponse({
    methods: "GET,POST,DELETE,OPTIONS",
    headers: "Content-Type, Authorization, x-admin-secret",
  });
}

export async function GET(req: NextRequest) {
  if (!isAdminRequestAuthorized(req)) {
    return withCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), {
      methods: "GET,POST,DELETE,OPTIONS",
      headers: "Content-Type, Authorization, x-admin-secret",
    });
  }

  try {
    const invites = await listAdminInvites();
    return withCors(
      NextResponse.json({
        items: invites.map((invite) => ({
          ...invite,
          status: invite.accepted_at
            ? "accepted"
            : isInviteConsumable(invite)
            ? "pending"
            : "expired",
        })),
      }),
      {
        methods: "GET,POST,DELETE,OPTIONS",
        headers: "Content-Type, Authorization, x-admin-secret",
      },
    );
  } catch (error) {
    log.error("admin_invites_list_error", error, {
      correlationId: getCorrelationId(req),
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      {
        methods: "GET,POST,DELETE,OPTIONS",
        headers: "Content-Type, Authorization, x-admin-secret",
      },
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminRequestAuthorized(req)) {
    return withCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), {
      methods: "GET,POST,DELETE,OPTIONS",
      headers: "Content-Type, Authorization, x-admin-secret",
    });
  }

  try {
    const body = await req.json();
    const payload = createSchema.parse(body ?? {});
    const expiresAt =
      payload.expiresInHours && payload.expiresInHours > 0
        ? new Date(Date.now() + payload.expiresInHours * 60 * 60 * 1000)
        : undefined;

    const auth = getAuthFromRequest(req);
    const inviterEmail = auth?.email ?? undefined;

    const { invite, token } = await createAdminInvite({
      email: payload.email,
      inviterEmail,
      metadata: payload.name ? { name: payload.name } : undefined,
      expiresAt,
    });

    try {
      await recordAdminInviteMetadata({
        email: payload.email,
        inviterEmail,
      });
    } catch (metaError) {
      log.warn("admin_invite_metadata_error", {
        error: metaError instanceof Error ? metaError.message : String(metaError),
        email: payload.email,
      });
    }

    const inviteUrl = new URL(
      `/admin/invite/accept?token=${encodeURIComponent(token)}`,
      resolveBaseUrl(req),
    ).toString();

    log.info("admin_invite_created", {
      email: invite.email,
      inviter: invite.inviter_email,
      inviteId: invite.id,
      correlationId: getCorrelationId(req),
    });

    return withCors(
      NextResponse.json(
        {
          invite,
          token,
          inviteUrl,
        },
        { status: 201 },
      ),
      {
        methods: "GET,POST,DELETE,OPTIONS",
        headers: "Content-Type, Authorization, x-admin-secret",
      },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withCors(
        NextResponse.json({ error: "ValidationError", issues: error.flatten() }, { status: 400 }),
        {
          methods: "GET,POST,DELETE,OPTIONS",
          headers: "Content-Type, Authorization, x-admin-secret",
        },
      );
    }

    log.error("admin_invite_create_error", error, {
      correlationId: getCorrelationId(req),
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      {
        methods: "GET,POST,DELETE,OPTIONS",
        headers: "Content-Type, Authorization, x-admin-secret",
      },
    );
  }
}
