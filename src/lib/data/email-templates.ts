import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { log } from "@/lib/logging";
import {
  EMAIL_TEMPLATE_DEFAULTS,
  EmailTemplateType,
  emailTemplateTypes,
} from "@/lib/email-template-constants";
import type { EmailTemplateStructure } from "@/lib/types/email-template-structure";
import { getDefaultStructure } from "@/lib/types/email-template-structure";

export interface EmailTemplateRecord {
  id?: string;
  templateType: EmailTemplateType;
  locale: string;
  subject: string;
  body: string;
  description?: string | null;
  structure?: EmailTemplateStructure | null;
  updatedBy?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
}

const templateSchema = z.object({
  templateType: z.enum(emailTemplateTypes),
  locale: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  description: z.string().optional().nullable(),
});

export async function listEmailTemplates(locale: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("locale", locale);
  if (error) {
    throw new Error(`Failed to load email templates: ${error.message}`);
  }

  const records = (data ?? []).map((row) => ({
    id: row.id as string | undefined,
    templateType: row.template_type as EmailTemplateType,
    locale: row.locale as string,
    subject: row.subject as string,
    body: row.body as string,
    description: (row.description as string | null) ?? null,
    structure: row.structure
      ? (row.structure as EmailTemplateStructure)
      : (getDefaultStructure(
          row.template_type as string
        ) as EmailTemplateStructure | null),
    updatedBy: (row.updated_by as string | null) ?? null,
    updatedAt: (row.updated_at as string | null) ?? null,
    createdAt: (row.created_at as string | null) ?? null,
  }));

  const merged: EmailTemplateRecord[] = emailTemplateTypes.map((type) => {
    const match = records.find((row) => row.templateType === type);
    if (match) {
      // Ensure structure exists
      if (!match.structure) {
        return {
          ...match,
          structure: getDefaultStructure(type),
        };
      }
      return match;
    }
    const defaults = EMAIL_TEMPLATE_DEFAULTS[type];
    return {
      templateType: type,
      locale,
      subject: defaults.subject,
      body: defaults.body,
      description: defaults.description,
      structure: getDefaultStructure(type),
    };
  });

  return merged;
}

export async function getEmailTemplate(
  templateType: EmailTemplateType,
  locale: string
) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("template_type", templateType)
    .eq("locale", locale)
    .maybeSingle();
  if (error) {
    log.error("email_template_lookup_error", error, {
      templateType,
      locale,
    });
  }

  if (data) {
    return {
      templateType: data.template_type as EmailTemplateType,
      locale: data.locale as string,
      subject: data.subject as string,
      body: data.body as string,
      description: (data.description as string | null) ?? null,
      structure: data.structure
        ? (data.structure as EmailTemplateStructure)
        : (getDefaultStructure(
            data.template_type as string
          ) as EmailTemplateStructure | null),
      updatedBy: (data.updated_by as string | null) ?? null,
      updatedAt: (data.updated_at as string | null) ?? null,
      createdAt: (data.created_at as string | null) ?? null,
    } satisfies EmailTemplateRecord;
  }

  return EMAIL_TEMPLATE_DEFAULTS[templateType];
}

export async function upsertEmailTemplates(
  templates: EmailTemplateRecord[],
  opts?: { actor?: { email?: string | null } }
) {
  const supabase = getSupabaseAdmin();
  const results = templateSchema
    .array()
    .safeParse(
      templates.map((t) => ({ ...t, description: t.description ?? undefined }))
    );

  if (!results.success) {
    throw new Error("Invalid template payload");
  }

  const rows = templates.map((template) => ({
    template_type: template.templateType,
    locale: template.locale,
    subject: template.subject,
    body: template.body,
    description: template.description ?? null,
    structure: template.structure ?? null,
    updated_by: opts?.actor?.email ?? null,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("email_templates")
    .upsert(rows as never, {
      onConflict: "template_type,locale",
    });

  if (error) {
    log.error("email_templates_upsert_error", error, {
      actor: opts?.actor?.email,
    });
    throw new Error(`Failed to save templates: ${error.message}`);
  }

  return true;
}
