"use client";

import { EmailTemplateRecord } from "@/lib/data/email-templates";
import { EmailTemplateBuilder } from "./email-template-builder";

export function EmailTemplatesDashboard({
  initialTemplates,
  locale,
}: {
  initialTemplates: EmailTemplateRecord[];
  locale: string;
}) {
  return (
    <EmailTemplateBuilder initialTemplates={initialTemplates} locale={locale} />
  );
}
