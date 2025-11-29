import { redirect } from "next/navigation";

import { resolveLocale } from "@/i18n/config";
import { buildLocalizedPath } from "@/i18n/routing";

type AdminIndexParams = Promise<{ locale: string }>;

export default async function AdminIndexRedirect({ params }: { params: AdminIndexParams }) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  redirect(buildLocalizedPath("/admin/dashboard", locale));
}
