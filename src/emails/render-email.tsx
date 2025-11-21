import { render } from "@react-email/render";

import type { EmailTemplateType } from "@/lib/email-template-constants";

import type { EmailDetailsEntry } from "./templates";
import {
  BillingReportEmail,
  InviteEmail,
  QrDeliveryEmail,
  VerificationCodeEmail,
  VisitConfirmedEmail,
  VisitUpdatedEmail,
} from "./templates";

export interface RenderEmailTemplateInput {
  templateType: EmailTemplateType;
  subject: string;
  body: string;
  details?: EmailDetailsEntry[];
  imageSrc?: string | null;
}

export async function renderEmailTemplate(input: RenderEmailTemplateInput) {
  const normalizedDetails = normalizeDetails(input.details);
  const previewText = buildPreviewText(input.body);
  const cta = extractFirstUrl(normalizedDetails);
  const highlightedCode = extractHighlightedCode(
    normalizedDetails,
    input.templateType
  );
  const attachmentsNote =
    input.templateType === "billing_report"
      ? "Your CSV and XLSX reports are attached."
      : undefined;
  const verificationPartnerLabel = extractPartnerLabel(normalizedDetails);
  const verificationExpiresIn = buildExpiresInLabel(normalizedDetails);

  const component = getTemplateComponent({
    templateType: input.templateType,
    subject: input.subject,
    body: input.body,
    previewText,
    details: normalizedDetails,
    imageSrc: input.imageSrc,
    ctaHref: cta?.href,
    ctaLabel: cta?.label,
    highlightedCode,
    attachmentsNote,
    partnerLabel: verificationPartnerLabel,
    expiresInLabel: verificationExpiresIn,
  });

  const html = await render(component);
  const text = await render(component, { plainText: true });
  return { html, text };
}

function getTemplateComponent(props: {
  templateType: EmailTemplateType;
  subject: string;
  body: string;
  previewText?: string;
  details?: EmailDetailsEntry[];
  imageSrc?: string | null;
  ctaHref?: string | null;
  ctaLabel?: string | null;
  highlightedCode?: { label?: string; value?: string | null };
  attachmentsNote?: string;
  partnerLabel?: string | null;
  expiresInLabel?: string | null;
}) {
  switch (props.templateType) {
    case "qr_delivery":
      return (
        <QrDeliveryEmail
          subject={props.subject}
          body={props.body}
          previewText={props.previewText}
          details={props.details}
          imageSrc={props.imageSrc}
          ctaHref={props.ctaHref}
          ctaLabel={props.ctaLabel}
        />
      );
    case "visit_confirmed":
      return (
        <VisitConfirmedEmail
          subject={props.subject}
          body={props.body}
          previewText={props.previewText}
          details={props.details}
        />
      );
    case "visit_updated":
      return (
        <VisitUpdatedEmail
          subject={props.subject}
          body={props.body}
          previewText={props.previewText}
          details={props.details}
        />
      );
    case "invite_partner":
    case "invite_staff":
      return (
        <InviteEmail
          subject={props.subject}
          body={props.body}
          previewText={props.previewText}
          details={props.details}
          ctaHref={props.ctaHref}
          ctaLabel={props.ctaLabel}
        />
      );
    case "verification_code":
      return (
        <VerificationCodeEmail
          subject={props.subject}
          body={props.body}
          previewText={props.previewText}
          details={props.details}
          highlightedCode={props.highlightedCode}
          partnerLabel={props.partnerLabel}
          expiresInLabel={props.expiresInLabel}
        />
      );
    case "billing_report":
      return (
        <BillingReportEmail
          subject={props.subject}
          body={props.body}
          previewText={props.previewText}
          details={props.details}
          attachmentsNote={props.attachmentsNote}
        />
      );
    default:
      return (
        <VisitUpdatedEmail
          subject={props.subject}
          body={props.body}
          previewText={props.previewText}
          details={props.details}
        />
      );
  }
}

function normalizeDetails(details?: EmailDetailsEntry[]) {
  if (!details) return undefined;
  return details
    .map((entry) => ({
      label: entry.label,
      value:
        typeof entry.value === "number" || typeof entry.value === "string"
          ? entry.value
          : (entry.value ?? ""),
    }))
    .filter((entry) => entry.label);
}

function buildPreviewText(body: string, fallback?: string) {
  const firstLine =
    body
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? fallback;
  if (!firstLine) return undefined;
  return firstLine.length > 140 ? `${firstLine.slice(0, 137)}…` : firstLine;
}

function extractFirstUrl(details?: EmailDetailsEntry[]) {
  if (!details) return null;
  for (const entry of details) {
    const value = entry.value?.toString() ?? "";
    if (/^https?:\/\//i.test(value)) {
      const labelText =
        entry.label?.toLowerCase().includes("invite") ||
        entry.label?.toLowerCase().includes("verify")
          ? entry.label
          : "Open link";
      return { href: value, label: labelText };
    }
  }
  return null;
}

function extractHighlightedCode(
  details: EmailDetailsEntry[] | undefined,
  templateType: EmailTemplateType
) {
  if (!details) return undefined;
  const codeEntry =
    details.find((entry) => entry.label?.toLowerCase().includes("code")) ??
    details[0];
  if (
    templateType === "verification_code" &&
    codeEntry &&
    typeof codeEntry.value === "string"
  ) {
    return { label: codeEntry.label ?? "Code", value: codeEntry.value };
  }
  return undefined;
}

function extractPartnerLabel(details?: EmailDetailsEntry[]) {
  if (!details) return undefined;
  const partnerEntry = details.find((entry) =>
    entry.label?.toLowerCase().includes("partner")
  );
  return partnerEntry?.value ? String(partnerEntry.value) : undefined;
}

function buildExpiresInLabel(details?: EmailDetailsEntry[]) {
  if (!details) return undefined;
  const expiresEntry = details.find((entry) =>
    entry.label?.toLowerCase().includes("expire")
  );
  if (!expiresEntry?.value) return undefined;
  const parsed = Date.parse(String(expiresEntry.value));
  if (Number.isNaN(parsed)) return undefined;
  const diffMs = parsed - Date.now();
  if (diffMs <= 0) return "Expires soon";
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));
  if (diffMinutes < 60) {
    return `Expires in ${diffMinutes} min${diffMinutes === 1 ? "" : "s"}`;
  }
  const diffHours = Math.max(1, Math.round(diffMinutes / 60));
  return `Expires in ${diffHours} hr${diffHours === 1 ? "" : "s"}`;
}
