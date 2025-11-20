import { redirect } from "next/navigation";

import { resolveLocale } from "@/i18n/config";
import { buildLocalizedPath } from "@/i18n/routing";

type StaffIndexParams = Promise<{ locale: string }>;

export default async function StaffIndexRedirect({ params }: { params: StaffIndexParams }) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  redirect(buildLocalizedPath("/staff/console", locale));
}
