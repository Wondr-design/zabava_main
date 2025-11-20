import { NextRequest, NextResponse } from "next/server";

import { preflightResponse, withCors } from "@/lib/http/cors";
import { cancelAdminInvite } from "@/lib/data/admin-invites";
import { getCorrelationId, log } from "@/lib/logging";
import { isAdminRequestAuthorized } from "@/lib/api/admin-auth";

export function OPTIONS() {
  return preflightResponse({
    methods: "DELETE,OPTIONS",
    headers: "Content-Type, Authorization, x-admin-secret",
  });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequestAuthorized(req)) {
    return withCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), {
      methods: "DELETE,OPTIONS",
      headers: "Content-Type, Authorization, x-admin-secret",
    });
  }

  const { id: inviteId } = await context.params;
  if (!inviteId) {
    return withCors(
      NextResponse.json({ error: "Invite ID is required" }, { status: 400 }),
      {
        methods: "DELETE,OPTIONS",
        headers: "Content-Type, Authorization, x-admin-secret",
      },
    );
  }

  try {
    await cancelAdminInvite(inviteId);
    log.info("admin_invite_cancelled", {
      inviteId,
      correlationId: getCorrelationId(req),
    });
    return withCors(NextResponse.json({ success: true }), {
      methods: "DELETE,OPTIONS",
      headers: "Content-Type, Authorization, x-admin-secret",
    });
  } catch (error) {
    log.error("admin_invite_cancel_error", error, {
      inviteId,
      correlationId: getCorrelationId(req),
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      {
        methods: "DELETE,OPTIONS",
        headers: "Content-Type, Authorization, x-admin-secret",
      },
    );
  }
}
