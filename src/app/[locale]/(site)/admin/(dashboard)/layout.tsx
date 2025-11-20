import { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { verifyJwt } from "@/lib/auth/jwt";
import { resolveLocale } from "@/i18n/config";
import { buildLocalizedPath } from "@/i18n/routing";

import { AdminShell } from "../admin-shell";

interface JwtPayload {
  role?: string;
}

async function ensureAdminSession(loginPath: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("zabava_token")?.value;
  if (!token) {
    redirect(loginPath);
  }

  try {
    const payload = verifyJwt<JwtPayload>(token);
    if (payload.role !== "admin") {
      redirect(loginPath);
    }
  } catch {
    redirect(loginPath);
  }
}

export default async function AdminDashboardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  const loginPath = buildLocalizedPath("/admin/login", locale);
  await ensureAdminSession(loginPath);
  return <AdminShell>{children}</AdminShell>;
}
