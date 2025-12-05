"use client";

import { useState } from "react";
import { toast } from "sonner";

import { adminApi } from "@/lib/web/api-client";

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
import { ImageUploadField } from "@/components/admin/media/image-upload-field";

const DEFAULT_STORAGE_KEYS = {
  category: "zabavaSelectedCategory",
  partner: "zabavaSelectedPartner",
};

export function PartnerListPanel() {
  const [form, setForm] = useState({
    categoriesPageUrl: "",
    detailPageUrl: "",
    fallbackImageUrl: "",
  });
  const [embed, setEmbed] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    if (!form.detailPageUrl.trim()) {
      toast.error("Enter the partner detail page URL first.");
      return;
    }
    setLoading(true);
    try {
      const code = await adminApi.showcaseEmbed(
        {
          type: "list",
          detailPageUrl: form.detailPageUrl.trim(),
          categoriesPageUrl: form.categoriesPageUrl.trim() || undefined,
          defaultImageUrl: form.fallbackImageUrl.trim() || undefined,
          categoryStorageKey: DEFAULT_STORAGE_KEYS.category,
          partnerStorageKey: DEFAULT_STORAGE_KEYS.partner,
        },
        {}
      );
      setEmbed(code);
      toast.success("Partner list embed generated.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to generate partner list embed."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!embed) {
      toast.error("Generate the embed first.");
      return;
    }
    try {
      await navigator.clipboard.writeText(embed);
      toast.success("Embed copied to clipboard.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to copy embed code."
      );
    }
  }

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader>
        <CardTitle>Partner list embed</CardTitle>
        <CardDescription>
          Generate the snippet for the page that shows partners inside a
          category.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Partner detail page URL</Label>
            <Input
              value={form.detailPageUrl}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  detailPageUrl: event.target.value,
                }))
              }
              placeholder="https://your.tilda.site/partner-detail"
            />
            <p className="text-xs text-muted-foreground">
              Required. Where visitors should land when they select “View
              details”.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Categories page URL (optional)</Label>
            <Input
              value={form.categoriesPageUrl}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  categoriesPageUrl: event.target.value,
                }))
              }
              placeholder="https://your.tilda.site/categories"
            />
            <p className="text-xs text-muted-foreground">
              Used for the “Back to categories” link in the embed, if provided.
            </p>
          </div>
          <ImageUploadField
            label="Fallback image (optional)"
            description="Shown when a partner does not have a hero image configured."
            value={form.fallbackImageUrl}
            onChange={(url) =>
              setForm((prev) => ({
                ...prev,
                fallbackImageUrl: url,
              }))
            }
            folder="embeds/fallbacks"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={handleGenerate} disabled={loading}>
            {loading ? "Generating…" : "Generate embed"}
          </Button>
          <Button type="button" variant="outline" onClick={handleCopy}>
            Copy code
          </Button>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed">
          <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap break-all">
            <code>
              {embed || "Generate the partner list embed to preview it here."}
            </code>
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
