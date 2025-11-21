import type { ReactNode } from "react";

import {
  CtaButton,
  CodeBadge,
  DetailsTable,
  EmailLayout,
  EmailParagraph,
  QrPreview,
  CopyIconBadge,
} from "./components/email-components";

export type EmailDetailsEntry = {
  label: string;
  value: string | number | null | undefined;
};

export interface TemplateComponentProps {
  subject: string;
  body: string;
  previewText?: string;
  details?: EmailDetailsEntry[];
  imageSrc?: string | null;
  ctaHref?: string | null;
  ctaLabel?: string | null;
  highlightedCode?: { label?: string; value?: string | null };
  attachmentsNote?: string | null;
  partnerLabel?: string | null;
  expiresInLabel?: string | null;
}

const FOOTER_TEXT =
  "This message was sent by Zabava. If you did not expect it, please contact support@zabava.cz.";

function ParagraphGroup({ body }: { body: string }) {
  const cleaned = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const paragraphs = cleaned.length > 0 ? cleaned : [""];
  return (
    <>
      {paragraphs.map((text, index) => (
        <EmailParagraph key={`p-${index}`}>
          {text.length > 0 ? text : "\u00A0"}
        </EmailParagraph>
      ))}
    </>
  );
}

function DetailsSection({ children }: { children: ReactNode }) {
  return <div className="space-y-4">{children}</div>;
}

export function QrDeliveryEmail(props: TemplateComponentProps) {
  return (
    <EmailLayout
      title={props.subject}
      previewText={props.previewText ?? "Your QR code is ready for check-in."}
      footerText={FOOTER_TEXT}
    >
      <ParagraphGroup body={props.body} />
      <QrPreview imageSrc={props.imageSrc} caption="Show this code when you arrive." />
      <DetailsSection>
        <DetailsTable rows={props.details} />
        <CtaButton href={props.ctaHref} label={props.ctaLabel ?? "View visit"} />
      </DetailsSection>
    </EmailLayout>
  );
}

export function VisitConfirmedEmail(props: TemplateComponentProps) {
  return (
    <EmailLayout
      title={props.subject}
      previewText={props.previewText ?? "Your visit has been confirmed."}
      footerText={FOOTER_TEXT}
    >
      <ParagraphGroup body={props.body} />
      <DetailsTable rows={props.details} />
    </EmailLayout>
  );
}

export function VisitUpdatedEmail(props: TemplateComponentProps) {
  return (
    <EmailLayout
      title={props.subject}
      previewText={props.previewText ?? "We updated your visit details."}
      footerText={FOOTER_TEXT}
    >
      <ParagraphGroup body={props.body} />
      <DetailsTable rows={props.details} />
    </EmailLayout>
  );
}

export function InviteEmail(props: TemplateComponentProps) {
  return (
    <EmailLayout
      title={props.subject}
      previewText={props.previewText ?? "You're invited to manage experiences with Zabava."}
      footerText={FOOTER_TEXT}
    >
      <ParagraphGroup body={props.body} />
      <CtaButton href={props.ctaHref} label={props.ctaLabel ?? "Accept invitation"} />
      <DetailsTable rows={props.details} />
    </EmailLayout>
  );
}

export function VerificationCodeEmail(props: TemplateComponentProps) {
  return (
    <EmailLayout
      title={props.subject}
      previewText={props.previewText ?? "Use this code to verify your email."}
      footerText={FOOTER_TEXT}
    >
      <ParagraphGroup body={props.body} />
      <CodeBadge
        label={props.highlightedCode?.label ?? "Verification code"}
        value={props.highlightedCode?.value ?? undefined}
      />
      <div className="text-center">
        <CopyIconBadge label="Copy code" />
        {props.expiresInLabel ? (
          <p className="mt-3 text-xs uppercase tracking-[0.3em] text-brand-muted">
            {props.expiresInLabel}
          </p>
        ) : null}
      </div>
      {props.partnerLabel ? (
        <div className="mt-4 rounded-2xl border border-brand-border bg-brand-surface px-4 py-3 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-brand-muted">
            Attraction
          </p>
          <p className="text-sm font-semibold text-brand-text">{props.partnerLabel}</p>
        </div>
      ) : null}
    </EmailLayout>
  );
}

export function BillingReportEmail(props: TemplateComponentProps) {
  return (
    <EmailLayout
      title={props.subject}
      previewText={props.previewText ?? "Here is your latest billing summary."}
      footerText={FOOTER_TEXT}
    >
      <ParagraphGroup body={props.body} />
      <DetailsTable rows={props.details} />
      {props.attachmentsNote ? (
        <EmailParagraph>{props.attachmentsNote}</EmailParagraph>
      ) : null}
    </EmailLayout>
  );
}

