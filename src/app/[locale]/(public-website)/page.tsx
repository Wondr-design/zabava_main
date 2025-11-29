import { Suspense } from "react";

import { HomeHero } from "@/site/sections/home-hero";
import { PartnerLogoMarquee } from "@/site/partners/partner-logo-marquee";
import { SiteNav } from "@/site/components/site-nav";
import { getPublicDirectory } from "@/lib/data/site-directory";
import {
  HomeReviews,
  defaultHomeReviewsContent,
} from "@/site/sections/home-reviews";
import { HomeFaq, defaultHomeFaqContent } from "@/site/sections/home-faq";
import { getPublishedCmsPage } from "@/lib/data/cms";
import { getDefaultCmsPage } from "@/lib/cms-defaults";
import type { CmsRenderableBlock } from "@/lib/data/cms";
import type { CmsBlockDataMap } from "@/lib/cms/block-registry";
import { resolveLocale, type Locale } from "@/i18n/config";

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  const [{ categories, partners }, homeCms] = await Promise.all([
    getPublicDirectory(),
    getHomeCms(locale),
  ]);

  const heroCategories = categories.slice(0, 6).map((category) => ({
    id: category.id,
    slug: category.slug,
    name: category.name,
    description: category.description,
    accentColor: category.accentColor,
  }));

  const featuredPool = partners.filter((partner) => partner.isFeatured);
  const prioritizedPartners = featuredPool.length > 0 ? featuredPool : partners;

  const partnerLogos = prioritizedPartners.map((partner) => ({
    partnerId: partner.partnerId,
    slug: partner.slug,
    name: partner.name,
    logoUrl: partner.media.logoUrl,
    heroImageUrl: partner.heroImageUrl,
  }));

  return (
    <main className="flex min-h-screen flex-col text-white relative z-10">
      <SiteNav />
      <HomeHero categories={heroCategories} />
      <PartnerLogoMarquee partners={partnerLogos} />
      <HomeReviews {...homeCms.reviews} />
      <HomeFaq {...homeCms.faq} />
    </main>
  );
}

async function getHomeCms(locale: Locale) {
  const published = await getPublishedCmsPage("home", locale);
  const fallback = getDefaultCmsPage("home", locale);

  const fallbackBlocks: CmsRenderableBlock[] = (fallback?.blocks ?? []).map(
    (block, index) => ({
      id: `${block.type}-${index}`,
      type: block.type,
      sortOrder: index,
      visible: block.visible ?? true,
      data: block.data,
    })
  );

  const blocks = (published?.blocks ?? fallbackBlocks).filter(
    (block) => block.visible !== false
  );

  const reviews =
    (blocks.find((block) => block.type === "reviews")?.data as
      | CmsBlockDataMap["reviews"]
      | undefined) ?? defaultHomeReviewsContent;
  const faq =
    (blocks.find((block) => block.type === "faq")?.data as
      | CmsBlockDataMap["faq"]
      | undefined) ?? defaultHomeFaqContent;

  return {
    reviews: {
      title: reviews.title || defaultHomeReviewsContent.title,
      eyebrow: defaultHomeReviewsContent.eyebrow,
      description: defaultHomeReviewsContent.description,
      layout: reviews.layout ?? defaultHomeReviewsContent.layout,
      items: reviews.items ?? defaultHomeReviewsContent.items,
    },
    faq: {
      title: faq.title || defaultHomeFaqContent.title,
      eyebrow: defaultHomeFaqContent.eyebrow,
      description: defaultHomeFaqContent.description,
      items: faq.items ?? defaultHomeFaqContent.items,
    },
  };
}
