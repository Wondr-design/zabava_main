import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAuthFromRequest } from "@/lib/auth/request";
import {
  getVisitById,
  updateVisitStatus,
  estimateVisitPoints,
} from "@/lib/data/visits";
import { getRedemptionByCode } from "@/lib/data/redemptions";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { log, getCorrelationId } from "@/lib/logging";
import { withCors, preflightResponse } from "@/lib/http/cors";
import { verifyCsrf } from "@/lib/http/csrf";
import { notifyVisitUpdated } from "@/lib/services/visits/notify";

const updateSchema = z
  .object({
    numPeople: z.number().int().positive().max(50).optional(),
    totalPrice: z.number().nonnegative().optional(),
    ticketType: z.string().min(1).max(120).optional(),
    transport: z.string().min(1).max(120).optional(),
    categories: z.string().max(255).optional(),
    visitNotes: z.string().max(1000).optional(),
  })
  .refine(
    (payload) =>
      Object.values(payload).some((value) => value !== undefined && value !== null),
    {
      message: "Provide at least one field to update.",
    },
  );

function isStaffAuthorized(
  auth: ReturnType<typeof getAuthFromRequest>,
  visitPartnerId: string | null,
) {
  if (!auth?.role) return false;
  if (auth.role === "admin") return true;
  if (auth.role === "staff") {
    const partner = (auth.partnerId ?? "").toLowerCase();
    const visitPartner = (visitPartnerId ?? "").toLowerCase();
    return Boolean(partner && visitPartner && partner === visitPartner);
  }
  return false;
}

export function OPTIONS() {
  return preflightResponse({
    methods: "GET,PUT,OPTIONS",
    headers: "Content-Type, Authorization",
  });
}

export async function GET(
  request: Request,
  context: unknown,
) {
  const req = request as NextRequest;
  const params = (context as { params?: { id?: string } } | undefined)?.params ?? {};
  const correlationId = getCorrelationId(req);
  try {
    const auth = getAuthFromRequest(req);
    const visitId = params.id ?? "";
    if (!visitId) {
      return withCors(
        NextResponse.json({ error: "Visit ID is required" }, { status: 400 }),
      );
    }
    const visit = await getVisitById(visitId);
    if (!visit) {
      return withCors(
        NextResponse.json({ error: "Visit not found" }, { status: 404 }),
      );
    }

    if (!isStaffAuthorized(auth, visit.partner_id ?? null)) {
      log.warn("staff_visit_get_forbidden", {
        visitId,
        actorRole: auth?.role ?? "unknown",
        actorPartner: auth?.partnerId ?? null,
        visitPartner: visit.partner_id ?? null,
        correlationId,
      });
      return withCors(
        NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      );
    }

    let redemption = null;
    if (visit.redemption_code) {
      try {
        redemption = await getRedemptionByCode(visit.redemption_code);
      } catch (lookupError) {
        log.warn("staff_visit_redemption_lookup_failed", {
          visitId,
          code: visit.redemption_code,
          error: (lookupError as Error)?.message,
          correlationId,
        });
      }
    }

    return withCors(NextResponse.json({ visit, redemption }));
  } catch (error) {
    log.error("staff_visit_get_error", error, {
      visitId: params.id ?? "",
      correlationId,
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
    );
  }
}

export async function PUT(
  request: Request,
  context: unknown,
) {
  const req = request as NextRequest;
  const params = (context as { params?: { id?: string } } | undefined)?.params ?? {};
  const correlationId = getCorrelationId(req);
  if (!verifyCsrf(req)) {
    return withCors(
      NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }),
    );
  }
  try {
    const auth = getAuthFromRequest(req);
    const visitId = params.id ?? "";
    if (!visitId) {
      return withCors(
        NextResponse.json({ error: "Visit ID is required" }, { status: 400 }),
      );
    }
    const visit = await getVisitById(visitId);
    if (!visit) {
      return withCors(
        NextResponse.json({ error: "Visit not found" }, { status: 404 }),
      );
    }

    if (!isStaffAuthorized(auth, visit.partner_id ?? null)) {
      log.warn("staff_visit_update_forbidden", {
        visitId,
        actorRole: auth?.role ?? "unknown",
        actorPartner: auth?.partnerId ?? null,
        visitPartner: visit.partner_id ?? null,
        correlationId,
      });
      return withCors(
        NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return withCors(
        NextResponse.json(
          { error: "ValidationError", details: parsed.error.flatten() },
          { status: 400 },
        ),
      );
    }

    const payload = parsed.data;
    const estimatedPoints = estimateVisitPoints({
      estimatedPoints: visit.estimated_points,
      numPeople: payload.numPeople ?? visit.num_people,
      ticketType: payload.ticketType ?? visit.ticket_type ?? undefined,
      totalPrice: payload.totalPrice ?? visit.total_price,
      transport: payload.transport ?? visit.transport,
    });

    const updated = await updateVisitStatus({
      visitId: visit.id,
      numPeople: payload.numPeople,
      totalPrice: payload.totalPrice,
      ticketType: payload.ticketType,
      transport: payload.transport,
      categories: payload.categories,
      visitNotes: payload.visitNotes,
      estimatedPoints,
    });

    const supabase = getSupabaseAdmin();
    const mergedPayload: Record<string, unknown> = {
      ...(visit.payload ?? {}),
    };

    if (payload.numPeople !== undefined) {
      mergedPayload.numPeople = payload.numPeople;
    }
    if (payload.ticketType !== undefined) {
      mergedPayload.ticketType = payload.ticketType;
      mergedPayload.ticket_type = payload.ticketType;
    }
    if (payload.transport !== undefined) {
      mergedPayload.transport = payload.transport;
    }
    if (payload.totalPrice !== undefined) {
      mergedPayload.totalPrice = payload.totalPrice;
    }
    if (payload.categories !== undefined) {
      mergedPayload.categories = payload.categories;
    }
    if (payload.visitNotes !== undefined) {
      mergedPayload.visitNotes = payload.visitNotes;
    }

    if (Object.keys(mergedPayload).length > 0) {
      const { error: payloadError } = await supabase
        .from("visit_registrations")
        .update({
          payload: mergedPayload as unknown as never,
          updated_at: new Date().toISOString(),
        } as unknown as never)
        .eq("id", visit.id);

      if (payloadError) {
        log.warn("staff_visit_payload_update_failed", {
          error: payloadError.message,
          visitId: visit.id,
          correlationId,
        });
      }
    }

    const fresh = await getVisitById(visit.id);
    const updatedVisit = fresh ?? updated;

    if (updatedVisit) {
      await notifyVisitUpdated({
        before: visit,
        after: updatedVisit,
        changes: payload,
        actor: {
          email: auth?.email,
          staffId: auth?.staffId ?? null,
          name: auth?.name,
        },
      });
    }

    log.info("staff_visit_updated", {
      visitId: visit.id,
      staffId: auth?.staffId ?? null,
      correlationId,
    });

    return withCors(
      NextResponse.json({
        visit: updatedVisit ?? visit,
      }),
    );
  } catch (error) {
    log.error("staff_visit_update_error", error, {
      visitId: params.id,
      correlationId,
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
    );
  }
}
