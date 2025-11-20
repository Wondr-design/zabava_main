import { EmailTemplatesDashboard } from "@/components/admin/email-templates/email-templates-dashboard";
import { listEmailTemplates } from "@/lib/data/email-templates";
import { resolveLocale } from "@/i18n/config";

export const metadata = {
  title: "Email templates · Admin",
};

export default async function EmailTemplatesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  const templates = await listEmailTemplates(locale);
  return <EmailTemplatesDashboard initialTemplates={templates} locale={locale} />;
}
