import { NextRequest } from "next/server";
import { verifyJwt } from "./jwt";

export interface AuthContext {
  email?: string;
  role?: "admin" | "partner" | "staff";
  partnerId?: string;
  staffId?: string;
  name?: string;
}

export function getAuthFromRequest(req: NextRequest): AuthContext | null {
  // Prefer cookie-based auth (httpOnly JWT cookie)
  try {
    const token = req.cookies.get("zabava_token")?.value;
    if (token) {
      const payload = verifyJwt<AuthContext & { sub?: string }>(token);
      const email = (payload.email || payload.sub || "").trim().toLowerCase();
      return {
        email: email || undefined,
        role: payload.role as AuthContext["role"],
        partnerId: payload.partnerId,
        staffId: (payload as Record<string, unknown>).staffId as
          | string
          | undefined,
        name: payload.name,
      };
    }
  } catch {
    // ignore and try header fallback
  }

  // Back-compat: allow Bearer token header if present
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7).trim();
      if (token) {
        const payload = verifyJwt<AuthContext & { sub?: string }>(token);
        const email = (payload.email || payload.sub || "").trim().toLowerCase();
        return {
          email: email || undefined,
          role: payload.role as AuthContext["role"],
          partnerId: payload.partnerId,
          staffId: (payload as Record<string, unknown>).staffId as
            | string
            | undefined,
          name: payload.name,
        };
      }
    }
  } catch {
    // ignore
  }

  return null;
}
