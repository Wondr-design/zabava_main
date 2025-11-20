import { Suspense } from "react";

import { HomeHero } from "@/site/sections/home-hero";
import { FeaturedPartners } from "@/site/partners/featured-partners";
import { SiteNav } from "@/site/components/site-nav";
import { getPublicDirectory } from "@/lib/data/site-directory";

export default async function HomePage() {
  const { categories, partners } = await getPublicDirectory();

  const heroCategories = categories.slice(0, 6).map((category) => ({
    id: category.id,
    slug: category.slug,
    name: category.name,
    description: category.description,
    accentColor: category.accentColor,
  }));

  const featuredPool = partners.filter((partner) => partner.isFeatured);
  const prioritizedPartners =
    featuredPool.length > 0 ? featuredPool : partners;

  const featuredPartners = prioritizedPartners.map((partner) => ({
    partnerId: partner.partnerId,
    slug: partner.slug,
    name: partner.name,
    description: partner.description,
    heroImageUrl: partner.heroImageUrl,
    isFeatured: partner.isFeatured,
    categories: partner.categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
    })),
    highlights: partner.highlights,
    ctaPrimaryLabel: partner.ctaPrimaryLabel,
    selectedFormId: partner.selectedFormId,
  }));

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 text-white">
      <SiteNav />
      <HomeHero categories={heroCategories} />
      <Suspense fallback={null}>
        <FeaturedPartners partners={featuredPartners} />
      </Suspense>
    </main>
  );
}
