"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type {
  PartnerCategory,
  PartnerShowcaseDirectory,
} from "@/lib/data/partner-showcase";
import { adminApi } from "@/lib/web/api-client";
import { getCsrfToken } from "@/lib/web/csrf";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { ImageUploadField } from "@/components/admin/media/image-upload-field";

interface CategoriesDashboardProps {
  directory: PartnerShowcaseDirectory;
}

interface CategoryFormState {
  id?: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: string;
  cardTitle: string;
  cardSubtitle: string;
  cardDescription: string;
  cardHeroImageUrl: string;
  cardButtonLabel: string;
  cardButtonUrl: string;
  cardBackgroundColor: string;
  cardTextColor: string;
  cardTextSize: string;
  cardSubtitleColor: string;
  cardSubtitleSize: string;
}

const DEFAULT_CATEGORY_STORAGE_KEY = "zabavaSelectedCategory";
const DEFAULT_PARTNER_STORAGE_KEY = "zabavaSelectedPartner";

function toCategoryForm(category?: PartnerCategory): CategoryFormState {
  return {
    id: category?.id,
    name: category?.name ?? "",
    slug: category?.slug ?? "",
    description: category?.description ?? "",
    sortOrder: category ? String(category.sortOrder ?? 0) : "0",
    cardTitle: category?.cardContent?.title ?? "",
    cardSubtitle: category?.cardContent?.subtitle ?? "",
    cardDescription: category?.cardContent?.description ?? "",
    cardHeroImageUrl: category?.cardContent?.heroImageUrl ?? "",
    cardButtonLabel: category?.cardContent?.buttonLabel ?? "",
    cardButtonUrl: category?.cardContent?.buttonUrl ?? "",
    cardBackgroundColor: category?.cardContent?.backgroundColor ?? "",
    cardTextColor: category?.cardContent?.textColor ?? "",
    cardTextSize: category?.cardContent?.textSize ?? "",
    cardSubtitleColor: category?.cardContent?.subtitleColor ?? "",
    cardSubtitleSize: category?.cardContent?.subtitleSize ?? "",
  };
}

export function CategoriesDashboard({ directory }: CategoriesDashboardProps) {
  const [categories, setCategories] = useState<PartnerCategory[]>(
    directory.categories
  );
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(
    toCategoryForm()
  );
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryDeleting, setCategoryDeleting] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "detail">("list");

  const [embedConfig, setEmbedConfig] = useState({
    listPageUrl: "",
  });
  const [embedSnippet, setEmbedSnippet] = useState("");
  const [embedLoading, setEmbedLoading] = useState(false);

  const csrfToken = useMemo(() => getCsrfToken(), []);

  const categoryAssetFolder = `categories/${(
    categoryForm.id ||
    categoryForm.slug ||
    "new-category"
  )
    .toString()
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()}`;

  function resetCategoryForm() {
    setCategoryForm(toCategoryForm());
    setSelectedId(null);
    setView("list");
  }

  function handleCategoryEdit(category: PartnerCategory) {
    setCategoryForm(toCategoryForm(category));
    setSelectedId(category.id);
    setView("detail");
    setEmbedSnippet("");
  }

  function handleCreateNewCategory() {
    setCategoryForm(toCategoryForm());
    setSelectedId(null);
    setView("detail");
    setEmbedSnippet("");
  }

  async function handleCategorySubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!categoryForm.name.trim()) {
      toast.error("Category name is required.");
      return;
    }
    setCategorySaving(true);
    try {
      const payload = {
        id: categoryForm.id?.trim() || undefined,
        name: categoryForm.name.trim(),
        slug: categoryForm.slug.trim() || undefined,
        description: categoryForm.description.trim() || undefined,
        sortOrder: Number(categoryForm.sortOrder) || 0,
        cardContent: {
          title: categoryForm.cardTitle.trim() || undefined,
          subtitle: categoryForm.cardSubtitle.trim() || undefined,
          description: categoryForm.cardDescription.trim() || undefined,
          heroImageUrl:
            categoryForm.cardHeroImageUrl.trim() || undefined,
          buttonLabel: categoryForm.cardButtonLabel.trim() || undefined,
          buttonUrl: categoryForm.cardButtonUrl.trim() || undefined,
          backgroundColor:
            categoryForm.cardBackgroundColor.trim() || undefined,
          textColor: categoryForm.cardTextColor.trim() || undefined,
          textSize: categoryForm.cardTextSize.trim() || undefined,
          subtitleColor:
            categoryForm.cardSubtitleColor.trim() || undefined,
          subtitleSize:
            categoryForm.cardSubtitleSize.trim() || undefined,
        },
      };
      const response = await adminApi.showcaseCategorySave(payload, {
        headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined,
      });
      const saved = response.item;
      setCategories((existing) => {
        const others = existing.filter((item) => item.id !== saved.id);
        return [...others, saved].sort(
          (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
        );
      });
      toast.success(
        categoryForm.id ? "Category updated." : "Category created."
      );
      setCategoryForm(toCategoryForm(saved));
      setSelectedId(saved.id);
      setView("detail");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save category."
      );
    } finally {
      setCategorySaving(false);
    }
  }

  async function handleCategoryDelete(id: string) {
    setCategoryDeleting(id);
    try {
      await adminApi.showcaseCategoryDelete(id, {
        headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined,
      });
      setCategories((existing) =>
        existing.filter((category) => category.id !== id)
      );
      if (categoryForm.id === id) {
        resetCategoryForm();
      }
      toast.success("Category removed.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete category."
      );
    } finally {
      setCategoryDeleting(null);
    }
  }

  async function generateCategoriesEmbed() {
    if (!embedConfig.listPageUrl.trim()) {
      toast.error("Add the categories page URL before generating.");
      return;
    }
    setEmbedLoading(true);
    try {
      const code = await adminApi.showcaseEmbed(
        {
          type: "categories",
          listPageUrl: embedConfig.listPageUrl.trim(),
          categoryStorageKey: DEFAULT_CATEGORY_STORAGE_KEY,
          partnerStorageKey: DEFAULT_PARTNER_STORAGE_KEY,
        },
        {}
      );
      setEmbedSnippet(code);
      toast.success("Categories list embed generated.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to generate embed snippet."
      );
    } finally {
      setEmbedLoading(false);
    }
  }

  async function copyToClipboard(value: string) {
    if (!value) {
      toast.error("Generate the embed snippet first.");
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Embed copied to clipboard.");
    } catch (error) {
      console.error("clipboard error", error);
      toast.error("Unable to copy embed code.");
    }
  }

  if (view === "detail") {
    const isEditing = Boolean(selectedId);
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setView("list");
              setSelectedId(null);
              setCategoryForm(toCategoryForm());
            }}
          >
            ← Back to categories
          </Button>
          <div className="text-sm text-muted-foreground">
            {isEditing ? "Editing category" : "Create new category"}
          </div>
        </div>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle>{isEditing ? "Edit category" : "Create category"}</CardTitle>
            <CardDescription>
              Define the category and the card content visitors will see.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleCategorySubmit}>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={categoryForm.name}
                  onChange={(event) =>
                    setCategoryForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Family adventures"
                />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input
                  value={categoryForm.slug}
                  onChange={(event) =>
                    setCategoryForm((prev) => ({
                      ...prev,
                      slug: event.target.value,
                    }))
                  }
                  placeholder="family"
                />
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Textarea
                  value={categoryForm.description}
                  onChange={(event) =>
                    setCategoryForm((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Useful for families, schools, and group fun."
                />
              </div>
              <div className="space-y-2">
                <Label>Sort order</Label>
                <Input
                  type="number"
                  min={0}
                  value={categoryForm.sortOrder}
                  onChange={(event) =>
                    setCategoryForm((prev) => ({
                      ...prev,
                      sortOrder: event.target.value,
                    }))
                  }
                />
              </div>

              <Separator className="my-6" />

              <div className="space-y-2">
                <Label>Card title</Label>
                <Input
                  value={categoryForm.cardTitle}
                  onChange={(event) =>
                    setCategoryForm((prev) => ({
                      ...prev,
                      cardTitle: event.target.value,
                    }))
                  }
                  placeholder="Exciting family day"
                />
              </div>
              <div className="space-y-2">
                <Label>Card subtitle</Label>
                <Input
                  value={categoryForm.cardSubtitle}
                  onChange={(event) =>
                    setCategoryForm((prev) => ({
                      ...prev,
                      cardSubtitle: event.target.value,
                    }))
                  }
                  placeholder="Tailored experiences for all ages"
                />
              </div>
              <div className="space-y-2">
                <Label>Card description</Label>
                <Textarea
                  value={categoryForm.cardDescription}
                  onChange={(event) =>
                    setCategoryForm((prev) => ({
                      ...prev,
                      cardDescription: event.target.value,
                    }))
                  }
                  placeholder="Short summary shown on the categories page."
                />
              </div>
              <ImageUploadField
                label="Card media (image, gif, or video)"
                description="Displayed on the homepage category marquee. Upload images or paste URLs for videos (.mp4, .webm, .mov) or gifs (.gif) in the URL field below."
                value={categoryForm.cardHeroImageUrl}
                onChange={(url) =>
                  setCategoryForm((prev) => ({
                    ...prev,
                    cardHeroImageUrl: url,
                  }))
                }
                folder={`${categoryAssetFolder}/card`}
                readOnlyUrl={false}
                helperText="Supports images (.jpg, .png, .webp), animated gifs (.gif), and videos (.mp4, .webm, .mov). For videos and gifs, paste the URL directly in the field below."
              />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Button label</Label>
              <Input
                value={categoryForm.cardButtonLabel}
                    onChange={(event) =>
                      setCategoryForm((prev) => ({
                        ...prev,
                        cardButtonLabel: event.target.value,
                      }))
                    }
                    placeholder="Explore"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Button link (optional)</Label>
                  <Input
                    value={categoryForm.cardButtonUrl}
                    onChange={(event) =>
                      setCategoryForm((prev) => ({
                        ...prev,
                        cardButtonUrl: event.target.value,
                      }))
                    }
                    placeholder="https://..."
                  />
                </div>
              </div>

              <Separator className="my-6" />

              <div className="space-y-2">
                <Label>Card title</Label>
                <Input
                  value={categoryForm.cardTitle}
                  onChange={(event) =>
                    setCategoryForm((prev) => ({
                      ...prev,
                      cardTitle: event.target.value,
                    }))
                  }
                  placeholder="Exciting family day"
                />
              </div>
              <div className="space-y-2">
                <Label>Card subtitle</Label>
                <Input
                  value={categoryForm.cardSubtitle}
                  onChange={(event) =>
                    setCategoryForm((prev) => ({
                      ...prev,
                      cardSubtitle: event.target.value,
                    }))
                  }
                  placeholder="Tailored experiences for all ages"
                />
              </div>
              <div className="space-y-2">
                <Label>Card description</Label>
                <Textarea
                  value={categoryForm.cardDescription}
                  onChange={(event) =>
                    setCategoryForm((prev) => ({
                      ...prev,
                      cardDescription: event.target.value,
                    }))
                  }
                  placeholder="Short summary shown on the categories page."
                />
              </div>
              <ImageUploadField
                label="Card media (image, gif, or video)"
                description="Displayed on the homepage category marquee. Upload images or paste URLs for videos (.mp4, .webm, .mov) or gifs (.gif) in the URL field below."
                value={categoryForm.cardHeroImageUrl}
                onChange={(url) =>
                  setCategoryForm((prev) => ({
                    ...prev,
                    cardHeroImageUrl: url,
                  }))
                }
                folder={`${categoryAssetFolder}/card`}
                readOnlyUrl={false}
                helperText="Supports images (.jpg, .png, .webp), animated gifs (.gif), and videos (.mp4, .webm, .mov). For videos and gifs, paste the URL directly in the field below."
              />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Button label</Label>
                  <Input
                    value={categoryForm.cardButtonLabel}
                    onChange={(event) =>
                      setCategoryForm((prev) => ({
                        ...prev,
                        cardButtonLabel: event.target.value,
                      }))
                    }
                    placeholder="Explore"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Button link (optional)</Label>
                  <Input
                    value={categoryForm.cardButtonUrl}
                    onChange={(event) =>
                      setCategoryForm((prev) => ({
                        ...prev,
                        cardButtonUrl: event.target.value,
                      }))
                    }
                placeholder="https://..."
              />
            </div>
          </div>

          <Separator className="my-4" />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Card background color</Label>
              <Input
                value={categoryForm.cardBackgroundColor}
                onChange={(event) =>
                  setCategoryForm((prev) => ({
                    ...prev,
                    cardBackgroundColor: event.target.value,
                  }))
                }
                placeholder="#ffffff"
              />
            </div>
            <div className="space-y-2">
              <Label>Text color</Label>
              <Input
                value={categoryForm.cardTextColor}
                onChange={(event) =>
                  setCategoryForm((prev) => ({
                    ...prev,
                    cardTextColor: event.target.value,
                  }))
                }
                placeholder="#101828"
              />
            </div>
            <div className="space-y-2">
              <Label>Title text size</Label>
              <Input
                value={categoryForm.cardTextSize}
                onChange={(event) =>
                  setCategoryForm((prev) => ({
                    ...prev,
                    cardTextSize: event.target.value,
                  }))
                }
                placeholder="1.5rem"
              />
            </div>
            <div className="space-y-2">
              <Label>Subtitle color</Label>
              <Input
                value={categoryForm.cardSubtitleColor}
                onChange={(event) =>
                  setCategoryForm((prev) => ({
                    ...prev,
                    cardSubtitleColor: event.target.value,
                  }))
                }
                placeholder="#475467"
              />
            </div>
            <div className="space-y-2">
              <Label>Subtitle text size</Label>
              <Input
                value={categoryForm.cardSubtitleSize}
                onChange={(event) =>
                  setCategoryForm((prev) => ({
                    ...prev,
                    cardSubtitleSize: event.target.value,
                  }))
                }
                placeholder="1rem"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              disabled={categorySaving}
                  className="flex-1"
                >
                  {categorySaving
                    ? "Saving…"
                    : categoryForm.id
                    ? "Save changes"
                    : "Create category"}
                </Button>
                <Button type="button" variant="outline" onClick={resetCategoryForm}>
                  Clear
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Categories</CardTitle>
            <CardDescription>
              View all categories. Create or edit to manage the card content.
            </CardDescription>
          </div>
          <Button type="button" onClick={handleCreateNewCategory}>
            Create category
          </Button>
        </CardHeader>
        <CardContent className="overflow-hidden rounded-lg border border-slate-200">
          <Table>
            <TableHeader className="bg-slate-50 text-xs uppercase text-slate-500">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="text-right">Sort</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center text-sm text-muted-foreground"
                  >
                    No categories yet. Use the button above to create one.
                  </TableCell>
                </TableRow>
              )}
              {categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium text-slate-900">
                    {category.name}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {category.slug}
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    <span className="text-sm text-slate-500">
                      {category.sortOrder ?? 0}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleCategoryEdit(category)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleCategoryDelete(category.id)}
                      disabled={categoryDeleting === category.id}
                      className="text-red-600 hover:text-red-600"
                    >
                      {categoryDeleting === category.id ? "…" : "Delete"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle>Categories embed</CardTitle>
          <CardDescription>
            Provide the landing page URL, then generate and copy the HTML snippet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Categories page URL</Label>
            <Input
              value={embedConfig.listPageUrl}
              onChange={(event) =>
                setEmbedConfig((prev) => ({
                  ...prev,
                  listPageUrl: event.target.value,
                }))
              }
              placeholder="https://your.tilda.site/categories"
            />
            <p className="text-xs text-muted-foreground">
              This should be the page where the categories embed will live.
            </p>
          </div>

          <EmbedCard
            title="Categories list embed"
            description="Place on your categories landing page."
            loading={embedLoading}
            snippet={embedSnippet}
            onGenerate={generateCategoriesEmbed}
            onCopy={() => copyToClipboard(embedSnippet)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function EmbedCard({
  title,
  description,
  loading,
  snippet,
  onGenerate,
  onCopy,
}: {
  title: string;
  description: string;
  loading: boolean;
  snippet: string;
  onGenerate: () => void;
  onCopy: () => void;
}) {
  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onGenerate} disabled={loading}>
            {loading ? "Generating…" : "Generate"}
          </Button>
          <Button type="button" variant="outline" onClick={onCopy}>
            Copy
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed">
          <pre className="max-h-[220px] overflow-auto whitespace-pre-wrap break-all">
            <code>
              {snippet || "Generate the embed to preview or copy the HTML here."}
            </code>
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
