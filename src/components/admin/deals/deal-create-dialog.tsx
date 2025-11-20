"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { getCsrfToken } from "@/lib/web/csrf";
import type { DealType, FlashDealStatus } from "@/lib/data/flash-deals";
import { ImageUploadField } from "@/components/admin/media/image-upload-field";
import { MultiSelect } from "@/components/ui/multi-select";
import { useGlobalValues } from "@/hooks/use-global-values";
import type { GlobalValueRecord } from "@/lib/data/global-values";

const DEFAULT_QR_VALIDITY_DAYS = 10;
const WEEKDAYS: Array<{ value: number; label: string }> = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

interface DealCreateFormState {
  partnerId: string;
  dealType: DealType;
  status: FlashDealStatus;
  title: string;
  slug: string;
  description: string;
  discountPercent: string;
  minVisitors: string;
  commissionPercent: string;
  priceOverrideCzk: string;
  bonusPointsOverride: string;
  qrValidityDays: string;
  usageLimit: string;
  usageLimitDaily: string;
  validFrom: string;
  validTo: string;
  tags: string[];
  audience: string;
  city: string;
  autoExpire: boolean;
  sendReminders: boolean;
  heroImageUrl: string;
  heroImageAlt: string;
  ticketTypes: string[];
}

const INITIAL_FORM: DealCreateFormState = {
  partnerId: "",
  dealType: "flash",
  status: "draft",
  title: "",
  slug: "",
  description: "",
  discountPercent: "10",
  minVisitors: "1",
  commissionPercent: "20",
  priceOverrideCzk: "",
  bonusPointsOverride: "",
  qrValidityDays: "10",
  usageLimit: "",
  usageLimitDaily: "",
  validFrom: "",
  validTo: "",
  tags: [],
  audience: "",
  city: "",
  autoExpire: true,
  sendReminders: false,
  heroImageUrl: "",
  heroImageAlt: "",
  ticketTypes: [],
};

export type PartnerOption = {
  id: string;
  label: string;
  status: string;
  defaultCommission?: number | null;
};

type DealCreateDialogProps = {
  onCreated: () => Promise<void> | void;
  partnerOptions?: PartnerOption[];
  initialTicketTypes?: GlobalValueRecord[];
};

export function DealCreateDialog({
  onCreated,
  partnerOptions: initialPartnerOptions,
  initialTicketTypes,
}: DealCreateDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<DealCreateFormState>(() => ({
    ...INITIAL_FORM,
    ticketTypes: [],
    tags: [],
  }));
  const [validDays, setValidDays] = useState<number[]>([]);
  const [partnerOptionsState, setPartnerOptionsState] = useState<PartnerOption[]>(initialPartnerOptions ?? []);
  const [partnersLoading, setPartnersLoading] = useState(false);
  const [partnersLoaded, setPartnersLoaded] = useState(Boolean(initialPartnerOptions?.length));
  const [partnersError, setPartnersError] = useState<string | null>(null);
  const [useCustomCommission, setUseCustomCommission] = useState(true);
  const { values: ticketTypeValues } = useGlobalValues("ticket_type", {
    includeInactive: false,
    initialValues: initialTicketTypes?.filter((item) => item.isActive),
  });

  const ticketTypeOptions = useMemo(
    () =>
      ticketTypeValues
        .filter((item) => item.isActive)
        .map((item) => ({
          value: item.key,
          label: item.label,
        })),
    [ticketTypeValues],
  );
  const { values: tagValues } = useGlobalValues("tag", {
    includeInactive: false,
  });

  const tagOptions = useMemo(
    () =>
      tagValues
        .filter((item) => item.isActive)
        .map((item) => ({
          value: item.key,
          label: item.label,
        })),
    [tagValues],
  );

  const partnerDefaultCommission = useMemo(() => {
    const entry = partnerOptionsState.find((option) => option.id === form.partnerId);
    return typeof entry?.defaultCommission === "number"
      ? entry.defaultCommission
      : null;
  }, [partnerOptionsState, form.partnerId]);

  const isActivationOn = form.status === "live";

  const handleActivationToggle = useCallback(
    (checked: boolean) => {
      setForm((current) => ({
        ...current,
        status: checked ? "live" : current.status === "live" ? "draft" : current.status,
      }));
    },
    []
  );

  const canSubmit = useMemo(() => {
    return Boolean(form.partnerId.trim() && form.title.trim());
  }, [form.partnerId, form.title]);

  useEffect(() => {
    if (!useCustomCommission) {
      if (typeof partnerDefaultCommission === "number") {
        setForm((current) => ({ ...current, commissionPercent: String(partnerDefaultCommission) }));
      }
    }
  }, [useCustomCommission, partnerDefaultCommission]);

  useEffect(() => {
    if (initialPartnerOptions) {
      setPartnerOptionsState(initialPartnerOptions);
      setPartnersLoaded(Boolean(initialPartnerOptions.length));
    }
  }, [initialPartnerOptions]);

  useEffect(() => {
    if (partnerOptionsState.length > 0 && !form.partnerId) {
      setForm((current) => ({ ...current, partnerId: partnerOptionsState[0].id }));
    }
  }, [partnerOptionsState, form.partnerId]);

  useEffect(() => {
    if (!open) return;
    if (partnerOptionsState.length === 0) return;
    if (form.partnerId) return;
    setForm((current) => ({
      ...current,
      partnerId: partnerOptionsState[0]?.id ?? "",
    }));
  }, [open, partnerOptionsState, form.partnerId]);

  useEffect(() => {
    if (!open || partnersLoaded || partnersLoading) {
      return;
    }

    let cancelled = false;
    async function loadPartners() {
      setPartnersLoading(true);
      setPartnersError(null);
      try {
        const response = await fetch("/api/admin/partners?status=active", {
          credentials: "include",
        });
        if (!response.ok) {
          let message = `Failed to load partners (HTTP ${response.status})`;
          try {
            const body = (await response.json()) as { error?: string };
            if (body?.error) message = body.error;
          } catch {
            /* ignore */
          }
          throw new Error(message);
        }
        const payload = (await response.json()) as {
          items?: Array<{ partnerId: string; displayName?: string | null; status?: string }>;
        };
        if (cancelled) return;
        const options = (payload.items ?? []).map((item) => {
          const contract = typeof item === "object" && item && "contract" in item ? (item as { contract?: { commissionRate?: number } }).contract : undefined;
          const defaultCommission = typeof contract?.commissionRate === "number" ? contract.commissionRate : null;
          return {
            id: item.partnerId,
            label: item.displayName?.trim() || item.partnerId,
            status: item.status ?? "active",
            defaultCommission,
          } satisfies PartnerOption;
        });
        if (cancelled) return;
        setPartnerOptionsState(options);
        setPartnersLoaded(true);
        if (!cancelled && options.length > 0) {
          setForm((current) =>
            current.partnerId
              ? current
              : {
                  ...current,
                  partnerId: options[0].id,
                },
          );
        }
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : "Unable to load partners.";
        setPartnersError(message);
        toast.error(message);
      } finally {
        if (!cancelled) {
          setPartnersLoading(false);
        }
      }
    }

    void loadPartners();

    return () => {
      cancelled = true;
    };
  }, [open, partnersLoaded, partnersLoading]);

  const toggleDay = useCallback(
    (value: number) => {
      setValidDays((current) =>
        current.includes(value)
          ? current.filter((day) => day !== value)
          : [...current, value].sort((a, b) => a - b),
      );
    },
    [setValidDays],
  );

  const resetForm = useCallback(() => {
    setForm({ ...INITIAL_FORM, ticketTypes: [], tags: [] });
    setValidDays([]);
    setUseCustomCommission(true);
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (submitting || !canSubmit) return;
      setSubmitting(true);
      try {
        const qrValidityDays = Math.max(
          1,
          Number(form.qrValidityDays) || DEFAULT_QR_VALIDITY_DAYS,
        );

        const payload: Record<string, unknown> = {
          partnerId: form.partnerId.trim(),
          title: form.title.trim(),
          dealType: form.dealType,
          status: form.status,
          discountPercent: Number(form.discountPercent),
          minVisitors: Number(form.minVisitors),
          commissionPercent: Number(form.commissionPercent),
          qrValiditySeconds: qrValidityDays * 24 * 60 * 60,
          autoExpire: form.autoExpire,
          sendReminders: form.sendReminders,
        };
        if (form.slug.trim()) payload.slug = form.slug.trim();
        if (form.description.trim()) payload.description = form.description.trim();
        if (form.priceOverrideCzk.trim()) payload.priceOverrideCzk = Number(form.priceOverrideCzk);
        if (form.bonusPointsOverride.trim())
          payload.bonusPointsOverride = Number(form.bonusPointsOverride);
        if (form.usageLimit.trim()) payload.usageLimit = Number(form.usageLimit);
        if (form.usageLimitDaily.trim())
          payload.usageLimitDaily = Number(form.usageLimitDaily);
        if (form.validFrom) payload.validFrom = new Date(form.validFrom).toISOString();
        if (form.validTo) payload.validTo = new Date(form.validTo).toISOString();
        if (validDays.length) payload.validDays = validDays;
        if (form.tags.length) payload.tags = form.tags;
        const audience = splitCsv(form.audience);
        if (audience.length) payload.audience = audience;
        const ticketTypes = Array.from(
          new Set(
            form.ticketTypes
              .map((value) => value.trim())
              .filter((value) => value.length > 0),
          ),
        );
        if (ticketTypes.length) payload.ticketTypes = ticketTypes;
        if (form.city.trim()) payload.city = form.city.trim();

        const mediaItems: Array<{ url: string; mediaType?: string; altText?: string; sortOrder?: number }> = [];
        const heroUrl = form.heroImageUrl.trim();
        if (heroUrl) {
          mediaItems.push({
            url: heroUrl,
            mediaType: "image/hero",
            altText: form.heroImageAlt.trim() || undefined,
            sortOrder: 0,
          });
        }
        if (mediaItems.length > 0) {
          payload.media = mediaItems;
        }

        const response = await fetch("/api/admin/deals", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": getCsrfToken(),
          },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          let message = `Failed to create deal (HTTP ${response.status})`;
          try {
            const data = (await response.json()) as { error?: string };
            if (data?.error) message = data.error;
          } catch {
            // ignore
          }
          throw new Error(message);
        }

        toast.success("Deal created");
        setOpen(false);
        resetForm();
        await onCreated();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to create deal.";
        toast.error(message);
      } finally {
        setSubmitting(false);
      }
    },
    [
      canSubmit,
      form.audience,
      form.autoExpire,
      form.bonusPointsOverride,
      form.city,
      form.commissionPercent,
      form.dealType,
      form.description,
      form.discountPercent,
      form.minVisitors,
      form.partnerId,
      form.priceOverrideCzk,
      form.heroImageAlt,
      form.heroImageUrl,
      form.qrValidityDays,
      form.sendReminders,
      form.slug,
      form.status,
      form.tags,
      form.ticketTypes,
      form.title,
      form.usageLimit,
      form.usageLimitDaily,
      form.validFrom,
      form.validTo,
      onCreated,
      resetForm,
      submitting,
      validDays,
    ],
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && setOpen(next)}>
      <DialogTrigger asChild>
        <Button type="button" className="rounded-xl" onClick={() => setOpen(true)}>
          New deal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>Create deal</DialogTitle>
            <DialogDescription>
              Configure a flash deal, weekly promo, or group offer. You can adjust details later.
            </DialogDescription>
          </DialogHeader>

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="partnerId">Partner</Label>
              {partnerOptionsState.length > 0 ? (
                <Select
                  value={form.partnerId || undefined}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, partnerId: value }))
                  }
                  disabled={partnersLoading}
                >
                  <SelectTrigger id="partnerId">
                    <SelectValue
                      placeholder={
                        partnersLoading
                          ? "Loading partners…"
                          : "Select a partner"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {partnerOptionsState.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label} ({option.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="partnerId"
                  value={form.partnerId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, partnerId: event.target.value }))
                  }
                  placeholder="partner-slug-or-id"
                  required
                  disabled={partnersLoading}
                />
              )}
              <p className="text-xs text-muted-foreground">
                {partnersError
                  ? partnersError
                  : partnerOptionsState.length
                  ? "Select the partner this deal belongs to."
                  : partnersLoading
                  ? "Loading partners…"
                  : "No partners found. Enter the partner ID manually."}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dealType">Type</Label>
              <Select
                value={form.dealType}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, dealType: value as DealType }))
                }
              >
                <SelectTrigger id="dealType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flash">Flash deal</SelectItem>
                  <SelectItem value="weekly_promo">Weekly promo</SelectItem>
                  <SelectItem value="group">Group deal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, status: value as FlashDealStatus }))
                }
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="live">Live</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="activation-toggle">Activation</Label>
                <Switch
                  id="activation-toggle"
                  checked={isActivationOn}
                  onCheckedChange={handleActivationToggle}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Toggle on to set the deal live immediately. Use scheduled status for future launches.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug (optional)</Label>
              <Input
                id="slug"
                value={form.slug}
                onChange={(event) =>
                  setForm((current) => ({ ...current, slug: event.target.value }))
                }
                placeholder="special-offer-name"
              />
            </div>
          </section>

          <section className="space-y-4">
            <ImageUploadField
              label="Hero image"
              description="Optional banner shown on the public Special Deals listing."
              value={form.heroImageUrl}
              onChange={(url) =>
                setForm((current) => ({ ...current, heroImageUrl: url }))
              }
              folder="flash-deals/hero"
            />
            <div className="space-y-2">
              <Label htmlFor="heroImageAlt">Hero image alt text</Label>
              <Input
                id="heroImageAlt"
                value={form.heroImageAlt}
                onChange={(event) =>
                  setForm((current) => ({ ...current, heroImageAlt: event.target.value }))
                }
                placeholder="Describe the image for accessibility (optional)"
              />
              <p className="text-xs text-muted-foreground">
                Provide a brief description for screen readers. Leave blank to skip.
              </p>
            </div>
          </section>

          <section className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
                rows={4}
                placeholder="Explain what the deal includes, any special conditions, etc."
              />
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <NumberField
              label="Discount %"
              value={form.discountPercent}
              onChange={(value) => setForm((current) => ({ ...current, discountPercent: value }))}
              min={0}
              max={100}
              step="0.1"
              required
            />
            <NumberField
              label="Min visitors"
              value={form.minVisitors}
              onChange={(value) => setForm((current) => ({ ...current, minVisitors: value }))}
              min={1}
              step="1"
              required
            />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="commissionPercent">Commission %</Label>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Custom</span>
                  <Switch
                    checked={useCustomCommission}
                    onCheckedChange={(checked) => {
                      setUseCustomCommission(checked);
                      if (!checked && typeof partnerDefaultCommission === "number") {
                        setForm((current) => ({
                          ...current,
                          commissionPercent: String(partnerDefaultCommission),
                        }));
                      }
                    }}
                  />
                </div>
              </div>
              <Input
                id="commissionPercent"
                type="number"
                value={form.commissionPercent}
                onChange={(event) =>
                  setForm((current) => ({ ...current, commissionPercent: event.target.value }))
                }
                min={0}
                max={100}
                step="0.1"
                required
                disabled={!useCustomCommission && typeof partnerDefaultCommission === "number"}
              />
              <p className="text-xs text-muted-foreground">
                {useCustomCommission
                  ? "Set a specific commission for this deal."
                  : typeof partnerDefaultCommission === "number"
                  ? `Using partner default commission of ${partnerDefaultCommission}%`
                  : "No partner default commission found; please enter a custom rate."}
              </p>
            </div>
            <NumberField
              label="QR validity (days)"
              value={form.qrValidityDays}
              onChange={(value) =>
                setForm((current) => ({ ...current, qrValidityDays: value }))
              }
              min={1}
              step="1"
              required
            />
            <NumberField
              label="Flat price override (CZK)"
              value={form.priceOverrideCzk}
              onChange={(value) =>
                setForm((current) => ({ ...current, priceOverrideCzk: value }))
              }
              min={0}
              step="1"
            />
            <NumberField
              label="Bonus points override"
              value={form.bonusPointsOverride}
              onChange={(value) =>
                setForm((current) => ({ ...current, bonusPointsOverride: value }))
              }
              min={0}
              step="1"
            />
            <NumberField
              label="Usage limit (total)"
              value={form.usageLimit}
              onChange={(value) => setForm((current) => ({ ...current, usageLimit: value }))}
              min={1}
              step="1"
            />
            <NumberField
              label="Usage limit (daily)"
              value={form.usageLimitDaily}
              onChange={(value) =>
                setForm((current) => ({ ...current, usageLimitDaily: value }))
              }
              min={1}
              step="1"
            />
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="validFrom">Starts at</Label>
              <Input
                id="validFrom"
                type="datetime-local"
                value={form.validFrom}
                onChange={(event) =>
                  setForm((current) => ({ ...current, validFrom: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="validTo">Ends at</Label>
              <Input
                id="validTo"
                type="datetime-local"
                value={form.validTo}
                onChange={(event) =>
                  setForm((current) => ({ ...current, validTo: event.target.value }))
                }
              />
            </div>
          </section>

          <section className="space-y-2">
            <Label>Valid days</Label>
            <div className="flex flex-wrap gap-3">
              {WEEKDAYS.map((day) => (
                <label key={day.value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={validDays.includes(day.value)}
                    onCheckedChange={() => toggleDay(day.value)}
                  />
                  <span>{day.label}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="grid gap-4">
            <div className="space-y-2">
              <Label>Tags</Label>
              <MultiSelect
                options={tagOptions}
                value={form.tags}
                onChange={(next) =>
                  setForm((current) => ({ ...current, tags: next }))
                }
                placeholder="No tag options available. Configure under Globals → Tags."
              />
              <p className="text-xs text-muted-foreground">
                Tags are managed in <span className="font-medium text-foreground">Globals → Tags</span>.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="audience">Audience (comma separated)</Label>
              <Input
                id="audience"
                value={form.audience}
                onChange={(event) =>
                  setForm((current) => ({ ...current, audience: event.target.value }))
                }
                placeholder="Kids, Family"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(event) =>
                  setForm((current) => ({ ...current, city: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Ticket types</Label>
              <MultiSelect
                options={ticketTypeOptions}
                value={form.ticketTypes}
                onChange={(next) =>
                  setForm((current) => ({ ...current, ticketTypes: next }))
                }
                placeholder="Select applicable ticket types"
              />
              <p className="text-xs text-muted-foreground">
                Managed under <span className="font-medium text-foreground">Globals → Ticket types</span>. Leave empty to allow all.
              </p>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <ToggleField
              label="Auto expire"
              description="Automatically mark deal as expired when end date passes."
              checked={form.autoExpire}
              onCheckedChange={(checked) =>
                setForm((current) => ({ ...current, autoExpire: checked }))
              }
            />
            <ToggleField
              label="Send reminders"
              description="Queue reminder emails when users haven't redeemed."
              checked={form.sendReminders}
              onCheckedChange={(checked) =>
                setForm((current) => ({ ...current, sendReminders: checked }))
              }
            />
          </section>

          <DialogFooter>
            <Button
              type="submit"
              disabled={!canSubmit || submitting}
              className="rounded-xl"
            >
              {submitting ? "Creating…" : "Create deal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  required,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  min?: number;
  max?: number;
  step?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        min={min}
        max={max}
        step={step}
        required={required}
      />
    </div>
  );
}

function ToggleField({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between rounded-xl border border-border/70 bg-muted/40 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}
