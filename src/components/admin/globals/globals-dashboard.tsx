"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  X,
  Check,
  Globe2,
  Ticket,
  Tag,
  Layers,
  Coins,
  CreditCard,
  Building,
  ChevronRight,
} from "lucide-react";

import { adminApi } from "@/lib/web/api-client";
import type {
  GlobalValueRecord,
  GlobalValueType,
} from "@/lib/data/global-values";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const TYPE_CONFIG: Record<GlobalValueType, { label: string; icon: React.ComponentType<{ className?: string }>; description: string }> = {
  ticket_type: {
    label: "Ticket types",
    icon: Ticket,
    description: "Configure the standard ticket types that deals, partners, and forms can reference.",
  },
  category: {
    label: "Categories",
    icon: Layers,
    description: "Define reusable categories for partners, deals, or rewards across the platform.",
  },
  tag: {
    label: "Tags",
    icon: Tag,
    description: "Manage the tag vocabulary used for rewards, deals, and analytics filters.",
  },
  listing_tier: {
    label: "Listing tiers",
    icon: Layers,
    description: "Control the Silver/Gold/Platinum tiers that determine partner spotlight placement.",
  },
  cash_currency: {
    label: "Cash currencies",
    icon: Coins,
    description: "Maintain the list of currencies partners can accept for cash payments.",
  },
  accepted_payment: {
    label: "Accepted payments",
    icon: CreditCard,
    description: "Define reusable payment method labels (cash, cards, Apple Pay, etc.).",
  },
  facility: {
    label: "Facilities",
    icon: Building,
    description: "Manage the amenities/facilities icons that appear on partner detail cards.",
  },
};

function slugifyValue(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readMetadataString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function inferMediaKind(url: string): "image" | "video" | "gif" {
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

type GlobalsByType = Record<GlobalValueType, GlobalValueRecord[]>;

interface GlobalsDashboardProps {
  initialValues: GlobalsByType;
}

interface FormState {
  key: string;
  label: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
  subOptions: string[];
  heroMediaUrl: string;
  heroMediaAlt: string;
  accentColor: string;
}

const EMPTY_FORM: FormState = {
  key: "",
  label: "",
  description: "",
  sortOrder: "0",
  isActive: true,
  subOptions: [],
  heroMediaUrl: "",
  heroMediaAlt: "",
  accentColor: "",
};

export function GlobalsDashboard({ initialValues }: GlobalsDashboardProps) {
  const [activeType, setActiveType] = useState<GlobalValueType>("ticket_type");
  const [values, setValues] = useState<GlobalsByType>(initialValues);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const categoryMediaInputRef = useRef<HTMLInputElement | null>(null);
  const [mediaUploading, setMediaUploading] = useState(false);

  const currentValues = useMemo(
    () => values[activeType] ?? [],
    [values, activeType]
  );

  const availableTicketTypesForSubOptions = useMemo(() => {
    if (activeType !== "ticket_type") return [];
    return values.ticket_type
      .filter((t) => !editingId || t.id !== editingId)
      .filter((t) => t.isActive)
      .map((t) => ({ key: t.key, label: t.label }));
  }, [values.ticket_type, editingId, activeType]);

  function getCategoryAssetFolder() {
    const source = form.key?.trim() || form.label?.trim() || "category";
    const slug = slugifyValue(source || "category");
    return `globals/categories/${slug || "category"}`;
  }

  function resetForm(nextType: GlobalValueType = activeType) {
    setForm({
      ...EMPTY_FORM,
      sortOrder:
        (values[nextType]?.[values[nextType].length - 1]?.sortOrder ?? 0) + "",
    });
    setEditingId(null);
  }

  async function refreshType(type: GlobalValueType = activeType) {
    setRefreshing(true);
    try {
      const response = await adminApi.globalsList(
        { type, includeInactive: true },
        {}
      );
      setValues((prev) => ({
        ...prev,
        [type]: response.items,
      }));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to refresh values."
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const metadata: Record<string, unknown> = {};
      let includeMetadata = false;
      if (activeType === "ticket_type") {
        includeMetadata = true;
        if (form.subOptions.length > 0) {
          metadata.subOptions = form.subOptions;
        } else if (editingId) {
          metadata.subOptions = [];
        }
      }
      if (activeType === "category") {
        includeMetadata = true;
        const mediaUrl = form.heroMediaUrl.trim();
        const mediaAlt = form.heroMediaAlt.trim();
        const accentColor = form.accentColor.trim();
        if (mediaUrl) metadata.heroMediaUrl = mediaUrl;
        if (mediaAlt) metadata.heroMediaAlt = mediaAlt;
        if (accentColor) metadata.accentColor = accentColor;
      }

      const payload = {
        label: form.label.trim(),
        key: form.key.trim() || undefined,
        description: form.description.trim() || undefined,
        sortOrder: Number.parseInt(form.sortOrder, 10) || 0,
        isActive: form.isActive,
        ...(includeMetadata ? { metadata } : {}),
      };

      if (!payload.label) {
        throw new Error("Label is required.");
      }

      if (editingId) {
        const response = await adminApi.globalUpdate(editingId, payload, {});
        setValues((prev) => ({
          ...prev,
          [activeType]: prev[activeType].map((item) =>
            item.id === editingId ? response.item : item
          ),
        }));
        toast.success("Value updated.");
      } else {
        const response = await adminApi.globalCreate(
          { type: activeType, ...payload },
          {}
        );
        setValues((prev) => ({
          ...prev,
          [activeType]: [...prev[activeType], response.item].sort(
            (a, b) =>
              a.sortOrder - b.sortOrder ||
              a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
          ),
        }));
        toast.success("Value created.");
      }
      resetForm();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save value."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCategoryMediaUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    if (!file) return;
    setMediaUploading(true);
    try {
      const result = await adminApi.uploadFile(
        file,
        { folder: getCategoryAssetFolder(), contentType: file.type },
        {}
      );
      if (!result?.url) {
        toast.warning("Media uploaded but no URL returned.");
      } else {
        toast.success("Category media uploaded.");
      }
      setForm((prev) => ({ ...prev, heroMediaUrl: result?.url ?? "" }));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload media."
      );
    } finally {
      setMediaUploading(false);
      if (categoryMediaInputRef.current) {
        categoryMediaInputRef.current.value = "";
      }
    }
  }

  function handleEdit(item: GlobalValueRecord) {
    setEditingId(item.id);
    const metadata = (item.metadata ?? {}) as Record<string, unknown>;
    const subOptions =
      activeType === "ticket_type" &&
      Array.isArray(metadata?.subOptions) &&
      typeof (metadata?.subOptions as unknown[])[0] === "string"
        ? (metadata.subOptions as string[])
        : [];
    setForm({
      key: item.key,
      label: item.label,
      description: item.description ?? "",
      sortOrder: `${item.sortOrder ?? 0}`,
      isActive: item.isActive,
      subOptions,
      heroMediaUrl:
        activeType === "category"
          ? readMetadataString(metadata.heroMediaUrl).trim()
          : "",
      heroMediaAlt:
        activeType === "category"
          ? readMetadataString(metadata.heroMediaAlt).trim()
          : "",
      accentColor:
        activeType === "category"
          ? readMetadataString(metadata.accentColor).trim()
          : "",
    });
  }

  async function handleDelete(id: string) {
    const item = currentValues.find((value) => value.id === id);
    if (!item) return;
    const confirmDelete = window.confirm(
      `Delete "${item.label}"? This cannot be undone.`
    );
    if (!confirmDelete) return;
    try {
      await adminApi.globalDelete(id, {});
      setValues((prev) => ({
        ...prev,
        [activeType]: prev[activeType].filter((value) => value.id !== id),
      }));
      if (editingId === id) resetForm();
      toast.success("Value deleted.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete value."
      );
    }
  }

  async function handleToggleActive(item: GlobalValueRecord) {
    try {
      const response = await adminApi.globalUpdate(
        item.id,
        { isActive: !item.isActive },
        {}
      );
      setValues((prev) => ({
        ...prev,
        [activeType]: prev[activeType].map((value) =>
          value.id === item.id ? response.item : value
        ),
      }));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to toggle value."
      );
    }
  }

  const activeConfig = TYPE_CONFIG[activeType];
  const ActiveIcon = activeConfig.icon;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-foreground/10">
            <Globe2 className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Global References
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage reusable values that power the entire platform.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refreshType()}
          disabled={refreshing}
        >
          {refreshing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {/* Type Tabs */}
      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/40 p-1">
        {(Object.keys(TYPE_CONFIG) as GlobalValueType[]).map((type) => {
          const config = TYPE_CONFIG[type];
          const Icon = config.icon;
          const isActive = activeType === type;
          const count = values[type]?.length ?? 0;
          return (
            <button
              key={type}
              type="button"
              onClick={() => {
                setActiveType(type);
                resetForm(type);
              }}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all",
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{config.label}</span>
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {count}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Form Panel */}
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <ActiveIcon className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-foreground">
                {editingId ? "Edit value" : "Create value"}
              </h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {activeConfig.description}
            </p>
          </div>

          <form className="space-y-4 p-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="label" className="text-sm font-medium">
                Label <span className="text-destructive">*</span>
              </Label>
              <Input
                id="label"
                value={form.label}
                onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
                placeholder="e.g. Adult"
                required
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="key" className="text-sm font-medium">
                Key
              </Label>
              <Input
                id="key"
                value={form.key}
                onChange={(e) => setForm((prev) => ({ ...prev, key: e.target.value }))}
                placeholder="Derived from label if blank"
                className="h-10"
              />
              <p className="text-xs text-muted-foreground">
                Optional. Auto-generated from label if empty.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">
                Description
              </Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={2}
                placeholder="Optional context for teammates"
                className="resize-none"
              />
            </div>

            {activeType === "category" && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Hero media</Label>
                  {form.heroMediaUrl && (
                    <div className="relative h-32 overflow-hidden rounded-lg border border-border bg-muted">
                      {inferMediaKind(form.heroMediaUrl) === "video" ? (
                        <video
                          className="h-full w-full object-cover"
                          controls
                          playsInline
                          muted
                          loop
                          src={form.heroMediaUrl}
                        />
                      ) : (
                        <Image
                          src={form.heroMediaUrl}
                          alt={form.heroMediaAlt || form.label || "Category media"}
                          fill
                          className="object-cover"
                          sizes="380px"
                          unoptimized
                        />
                      )}
                    </div>
                  )}
                  <input
                    ref={categoryMediaInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*,video/mp4,video/webm,video/quicktime"
                    onChange={handleCategoryMediaUpload}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => categoryMediaInputRef.current?.click()}
                      disabled={mediaUploading}
                    >
                      {mediaUploading ? (
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      ) : null}
                      Upload
                    </Button>
                    {form.heroMediaUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setForm((prev) => ({ ...prev, heroMediaUrl: "" }))}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  <Input
                    value={form.heroMediaUrl}
                    onChange={(e) => setForm((prev) => ({ ...prev, heroMediaUrl: e.target.value }))}
                    placeholder="Or paste URL"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="heroMediaAlt" className="text-sm font-medium">
                    Alt text
                  </Label>
                  <Input
                    id="heroMediaAlt"
                    value={form.heroMediaAlt}
                    onChange={(e) => setForm((prev) => ({ ...prev, heroMediaAlt: e.target.value }))}
                    placeholder="Describe the media"
                    className="h-10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accentColor" className="text-sm font-medium">
                    Accent color
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="accentColor"
                      value={form.accentColor}
                      onChange={(e) => setForm((prev) => ({ ...prev, accentColor: e.target.value }))}
                      placeholder="#a3e635"
                      className="h-10 flex-1"
                    />
                    {form.accentColor && (
                      <div
                        className="h-10 w-10 rounded-md border border-border"
                        style={{ backgroundColor: form.accentColor }}
                      />
                    )}
                  </div>
                </div>
              </>
            )}

            {activeType === "ticket_type" && availableTicketTypesForSubOptions.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Sub-options</Label>
                <div className="space-y-2">
                  {form.subOptions.map((subOptionKey, index) => {
                    const availableOptions = availableTicketTypesForSubOptions.filter(
                      (opt) => !form.subOptions.includes(opt.key) || opt.key === subOptionKey
                    );
                    return (
                      <div key={`${subOptionKey}-${index}`} className="flex items-center gap-2">
                        <Select
                          value={subOptionKey}
                          onValueChange={(value) => {
                            const updated = [...form.subOptions];
                            updated[index] = value;
                            setForm((prev) => ({ ...prev, subOptions: updated }));
                          }}
                        >
                          <SelectTrigger className="h-9 flex-1">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableOptions.map((opt) => (
                              <SelectItem key={opt.key} value={opt.key}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          onClick={() => {
                            setForm((prev) => ({
                              ...prev,
                              subOptions: prev.subOptions.filter((_, i) => i !== index),
                            }));
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                  {form.subOptions.length < availableTicketTypesForSubOptions.length && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        const nextAvailable = availableTicketTypesForSubOptions.find(
                          (opt) => !form.subOptions.includes(opt.key)
                        );
                        if (nextAvailable) {
                          setForm((prev) => ({
                            ...prev,
                            subOptions: [...prev.subOptions, nextAvailable.key],
                          }));
                        }
                      }}
                    >
                      <Plus className="mr-2 h-3 w-3" />
                      Add sub-option
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="sortOrder" className="text-sm font-medium">
                  Sort order
                </Label>
                <Input
                  id="sortOrder"
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={(e) => setForm((prev) => ({ ...prev, sortOrder: e.target.value }))}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Status</Label>
                <div className="flex h-10 items-center gap-2 rounded-md border border-border bg-muted/40 px-3">
                  <Switch
                    id="isActive"
                    checked={form.isActive}
                    onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))}
                  />
                  <span className="text-sm text-muted-foreground">
                    {form.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : editingId ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                {editingId ? "Save changes" : "Create value"}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={() => resetForm()} disabled={loading}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </div>

        {/* List Panel */}
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="font-semibold text-foreground">{activeConfig.label}</h2>
              <p className="text-xs text-muted-foreground">
                {currentValues.length} value{currentValues.length === 1 ? "" : "s"} configured
              </p>
            </div>
          </div>

          <div className="p-3">
            {currentValues.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
                <ActiveIcon className="h-10 w-10 text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium text-muted-foreground">
                  No {activeConfig.label.toLowerCase()} yet
                </p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Create your first entry using the form.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {currentValues.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "group flex items-center justify-between gap-3 rounded-lg border border-border p-3 transition-all",
                      editingId === item.id
                        ? "border-foreground/30 bg-foreground/5"
                        : "bg-background hover:border-foreground/20"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground truncate">
                          {item.label}
                        </span>
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          {item.key}
                        </Badge>
                        {item.isActive ? (
                          <Badge className="shrink-0 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="shrink-0">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      {item.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground truncate">
                          {item.description}
                        </p>
                      )}
                      {activeType === "ticket_type" &&
                        Array.isArray(item.metadata?.subOptions) &&
                        (item.metadata.subOptions as unknown[]).length > 0 && (
                          <div className="mt-1 flex items-center gap-1">
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            {(item.metadata.subOptions as string[]).map((subKey) => {
                              const subOption = values.ticket_type.find((t) => t.key === subKey);
                              return (
                                <Badge key={subKey} variant="outline" className="text-[10px]">
                                  {subOption?.label ?? subKey}
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(item)}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleToggleActive(item)}
                      >
                        {item.isActive ? (
                          <X className="h-3.5 w-3.5" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => void handleDelete(item.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
