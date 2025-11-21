import { Resend } from "resend";

import {
  EMAIL_TEMPLATE_DEFAULTS,
  EmailTemplateType,
} from "@/lib/email-template-constants";
import { getEmailTemplate } from "@/lib/data/email-templates";
import { log } from "@/lib/logging";
import { renderEmailTemplate } from "@/emails/render-email";

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const RESEND_FROM = process.env.RESEND_FROM ?? "";
const RESEND_REPLY_TO = process.env.RESEND_REPLY_TO ?? "";

const resend =
  RESEND_API_KEY && RESEND_FROM ? new Resend(RESEND_API_KEY) : null;

export function isEmailDeliveryConfigured() {
  return Boolean(resend && RESEND_FROM);
}

export async function sendTemplatedEmail(opts: {
  to: string | string[];
  templateType: EmailTemplateType;
  locale?: string;
  subjectOverride?: string;
  bodyOverride?: string;
  details?: Array<{ label: string; value: string | null | undefined }>;
  replyTo?: string;
  imageSrc?: string | null;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}) {
  if (!resend || !RESEND_FROM) {
    log.warn("mailer_not_configured", { template: opts.templateType });
    return;
  }
  const locale = opts.locale || "en";
  const template =
    (await getEmailTemplate(opts.templateType, locale)) ||
    EMAIL_TEMPLATE_DEFAULTS[opts.templateType];

  const subject = opts.subjectOverride || template.subject;
  const body = opts.bodyOverride || template.body;
  const { html, text } = await renderEmailTemplate({
    templateType: opts.templateType,
    subject,
    body,
    details: opts.details,
    imageSrc: opts.imageSrc,
  });

  try {
    const result = await resend.emails.send({
      from: RESEND_FROM,
      to: Array.isArray(opts.to) ? opts.to : [opts.to],
      subject,
      html,
      text,
      replyTo: opts.replyTo || RESEND_REPLY_TO || undefined,
      attachments: opts.attachments?.map((file) => ({
        filename: file.filename,
        content: file.content,
        contentType: file.contentType,
      })),
    });
    log.info("mailer_send_success", {
      template: opts.templateType,
      to: Array.isArray(opts.to) ? opts.to.join(",") : opts.to,
      id: (result.data as { id?: string } | null)?.id,
    });
  } catch (error) {
    log.error("mailer_send_error", error, {
      template: opts.templateType,
      to: Array.isArray(opts.to) ? opts.to.join(",") : opts.to,
    });
    throw error;
  }
}
