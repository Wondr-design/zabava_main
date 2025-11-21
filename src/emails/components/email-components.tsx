import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

import { emailTheme, emailFontStack } from "../email-theme";

const tailwindConfig = {
  theme: {
    extend: {
      colors: {
        brand: {
          background: emailTheme.background,
          surface: emailTheme.surface,
          border: emailTheme.border,
          text: emailTheme.text,
          muted: emailTheme.muted,
          primary: emailTheme.primary,
          primaryForeground: emailTheme.primaryForeground,
        },
      },
      fontFamily: {
        brand: emailFontStack
          .split(",")
          .map((item) => item.replace(/['"]/g, "")),
      },
    },
  },
  separator: ":",
  safelist: [] as string[],
  experimental: {},
  corePlugins: {},
} as const;

interface EmailLayoutProps {
  title: string;
  previewText?: string;
  footerText?: string;
  children: ReactNode;
}

export function EmailLayout({
  title,
  previewText,
  footerText,
  children,
}: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      {previewText ? <Preview>{previewText}</Preview> : null}
      <Tailwind config={tailwindConfig}>
        <Body className="m-0 bg-[#f5f3ed] p-6 font-brand text-brand-text">
          <Container className="mx-auto my-0 w-[560px] rounded-[32px] border border-brand-border bg-brand-surface px-8 py-10 shadow-[0_24px_60px_rgba(47,46,40,0.12)]">
            <Section className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-brand-muted">
                Zabava
              </p>
              <h1 className="mt-2 text-2xl font-semibold leading-tight text-brand-text">
                {title}
              </h1>
            </Section>
            <Section className="mt-8 space-y-6">{children}</Section>
            {footerText ? (
              <Section className="mt-10 border-t border-brand-border pt-6 text-center">
                <Text className="text-xs leading-relaxed text-brand-muted">
                  {footerText}
                </Text>
              </Section>
            ) : null}
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

interface EmailParagraphProps {
  children: ReactNode;
}

export function EmailParagraph({ children }: EmailParagraphProps) {
  return (
    <Text className="text-[15px] leading-relaxed text-brand-text tracking-tight">
      {children}
    </Text>
  );
}

interface DetailsTableProps {
  rows?: Array<{
    label: string;
    value: string | number | null | undefined;
  }> | null;
}

export function DetailsTable({ rows }: DetailsTableProps) {
  if (!rows || rows.length === 0) return null;
  const filtered = rows.filter(
    (row) => row.value !== null && row.value !== undefined
  );
  if (filtered.length === 0) return null;
  return (
    <Section className="overflow-hidden rounded-2xl border border-brand-border">
      <table className="w-full border-collapse text-sm">
        <tbody>
          {filtered.map((row, idx) => (
            <tr
              key={`${row.label}-${idx}`}
              className="border-b border-brand-border last:border-none"
            >
              <td className="w-40 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">
                {row.label}
              </td>
              <td className="px-4 py-3 text-[15px] text-brand-text">
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

interface QrPreviewProps {
  imageSrc?: string | null;
  caption?: string | null;
}

export function QrPreview({ imageSrc, caption }: QrPreviewProps) {
  if (!imageSrc) return null;
  return (
    <Section className="text-center">
      <div className="inline-flex flex-col items-center rounded-2xl border border-brand-border bg-white p-4">
        <Img
          alt="QR code"
          src={imageSrc}
          width="192"
          height="192"
          className="h-48 w-48 rounded-xl border border-brand-border object-contain"
        />
        {caption ? (
          <Text className="mt-3 text-xs text-brand-muted">{caption}</Text>
        ) : null}
      </div>
    </Section>
  );
}

interface CodeBadgeProps {
  label?: string;
  value?: string | null;
}

export function CodeBadge({ label, value }: CodeBadgeProps) {
  if (!value) return null;
  return (
    <Section className="text-center">
      {label ? (
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-muted">
          {label}
        </p>
      ) : null}
      <div className="mt-3 inline-flex rounded-2xl bg-brand-text px-6 py-3 font-mono text-lg font-semibold text-brand-primaryForeground">
        {value}
      </div>
    </Section>
  );
}

interface CtaButtonProps {
  href?: string | null;
  label?: string;
}

export function CtaButton({ href, label }: CtaButtonProps) {
  if (!href) return null;
  return (
    <Section className="text-center">
      <a
        href={href}
        className="inline-flex rounded-full bg-brand-primary px-8 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-brand-primaryForeground no-underline"
      >
        {label ?? "Open link"}
      </a>
    </Section>
  );
}
