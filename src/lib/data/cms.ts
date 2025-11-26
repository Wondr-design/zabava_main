import { z } from "zod";

import { getSupabaseAdminTyped } from "@/lib/supabase-admin";
import type { Database, Json } from "@/supabase/types";
import { defaultLocale, type Locale } from "@/i18n/config";
import {
  cmsBlockTypes,
  type CmsBlockType,
  type CmsBlockDataMap,
  validateBlockData,
} from "@/lib/cms/block-registry";
import { CMS_DEFAULTS, getDefaultCmsPage } from "@/lib/cms-defaults";

export interface CmsPageRecord {
  id: string;
  slug: string;
  displayName: string;
  description: string | null;
  status: string;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  versions: CmsPageVersionRecord[];
}

export interface CmsPageVersionRecord {
  id: string;
  pageId: string;
  locale: string;
  versionNumber: number;
  status: string;
  summary: string | null;
  createdBy: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CmsRenderableBlock<TType extends CmsBlockType = CmsBlockType> {
  id?: string;
  type: TType;
  sortOrder: number;
  visible: boolean;
  data: CmsBlockDataMap[TType];
}

export interface CmsPublishedPage {
  page: CmsPageRecord;
  version: CmsPageVersionRecord;
  blocks: CmsRenderableBlock[];
}

const blockInputSchema = z.object({
  id: z.string().optional(),
  type: z.enum(cmsBlockTypes),
  visible: z.boolean().optional(),
  data: z.record(z.string(), z.unknown()),
});

export type CmsBlockInput = z.infer<typeof blockInputSchema>;

function mapPageRow(
  row: Database["public"]["Tables"]["cms_pages"]["Row"] & {
    cms_page_versions?: Database["public"]["Tables"]["cms_page_versions"]["Row"][];
  }
): CmsPageRecord {
  const versions = row.cms_page_versions?.map(mapVersionRow) ?? [];
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    description: row.description ?? null,
    status: row.status,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    versions,
  };
}

function mapVersionRow(
  row: Database["public"]["Tables"]["cms_page_versions"]["Row"]
): CmsPageVersionRecord {
  return {
    id: row.id,
    pageId: row.page_id,
    locale: row.locale,
    versionNumber: row.version_number,
    status: row.status,
    summary: row.summary ?? null,
    createdBy: row.created_by,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBlockRow(
  row: Database["public"]["Tables"]["cms_blocks"]["Row"]
): CmsRenderableBlock {
  const type = row.block_type as CmsBlockType;
  const parsedData = validateBlockData(type, row.data ?? {});
  return {
    id: row.id,
    type,
    sortOrder: row.sort_order,
    visible: row.visible ?? true,
    data: parsedData as CmsRenderableBlock["data"],
  };
}

export async function listCmsPagesWithVersions() {
  const supabase = getSupabaseAdminTyped();
  const { data: initialData, error } = await supabase
    .from("cms_pages")
    .select("*, cms_page_versions(*)")
    .order("display_name", { ascending: true });
  let data = initialData;

  if (error) {
    throw new Error(`Failed to load CMS pages: ${error.message}`);
  }

  if ((data ?? []).length === 0) {
    await seedCmsDefaultsIfEmpty();
    const seeded = await supabase
      .from("cms_pages")
      .select("*, cms_page_versions(*)")
      .order("display_name", { ascending: true });
    if (seeded.error) {
      throw new Error(
        `Failed to load CMS pages after seeding: ${seeded.error.message}`
      );
    }
    data = seeded.data;
  }

  return (data ?? []).map(mapPageRow);
}

const SEED_ACTOR_EMAIL = "system@zabava.com";

async function seedCmsDefaultsIfEmpty() {
  const supabase = getSupabaseAdminTyped();
  const { data: existing, error } = await supabase
    .from("cms_pages")
    .select("id")
    .limit(1);
  if (error) {
    throw new Error(`Failed to inspect CMS pages: ${error.message}`);
  }
  if (existing && existing.length > 0) {
    return;
  }

  for (const [slug, localeEntries] of Object.entries(CMS_DEFAULTS)) {
    const primaryLocale = (
      localeEntries as Partial<Record<Locale, { title: string }>>
    ).en
      ? ("en" as Locale)
      : (Object.keys(localeEntries)[0] as Locale | undefined);
    const fallbackEntry =
      primaryLocale && localeEntries[primaryLocale]
        ? localeEntries[primaryLocale]
        : Object.values(localeEntries)[0];
    if (!fallbackEntry || !primaryLocale) {
      continue;
    }

    const page = await createCmsPage({
      slug,
      displayName: fallbackEntry.title,
      description: null,
      actorEmail: SEED_ACTOR_EMAIL,
      seedLocale: primaryLocale,
    });

    for (const [localeKey, entry] of Object.entries(localeEntries)) {
      const locale = localeKey as Locale;
      if (!entry?.blocks?.length) continue;
      const draftVersion = await ensureDraftVersion({
        pageId: page.id,
        locale,
        actorEmail: SEED_ACTOR_EMAIL,
        slug,
      });

      await saveCmsDraftVersion({
        versionId: draftVersion.id,
        summary: "Seeded from default content",
        blocks: entry.blocks.map((block) => ({
          type: block.type,
          visible: block.visible ?? true,
          data: block.data,
        })),
        actorEmail: SEED_ACTOR_EMAIL,
      });

      await publishCmsVersion({
        versionId: draftVersion.id,
        actorEmail: SEED_ACTOR_EMAIL,
      });
    }
  }
}

export async function createCmsPage(input: {
  slug: string;
  displayName: string;
  description?: string | null;
  actorEmail?: string | null;
  seedLocale?: Locale;
}) {
  const slug = input.slug.trim().toLowerCase();
  const supabase = getSupabaseAdminTyped();
  const { data, error } = await supabase
    .from("cms_pages")
    .insert({
      slug,
      display_name: input.displayName.trim(),
      description: input.description ?? null,
      status: "draft",
      created_by: input.actorEmail ?? null,
      updated_by: input.actorEmail ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Unable to create CMS page: ${error?.message}`);
  }

  const page = mapPageRow({ ...data, cms_page_versions: [] });
  const seedLocale = input.seedLocale ?? defaultLocale;
  await ensureDraftVersion({
    pageId: page.id,
    locale: seedLocale,
    actorEmail: input.actorEmail,
    slug,
  });

  return page;
}

export async function ensureDraftVersion(params: {
  pageId: string;
  locale: string;
  actorEmail?: string | null;
  slug?: string;
}) {
  const supabase = getSupabaseAdminTyped();
  const existingDraft = await supabase
    .from("cms_page_versions")
    .select("*")
    .eq("page_id", params.pageId)
    .eq("locale", params.locale)
    .eq("status", "draft")
    .maybeSingle();

  if (existingDraft.data) {
    return mapVersionRow(existingDraft.data);
  }

  const { data: maxData } = await supabase
    .from("cms_page_versions")
    .select("version_number")
    .eq("page_id", params.pageId)
    .eq("locale", params.locale)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersionNumber = (maxData?.version_number ?? 0) + 1;

  const { data: inserted, error } = await supabase
    .from("cms_page_versions")
    .insert({
      page_id: params.pageId,
      locale: params.locale,
      version_number: nextVersionNumber,
      status: "draft",
      created_by: params.actorEmail ?? null,
    })
    .select("*")
    .single();

  if (error || !inserted) {
    throw new Error(`Unable to create draft version: ${error?.message}`);
  }

  const version = mapVersionRow(inserted);

  // Seed default blocks if available
  if (params.slug) {
    const defaults = getDefaultCmsPage(params.slug, params.locale as Locale);
    if (defaults) {
      const blocksPayload = defaults.blocks.map((block, index) => ({
        page_version_id: version.id,
        block_type: block.type,
        sort_order: index,
        visible: block.visible ?? true,
        data: block.data as unknown as Json,
      }));
      if (blocksPayload.length) {
        await supabase.from("cms_blocks").insert(blocksPayload);
      }
    }
  }

  return version;
}

export async function getCmsVersionWithBlocks(versionId: string) {
  const supabase = getSupabaseAdminTyped();
  const { data, error } = await supabase
    .from("cms_page_versions")
    .select("*")
    .eq("id", versionId)
    .maybeSingle();
  if (error || !data) {
    throw new Error("Version not found");
  }
  const blocks = await supabase
    .from("cms_blocks")
    .select("*")
    .eq("page_version_id", versionId)
    .order("sort_order", { ascending: true });
  if (blocks.error) {
    throw new Error(`Failed to load blocks: ${blocks.error.message}`);
  }
  return {
    version: mapVersionRow(data),
    blocks: (blocks.data ?? []).map(mapBlockRow),
  };
}

export async function saveCmsDraftVersion(params: {
  versionId: string;
  summary?: string | null;
  blocks: CmsBlockInput[];
  actorEmail?: string | null;
}) {
  const supabase = getSupabaseAdminTyped();
  const validatedBlocks = params.blocks.map((block) => {
    const parsed = blockInputSchema.parse(block);
    const data = validateBlockData(parsed.type, parsed.data);
    return {
      type: parsed.type,
      visible: parsed.visible ?? true,
      data,
    };
  });

  const { data: versionRow, error: versionError } = await supabase
    .from("cms_page_versions")
    .select("*")
    .eq("id", params.versionId)
    .maybeSingle();
  if (versionError || !versionRow) {
    throw new Error("Version not found");
  }
  if (versionRow.status !== "draft") {
    throw new Error("Only draft versions can be edited.");
  }

  await supabase
    .from("cms_blocks")
    .delete()
    .eq("page_version_id", params.versionId);

  if (validatedBlocks.length) {
    const rows = validatedBlocks.map((block, index) => ({
      page_version_id: params.versionId,
      sort_order: index,
      block_type: block.type,
      visible: block.visible,
      data: block.data as unknown as Json,
    }));
    const { error: insertError } = await supabase
      .from("cms_blocks")
      .insert(rows);
    if (insertError) {
      throw new Error(`Failed to save blocks: ${insertError.message}`);
    }
  }

  const { error: updateError } = await supabase
    .from("cms_page_versions")
    .update({
      summary: params.summary ?? null,
      updated_at: new Date().toISOString(),
      created_by: params.actorEmail ?? versionRow.created_by,
    })
    .eq("id", params.versionId);

  if (updateError) {
    throw new Error(`Failed to update version: ${updateError.message}`);
  }

  return getCmsVersionWithBlocks(params.versionId);
}

export async function publishCmsVersion(params: {
  versionId: string;
  actorEmail?: string | null;
}) {
  const supabase = getSupabaseAdminTyped();
  const { data, error } = await supabase
    .from("cms_page_versions")
    .select("*")
    .eq("id", params.versionId)
    .maybeSingle();
  if (error || !data) {
    throw new Error("Version not found");
  }

  await supabase
    .from("cms_page_versions")
    .update({ status: "draft" })
    .eq("page_id", data.page_id)
    .eq("locale", data.locale)
    .neq("id", params.versionId)
    .in("status", ["published"]);

  const { error: publishError } = await supabase
    .from("cms_page_versions")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.versionId);
  if (publishError) {
    throw new Error(`Failed to publish version: ${publishError.message}`);
  }

  await supabase
    .from("cms_pages")
    .update({
      status: "ready",
      updated_by: params.actorEmail ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.page_id);

  return getCmsVersionWithBlocks(params.versionId);
}

export async function getPublishedCmsPage(
  slug: string,
  locale: Locale
): Promise<CmsPublishedPage | null> {
  const supabase = getSupabaseAdminTyped();
  const pageRes = await supabase
    .from("cms_pages")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (pageRes.error || !pageRes.data) {
    const fallback = getDefaultCmsPage(slug, locale);
    if (!fallback) return null;
    return {
      page: {
        id: "default",
        slug,
        displayName: fallback.title,
        description: null,
        status: "default",
        createdBy: null,
        updatedBy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        versions: [],
      },
      version: {
        id: "default",
        pageId: "default",
        locale,
        versionNumber: 1,
        status: "published",
        summary: null,
        createdBy: null,
        publishedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      blocks: (fallback.blocks ?? []).map((block, index) => ({
        id: `${block.type}-${index}`,
        type: block.type,
        sortOrder: index,
        visible: block.visible ?? true,
        data: block.data,
      })),
    };
  }

  const page = mapPageRow({ ...pageRes.data, cms_page_versions: [] });
  const versionRes = await supabase
    .from("cms_page_versions")
    .select("*")
    .eq("page_id", page.id)
    .eq("locale", locale)
    .eq("status", "published")
    .maybeSingle();

  const versionRow =
    versionRes.data ??
    (
      await supabase
        .from("cms_page_versions")
        .select("*")
        .eq("page_id", page.id)
        .eq("locale", defaultLocale)
        .eq("status", "published")
        .maybeSingle()
    ).data;

  if (!versionRow) {
    const fallback = getDefaultCmsPage(slug, locale);
    if (!fallback) return null;
    return {
      page,
      version: {
        id: "default",
        pageId: page.id,
        locale,
        versionNumber: 1,
        status: "published",
        summary: null,
        createdBy: null,
        publishedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      blocks: fallback.blocks.map((block, index) => ({
        id: `${block.type}-${index}`,
        type: block.type,
        sortOrder: index,
        visible: block.visible ?? true,
        data: block.data,
      })),
    };
  }

  const blocks = await supabase
    .from("cms_blocks")
    .select("*")
    .eq("page_version_id", versionRow.id)
    .order("sort_order", { ascending: true });
  if (blocks.error) {
    throw new Error(`Failed to load blocks: ${blocks.error.message}`);
  }

  return {
    page,
    version: mapVersionRow(versionRow),
    blocks: (blocks.data ?? []).map(mapBlockRow),
  };
}
