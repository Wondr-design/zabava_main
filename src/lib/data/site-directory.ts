import { unstable_cache, revalidateTag } from "next/cache";

import { getPartnerShowcaseDirectory } from "./partner-showcase";
import type { PartnerShowcaseEntry } from "./partner-showcase";
import { listGlobalValues } from "./global-values";
import type { GlobalValueRecord } from "./global-values";
import type {
  PartnerMetaContract,
  PartnerMetaInfo,
  PartnerMetaMedia,
  PartnerMetaTicketing,
  PartnerTicketDetail,
  PartnerTicketAddon,
} from "./partners";

export const SITE_DIRECTORY_TAG = "public-site-directory";

export interface CategoryCardMedia {
  type: "image" | "gif" | "video";
  url: string;
  alt?: string;
}

export interface PublicCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  accentColor?: string | null;
  media?: CategoryCardMedia | null;
  tag?: string | null;
}

export interface HomeCategoryCard {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  accentColor?: string | null;
  media?: CategoryCardMedia | null;
  tag?: string | null;
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

function normalizeSlugCandidate(value?: string | null) {
  if (!value) return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseMetadataString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function inferMediaTypeFromUrl(url: string): CategoryCardMedia["type"] {
  const normalized = url.split("?")[0]?.toLowerCase() ?? "";
  if (
    normalized.endsWith(".mp4") ||
    normalized.endsWith(".webm") ||
    normalized.endsWith(".mov") ||
    normalized.endsWith(".m4v")
  ) {
    return "video";
  }
  if (normalized.endsWith(".gif")) {
    return "gif";
  }
  return "image";
}

interface GlobalCategoryOverride {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  accentColor: string | null;
  media: CategoryCardMedia | null;
  tag: string | null;
  sortOrder: number;
}

function buildGlobalCategoryOverrides(values: GlobalValueRecord[]) {
  const overrides: GlobalCategoryOverride[] = [];
  for (const value of values) {
    const metadata = (value.metadata ?? {}) as Record<string, unknown>;
    const slugSource =
      parseMetadataString(metadata.slug) || value.key || value.label;
    const normalizedSlug = normalizeSlugCandidate(slugSource);
    if (!normalizedSlug) {
      continue;
    }

    const heroMediaUrl = parseMetadataString(metadata.heroMediaUrl);
    const heroMediaAlt =
      parseMetadataString(metadata.heroMediaAlt) || value.label;

    const media: CategoryCardMedia | null = heroMediaUrl
      ? {
          type: inferMediaTypeFromUrl(heroMediaUrl),
          url: heroMediaUrl,
          alt: heroMediaAlt,
        }
      : null;

    overrides.push({
      id: value.id,
      slug: normalizedSlug,
      label: value.label,
      description: value.description ?? null,
      accentColor: parseMetadataString(metadata.accentColor) || null,
      media,
      tag: parseMetadataString(metadata.tag) || null,
      sortOrder: value.sortOrder ?? 0,
    });
  }
  return overrides;
}

const loadDirectory = unstable_cache(
  async () => {
    const [{ categories, partners }, globalCategoryValues] = await Promise.all([
      getPartnerShowcaseDirectory(),
      listGlobalValues({ type: "category", includeInactive: false }),
    ]);

    const globalOverrides = buildGlobalCategoryOverrides(globalCategoryValues);
    const overrideMap = new Map(globalOverrides.map((entry) => [entry.slug, entry]));

    const activeCategories: PublicCategory[] = categories
      .map((category) => {
        const cardContent = category.cardContent || {};
        const heroImageUrl = cardContent.heroImageUrl;

        let media: CategoryCardMedia | null = null;
        if (heroImageUrl) {
          const urlLower = heroImageUrl.toLowerCase();
          let mediaType: "image" | "gif" | "video" = "image";

          if (urlLower.endsWith(".gif")) {
            mediaType = "gif";
          } else if (
            urlLower.endsWith(".mp4") ||
            urlLower.endsWith(".webm") ||
            urlLower.endsWith(".mov") ||
            urlLower.endsWith(".m4v")
          ) {
            mediaType = "video";
          }

          media = {
            type: mediaType,
            url: heroImageUrl,
            alt: category.name,
          };
        }

        const normalizedSlug = normalizeSlugCandidate(category.slug);
        const override = normalizedSlug
          ? overrideMap.get(normalizedSlug)
          : undefined;

        const tagFromCard =
          typeof cardContent.subtitle === "string" && cardContent.subtitle.trim()
            ? cardContent.subtitle.trim().toUpperCase()
            : null;

        const baseSortOrder =
          typeof category.sortOrder === "number" ? category.sortOrder : 0;

        return {
          id: category.id,
          slug: category.slug,
          name: override?.label ?? category.name,
          description: override?.description ?? category.description,
          sortOrder: override?.sortOrder ?? baseSortOrder,
          accentColor:
            override?.accentColor ??
            (typeof cardContent.backgroundColor === "string"
              ? cardContent.backgroundColor
              : null) ?? null,
          media: override?.media ?? media ?? null,
          tag: override?.tag ?? tagFromCard ?? null,
        } satisfies PublicCategory;
      })
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

    const categoriesById = new Map(activeCategories.map((cat) => [cat.id, cat]));
    const categoriesBySlug = new Map(
      activeCategories.map((cat) => [normalizeSlugCandidate(cat.slug), cat]),
    );

    const heroCategories = globalOverrides
      .flatMap((override) => {
        const partnerCategory = categoriesBySlug.get(override.slug);
        if (!partnerCategory) {
          return [] as Array<{ sortOrder: number; card: HomeCategoryCard }>;
        }
        const card: HomeCategoryCard = {
          id: partnerCategory.id,
          slug: partnerCategory.slug,
          name: override.label,
          description: override.description ?? partnerCategory.description,
          accentColor: override.accentColor ?? partnerCategory.accentColor ?? null,
          media: override.media ?? partnerCategory.media ?? null,
          tag: override.tag ?? partnerCategory.tag ?? null,
        };
        return [{ sortOrder: override.sortOrder, card }];
      })
      .sort(
        (a, b) => a.sortOrder - b.sortOrder || a.card.name.localeCompare(b.card.name),
      )
      .map((entry) => entry.card);

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
        } satisfies PublicPartner;
      });

    return {
      categories: activeCategories,
      partners: publicPartners,
      heroCategories,
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

export async function getPartnerById(partnerId: string) {
  const directory = await loadDirectory();
  const partner = directory.partners.find((item) => item.partnerId === partnerId);
  if (!partner) return null;
  return { partner };
}

export function revalidatePublicDirectory() {
  revalidateTag(SITE_DIRECTORY_TAG);
}
