import { Resend } from "resend";

import {
  EMAIL_TEMPLATE_DEFAULTS,
  EmailTemplateType,
} from "@/lib/email-template-constants";
import { getEmailTemplate } from "@/lib/data/email-templates";
import { log } from "@/lib/logging";

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const RESEND_FROM = process.env.RESEND_FROM ?? "";
const RESEND_REPLY_TO = process.env.RESEND_REPLY_TO ?? "";

const resend =
  RESEND_API_KEY && RESEND_FROM
    ? new Resend(RESEND_API_KEY)
    : null;

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderBodyToHtml(body: string) {
  const safe = escapeHtml(body).replace(/\r?\n/g, "<br />");
  return `<p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 15px; line-height: 1.5; color: #0f172a;">${safe}</p>`;
}

function renderDetails(
  details?: Array<{ label: string; value: string | null | undefined }>,
) {
  if (!details || details.length === 0) return "";
  const rows = details
    .filter((item) => item.value)
    .map(
      (item) =>
        `<tr><td style="padding:4px 0; font-size:14px; color:#334155; min-width:140px;"><strong>${escapeHtml(
          item.label,
        )}</strong></td><td style="padding:4px 0; font-size:14px; color:#0f172a;">${escapeHtml(
          String(item.value),
        )}</td></tr>`,
    )
    .join("");
  return rows
    ? `<table role="presentation" style="margin-top:12px; border-collapse:collapse;">${rows}</table>`
    : "";
}

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
  attachments?: Array<{ filename: string; content: Buffer | string; contentType?: string }>;
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
  const qrBlock =
    opts.imageSrc && /^data:image\/svg\+xml;base64,|^https?:\/\//i.test(opts.imageSrc)
      ? `<div style="margin-top:12px;"><img src="${escapeHtml(
          opts.imageSrc,
        )}" alt="QR code" style="max-width:260px;height:auto;border:1px solid #e2e8f0;border-radius:12px;padding:8px;" referrerpolicy="no-referrer" /></div>`
      : "";
  const html = `${renderBodyToHtml(body)}${qrBlock}${renderDetails(opts.details)}`;
  const textLines = [
    body,
    opts.imageSrc ? `QR: ${opts.imageSrc}` : "",
    "",
    ...(opts.details ?? [])
      .filter((d) => d.value)
      .map((d) => `${d.label}: ${d.value}`),
  ].filter(Boolean);

  try {
    const result = await resend.emails.send({
      from: RESEND_FROM,
      to: Array.isArray(opts.to) ? opts.to : [opts.to],
      subject,
      html,
      text: textLines.join("\n"),
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
