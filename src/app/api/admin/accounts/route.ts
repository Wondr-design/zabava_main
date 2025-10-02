import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { ZodError, z } from "zod";
import { upsertPartnerUser } from "@/lib/data/partner-users";
import { hashPassword } from "@/lib/auth/passwords";
import { preflightResponse, withCors } from "@/lib/http/cors";
import { log, getCorrelationId } from "@/lib/logging";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const JWT_SECRET = process.env.JWT_SECRET || "";

const upsertSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    partnerId: z.string().min(1, "partnerId is required").optional(),
    role: z.enum(["partner", "admin"]).default("partner"),
    name: z.string().min(1).max(120).optional(),
  })
  .refine((payload) => payload.role === "admin" || Boolean(payload.partnerId), {
    message: "partnerId is required for partner accounts",
    path: ["partnerId"],
  });

function isAuthorized(req: NextRequest) {
  const adminSecret = req.headers.get("x-admin-secret");
  if (ADMIN_SECRET && adminSecret === ADMIN_SECRET) {
    return true;
  }

  if (!JWT_SECRET) {
    return false;
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return false;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (typeof payload === "object" && payload && "role" in payload) {
      return (payload as { role?: string }).role === "admin";
    }
    return false;
  } catch (err) {
    log.warn("admin_accounts_auth_failed", { route: "admin/accounts", error: (err as Error)?.message, correlationId: getCorrelationId(req) });
    return false;
  }
}

export function OPTIONS() {
  return preflightResponse({
    methods: "GET,POST,PUT,OPTIONS",
    headers: "Content-Type, Authorization, x-admin-secret",
  });
}

// GET: list accounts (parity helper)

type PartnerUserRow = {
  email: string | null;
  role: string | null;
  partner_id: string | null;
  name: string | null;
  created_at: string | null;
  last_login_at: string | null;
};

export async function GET(req: NextRequest) {
  // Reuse unified authorization: x-admin-secret OR admin JWT
  if (!isAuthorized(req)) {
    return withCors(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      {
        methods: "GET,POST,PUT,OPTIONS",
        headers: "Content-Type, Authorization, x-admin-secret",
      }
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const res = await supabase
      .from("partner_users")
      .select("email,role,partner_id,name,created_at,last_login_at")
      .order("created_at", { ascending: false });
    if (res.error) throw new Error(res.error.message);
    const rows = (res.data ?? []) as PartnerUserRow[];
    const items = rows.map((r) => ({
      email: r.email?.toLowerCase(),
      role: r.role,
      partnerId: r.partner_id,
      name: r.name,
      createdAt: r.created_at,
      lastLoginAt: r.last_login_at,
    }));
    return withCors(NextResponse.json({ items }), {
      methods: "GET,POST,PUT,OPTIONS",
      headers: "Content-Type, Authorization, x-admin-secret",
    });
  } catch (err) {
    log.error("admin_accounts_get_error", err, { route: "admin/accounts", correlationId: getCorrelationId(req) });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      {
        methods: "GET,POST,PUT,OPTIONS",
        headers: "Content-Type, Authorization, x-admin-secret",
      }
    );
  }
}

async function handleUpsert(req: NextRequest) {
  if (!isAuthorized(req)) {
    return withCors(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      {
        methods: "GET,POST,PUT,OPTIONS",
        headers: "Content-Type, Authorization, x-admin-secret",
      }
    );
  }

  try {
    const body = await req.json();
    const payload = upsertSchema.parse(body ?? {});
    const passwordHash = await hashPassword(payload.password);

    const result = await upsertPartnerUser({
      email: payload.email,
      passwordHash,
      partnerId: payload.partnerId,
      role: payload.role,
      name: payload.name,
    });

    return withCors(
      NextResponse.json(
        {
          success: true,
          email: result.email,
          partnerId: result.partnerId,
          role: result.role,
          name: result.name,
        },
        { status: 200 }
      ),
      {
        methods: "GET,POST,PUT,OPTIONS",
        headers: "Content-Type, Authorization, x-admin-secret",
      }
    );
  } catch (err) {
    if (err instanceof ZodError) {
      log.warn("admin_accounts_validation_error", { route: "admin/accounts", method: req.method, correlationId: getCorrelationId(req), issues: err.flatten?.() });
      return withCors(
        NextResponse.json(
          { error: "ValidationError", issues: err.flatten() },
          { status: 400 }
        ),
        {
          methods: "GET,POST,PUT,OPTIONS",
          headers: "Content-Type, Authorization, x-admin-secret",
        }
      );
    }

    log.error("admin_accounts_upsert_error", err, { route: "admin/accounts", correlationId: getCorrelationId(req) });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      {
        methods: "GET,POST,PUT,OPTIONS",
        headers: "Content-Type, Authorization, x-admin-secret",
      }
    );
  }
}

export async function POST(req: NextRequest) {
  return handleUpsert(req);
}

export async function PUT(req: NextRequest) {
  return handleUpsert(req);
}
