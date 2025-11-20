import { unstable_cache, revalidateTag } from "next/cache";

import { getPartnerShowcaseDirectory } from "./partner-showcase";
import type { PartnerShowcaseEntry } from "./partner-showcase";
import type {
  PartnerMetaContract,
  PartnerMetaInfo,
  PartnerMetaMedia,
  PartnerMetaTicketing,
  PartnerTicketDetail,
  PartnerTicketAddon,
} from "./partners";

export const SITE_DIRECTORY_TAG = "public-site-directory";

export interface PublicCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  accentColor?: string | null;
}

export interface PublicPartner {
  partnerId: string;
  slug: string;
  name: string;
  description: string | null;
  heroImageUrl: string | null;
  isFeatured: boolean;
  categories: PublicCategory[];
  highlights: Array<{ id: string; title: string; description?: string | null }>;
  gallery: PartnerShowcaseEntry["gallery"];
  ctaPrimaryLabel: string | null;
  ctaPrimaryUrl: string | null;
  detailUrl: string | null;
  metadata: Record<string, unknown>;
  selectedFormId: string | null;
  info: PartnerMetaInfo;
  contract: PartnerMetaContract;
  ticketing: PartnerMetaTicketing;
  ticketDetails: PartnerTicketDetail[];
  ticketAddons: PartnerTicketAddon[];
  media: PartnerMetaMedia;
  bonusProgramEnabled: boolean;
  listingTierKey: string | null;
}

function derivePartnerSlug(entry: PartnerShowcaseEntry) {
  const metaSlug =
    typeof entry.metadata?.slug === "string" ? entry.metadata.slug : null;
  if (metaSlug && /^[a-z0-9-]+$/i.test(metaSlug)) {
    return metaSlug.toLowerCase();
  }
  return entry.partnerId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const loadDirectory = unstable_cache(
  async () => {
    const { categories, partners } = await getPartnerShowcaseDirectory();

  const activeCategories: PublicCategory[] = categories
    .map((category) => ({
      id: category.id,
      slug: category.slug,
      name: category.name,
      description: category.description,
      sortOrder: category.sortOrder,
      accentColor:
        typeof category.cardContent?.backgroundColor === "string"
          ? category.cardContent.backgroundColor
          : null,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  const categoriesById = new Map(activeCategories.map((cat) => [cat.id, cat]));

  const publicPartners: PublicPartner[] = partners
    .filter((partner) => partner.status === "active")
    .map((partner) => {
      const partnerCategories = partner.categories
        .map((categoryId) => categoriesById.get(categoryId))
        .filter((value): value is PublicCategory => Boolean(value));
      const metadata = (partner.metadata ?? {}) as Record<string, unknown>;
      const selectedFormId =
        partner.selectedFormId ??
        (typeof metadata.selectedFormId === "string"
          ? (metadata.selectedFormId as string)
          : null);

      return {
        partnerId: partner.partnerId,
        slug: derivePartnerSlug(partner),
        name: partner.name,
        description: partner.description,
        heroImageUrl: partner.heroImageUrl,
        isFeatured: partner.isFeatured,
        categories: partnerCategories,
        highlights: partner.highlights,
        gallery: partner.gallery,
        ctaPrimaryLabel: partner.ctaPrimaryLabel,
        ctaPrimaryUrl: partner.ctaPrimaryUrl,
        detailUrl: partner.detailUrl,
      metadata,
      selectedFormId,
      info: partner.info,
      contract: partner.contract,
      ticketing: partner.ticketing,
      ticketDetails: partner.ticketDetails,
      ticketAddons: partner.ticketAddons,
      media: partner.media,
      bonusProgramEnabled: partner.bonusProgramEnabled,
      listingTierKey: partner.listingTierKey,
    };
  });

    return {
      categories: activeCategories,
      partners: publicPartners,
    };
  },
  ["site-directory"],
  {
    tags: [SITE_DIRECTORY_TAG],
  },
);

export async function getPublicDirectory() {
  return loadDirectory();
}

export async function getCategoryBySlug(slug: string) {
  const directory = await loadDirectory();
  const category = directory.categories.find((cat) => cat.slug === slug);
  if (!category) return null;
  const partners = directory.partners.filter((partner) =>
    partner.categories.some((cat) => cat.id === category.id),
  );
  return {
    category,
    partners,
  };
}

export async function getPartnerBySlug(slug: string) {
  const directory = await loadDirectory();
  const partner = directory.partners.find((item) => item.slug === slug);
  if (!partner) return null;
  return {
    partner,
  };
}

export function revalidatePublicDirectory() {
  revalidateTag(SITE_DIRECTORY_TAG);
}
