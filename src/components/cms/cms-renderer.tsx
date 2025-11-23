import { cn } from "@/lib/utils";
import type { CmsRenderableBlock } from "@/lib/data/cms";

interface CmsRendererProps {
  blocks: CmsRenderableBlock[];
}

export function CmsRenderer({ blocks }: CmsRendererProps) {
  if (!blocks.length) {
    return null;
  }
  return (
    <div className="space-y-8">
      {blocks
        .filter((block) => block.visible !== false)
        .map((block) => (
          <div key={block.id ?? `${block.type}-${block.sortOrder}`}>
            {renderBlock(block)}
          </div>
        ))}
    </div>
  );
}

function renderBlock(block: CmsRenderableBlock) {
  switch (block.type) {
    case "hero":
      return (
        <HeroBlock {...(block.data as CmsRenderableBlock<"hero">["data"])} />
      );
    case "rich_text":
      return (
        <RichTextBlock
          {...(block.data as CmsRenderableBlock<"rich_text">["data"])}
        />
      );
    case "feature_grid":
      return (
        <FeatureGridBlock
          {...(block.data as CmsRenderableBlock<"feature_grid">["data"])}
        />
      );
    case "legal_section":
      return (
        <LegalSectionBlock
          {...(block.data as CmsRenderableBlock<"legal_section">["data"])}
        />
      );
    case "cta_banner":
      return (
        <CtaBannerBlock
          {...(block.data as CmsRenderableBlock<"cta_banner">["data"])}
        />
      );
    case "reviews":
      return (
        <ReviewsBlock
          {...(block.data as CmsRenderableBlock<"reviews">["data"])}
        />
      );
    case "faq":
      return (
        <FaqBlock {...(block.data as CmsRenderableBlock<"faq">["data"])} />
      );
    default:
      return null;
  }
}

function HeroBlock({
  eyebrow,
  title,
  body,
  align = "left",
  ctaLabel,
  ctaHref,
  tone = "brand",
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  align?: "left" | "center";
  ctaLabel?: string;
  ctaHref?: string;
  tone?: "brand" | "muted" | "contrast";
}) {
  const toneClass =
    tone === "muted"
      ? "bg-[color:var(--ds-surface-card)] text-[color:var(--ds-text-strong)]"
      : tone === "contrast"
        ? "bg-slate-900 text-white"
        : "bg-[color:var(--ds-primary-soft)] text-[color:var(--ds-text-strong)]";
  return (
    <section
      className={cn(
        "rounded-3xl border border-[color:var(--ds-border-subtle)] px-6 py-10 shadow-[0_24px_60px_rgba(47,46,40,0.12)] sm:px-10",
        toneClass,
        align === "center" ? "text-center" : "text-left"
      )}
    >
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[color:var(--ds-text-subtle)]">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-2 text-3xl font-semibold leading-tight">{title}</h2>
      {body ? (
        <p className="mt-4 text-base text-[color:var(--ds-text-muted)]">
          {body}
        </p>
      ) : null}
      {ctaLabel && ctaHref ? (
        <a
          href={ctaHref}
          className="mt-6 inline-flex items-center rounded-full bg-[color:var(--ds-primary)] px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-[color:var(--ds-primary-strong)]"
        >
          {ctaLabel}
        </a>
      ) : null}
    </section>
  );
}

function RichTextBlock({ title, body }: { title?: string; body: string }) {
  return (
    <section className="rounded-3xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-6">
      {title ? <h3 className="text-xl font-semibold">{title}</h3> : null}
      <p className="mt-2 text-sm leading-relaxed text-[color:var(--ds-text-strong)] whitespace-pre-line">
        {body}
      </p>
    </section>
  );
}

function FeatureGridBlock({
  title,
  columns,
  items,
}: {
  title: string;
  columns?: number;
  items: Array<{ heading: string; description: string }>;
}) {
  const colClass =
    columns && columns >= 3
      ? "md:grid-cols-3"
      : columns === 2
        ? "md:grid-cols-2"
        : "md:grid-cols-4";
  return (
    <section className="rounded-3xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-6">
      <h3 className="text-xl font-semibold">{title}</h3>
      <div className={cn("mt-4 grid gap-4", colClass)}>
        {items.map((item, index) => (
          <div
            key={`${item.heading}-${index}`}
            className="rounded-2xl border border-[color:var(--ds-border-muted)] bg-[color:var(--ds-surface-muted)]/60 p-4"
          >
            <p className="text-base font-semibold">{item.heading}</p>
            <p className="mt-2 text-sm text-[color:var(--ds-text-muted)]">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function LegalSectionBlock({
  heading,
  body,
}: {
  heading: string;
  body: string;
}) {
  return (
    <section className="space-y-3 rounded-3xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-6">
      <h3 className="text-xl font-semibold">{heading}</h3>
      <p className="text-sm leading-relaxed text-[color:var(--ds-text-strong)] whitespace-pre-line">
        {body}
      </p>
    </section>
  );
}

function CtaBannerBlock({
  eyebrow,
  title,
  description,
  ctaLabel,
  ctaHref,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <section className="rounded-3xl border border-[color:var(--ds-border-strong)] bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-white shadow-xl">
      {eyebrow ? (
        <p className="text-xs uppercase tracking-[0.4em] text-white/70">
          {eyebrow}
        </p>
      ) : null}
      <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-2xl font-semibold">{title}</h3>
          {description ? (
            <p className="mt-1 text-sm text-white/80">{description}</p>
          ) : null}
        </div>
        {ctaLabel && ctaHref ? (
          <a
            href={ctaHref}
            className="inline-flex items-center rounded-full bg-white/90 px-5 py-2 text-sm font-semibold text-indigo-700 shadow-md transition hover:bg-white"
          >
            {ctaLabel}
          </a>
        ) : null}
      </div>
    </section>
  );
}

function ReviewsBlock({
  title,
  layout = "grid",
  items,
}: {
  title: string;
  layout?: "grid" | "carousel";
  items: Array<{ quote: string; author: string; role?: string | null }>;
}) {
  return (
    <section className="space-y-4 rounded-3xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-6">
      <h3 className="text-xl font-semibold">{title}</h3>
      <div
        className={cn(
          "grid gap-4",
          layout === "grid" ? "md:grid-cols-2" : "grid-cols-1"
        )}
      >
        {items.map((item, index) => (
          <div
            key={`${item.author}-${index}`}
            className="space-y-3 rounded-2xl border border-[color:var(--ds-border-muted)] bg-white/70 p-4 shadow-sm"
          >
            <p className="text-base italic text-[color:var(--ds-text-strong)]">
              “{item.quote}”
            </p>
            <div>
              <p className="text-sm font-semibold text-[color:var(--ds-text-strong)]">
                {item.author}
              </p>
              {item.role ? (
                <p className="text-xs text-[color:var(--ds-text-muted)]">
                  {item.role}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FaqBlock({
  title,
  items,
}: {
  title: string;
  items: Array<{ question: string; answer: string }>;
}) {
  return (
    <section className="space-y-4 rounded-3xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-6">
      <h3 className="text-xl font-semibold">{title}</h3>
      <div className="space-y-3">
        {items.map((item, index) => (
          <details
            key={`${item.question}-${index}`}
            className="group rounded-2xl border border-[color:var(--ds-border-muted)] bg-white/80 px-4 py-3"
          >
            <summary className="cursor-pointer list-none text-base font-semibold text-[color:var(--ds-text-strong)]">
              {item.question}
            </summary>
            <p className="mt-2 text-sm text-[color:var(--ds-text-muted)] leading-relaxed">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
