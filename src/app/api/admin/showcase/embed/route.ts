import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

import { getAuthFromRequest } from "@/lib/auth/request";
import { getPartnerShowcaseDirectory } from "@/lib/data/partner-showcase";
import {
  generateShowcaseCategoriesEmbed,
  generateShowcaseDetailEmbed,
  generateShowcaseListEmbed,
} from "@/lib/services/partner-showcase-embed";
import { preflightResponse, withCors } from "@/lib/http/cors";
import { log, getCorrelationId } from "@/lib/logging";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const JWT_SECRET = process.env.JWT_SECRET || "";

const CORS_CONFIG = {
  methods: "GET,OPTIONS",
  headers: "Content-Type, Authorization, x-admin-secret",
} as const;

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
  } catch (err) {
    log.warn("admin_showcase_auth_failed", {
      route: "admin/showcase/embed",
      error: (err as Error)?.message,
      correlationId: getCorrelationId(req),
    });
    return false;
  }
}

export function OPTIONS() {
  return preflightResponse(CORS_CONFIG);
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return withCors(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      CORS_CONFIG
    );
  }

  const url = req.nextUrl;
  const type = (url.searchParams.get("type") ?? "categories")
    .trim()
    .toLowerCase();
  const listPageUrl = url.searchParams.get("listPageUrl") ?? "";
  const detailPageUrl = url.searchParams.get("detailPageUrl") ?? "";
  const categoriesPageUrl = url.searchParams.get("categoriesPageUrl") ?? "";
  const defaultImageUrl = url.searchParams.get("defaultImageUrl") ?? "";
  const categoryStorageKey =
    url.searchParams.get("categoryStorageKey") ?? undefined;
  const partnerStorageKey =
    url.searchParams.get("partnerStorageKey") ?? undefined;
  const partnerIdParam = url.searchParams.get("partnerId") ?? "";

  try {
    const directory = await getPartnerShowcaseDirectory();
    let html = "";

    switch (type) {
      case "categories": {
        if (!listPageUrl.trim()) {
          return withCors(
            NextResponse.json(
              { error: "listPageUrl is required for categories embed" },
              { status: 400 }
            ),
            CORS_CONFIG
          );
        }
        html = generateShowcaseCategoriesEmbed(directory, {
          listPageUrl,
          storageKeys: {
            category: categoryStorageKey,
            partner: partnerStorageKey,
          },
        });
        break;
      }
      case "list": {
        if (!detailPageUrl.trim()) {
          return withCors(
            NextResponse.json(
              { error: "detailPageUrl is required for list embed" },
              { status: 400 }
            ),
            CORS_CONFIG
          );
        }
        html = generateShowcaseListEmbed(directory, {
          detailPageUrl,
          categoriesPageUrl,
          defaultImageUrl,
          storageKeys: {
            category: categoryStorageKey,
            partner: partnerStorageKey,
          },
        });
        break;
      }
      case "detail": {
        html = generateShowcaseDetailEmbed(directory, {
          categoriesPageUrl,
          defaultImageUrl,
          storageKeys: {
            category: categoryStorageKey,
            partner: partnerStorageKey,
          },
          partnerId: partnerIdParam || undefined,
        });
        break;
      }
      default: {
        return withCors(
          NextResponse.json({ error: "Unknown embed type" }, { status: 400 }),
          CORS_CONFIG
        );
      }
    }

    return withCors(
      new NextResponse(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      }),
      CORS_CONFIG
    );
  } catch (error) {
    log.error("admin_showcase_embed_error", error, {
      route: "admin/showcase/embed",
      correlationId: getCorrelationId(req),
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      CORS_CONFIG
    );
  }
}
