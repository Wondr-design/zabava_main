"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  EmailTemplateRecord,
} from "@/lib/data/email-templates";
import { adminApi } from "@/lib/web/api-client";
import { getCsrfToken } from "@/lib/web/csrf";
import { cn } from "@/lib/utils";
import {
  EMAIL_TEMPLATE_DEFAULTS,
  EmailTemplateType,
  emailTemplateTypes,
} from "@/lib/email-template-constants";

const TEMPLATE_LABELS: Record<EmailTemplateType, { title: string; subtitle: string }> = {
  qr_delivery: {
    title: "QR delivery",
    subtitle: "Sent when we generate a QR (visits, rewards, flash deals).",
  },
  visit_confirmed: {
    title: "Visit confirmed",
    subtitle: "Sent after staff marks a visit as visited/confirmed.",
  },
  visit_updated: {
    title: "Visit updated",
    subtitle: "Sent when staff edits a visitor’s details.",
  },
  invite_partner: {
    title: "Partner invite",
    subtitle: "Sent to partners with their invite link.",
  },
  invite_staff: {
    title: "Staff invite",
    subtitle: "Sent to staff with their invite link.",
  },
  verification_code: {
    title: "Verification code",
    subtitle: "Sent for any email verification flow.",
  },
  billing_report: {
    title: "Billing report",
    subtitle: "Sent monthly with CSV/XLSX attachments.",
  },
};

export function EmailTemplatesDashboard({
  initialTemplates,
  locale,
}: {
  initialTemplates: EmailTemplateRecord[];
  locale: string;
}) {
  const [templates, setTemplates] = useState<EmailTemplateRecord[]>(initialTemplates);
  const [saving, setSaving] = useState(false);
  const [csrfToken] = useState(() => getCsrfToken());

  const mergedTemplates = useMemo(() => {
    return emailTemplateTypes.map((type) => {
      const existing = templates.find((t) => t.templateType === type);
      if (existing) return existing;
      const defaults = EMAIL_TEMPLATE_DEFAULTS[type];
      return {
        templateType: type,
        locale,
        subject: defaults.subject,
        body: defaults.body,
        description: defaults.description,
      } satisfies EmailTemplateRecord;
    });
  }, [templates, locale]);

  const dirty = useMemo(() => {
    return mergedTemplates.some((template) => {
      const defaults = EMAIL_TEMPLATE_DEFAULTS[template.templateType];
      const initial = initialTemplates.find(
        (t) =>
          t.templateType === template.templateType &&
          (t.locale === template.locale || !t.locale),
      );
      if (!initial) return true;
      return (
        initial.subject !== template.subject ||
        initial.body !== template.body ||
        (initial.description ?? undefined) !== (template.description ?? undefined)
      );
    });
  }, [mergedTemplates, initialTemplates]);

  async function handleSave() {
    setSaving(true);
    try {
      await adminApi.emailTemplatesSave(
        { templates: mergedTemplates },
        { headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined },
      );
      toast.success("Templates saved");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save templates";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Email templates
          </p>
          <h1 className="text-2xl font-bold leading-tight">System emails</h1>
          <p className="text-sm text-muted-foreground">
            Customize the subject and message shown in outbound emails. Variables are applied by the
            mailer; keep phrasing clear and concise.
          </p>
        </div>
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving || !dirty}
          className="inline-flex items-center gap-2"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save templates
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {mergedTemplates.map((template) => {
          const labels = TEMPLATE_LABELS[template.templateType];
          const defaults = EMAIL_TEMPLATE_DEFAULTS[template.templateType];
          return (
            <Card key={`${template.templateType}-${template.locale}`} className="border-muted/60">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base font-semibold">
                  <span>{labels.title}</span>
                  <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {template.locale}
                  </span>
                </CardTitle>
                <CardDescription>{labels.subtitle}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Subject</label>
                  <Input
                    value={template.subject}
                    onChange={(event) => {
                      const next = event.target.value;
                      setTemplates((prev) =>
                        prev.map((item) =>
                          item.templateType === template.templateType && item.locale === template.locale
                            ? { ...item, subject: next }
                            : item,
                        ),
                      );
                    }}
                    placeholder={defaults.subject}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Body</label>
                  <Textarea
                    value={template.body}
                    onChange={(event) => {
                      const next = event.target.value;
                      setTemplates((prev) =>
                        prev.map((item) =>
                          item.templateType === template.templateType && item.locale === template.locale
                            ? { ...item, body: next }
                            : item,
                        ),
                      );
                    }}
                    rows={6}
                    className="resize-none"
                    placeholder={defaults.body}
                  />
                  <p className="text-xs text-muted-foreground">
                    {template.description ?? defaults.description}
                  </p>
                  <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    <span className="rounded-full border border-muted px-2 py-0.5">
                      Variables auto-populated by mailer (user, QR, links)
                    </span>
                  </div>
                </div>
                {template.updatedAt ? (
                  <p className="text-[11px] text-muted-foreground">
                    Last updated {new Date(template.updatedAt).toLocaleString()}
                    {template.updatedBy ? ` by ${template.updatedBy}` : ""}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
