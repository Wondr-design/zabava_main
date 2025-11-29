import { getPublicDirectory } from "@/lib/data/site-directory";
import { SiteNav } from "@/site/components/site-nav";
import {
  PartnerDirectory,
  PartnerDirectoryCategory,
  PartnerDirectoryPartner,
} from "@/site/partners/partner-directory";

export default async function PartnersDirectoryPage() {
  const { categories, partners } = await getPublicDirectory();

  const directoryCategories: PartnerDirectoryCategory[] = categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
  }));

  const directoryPartners: PartnerDirectoryPartner[] = partners.map((partner) => ({
    partnerId: partner.partnerId,
    slug: partner.slug,
    name: partner.name,
    description: partner.description,
    heroImageUrl: partner.heroImageUrl,
    categories: partner.categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
    })),
    highlights: partner.highlights,
    selectedFormId: partner.selectedFormId,
    ctaPrimaryLabel: partner.ctaPrimaryLabel,
  }));

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 text-white">
      <SiteNav />
      <PartnerDirectory
        categories={directoryCategories}
        partners={directoryPartners}
      />
    </main>
  );
}
