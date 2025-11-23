import { CmsDashboard } from "@/components/admin/cms/cms-dashboard";
import { listCmsPagesWithVersions } from "@/lib/data/cms";
import { resolveLocale } from "@/i18n/config";

export const metadata = {
  title: "CMS · Admin",
};

export default async function CmsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  const pages = await listCmsPagesWithVersions();
  return <CmsDashboard initialPages={pages} locale={locale} />;
}

