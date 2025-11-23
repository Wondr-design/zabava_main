"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle,
  GripVertical,
  Loader2,
  MoveDown,
  MoveUp,
  Plus,
  PlusCircle,
  Save,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { adminApi } from "@/lib/web/api-client";
import type {
  CmsPageRecord,
  CmsPageVersionRecord,
  CmsRenderableBlock,
} from "@/lib/data/cms";
import {
  cmsBlockRegistry,
  cmsBlockTypes,
  getBlockDefaults,
  type CmsBlockType,
} from "@/lib/cms/block-registry";
import { CmsRenderer } from "@/components/cms/cms-renderer";
import { locales, resolveLocale, type Locale } from "@/i18n/config";

type EditableBlock = {
  id?: string;
  type: CmsBlockType;
  sortOrder: number;
  visible: boolean;
  data: Record<string, unknown>;
};

interface CmsDashboardProps {
  initialPages: CmsPageRecord[];
  locale: string;
}

export function CmsDashboard({ initialPages, locale }: CmsDashboardProps) {
  const resolvedLocale = resolveLocale(locale);
  const [pages, setPages] = useState(initialPages);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(
    initialPages[0]?.id ?? null
  );
  const [selectedLocale, setSelectedLocale] = useState<Locale>(resolvedLocale);
  const [blocks, setBlocks] = useState<EditableBlock[]>([]);
  const [baselineBlocks, setBaselineBlocks] = useState<EditableBlock[]>([]);
  const [summary, setSummary] = useState("");
  const [baselineSummary, setBaselineSummary] = useState("");
  const [activeVersion, setActiveVersion] =
    useState<CmsPageVersionRecord | null>(null);
  const [loadingVersion, setLoadingVersion] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [creatingPage, setCreatingPage] = useState(false);
  const [newPageName, setNewPageName] = useState("");
  const [newPageSlug, setNewPageSlug] = useState("");

  const selectedPage = useMemo(
    () => pages.find((page) => page.id === selectedPageId) ?? null,
    [pages, selectedPageId]
  );

  const previewBlocks = useMemo<CmsRenderableBlock[]>(() => {
    return blocks.map((block, index) => ({
      id: block.id ?? `temp-${index}`,
      type: block.type,
      sortOrder: index,
      visible: block.visible,
      data: block.data as CmsRenderableBlock["data"],
    }));
  }, [blocks]);

  const dirty =
    JSON.stringify(blocks) !== JSON.stringify(baselineBlocks) ||
    summary !== baselineSummary;

  useEffect(() => {
    if (selectedPage) {
      void loadVersion(selectedPage, selectedLocale);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPageId, selectedLocale]);

  async function loadVersion(page: CmsPageRecord, localeToLoad: Locale) {
    setLoadingVersion(true);
    try {
      const versionsForLocale = page.versions.filter(
        (version) => version.locale === localeToLoad
      );
      const draftVersion = versionsForLocale.find(
        (version) => version.status === "draft"
      );
      const publishedVersion = versionsForLocale.find(
        (version) => version.status === "published"
      );
      const targetVersionId = draftVersion?.id ?? publishedVersion?.id ?? null;

      let payload: {
        version: CmsPageVersionRecord;
        blocks: CmsRenderableBlock[];
      } | null = null;

      if (targetVersionId) {
        payload = await adminApi.cmsVersionGet(targetVersionId);
      } else {
        payload = await adminApi.cmsVersionSave({
          pageId: page.id,
          slug: page.slug,
          locale: localeToLoad,
          blocks: [],
        });
        insertVersionIntoState(payload.version);
      }

      setActiveVersion(payload.version);
      setSummary(payload.version.summary ?? "");
      setBaselineSummary(payload.version.summary ?? "");
      const editableBlocks = payload.blocks.map<EditableBlock>((block) => ({
        id: block.id,
        type: block.type,
        sortOrder: block.sortOrder,
        visible: block.visible,
        data: block.data as Record<string, unknown>,
      }));
      setBlocks(editableBlocks);
      setBaselineBlocks(editableBlocks);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load version.";
      toast.error(message);
    } finally {
      setLoadingVersion(false);
    }
  }

  function insertVersionIntoState(updatedVersion: CmsPageVersionRecord) {
    setPages((prev) =>
      prev.map((page) => {
        if (page.id !== updatedVersion.pageId) return page;
        const otherVersions = page.versions.filter(
          (version) => version.id !== updatedVersion.id
        );
        const nextVersions = [...otherVersions, updatedVersion].sort(
          (a, b) => a.versionNumber - b.versionNumber
        );
        return { ...page, versions: nextVersions };
      })
    );
  }

  async function handleCreatePage() {
    if (!newPageName.trim() || !newPageSlug.trim()) {
      toast.error("Provide both a name and slug.");
      return;
    }
    setCreatingPage(true);
    try {
      const payload = await adminApi.cmsPageCreate({
        slug: newPageSlug.trim(),
        displayName: newPageName.trim(),
        seedLocale: selectedLocale,
      });
      setPages((prev) => [...prev, payload.page]);
      setSelectedPageId(payload.page.id);
      setNewPageName("");
      setNewPageSlug("");
      toast.success("Page created");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to create page.";
      toast.error(message);
    } finally {
      setCreatingPage(false);
    }
  }

  function normalizeOrder(list: EditableBlock[]) {
    return list.map((block, index) => ({ ...block, sortOrder: index }));
  }

  function addBlock(type: CmsBlockType) {
    const defaults = getBlockDefaults(type) as Record<string, unknown>;
    setBlocks((prev) =>
      normalizeOrder([
        ...prev,
        {
          type,
          data: defaults,
          sortOrder: prev.length,
          visible: true,
        },
      ])
    );
  }

  function removeBlock(index: number) {
    setBlocks((prev) =>
      normalizeOrder(prev.filter((_, blockIndex) => blockIndex !== index))
    );
  }

  function moveBlock(index: number, direction: "up" | "down") {
    setBlocks((prev) => {
      const next = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return normalizeOrder(next);
    });
  }

  function updateBlockData(index: number, updates: Record<string, unknown>) {
    setBlocks((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        data: { ...next[index].data, ...updates },
      };
      return next;
    });
  }

  async function handleSaveDraft() {
    if (!selectedPage || !activeVersion) return;
    setSaving(true);
    try {
      const payload = await adminApi.cmsVersionSave({
        pageId: selectedPage.id,
        slug: selectedPage.slug,
        locale: selectedLocale,
        versionId: activeVersion.id,
        summary,
        blocks: blocks.map((block) => ({
          id: block.id,
          type: block.type,
          visible: block.visible,
          data: block.data,
        })),
      });
      const editableBlocks = payload.blocks.map((block, index) => ({
        id: block.id,
        type: block.type,
        data: block.data as Record<string, unknown>,
        visible: block.visible,
        sortOrder: index,
      }));
      setBlocks(editableBlocks);
      setBaselineBlocks(editableBlocks);
      setBaselineSummary(payload.version.summary ?? "");
      setActiveVersion(payload.version);
      insertVersionIntoState(payload.version);
      toast.success("Draft saved");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save draft.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!activeVersion || !selectedPage) {
      toast.error("Create a draft first.");
      return;
    }
    setPublishing(true);
    try {
      const payload = await adminApi.cmsVersionPublish({
        versionId: activeVersion.id,
      });
      setActiveVersion(payload.version);
      insertVersionIntoState(payload.version);
      setBaselineSummary(payload.version.summary ?? "");
      toast.success("Version published");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to publish version.";
      toast.error(message);
    } finally {
      setPublishing(false);
    }
  }

  if (!selectedPage) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No CMS pages yet. Create one to get started.
        </p>
        <Button className="mt-4" onClick={() => setCreatingPage(true)}>
          Create page
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            Content management
          </p>
          <h1 className="text-3xl font-semibold">Headless CMS</h1>
          <p className="text-sm text-muted-foreground">
            Manage enterprise-ready pages with per-locale drafts, versioning,
            and granular blocks.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleSaveDraft}
            disabled={!dirty || saving || loadingVersion}
            className="inline-flex items-center gap-2"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save draft
          </Button>
          <Button
            type="button"
            onClick={handlePublish}
            disabled={
              publishing ||
              !activeVersion ||
              loadingVersion ||
              blocks.length === 0
            }
            className="inline-flex items-center gap-2"
          >
            {publishing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            Publish
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px,1fr]">
        <aside className="space-y-6 rounded-3xl border border-border bg-card p-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                  Pages
                </p>
                <p className="text-xs text-muted-foreground">
                  {pages.length} total
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setCreatingPage((prev) => !prev)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {pages.map((page) => {
                const active = page.id === selectedPageId;
                const publishedLocales = page.versions.filter(
                  (version) => version.status === "published"
                );
                return (
                  <button
                    key={page.id}
                    type="button"
                    onClick={() => setSelectedPageId(page.id)}
                    className={cn(
                      "flex w-full flex-col rounded-2xl border px-4 py-3 text-left transition",
                      active
                        ? "border-primary bg-primary/10"
                        : "border-border/70 hover:border-border"
                    )}
                  >
                    <span className="text-sm font-semibold text-foreground">
                      {page.displayName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      /{page.slug} · {publishedLocales.length} locale
                      {publishedLocales.length === 1 ? "" : "s"} live
                    </span>
                  </button>
                );
              })}
            </div>
            {creatingPage ? (
              <div className="rounded-2xl border border-dashed border-border px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                  New page
                </p>
                <div className="mt-3 space-y-2">
                  <Input
                    placeholder="Display name"
                    value={newPageName}
                    onChange={(event) => setNewPageName(event.target.value)}
                  />
                  <Input
                    placeholder="Slug (privacy, about, ...)"
                    value={newPageSlug}
                    onChange={(event) => setNewPageSlug(event.target.value)}
                  />
                  <Button
                    type="button"
                    className="w-full"
                    onClick={handleCreatePage}
                    disabled={!newPageName || !newPageSlug}
                  >
                    Create
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Locale
            </p>
            <div className="mt-3 grid gap-2">
              {locales.map((localeOption) => {
                const active = localeOption === selectedLocale;
                return (
                  <button
                    key={localeOption}
                    type="button"
                    onClick={() => setSelectedLocale(localeOption)}
                    className={cn(
                      "flex items-center justify-between rounded-2xl border px-3 py-2 text-left transition",
                      active
                        ? "border-primary bg-primary/10"
                        : "border-border/70 hover:border-border"
                    )}
                  >
                    <span className="text-sm font-medium">
                      {localeOption.toUpperCase()}
                    </span>
                    {active ? (
                      <span className="text-xs text-primary">Active</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Block library
            </p>
            <div className="mt-3 grid gap-2">
              {cmsBlockTypes.map((type) => {
                const definition = cmsBlockRegistry[type];
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => addBlock(type)}
                    className="flex items-center justify-between rounded-2xl border border-dashed border-border px-3 py-2 text-left text-sm transition hover:border-primary"
                  >
                    <span className="font-medium">{definition.label}</span>
                    <PlusCircle className="h-4 w-4 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{selectedPage.displayName}</CardTitle>
              <CardDescription>
                Managing locale{" "}
                <span className="font-semibold">
                  {selectedLocale.toUpperCase()}
                </span>{" "}
                · Version {activeVersion?.versionNumber ?? "—"} · Status{" "}
                <span className="uppercase">
                  {activeVersion?.status ?? "draft"}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">
                  Summary
                </label>
                <Textarea
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                  placeholder="Notes about this version"
                  className="mt-2"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>Blocks</CardTitle>
                <CardDescription>
                  Drag, reorder, or edit structured sections. These compose the
                  final page.
                </CardDescription>
              </div>
              <span className="text-xs text-muted-foreground">
                {blocks.length} block{blocks.length === 1 ? "" : "s"}
              </span>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingVersion ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : blocks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  No blocks yet. Use the block library to add the first section.
                </div>
              ) : (
                blocks.map((block, index) => {
                  const definition = cmsBlockRegistry[block.type];
                  return (
                    <div
                      key={block.id ?? `${block.type}-${index}`}
                      className="space-y-4 rounded-2xl border border-border/70 bg-card/60 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {definition.label}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {definition.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={block.visible}
                            onCheckedChange={(checked) =>
                              setBlocks((prev) => {
                                const next = [...prev];
                                next[index] = {
                                  ...next[index],
                                  visible: checked,
                                };
                                return next;
                              })
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => moveBlock(index, "up")}
                            disabled={index === 0}
                          >
                            <MoveUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => moveBlock(index, "down")}
                            disabled={index === blocks.length - 1}
                          >
                            <MoveDown className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeBlock(index)}
                          >
                            <Trash2 className="h-4 w-4 text-rose-500" />
                          </Button>
                        </div>
                      </div>
                      <BlockFields
                        block={block}
                        index={index}
                        onChange={updateBlockData}
                        onItemChange={(items) =>
                          updateBlockData(index, { items })
                        }
                      />
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>Live preview</CardTitle>
              <CardDescription>
                Blocks render using the same components as the public site.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CmsRenderer blocks={previewBlocks} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function BlockFields({
  block,
  index,
  onChange,
  onItemChange,
}: {
  block: EditableBlock;
  index: number;
  onChange: (index: number, updates: Record<string, unknown>) => void;
  onItemChange: (items: Array<Record<string, unknown>>) => void;
}) {
  switch (block.type) {
    case "hero":
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <InputField
            label="Eyebrow"
            value={(block.data.eyebrow as string) ?? ""}
            onChange={(value) => onChange(index, { eyebrow: value })}
          />
          <InputField
            label="Headline"
            required
            value={(block.data.title as string) ?? ""}
            onChange={(value) => onChange(index, { title: value })}
          />
          <TextareaField
            label="Body"
            value={(block.data.body as string) ?? ""}
            onChange={(value) => onChange(index, { body: value })}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <InputField
              label="CTA label"
              value={(block.data.ctaLabel as string) ?? ""}
              onChange={(value) => onChange(index, { ctaLabel: value })}
            />
            <InputField
              label="CTA href"
              value={(block.data.ctaHref as string) ?? ""}
              onChange={(value) => onChange(index, { ctaHref: value })}
            />
          </div>
        </div>
      );
    case "rich_text":
      return (
        <div className="space-y-4">
          <InputField
            label="Title"
            value={(block.data.title as string) ?? ""}
            onChange={(value) => onChange(index, { title: value })}
          />
          <TextareaField
            label="Body"
            required
            value={(block.data.body as string) ?? ""}
            onChange={(value) => onChange(index, { body: value })}
          />
        </div>
      );
    case "feature_grid": {
      const items = (
        Array.isArray(block.data.items) ? block.data.items : []
      ) as Array<{
        heading?: string;
        description?: string;
      }>;
      return (
        <div className="space-y-4">
          <InputField
            label="Section title"
            required
            value={(block.data.title as string) ?? ""}
            onChange={(value) => onChange(index, { title: value })}
          />
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Items
            </p>
            {items.map((item, itemIndex) => (
              <div
                key={`${item.heading}-${itemIndex}`}
                className="rounded-2xl border border-border/60 p-4"
              >
                <InputField
                  label="Heading"
                  required
                  value={item.heading ?? ""}
                  onChange={(value) => {
                    const next = [...items];
                    next[itemIndex] = { ...next[itemIndex], heading: value };
                    onItemChange(next);
                  }}
                />
                <TextareaField
                  label="Description"
                  required
                  value={item.description ?? ""}
                  onChange={(value) => {
                    const next = [...items];
                    next[itemIndex] = {
                      ...next[itemIndex],
                      description: value,
                    };
                    onItemChange(next);
                  }}
                />
                <div className="mt-3 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const next = items.filter((_, idx) => idx !== itemIndex);
                      onItemChange(next);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onItemChange([...items, { heading: "", description: "" }])
              }
            >
              Add feature
            </Button>
          </div>
        </div>
      );
    }
    case "legal_section":
      return (
        <div className="space-y-4">
          <InputField
            label="Heading"
            required
            value={(block.data.heading as string) ?? ""}
            onChange={(value) => onChange(index, { heading: value })}
          />
          <TextareaField
            label="Body"
            required
            value={(block.data.body as string) ?? ""}
            onChange={(value) => onChange(index, { body: value })}
          />
        </div>
      );
    case "cta_banner":
      return (
        <div className="space-y-4">
          <InputField
            label="Eyebrow"
            value={(block.data.eyebrow as string) ?? ""}
            onChange={(value) => onChange(index, { eyebrow: value })}
          />
          <InputField
            label="Title"
            required
            value={(block.data.title as string) ?? ""}
            onChange={(value) => onChange(index, { title: value })}
          />
          <TextareaField
            label="Description"
            value={(block.data.description as string) ?? ""}
            onChange={(value) => onChange(index, { description: value })}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <InputField
              label="CTA label"
              value={(block.data.ctaLabel as string) ?? ""}
              onChange={(value) => onChange(index, { ctaLabel: value })}
            />
            <InputField
              label="CTA href"
              value={(block.data.ctaHref as string) ?? ""}
              onChange={(value) => onChange(index, { ctaHref: value })}
            />
          </div>
        </div>
      );
    case "reviews": {
      const items = (
        Array.isArray(block.data.items) ? block.data.items : []
      ) as Array<{
        quote?: string;
        author?: string;
        role?: string;
      }>;
      return (
        <div className="space-y-4">
          <InputField
            label="Section title"
            required
            value={(block.data.title as string) ?? ""}
            onChange={(value) => onChange(index, { title: value })}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm font-medium text-foreground">
              Layout
            </label>
            <select
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
              value={(block.data.layout as string) ?? "grid"}
              onChange={(event) =>
                onChange(index, { layout: event.target.value })
              }
            >
              <option value="grid">Grid</option>
              <option value="carousel">Carousel</option>
            </select>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Reviews
            </p>
            {items.map((item, itemIndex) => (
              <div
                key={`${item.author}-${itemIndex}`}
                className="rounded-2xl border border-border/60 p-4"
              >
                <TextareaField
                  label="Quote"
                  required
                  value={item.quote ?? ""}
                  onChange={(value) => {
                    const next = [...items];
                    next[itemIndex] = { ...next[itemIndex], quote: value };
                    onItemChange(next);
                  }}
                />
                <InputField
                  label="Author"
                  required
                  value={item.author ?? ""}
                  onChange={(value) => {
                    const next = [...items];
                    next[itemIndex] = { ...next[itemIndex], author: value };
                    onItemChange(next);
                  }}
                />
                <InputField
                  label="Role / title"
                  value={item.role ?? ""}
                  onChange={(value) => {
                    const next = [...items];
                    next[itemIndex] = { ...next[itemIndex], role: value };
                    onItemChange(next);
                  }}
                />
                <div className="mt-3 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const next = items.filter((_, idx) => idx !== itemIndex);
                      onItemChange(next);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onItemChange([...items, { quote: "", author: "", role: "" }])
              }
            >
              Add review
            </Button>
          </div>
        </div>
      );
    }
    case "faq": {
      const items = (
        Array.isArray(block.data.items) ? block.data.items : []
      ) as Array<{
        question?: string;
        answer?: string;
      }>;
      return (
        <div className="space-y-4">
          <InputField
            label="Section title"
            required
            value={(block.data.title as string) ?? ""}
            onChange={(value) => onChange(index, { title: value })}
          />
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Questions
            </p>
            {items.map((item, itemIndex) => (
              <div
                key={`${item.question}-${itemIndex}`}
                className="rounded-2xl border border-border/60 p-4"
              >
                <InputField
                  label="Question"
                  required
                  value={item.question ?? ""}
                  onChange={(value) => {
                    const next = [...items];
                    next[itemIndex] = { ...next[itemIndex], question: value };
                    onItemChange(next);
                  }}
                />
                <TextareaField
                  label="Answer"
                  required
                  value={item.answer ?? ""}
                  onChange={(value) => {
                    const next = [...items];
                    next[itemIndex] = { ...next[itemIndex], answer: value };
                    onItemChange(next);
                  }}
                />
                <div className="mt-3 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const next = items.filter((_, idx) => idx !== itemIndex);
                      onItemChange(next);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onItemChange([...items, { question: "", answer: "" }])
              }
            >
              Add question
            </Button>
          </div>
        </div>
      );
    }
    default:
      return null;
  }
}

function InputField({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">
        {label}
        {required ? <span className="text-rose-500">*</span> : null}
      </label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">
        {label}
        {required ? <span className="text-rose-500">*</span> : null}
      </label>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[120px]"
      />
    </div>
  );
}
