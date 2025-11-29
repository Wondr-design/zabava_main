import { redirect } from "next/navigation";

import { resolveLocale } from "@/i18n/config";
import { buildLocalizedPath } from "@/i18n/routing";

type StaffDashboardParams = Promise<{ locale: string }>;

export default async function StaffDashboardRedirect({ params }: { params: StaffDashboardParams }) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  redirect(buildLocalizedPath("/staff/console", locale));
}
