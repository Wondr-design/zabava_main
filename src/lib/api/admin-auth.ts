import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

import { getAuthFromRequest } from "@/lib/auth/request";
import { getCorrelationId, log } from "@/lib/logging";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const JWT_SECRET = process.env.JWT_SECRET || "";

export function isAdminRequestAuthorized(req: NextRequest): boolean {
  const auth = getAuthFromRequest(req);
  if (auth?.role === "admin") {
    return true;
  }

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
    log.warn("admin_auth_failed", {
      error: err instanceof Error ? err.message : String(err),
      correlationId: getCorrelationId(req),
    });
    return false;
  }
}
