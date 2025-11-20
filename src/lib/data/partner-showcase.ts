import { z } from "zod";

import { getSupabaseAdmin } from "../supabase-admin";
import {
  normalizePartnerId,
  partnerExists,
  listPartnerMetas,
  type PartnerMetaContract,
  type PartnerMetaInfo,
  type PartnerMetaMedia,
  type PartnerMetaTicketing,
  type PartnerTicketDetail,
  type PartnerTicketAddon,
} from "./partners";
import { listGlobalValues, type GlobalValueRecord } from "./global-values";
import { listPartnerForms } from "./partner-forms";
import type { PartnerFormRecord } from "./partner-forms";

const galleryItemSchema = z
  .object({
    id: z.string(),
    imageUrl: z.string().url(),
    caption: z.string().optional(),
  })
  .strict();

const highlightItemSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    icon: z.string().optional(),
  })
  .strict();

const categoryCardContentSchema = z
  .object({
    heroImageUrl: z.string().url().optional(),
    title: z.string().optional(),
    subtitle: z.string().optional(),
    description: z.string().optional(),
    buttonLabel: z.string().optional(),
    buttonUrl: z.string().url().optional(),
    backgroundColor: z.string().optional(),
    textColor: z.string().optional(),
    textSize: z.string().optional(),
    subtitleColor: z.string().optional(),
    subtitleSize: z.string().optional(),
  })
  .default({});

const metadataSchema = z.record(z.string(), z.any()).default(() => ({}));

export const partnerCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  sortOrder: z.number().int().min(0).default(0),
  cardContent: categoryCardContentSchema,
});

export const partnerCategoryInputSchema = z.object({
  id: partnerCategorySchema.shape.id.optional(),
  name: partnerCategorySchema.shape.name,
  slug: partnerCategorySchema.shape.slug.optional(),
  description: partnerCategorySchema.shape.description,
  sortOrder: partnerCategorySchema.shape.sortOrder.optional(),
  cardContent: partnerCategorySchema.shape.cardContent.optional(),
});

export type PartnerCategoryInput = z.infer<typeof partnerCategoryInputSchema>;

export interface PartnerCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  cardContent: PartnerCategoryCardContent;
  createdAt: string;
  updatedAt: string;
}

export type PartnerCategoryCardContent = z.infer<
  typeof categoryCardContentSchema
>;

export const partnerShowcaseSchema = z
  .object({
    partnerId: z.string().min(1),
    title: z.string().optional(),
    subtitle: z.string().optional(),
    description: z.string().optional(),
    heroImageUrl: z.string().url().optional(),
    gallery: z.array(galleryItemSchema).default([]),
    highlights: z.array(highlightItemSchema).default([]),
    isFeatured: z.boolean().optional(),
    ctaPrimaryLabel: z.string().optional(),
    ctaPrimaryUrl: z.string().url().optional(),
    ctaSecondaryLabel: z.string().optional(),
    ctaSecondaryUrl: z.string().url().optional(),
    ageMin: z.number().int().min(0).max(120).nullable().optional(),
    ageMax: z.number().int().min(0).max(120).nullable().optional(),
    formUrl: z.string().url().optional(),
    detailUrl: z.string().url().optional(),
    metadata: metadataSchema.optional(),
  })
  .refine(
    (value) => {
      if (
        value.ageMin !== undefined &&
        value.ageMax !== undefined &&
        value.ageMin !== null &&
        value.ageMax !== null
      ) {
        return value.ageMin <= value.ageMax;
      }
      return true;
    },
    {
      message: "ageMin must be less than or equal to ageMax",
      path: ["ageMin"],
    }
  );

export type PartnerShowcaseUpdateInput = z.infer<typeof partnerShowcaseSchema>;

export interface PartnerShowcaseRecord {
  partnerId: string;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  heroImageUrl: string | null;
  gallery: Array<z.infer<typeof galleryItemSchema>>;
  highlights: Array<z.infer<typeof highlightItemSchema>>;
  isFeatured: boolean;
  ctaPrimaryLabel: string | null;
  ctaPrimaryUrl: string | null;
  ctaSecondaryLabel: string | null;
  ctaSecondaryUrl: string | null;
  ageMin: number | null;
  ageMax: number | null;
  formUrl: string | null;
  detailUrl: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type PartnerShowcaseGalleryItem = z.infer<typeof galleryItemSchema>;
export type PartnerShowcaseHighlightItem = z.infer<typeof highlightItemSchema>;

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number | null;
  card_content: unknown;
  created_at: string | null;
  updated_at: string | null;
}

interface ShowcaseRow {
  partner_id: string;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  hero_image_url: string | null;
  gallery: unknown;
  highlights: unknown;
  is_featured: boolean | null;
  cta_primary_label: string | null;
  cta_primary_url: string | null;
  cta_secondary_label: string | null;
  cta_secondary_url: string | null;
  age_min: number | null;
  age_max: number | null;
  form_url: string | null;
  detail_url: string | null;
  metadata: unknown;
  created_at: string | null;
  updated_at: string | null;
}

function normalizeCategoryId(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80);
}

function mapCategoryRow(row: CategoryRow): PartnerCategory {
  const cardContentResult = categoryCardContentSchema.safeParse(
    row.card_content ?? {}
  );
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    sortOrder: row.sort_order ?? 0,
    cardContent: cardContentResult.success ? cardContentResult.data : {},
    createdAt: row.created_at ?? new Date(0).toISOString(),
    updatedAt: row.updated_at ?? new Date(0).toISOString(),
  };
}

function mapShowcaseRow(row: ShowcaseRow): PartnerShowcaseRecord {
  const galleryResult = galleryItemSchema
    .array()
    .safeParse((row.gallery as unknown[]) ?? []);
  const highlightsResult = highlightItemSchema
    .array()
    .safeParse((row.highlights as unknown[]) ?? []);
  const metadataResult = metadataSchema.safeParse(row.metadata ?? {});
  return {
    partnerId: row.partner_id,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    heroImageUrl: row.hero_image_url,
    gallery: galleryResult.success ? galleryResult.data : [],
    highlights: highlightsResult.success ? highlightsResult.data : [],
    isFeatured: Boolean(row.is_featured),
    ctaPrimaryLabel: row.cta_primary_label,
    ctaPrimaryUrl: row.cta_primary_url,
    ctaSecondaryLabel: row.cta_secondary_label,
    ctaSecondaryUrl: row.cta_secondary_url,
    ageMin: row.age_min,
    ageMax: row.age_max,
    formUrl: row.form_url,
    detailUrl: row.detail_url,
    metadata: metadataResult.success ? metadataResult.data : {},
    createdAt: row.created_at ?? new Date(0).toISOString(),
    updatedAt: row.updated_at ?? new Date(0).toISOString(),
  };
}

export async function listPartnerCategories(): Promise<PartnerCategory[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("partner_categories")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to list categories: ${error.message}`);
  }

  return ((data ?? []) as CategoryRow[]).map(mapCategoryRow);
}

export async function getPartnerCategory(
  idOrSlug: string
): Promise<PartnerCategory | null> {
  const supabase = getSupabaseAdmin();
  const bySlug = idOrSlug.includes("-");
  const query = supabase.from("partner_categories").select("*").limit(1);
  if (bySlug) {
    query.eq("slug", idOrSlug);
  } else {
    query.eq("id", idOrSlug);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(`Failed to load category: ${error.message}`);
  }

  if (!data) return null;
  return mapCategoryRow(data as CategoryRow);
}

export async function savePartnerCategory(
  input: PartnerCategoryInput
): Promise<PartnerCategory> {
  const parsed = partnerCategoryInputSchema.parse(input);
  const supabase = getSupabaseAdmin();

  const id = normalizeCategoryId(parsed.id ?? parsed.name);
  if (!id) {
    throw new Error("Category id cannot be empty");
  }

  const payload = {
    id,
    name: parsed.name.trim(),
    slug: slugify(parsed.slug ?? parsed.name),
    description: parsed.description ?? null,
    sort_order: parsed.sortOrder ?? 0,
    card_content: (parsed.cardContent ?? {}) as unknown,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("partner_categories")
    .upsert(
      payload as unknown as never,
      {
        onConflict: "id",
        ignoreDuplicates: false,
      } as never
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save category: ${error.message}`);
  }

  return mapCategoryRow(data as CategoryRow);
}

export async function deletePartnerCategory(id: string) {
  const supabase = getSupabaseAdmin();
  const normalized = normalizeCategoryId(id);
  if (!normalized) {
    throw new Error("Category id is required");
  }
  const { error } = await supabase
    .from("partner_categories")
    .delete()
    .eq("id", normalized);
  if (error) {
    throw new Error(`Failed to delete category: ${error.message}`);
  }
}

export interface PartnerCategoryAssignment {
  partnerId: string;
  categoryId: string;
  assignedAt: string;
}

export async function listPartnerCategoryAssignments(
  partnerId?: string
): Promise<PartnerCategoryAssignment[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase.from("partner_category_assignments").select("*");
  if (partnerId) {
    query = query.eq("partner_id", normalizePartnerId(partnerId));
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load category assignments: ${error.message}`);
  }
  return (
    (data ?? []) as Array<{
      partner_id: string;
      category_id: string;
      assigned_at: string | null;
    }>
  ).map((row) => ({
    partnerId: row.partner_id,
    categoryId: row.category_id,
    assignedAt: row.assigned_at ?? new Date(0).toISOString(),
  }));
}

export async function setPartnerCategories(
  partnerId: string,
  categoryIds: string[]
) {
  const normalizedPartner = normalizePartnerId(partnerId);
  if (!normalizedPartner) {
    throw new Error("partnerId is required");
  }
  if (!(await partnerExists(normalizedPartner))) {
    throw new Error(`Partner not found: ${normalizedPartner}`);
  }

  const uniqueCategoryIds = Array.from(
    new Set(categoryIds.map(normalizeCategoryId).filter(Boolean))
  );

  const supabase = getSupabaseAdmin();

  const { error: deleteError } = await supabase
    .from("partner_category_assignments")
    .delete()
    .eq("partner_id", normalizedPartner);
  if (deleteError) {
    throw new Error(
      `Failed to clear previous categories: ${deleteError.message}`
    );
  }

  if (uniqueCategoryIds.length === 0) return;

  const rows = uniqueCategoryIds.map((categoryId) => ({
    partner_id: normalizedPartner,
    category_id: categoryId,
  }));

  const { error: insertError } = await supabase
    .from("partner_category_assignments")
    .upsert(rows as never);
  if (insertError) {
    throw new Error(
      `Failed to assign partner categories: ${insertError.message}`
    );
  }
}

export async function getPartnerShowcase(
  partnerId: string
): Promise<PartnerShowcaseRecord> {
  const normalized = normalizePartnerId(partnerId);
  if (!normalized) {
    throw new Error("partnerId is required");
  }
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("partner_showcase")
    .select("*")
    .eq("partner_id", normalized)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load partner showcase: ${error.message}`);
  }
  if (!data) {
    return {
      partnerId: normalized,
      title: null,
      subtitle: null,
      description: null,
      heroImageUrl: null,
      gallery: [],
      highlights: [],
      isFeatured: false,
      ctaPrimaryLabel: null,
      ctaPrimaryUrl: null,
      ctaSecondaryLabel: null,
      ctaSecondaryUrl: null,
      ageMin: null,
      ageMax: null,
      formUrl: null,
      detailUrl: null,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  return mapShowcaseRow(data as ShowcaseRow);
}

export async function savePartnerShowcase(
  input: PartnerShowcaseUpdateInput
): Promise<PartnerShowcaseRecord> {
  const parsed = partnerShowcaseSchema.parse(input);
  const normalizedPartner = normalizePartnerId(parsed.partnerId);
  if (!normalizedPartner) {
    throw new Error("partnerId is required");
  }
  if (!(await partnerExists(normalizedPartner))) {
    throw new Error(`Partner not found: ${normalizedPartner}`);
  }

  const payload = {
    partner_id: normalizedPartner,
    title: parsed.title ?? null,
    subtitle: parsed.subtitle ?? null,
    description: parsed.description ?? null,
    hero_image_url: parsed.heroImageUrl ?? null,
    gallery: parsed.gallery ?? [],
    highlights: parsed.highlights ?? [],
    is_featured: parsed.isFeatured ?? false,
    cta_primary_label: parsed.ctaPrimaryLabel ?? null,
    cta_primary_url: parsed.ctaPrimaryUrl ?? null,
    cta_secondary_label: parsed.ctaSecondaryLabel ?? null,
    cta_secondary_url: parsed.ctaSecondaryUrl ?? null,
    age_min: parsed.ageMin ?? null,
    age_max: parsed.ageMax ?? null,
    form_url: parsed.formUrl ?? null,
    detail_url: parsed.detailUrl ?? null,
    metadata: parsed.metadata ?? {},
    updated_at: new Date().toISOString(),
  };

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("partner_showcase")
    .upsert(
      payload as unknown as never,
      {
        onConflict: "partner_id",
        ignoreDuplicates: false,
      } as never
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save partner showcase: ${error.message}`);
  }

  return mapShowcaseRow(data as ShowcaseRow);
}

export async function listPartnerShowcases() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("partner_showcase").select("*");
  if (error) {
    throw new Error(`Failed to list partner showcases: ${error.message}`);
  }
  return ((data ?? []) as ShowcaseRow[]).map(mapShowcaseRow);
}

export interface PartnerShowcaseEntry {
  partnerId: string;
  name: string;
  status: "active" | "pending" | "hidden";
  categories: string[];
  title: string | null;
  subtitle: string | null;
  description: string | null;
  heroImageUrl: string | null;
  gallery: PartnerShowcaseGalleryItem[];
  highlights: PartnerShowcaseHighlightItem[];
  isFeatured: boolean;
  ctaPrimaryLabel: string | null;
  ctaPrimaryUrl: string | null;
  ctaSecondaryLabel: string | null;
  ctaSecondaryUrl: string | null;
  ageMin: number | null;
  ageMax: number | null;
  formUrl: string | null;
  detailUrl: string | null;
  selectedFormId: string | null;
  metadata: Record<string, unknown>;
  info: PartnerMetaInfo;
  contract: PartnerMetaContract;
  ticketing: PartnerMetaTicketing;
  ticketDetails: PartnerTicketDetail[];
  ticketAddons: PartnerTicketAddon[];
  media: PartnerMetaMedia;
  bonusProgramEnabled: boolean;
  listingTierKey: string | null;
}

export interface PartnerShowcaseDirectory {
  categories: PartnerCategory[];
  partners: PartnerShowcaseEntry[];
  forms?: Array<{
    id: string;
    name: string;
    partnerId: string | null;
    status: string;
    slug: string;
    updatedAt: string;
  }>;
}

function normalizeTicketKey(value?: string | null) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim().toLowerCase()
    : "";
}

function resolveTicketDetails(
  ticketing: PartnerMetaTicketing,
  ticketTypeGlobals: GlobalValueRecord[]
): PartnerTicketDetail[] {
  if (!ticketing) return [];
  const globalMap = new Map(
    ticketTypeGlobals.map((value) => [normalizeTicketKey(value.key), value])
  );
  const seen = new Set<string>();

  const resolved: PartnerTicketDetail[] = (ticketing.ticketDetails ?? []).map(
    (detail) => {
      const normalizedKey = normalizeTicketKey(
        detail.ticketType ?? detail.label ?? undefined
      );
      if (normalizedKey) {
        seen.add(normalizedKey);
      }
      const global = detail.ticketType
        ? globalMap.get(normalizeTicketKey(detail.ticketType))
        : null;
      const price =
        typeof detail.price === "number" ? detail.price : null;
      const discountedPrice =
        typeof detail.discountedPrice === "number"
          ? detail.discountedPrice
          : price;
      return {
        id: detail.id,
        ticketType: detail.ticketType ?? global?.key ?? null,
        label: detail.label ?? global?.label ?? detail.ticketType ?? null,
        price,
        discountedPrice,
        description:
          detail.description?.trim() ||
          global?.description?.trim() ||
          "",
        inclusions: detail.inclusions,
        maxGuests: detail.maxGuests ?? null,
      };
    }
  );

  for (const ticketType of ticketing.ticketTypes ?? []) {
    const normalizedKey = normalizeTicketKey(ticketType);
    if (!normalizedKey || seen.has(normalizedKey)) continue;
    seen.add(normalizedKey);
    const global = globalMap.get(normalizedKey);
    resolved.push({
      id: `${normalizedKey}-fallback`,
      ticketType,
      label: global?.label ?? ticketType,
      price: null,
      discountedPrice: null,
      description: global?.description ?? "",
      inclusions: undefined,
      maxGuests: null,
    });
  }

  return resolved;
}

function resolveTicketAddons(
  ticketing: PartnerMetaTicketing
): PartnerTicketAddon[] {
  if (!ticketing) return [];
  return (ticketing.addons ?? []).map((addon) => {
    const price = typeof addon.price === "number" ? addon.price : null;
    const discountedPrice =
      typeof addon.discountedPrice === "number"
        ? addon.discountedPrice
        : price;
    return {
      ...addon,
      price,
      discountedPrice,
    };
  });
}

export async function getPartnerShowcaseDirectory(): Promise<PartnerShowcaseDirectory> {
  const [
    categories,
    assignments,
    showcases,
    metas,
    forms,
    ticketTypeGlobals,
  ] = await Promise.all([
    listPartnerCategories(),
    listPartnerCategoryAssignments(),
    listPartnerShowcases(),
    listPartnerMetas(),
    listPartnerForms({ status: "published" }),
    listGlobalValues({ type: "ticket_type", includeInactive: true }),
  ]);

  const assignmentsByPartner = new Map<string, string[]>();
  for (const assignment of assignments) {
    const list = assignmentsByPartner.get(assignment.partnerId) ?? [];
    list.push(assignment.categoryId);
    assignmentsByPartner.set(assignment.partnerId, list);
  }

  const showcaseByPartner = new Map<string, PartnerShowcaseRecord>();
  for (const showcase of showcases) {
    showcaseByPartner.set(showcase.partnerId, showcase);
  }

  const publishedFormIds = new Set(forms.map((form) => form.id));
  const latestPublishedFormByPartner = new Map<string, PartnerFormRecord>();
  for (const form of forms) {
    if (!form.partnerId || form.status !== "published") continue;
    const normalized = form.partnerId.toLowerCase();
    if (!latestPublishedFormByPartner.has(normalized)) {
      latestPublishedFormByPartner.set(normalized, form);
    }
  }

  const partners: PartnerShowcaseEntry[] = metas.map((meta) => {
    const showcase = showcaseByPartner.get(meta.partnerId);
    const metadata = (showcase?.metadata ?? {}) as Record<string, unknown>;
    const explicitSelectedFormId =
      typeof metadata.selectedFormId === "string" &&
      metadata.selectedFormId.trim().length > 0
        ? metadata.selectedFormId.trim()
        : null;
    const normalizedPartnerId = meta.partnerId.toLowerCase();
    const fallbackForm = latestPublishedFormByPartner.get(normalizedPartnerId);
    const validExplicitSelectedFormId =
      explicitSelectedFormId && publishedFormIds.has(explicitSelectedFormId)
        ? explicitSelectedFormId
        : null;
    const resolvedSelectedFormId =
      validExplicitSelectedFormId ?? fallbackForm?.id ?? null;
    const metadataWithForm =
      resolvedSelectedFormId !== null
        ? { ...metadata, selectedFormId: resolvedSelectedFormId }
        : metadata;

    const ticketDetails = resolveTicketDetails(
      meta.ticketing,
      ticketTypeGlobals
    );
    const ticketAddons = resolveTicketAddons(meta.ticketing);

    return {
      partnerId: meta.partnerId,
      name: meta.displayName ?? meta.partnerId,
      status: meta.status,
      categories: assignmentsByPartner.get(meta.partnerId) ?? [],
      title: showcase?.title ?? null,
      subtitle: showcase?.subtitle ?? null,
      description: showcase?.description ?? null,
      heroImageUrl: showcase?.heroImageUrl ?? meta.media.heroImageUrl ?? null,
      gallery: showcase?.gallery ?? [],
      highlights: showcase?.highlights ?? [],
      isFeatured: Boolean(showcase?.isFeatured),
      ctaPrimaryLabel: showcase?.ctaPrimaryLabel ?? null,
      ctaPrimaryUrl: showcase?.ctaPrimaryUrl ?? null,
      ctaSecondaryLabel: showcase?.ctaSecondaryLabel ?? null,
      ctaSecondaryUrl: showcase?.ctaSecondaryUrl ?? null,
      ageMin: showcase?.ageMin ?? null,
      ageMax: showcase?.ageMax ?? null,
      formUrl: showcase?.formUrl ?? null,
      detailUrl: showcase?.detailUrl ?? null,
      selectedFormId: resolvedSelectedFormId,
      metadata: metadataWithForm,
      info: meta.info,
      contract: meta.contract,
      ticketing: meta.ticketing,
      ticketDetails,
      ticketAddons,
      media: meta.media,
      bonusProgramEnabled: meta.bonusProgramEnabled,
      listingTierKey: meta.listingTierKey ?? null,
    };
  });

  partners.sort((a, b) => a.name.localeCompare(b.name));

  return {
    categories,
    partners,
    forms: forms.map((form) => ({
      id: form.id,
      name: form.name,
      partnerId: form.partnerId ?? null,
      status: form.status,
      slug: form.slug,
      updatedAt: form.updatedAt,
    })),
  };
}
