import { NextRequest, NextResponse } from "next/server";

import { preflightResponse, withCors } from "@/lib/http/cors";
import { getAuthFromRequest } from "@/lib/auth/request";
import { getVisitById } from "@/lib/data/visits";
import { expandVisitPayload } from "@/lib/services/visit-links";
import { createSignedQrUrl } from "@/lib/services/qr";
import { log, getCorrelationId } from "@/lib/logging";

const PREVIEW_EXPIRY_SECONDS = 60; // short-lived preview URL

function isAuthorizedForVisit(
  role: string | null | undefined,
  partnerId: string | null | undefined,
  visitPartnerId: string | null | undefined
) {
  if (!role) return false;
  if (role === "admin") return true;
  if (role === "partner" || role === "staff") {
    const normalizedPartner = (partnerId ?? "").toLowerCase();
    const normalizedVisitPartner = (visitPartnerId ?? "").toLowerCase();
    return Boolean(
      normalizedPartner &&
        normalizedVisitPartner &&
        normalizedPartner === normalizedVisitPartner
    );
  }
  return false;
}

function extractQrPath(payload: Record<string, unknown>) {
  const candidates = ["qrStoragePath", "qr_storage_path", "qrPath", "qr_path"];
  for (const key of candidates) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

export function OPTIONS() {
  return preflightResponse({
    methods: "GET,OPTIONS",
    headers: "Content-Type, Authorization",
  });
}

export async function GET(req: NextRequest) {
  const correlationId = getCorrelationId(req);
  const segments = req.nextUrl.pathname.split("/").filter(Boolean);
  const visitId =
    segments.length >= 3 ? segments[segments.length - 2] : undefined;

  if (!visitId) {
    return withCors(
      NextResponse.json({ error: "Visit ID is required" }, { status: 400 }),
      { methods: "GET,OPTIONS", headers: "Content-Type, Authorization" }
    );
  }

  const auth = getAuthFromRequest(req);
  if (!auth || !auth.role) {
    return withCors(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      { methods: "GET,OPTIONS", headers: "Content-Type, Authorization" }
    );
  }

  try {
    const visit = await getVisitById(visitId);
    if (!visit) {
      return withCors(
        NextResponse.json({ error: "Visit not found" }, { status: 404 }),
        { methods: "GET,OPTIONS", headers: "Content-Type, Authorization" }
      );
    }

    if (
      !isAuthorizedForVisit(auth.role, auth.partnerId, visit.partner_id ?? null)
    ) {
      log.warn("visit_qr_forbidden", {
        route: "visit/qr",
        visitId,
        actor: auth.role,
        actorPartner: auth.partnerId,
        visitPartner: visit.partner_id,
        correlationId,
      });
      return withCors(
        NextResponse.json({ error: "Forbidden" }, { status: 403 }),
        { methods: "GET,OPTIONS", headers: "Content-Type, Authorization" }
      );
    }

    const payload = expandVisitPayload(visit);
    const qrPath = extractQrPath(payload);
    if (!qrPath) {
      log.warn("visit_qr_missing_path", {
        route: "visit/qr",
        visitId,
        correlationId,
      });
      return withCors(
        NextResponse.json(
          { error: "QR preview not available for this visit" },
          { status: 404 }
        ),
        { methods: "GET,OPTIONS", headers: "Content-Type, Authorization" }
      );
    }

    const { url, expiresAt } = await createSignedQrUrl(
      qrPath,
      PREVIEW_EXPIRY_SECONDS
    );

    return withCors(
      NextResponse.json(
        {
          url,
          expiresAt,
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      ),
      { methods: "GET,OPTIONS", headers: "Content-Type, Authorization" }
    );
  } catch (error) {
    log.error("visit_qr_preview_error", error, {
      route: "visit/qr",
      visitId,
      correlationId,
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      { methods: "GET,OPTIONS", headers: "Content-Type, Authorization" }
    );
  }
}
