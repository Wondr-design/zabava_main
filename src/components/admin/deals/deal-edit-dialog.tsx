"use client";

import { useEffect, useMemo, useState, useCallback, useRef, type ReactNode } from "react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { MultiSelect } from "@/components/ui/multi-select";
import { getCsrfToken } from "@/lib/web/csrf";
import { useGlobalValues } from "@/hooks/use-global-values";
import type { GlobalValueRecord } from "@/lib/data/global-values";
import type { DealType, FlashDealStatus } from "@/lib/data/flash-deals";
import { cn } from "@/lib/utils";

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

const STATUS_OPTIONS: Array<{
  value: FlashDealStatus;
  label: string;
  description: string;
  tone: string;
}> = [
  {
    value: "draft",
    label: "Draft",
    description: "Hidden from customers until you promote it to scheduled or live.",
    tone: "bg-slate-100 text-slate-800 border-slate-200",
  },
  {
    value: "scheduled",
    label: "Scheduled",
    description: "Visible starting from the configured window, great for teasers.",
    tone: "bg-sky-100 text-sky-800 border-sky-200",
  },
  {
    value: "live",
    label: "Live",
    description: "Published and redeemable immediately.",
    tone: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  {
    value: "paused",
    label: "Paused",
    description: "Temporarily hidden without losing metrics or configuration.",
    tone: "bg-amber-100 text-amber-800 border-amber-200",
  },
  {
    value: "expired",
    label: "Expired",
    description: "Locked for historical reporting only.",
    tone: "bg-rose-100 text-rose-800 border-rose-200",
  },
];

const DEAL_TYPE_OPTIONS: Array<{ value: DealType; label: string; blurb: string }> = [
  {
    value: "flash",
    label: "Flash deal",
    blurb: "Short-lived campaign with tight redemption window.",
  },
  {
    value: "weekly_promo",
    label: "Weekly promo",
    blurb: "Recurring highlight that rotates on a weekly cadence.",
  },
  {
    value: "group",
    label: "Group deal",
    blurb: "Best for ad-hoc concierge groups and corporate bookings.",
  },
];

export interface DealEditDialogDeal {
  id: string;
  partnerId: string;
  partnerName: string | null;
  dealType: DealType;
  status: FlashDealStatus;
  slug: string | null;
  title: string;
  description: string | null;
  discountPercent: number;
  minVisitors: number;
  commissionPercent: number;
  priceOverrideCzk: number | null;
  bonusPointsOverride: number | null;
  qrValiditySeconds: number;
  usageLimit: number | null;
  usageLimitDaily: number | null;
  validFrom: string | null;
  validTo: string | null;
  validDays: number[] | null;
  tags: string[];
  audience: string[];
  ticketTypes: string[];
  city: string | null;
  autoExpire: boolean;
  sendReminders: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DealEditDialogProps {
  deal: DealEditDialogDeal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => Promise<void> | void;
  initialTicketTypes?: GlobalValueRecord[];
}

interface DealEditFormState {
  title: string;
  slug: string;
  description: string;
  status: FlashDealStatus;
  dealType: DealType;
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
  ticketTypes: string[];
  city: string;
  autoExpire: boolean;
  sendReminders: boolean;
}

const EMPTY_FORM: DealEditFormState = {
  title: "",
  slug: "",
  description: "",
  status: "draft",
  dealType: "flash",
  discountPercent: "10",
  minVisitors: "1",
  commissionPercent: "20",
  priceOverrideCzk: "",
  bonusPointsOverride: "",
  qrValidityDays: String(DEFAULT_QR_VALIDITY_DAYS),
  usageLimit: "",
  usageLimitDaily: "",
  validFrom: "",
  validTo: "",
  tags: [],
  audience: "",
  ticketTypes: [],
  city: "",
  autoExpire: true,
  sendReminders: false,
};

function toInputDateTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function fromInputDateTime(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function DealEditDialog({
  deal,
  open,
  onOpenChange,
  onUpdated,
  initialTicketTypes,
}: DealEditDialogProps) {
  const [form, setForm] = useState<DealEditFormState>(EMPTY_FORM);
  const [validDays, setValidDays] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const lastSnapshotRef = useRef<{ id: string; updatedAt: string } | null>(null);
  const initializedForOpenRef = useRef(false);

  useEffect(() => {
    if (!open || !deal) {
      initializedForOpenRef.current = false;
      if (!open) setSubmitting(false);
      return;
    }

    const last = lastSnapshotRef.current;
    const shouldInitialize =
      !initializedForOpenRef.current ||
      !last ||
      last.id !== deal.id ||
      last.updatedAt !== deal.updatedAt;

    if (!shouldInitialize) {
      return;
    }

    setForm({
      title: deal.title,
      slug: deal.slug ?? "",
      description: deal.description ?? "",
      status: deal.status,
      dealType: deal.dealType,
      discountPercent: String(deal.discountPercent),
      minVisitors: String(deal.minVisitors),
      commissionPercent: String(deal.commissionPercent),
      priceOverrideCzk:
        deal.priceOverrideCzk !== null ? String(deal.priceOverrideCzk) : "",
      bonusPointsOverride:
        deal.bonusPointsOverride !== null ? String(deal.bonusPointsOverride) : "",
      qrValidityDays: String(
        Math.max(
          1,
          Math.round(
            (deal.qrValiditySeconds || DEFAULT_QR_VALIDITY_DAYS * 24 * 60 * 60) /
              (24 * 60 * 60),
          ),
        ),
      ),
      usageLimit: deal.usageLimit !== null ? String(deal.usageLimit) : "",
      usageLimitDaily:
        deal.usageLimitDaily !== null ? String(deal.usageLimitDaily) : "",
      validFrom: toInputDateTime(deal.validFrom),
      validTo: toInputDateTime(deal.validTo),
      tags: [...(deal.tags ?? [])],
      audience: deal.audience.join(", "),
      ticketTypes: [...(deal.ticketTypes ?? [])],
      city: deal.city ?? "",
      autoExpire: deal.autoExpire,
      sendReminders: deal.sendReminders,
    });
    setValidDays(deal.validDays ?? []);
    lastSnapshotRef.current = { id: deal.id, updatedAt: deal.updatedAt };
    initializedForOpenRef.current = true;
  }, [deal, open]);

  const toggleDay = useCallback((value: number) => {
    setValidDays((current) =>
      current.includes(value)
        ? current.filter((day) => day !== value)
        : [...current, value].sort((a, b) => a - b),
    );
  }, []);

  const { values: ticketTypeValues } = useGlobalValues("ticket_type", {
    includeInactive: false,
    initialValues: initialTicketTypes?.filter((item) => item.isActive),
  });
  const { values: tagValues } = useGlobalValues("tag", {
    includeInactive: false,
  });

  const ticketTypeOptions = useMemo(
    () =>
      ticketTypeValues
        .filter((item) => item.isActive)
        .map((item) => ({ value: item.key, label: item.label })),
    [ticketTypeValues],
  );
  const tagOptions = useMemo(
    () =>
      tagValues
        .filter((item) => item.isActive)
        .map((item) => ({ value: item.key, label: item.label })),
    [tagValues],
  );

  const canSubmit = Boolean(deal && form.title.trim());

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!deal || !canSubmit || submitting) return;
      setSubmitting(true);
      try {
        const payload: Record<string, unknown> = {};

        payload.title = form.title.trim();
        payload.status = form.status;
        payload.dealType = form.dealType;
        payload.discountPercent = Number(form.discountPercent) || 0;
        payload.minVisitors = Number(form.minVisitors) || 1;
        payload.commissionPercent = Number(form.commissionPercent) || 0;

        const slug = form.slug.trim();
        payload.slug = slug.length ? slug : null;

        const description = form.description.trim();
        payload.description = description.length ? description : null;

        payload.priceOverrideCzk = form.priceOverrideCzk.trim()
          ? Number(form.priceOverrideCzk)
          : null;
        payload.bonusPointsOverride = form.bonusPointsOverride.trim()
          ? Number(form.bonusPointsOverride)
          : null;

        const qrDays = Math.max(
          1,
          Number(form.qrValidityDays) || DEFAULT_QR_VALIDITY_DAYS,
        );
        payload.qrValiditySeconds = qrDays * 24 * 60 * 60;

        payload.usageLimit = form.usageLimit.trim()
          ? Number(form.usageLimit)
          : null;
        payload.usageLimitDaily = form.usageLimitDaily.trim()
          ? Number(form.usageLimitDaily)
          : null;

        payload.validFrom = fromInputDateTime(form.validFrom);
        payload.validTo = fromInputDateTime(form.validTo);
        payload.validDays = validDays.length ? validDays : null;

        payload.tags = form.tags;
        const audience = splitCsv(form.audience);
        payload.audience = audience;
        payload.ticketTypes = form.ticketTypes;
        payload.city = form.city.trim() || null;
        payload.autoExpire = form.autoExpire;
        payload.sendReminders = form.sendReminders;

        const response = await fetch(`/api/admin/deals/${deal.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": getCsrfToken(),
          },
          credentials: "include",
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          let message = `Failed to update deal (HTTP ${response.status})`;
          try {
            const body = (await response.json()) as {
              error?: string;
              message?: string;
              slug?: string | null;
            };
            if (body?.error) {
              if (body.error === "DuplicateSlug" && body.slug) {
                message = `Slug "${body.slug}" is already in use.`;
              } else {
                message = body.error;
              }
            } else if (body?.message) {
              message = body.message;
            }
          } catch {
            /* ignore */
          }
          throw new Error(message);
        }

        toast.success("Deal updated");
        await onUpdated();
        onOpenChange(false);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to update deal.";
        toast.error(message);
      } finally {
        setSubmitting(false);
      }
    },
    [
      canSubmit,
      deal,
      form.audience,
      form.autoExpire,
      form.bonusPointsOverride,
      form.city,
      form.commissionPercent,
      form.dealType,
      form.description,
      form.discountPercent,
      form.minVisitors,
      form.priceOverrideCzk,
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
      onOpenChange,
      onUpdated,
      submitting,
      validDays,
    ],
  );

  const statusMeta =
    useMemo(
      () => STATUS_OPTIONS.find((option) => option.value === form.status),
      [form.status],
    ) ?? STATUS_OPTIONS[0];
  const dealTypeMeta =
    useMemo(
      () => DEAL_TYPE_OPTIONS.find((option) => option.value === form.dealType),
      [form.dealType],
    ) ?? DEAL_TYPE_OPTIONS[0];

  const inputClass =
    "h-11 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";
  const textareaClass =
    "min-h-[120px] rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";
  const selectTriggerClass =
    "h-11 rounded-xl border border-border bg-card text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl border border-border bg-background px-0 py-0 text-foreground shadow-none sm:max-w-3xl">
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="space-y-6 px-6 pt-6">
            <DialogHeader className="text-left space-y-2">
              <DialogTitle className="text-2xl font-semibold tracking-tight text-white">
                Edit deal
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-300">
                Update the configuration for this special or flash deal. Changes take effect
                immediately for new redemptions.
              </DialogDescription>
            </DialogHeader>

            {deal ? (
              <div className="grid gap-4 rounded-2xl border border-border bg-card/80 p-5 text-sm text-muted-foreground sm:grid-cols-3">
                <SummaryBlock label="Partner" value={deal.partnerName ?? deal.partnerId} />
                <SummaryBlock
                  label="Current status"
                  value={statusMeta.label}
                  tone={statusMeta.tone}
                />
                <SummaryBlock
                  label="Last updated"
                  value={formatRelativeTime(deal.updatedAt)}
                />
              </div>
            ) : null}

            <SectionCard
              title="Status & scheduling"
              description="Control visibility and redemption windows."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(value) =>
                      setForm((current) => ({ ...current, status: value as FlashDealStatus }))
                    }
                  >
                    <SelectTrigger className={selectTriggerClass} id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="py-3 outline-none">
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-medium text-foreground">
                              {option.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {option.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Deal type</Label>
                  <Select
                    value={form.dealType}
                    onValueChange={(value) =>
                      setForm((current) => ({ ...current, dealType: value as DealType }))
                    }
                  >
                    <SelectTrigger className={selectTriggerClass} id="deal-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {DEAL_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="py-3">
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-medium text-foreground">
                              {option.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {option.blurb}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="validFrom">Starts at</Label>
                  <Input
                    id="validFrom"
                    type="datetime-local"
                    value={form.validFrom}
                    className={inputClass}
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
                    className={inputClass}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, validTo: event.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Valid days</Label>
                <div className="flex flex-wrap gap-3">
                  {WEEKDAYS.map((day) => (
                    <label
                      key={day.value}
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm"
                    >
                      <Checkbox
                        checked={validDays.includes(day.value)}
                        onCheckedChange={() => toggleDay(day.value)}
                      />
                      <span>{day.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Basics"
              description="What your customers read when discovering this deal."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    className={inputClass}
                    value={form.title}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, title: event.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    className={inputClass}
                    value={form.slug}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, slug: event.target.value }))
                    }
                    placeholder="optional-url-slug"
                  />
                  <p className="text-xs text-slate-400">
                    Leave blank to keep auto-generated URLs.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  className={textareaClass}
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, description: event.target.value }))
                  }
                  rows={4}
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Pricing & limits"
              description="Fine tune the commercial shape of the promotion."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField
                  label="Discount percent"
                  value={form.discountPercent}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, discountPercent: value }))
                  }
                  min={0}
                  max={100}
                  className={inputClass}
                />
                <NumberField
                  label="Minimum visitors"
                  value={form.minVisitors}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, minVisitors: value }))
                  }
                  min={1}
                  className={inputClass}
                />
                <NumberField
                  label="Commission percent"
                  value={form.commissionPercent}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, commissionPercent: value }))
                  }
                  min={0}
                  max={100}
                  className={inputClass}
                />
                <NumberField
                  label="QR validity (days)"
                  value={form.qrValidityDays}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, qrValidityDays: value }))
                  }
                  min={1}
                  className={inputClass}
                />
                <NumberField
                  label="Price override (CZK)"
                  value={form.priceOverrideCzk}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, priceOverrideCzk: value }))
                  }
                  min={0}
                  className={inputClass}
                />
                <NumberField
                  label="Bonus points override"
                  value={form.bonusPointsOverride}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, bonusPointsOverride: value }))
                  }
                  min={0}
                  className={inputClass}
                />
                <NumberField
                  label="Usage limit (total)"
                  value={form.usageLimit}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, usageLimit: value }))
                  }
                  min={0}
                  className={inputClass}
                />
                <NumberField
                  label="Usage limit (daily)"
                  value={form.usageLimitDaily}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, usageLimitDaily: value }))
                  }
                  min={0}
                  className={inputClass}
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Audience & metadata"
              description="Target the right visitors and annotate how the deal is surfaced."
            >
              <div className="space-y-2">
                <Label>Tags</Label>
                <MultiSelect
                  value={form.tags}
                  options={tagOptions}
                  onChange={(next) =>
                    setForm((current) => ({ ...current, tags: next }))
                  }
                  placeholder="Select tags"
                  className="border border-border bg-card"
                />
              </div>
              <div className="space-y-2">
                <Label>Ticket types</Label>
                <MultiSelect
                  value={form.ticketTypes}
                  options={ticketTypeOptions}
                  onChange={(next) =>
                    setForm((current) => ({ ...current, ticketTypes: next }))
                  }
                  placeholder="Select ticket types"
                  className="border border-border bg-card"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="audience">Audience (comma separated)</Label>
                  <Input
                    id="audience"
                    className={inputClass}
                    value={form.audience}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, audience: event.target.value }))
                    }
                    placeholder="Corporate, Families, VIP"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City focus</Label>
                  <Input
                    id="city"
                    className={inputClass}
                    value={form.city}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, city: event.target.value }))
                    }
                    placeholder="Prague"
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Automation"
              description="Automatically retire or remind visitors about their QR codes."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <ToggleField
                  label="Auto-expire on validity end"
                  description="Automatically mark the deal as expired once the validity window ends."
                  checked={form.autoExpire}
                  onCheckedChange={(checked) =>
                    setForm((current) => ({ ...current, autoExpire: checked }))
                  }
                />
                <ToggleField
                  label="Send reminder emails"
                  description="Trigger reminder emails to visitors who have not redeemed their QR yet."
                  checked={form.sendReminders}
                  onCheckedChange={(checked) =>
                    setForm((current) => ({ ...current, sendReminders: checked }))
                  }
                />
              </div>
            </SectionCard>
          </div>

          <div className="sticky bottom-0 mt-4 border-t border-border bg-card/90 px-6 py-4 backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-muted-foreground">
                Status will update to{" "}
                <span className="font-semibold text-foreground">{statusMeta.label}</span>. Deal type:{" "}
                <span className="font-semibold text-foreground">{dealTypeMeta.label}</span>.
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl border-border text-foreground hover:bg-muted"
                  onClick={() => onOpenChange(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                  disabled={!canSubmit || submitting}
                >
                  {submitting ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </div>
          </div>
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
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  className?: string;
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
        className={className}
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
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-card px-4 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-none">
      <header className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function SummaryBlock({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      {tone ? (
        <span className={cn("inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold", tone)}>
          {value}
        </span>
      ) : (
        <p className="text-sm font-semibold text-foreground">{value}</p>
      )}
    </div>
  );
}

function formatRelativeTime(value: string) {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  const diffMs = parsed - Date.now();
  const diffMinutes = Math.round(diffMs / (60 * 1000));
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, "minute");
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 48) {
    return rtf.format(diffHours, "hour");
  }
  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 30) {
    return rtf.format(diffDays, "day");
  }
  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 18) {
    return rtf.format(diffMonths, "month");
  }
  const diffYears = Math.round(diffMonths / 12);
  return rtf.format(diffYears, "year");
}
