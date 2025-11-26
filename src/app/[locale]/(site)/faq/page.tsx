import type { Metadata } from "next";

import { CmsRenderer } from "@/components/cms/cms-renderer";
import { resolveLocale } from "@/i18n/config";
import { getDefaultCmsPage } from "@/lib/cms-defaults";
import { getPublishedCmsPage } from "@/lib/data/cms";

export const metadata: Metadata = {
  title: "FAQ | Zabava",
  description:
    "Answers for guests, partners, and staff on how Zabava handles ticket requirements, QR passes, and rewards.",
};

interface FaqPageProps {
  params: Promise<{ locale: string }>;
}

export default async function FaqPage({ params }: FaqPageProps) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  const published = await getPublishedCmsPage("faq", locale);
  const fallback = getDefaultCmsPage("faq", locale);

  const blocks =
    published?.blocks ??
    (fallback?.blocks ?? []).map((block, index) => ({
      id: `${block.type}-${index}`,
      type: block.type,
      sortOrder: index,
      visible: block.visible ?? true,
      data: block.data,
    }));

  const title =
    published?.page.displayName ?? fallback?.title ?? "Frequently Asked Questions";

  return (
    <main className="min-h-screen bg-[color:var(--ds-surface-base)] px-4 py-12 text-[color:var(--ds-text-strong)] sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[color:var(--ds-text-subtle)]">
            Zabava
          </p>
          <h1 className="text-4xl font-semibold tracking-tight">{title}</h1>
        </header>
        <CmsRenderer blocks={blocks} />
      </div>
    </main>
  );
}
