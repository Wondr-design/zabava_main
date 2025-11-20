import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";

import { log } from "@/lib/logging";
import { isEmailDeliveryConfigured, sendTemplatedEmail } from "@/lib/services/mailer";
import { getEmailTemplate } from "@/lib/data/email-templates";
import QRCode from "qrcode";
import { createSignedQrUrl, DEFAULT_BUCKET } from "@/lib/services/qr";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type QrEmailNotificationType = "visit" | "deal" | "reward";

export interface QrEmailPartnerInfo {
  id: string | null;
  name?: string | null;
  displayName?: string | null;
  contactEmail?: string | null;
  type?: string | null;
  logoUrl?: string | null;
}

export interface QrEmailNotificationInput {
  type: QrEmailNotificationType;
  email: string | null;
  visitId: string | null;
  submissionId?: string | null;
  verifyUrl: string | null;
  qrUrl: string | null;
  qrExpiresAt: string | null;
  qrStoragePath?: string | null;
  partnerId?: string | null;
  partner?: QrEmailPartnerInfo | null;
  staffScanUrl?: string | null;
  locale?: string | null;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown> | null;
  extras?: Record<string, unknown> | null;
}

function isValidWebhookUrl(url: string) {
  if (!url) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

async function createEmailSafeQrUrl(verifyUrl: string, visitId?: string | null) {
  if (!verifyUrl || !isValidWebhookUrl(verifyUrl)) return null;
  try {
    const png = await QRCode.toBuffer(verifyUrl, { type: "png", margin: 1, scale: 6 });
    const supabase = getSupabaseAdmin();
    const path = `visits/${visitId ?? "generic"}/email-${randomUUID()}.png`;
    const { error } = await supabase.storage
      .from(DEFAULT_BUCKET)
      .upload(path, png, {
        contentType: "image/png",
        upsert: true,
        cacheControl: "21600",
      });
    if (error) {
      log.warn("qr_email_png_upload_failed", { visitId, error: error.message });
      return null;
    }
    const { url } = await createSignedQrUrl(path, 60 * 60 * 24 * 7); // 7 days
    return url;
  } catch (error) {
    log.warn("qr_email_png_generate_failed", { visitId, error: (error as Error)?.message });
    return null;
  }
}

async function loadStyledSvgInline(qrStoragePath?: string | null) {
  if (!qrStoragePath) return null;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from(DEFAULT_BUCKET)
      .download(qrStoragePath);
    if (error || !data) {
      log.warn("qr_email_svg_download_failed", {
        path: qrStoragePath,
        error: error?.message,
      });
      return null;
    }
    const arrayBuffer = await data.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return `data:image/svg+xml;base64,${base64}`;
  } catch (error) {
    log.warn("qr_email_svg_inline_failed", {
      path: qrStoragePath,
      error: (error as Error)?.message,
    });
    return null;
  }
}

export async function notifyQrEmail(input: QrEmailNotificationInput) {
  if (!input.email) {
    log.warn("qr_email_missing_recipient", { visitId: input.visitId });
    return;
  }
  if (!isEmailDeliveryConfigured()) {
    log.warn("qr_email_not_configured", { visitId: input.visitId, email: input.email });
    return;
  }

  try {
    const locale = input.locale || "en";
    const template = await getEmailTemplate("qr_delivery", locale);
    const styledInlineSvg = await loadStyledSvgInline(input.qrStoragePath);
    const styledSignedUrl = styledInlineSvg
      ? null
      : await createSignedQrUrl(input.qrStoragePath ?? "", 60 * 60 * 24 * 7)
          .then(({ url }) => url)
          .catch(() => null);
    const pngFallback = await createEmailSafeQrUrl(input.verifyUrl || "", input.visitId);
    const emailQrUrl =
      styledInlineSvg || styledSignedUrl || pngFallback || input.qrUrl || undefined;
    const details: Array<{ label: string; value: string | null | undefined }> = [
      { label: "Visit ID", value: input.visitId },
      { label: "Expires", value: input.qrExpiresAt },
      { label: "Verify URL", value: input.verifyUrl },
      { label: "Partner", value: input.partner?.displayName || input.partner?.name },
      { label: "Type", value: input.type },
    ];
    await sendTemplatedEmail({
      to: input.email,
      templateType: "qr_delivery",
      locale,
      subjectOverride: template?.subject,
      bodyOverride: template?.body,
      details,
      imageSrc: emailQrUrl || input.qrUrl || undefined,
    });
    log.info("qr_email_resend_sent", { visitId: input.visitId, email: input.email });
  } catch (error) {
    log.error("qr_email_resend_failed", error, { visitId: input.visitId });
  }
}
