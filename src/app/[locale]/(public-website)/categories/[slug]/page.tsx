import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SiteNav } from "@/site/components/site-nav";
import { FeaturedPartners } from "@/site/partners/featured-partners";
import { getCategoryBySlug } from "@/lib/data/site-directory";
import { LocalizedLink } from "@/components/ui/localized-link";

type CategoryPageContext = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: CategoryPageContext): Promise<Metadata> {
  const { slug } = await params;
  const result = await getCategoryBySlug(slug);
  if (!result) return {};
  const { category } = result;
  return {
    title: `${category.name} · Zabava Categories`,
    description:
      category.description ??
      `Discover experiences curated in the ${category.name} collection.`,
  };
}

export default async function CategoryPage({ params }: CategoryPageContext) {
  const { slug } = await params;
  const result = await getCategoryBySlug(slug);
  if (!result) {
    notFound();
  }

  const { category, partners } = result;

  const featuredPartners = partners
    .slice()
    .sort(
      (a, b) =>
        Number(b.isFeatured) - Number(a.isFeatured) ||
        a.name.localeCompare(b.name)
    )
    .map((partner) => ({
      partnerId: partner.partnerId,
      slug: partner.slug,
      name: partner.name,
      description: partner.description,
      heroImageUrl: partner.heroImageUrl,
      isFeatured: partner.isFeatured,
      categories: partner.categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
      })),
      highlights: partner.highlights,
      ctaPrimaryLabel: partner.ctaPrimaryLabel,
      selectedFormId: partner.selectedFormId,
    }));

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 text-white">
      <SiteNav />
      <section className="bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 py-24">
        <div className="mx-auto flex w-full max-w-[120rem] flex-col gap-8 px-4 lg:px-24">
          <div className="flex flex-wrap items-center gap-3 text-sm text-indigo-200">
            <LocalizedLink
              href="/"
              className="rounded-full border border-white/15 px-4 py-1 transition hover:border-indigo-300 hover:text-white"
            >
              ← Back to home
            </LocalizedLink>
            <span className="uppercase tracking-[0.35em] text-indigo-200/80">
              Category
            </span>
          </div>
          <div className="space-y-5">
            <h1 className="text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              {category.name}
            </h1>
            {category.description ? (
              <p className="max-w-3xl text-lg text-slate-200">
                {category.description}
              </p>
            ) : (
              <p className="max-w-3xl text-lg text-slate-200">
                Discover experiences curated in the {category.name} collection.
                Reserve your visit in seconds and earn rewards on arrival.
              </p>
            )}
          </div>
        </div>
      </section>

      <FeaturedPartners partners={featuredPartners} />
    </main>
  );
}
