"use client";

import type { ChangeEvent, CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  GripVertical,
  MoreHorizontal,
  Plus,
  Trash2,
  UploadCloud,
  Loader2,
} from "lucide-react";
import type { Swiper as SwiperType } from "swiper";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type {
  PartnerCategory,
  PartnerShowcaseDirectory,
  PartnerShowcaseEntry,
  PartnerShowcaseGalleryItem,
  PartnerShowcaseHighlightItem,
  PartnerShowcaseRecord,
} from "@/lib/data/partner-showcase";
import type {
  PartnerMeta,
  PartnerMetaContract,
  PartnerNoteEntry,
  PartnerOpeningHourEntry,
  PartnerTicketAddon,
  PartnerTicketDetail,
} from "@/lib/data/partners";
import type { GlobalValueRecord } from "@/lib/data/global-values";
import { adminApi } from "@/lib/web/api-client";
import { getCsrfToken } from "@/lib/web/csrf";
import { cn } from "@/lib/utils";
import { ensureExternalUrl, formatCategoryLabel } from "@/lib/utils/url";
import { formatCurrencyCZK } from "@/lib/format/currency";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUploadField } from "@/components/admin/media/image-upload-field";
import { FileUploadField } from "@/components/admin/media/file-upload-field";
import { MultiSelect } from "@/components/ui/multi-select";
import { useGlobalValues } from "@/hooks/use-global-values";

type ContentSectionType = "heading" | "paragraph" | "image" | "list";

interface ContentSection {
  id: string;
  type: ContentSectionType;
  title: string;
  value: string;
  subValue?: string;
}

interface OpeningHourDraft {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
}

interface TicketDetailDraft {
  id: string;
  ticketType: string;
  label: string;
  price: string;
  description: string;
  adults: string;
  children: string;
  teens: string;
}

type TicketDetailsPayloadItem = {
  id?: string;
  ticketType?: string;
  label?: string;
  price: number | null;
  description: string;
  inclusions?: {
    adults?: number | null;
    children?: number | null;
    teens?: number | null;
  };
};

interface TicketAddonDraft {
  id: string;
  label: string;
  appliesToTicketType: string;
  guestType: "adult" | "child" | "other" | "";
  price: string;
  description: string;
  maxPerBooking: string;
}

type TicketAddonPayloadItem = {
  id?: string;
  label: string;
  appliesToTicketType?: string | null;
  guestType?: "adult" | "child" | "other" | null;
  price: number | null;
  description: string;
  maxPerBooking?: number | null;
};

interface CollapsibleSectionProps {
  title: string;
  description: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

function SummaryField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
        {label}
      </p>
      <div className="text-sm text-foreground">
        {children}
      </div>
    </div>
  );
}

const SECTION_TYPE_META: Record<
  ContentSectionType,
  { label: string; description: string }
> = {
  heading: {
    label: "Heading",
    description: "",
  },
  paragraph: {
    label: "Paragraph",
    description: "",
  },
  image: {
    label: "Image",
    description: "",
  },
  list: {
    label: "List",
    description: "",
  },
};

const SECTION_TYPE_ORDER: ContentSectionType[] = [
  "heading",
  "paragraph",
  "image",
  "list",
];

function getDefaultSectionTitle(type: ContentSectionType) {
  return SECTION_TYPE_META[type]?.label ?? "Section";
}

const SELECT_ADDON_ANY_TICKET_VALUE = "__addon_any_ticket__";
const SELECT_ADDON_NO_GUEST_VALUE = "__addon_no_guest__";

interface PartnerProfileFormState {
  displayName: string;
  companyName: string;
  businessName: string;
  shortDescription: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  companyIdNumber: string;
  vatRegistered: boolean;
  vatRate: string;
  companyAddressCity: string;
  companyAddressLine: string;
  businessAddressCity: string;
  businessAddressLine: string;
  businessSameAsCompany: boolean;
  website: string;
  googleMapUrl: string;
  googleMapEmbedUrl: string;
  listingTierKey: string;
  contractAttachmentUrl: string;
  logoUrl: string;
  qrAccentColor: string;
  qrBadgeIconUrl: string;
  payments: string[];
  facilities: string[];
  cashCurrencies: string[];
  minAge: string;
  publicTransport: string;
  reservationRequired: boolean;
  hasToilet: boolean;
  wheelchairAccessible: boolean;
}

const PROFILE_FORM_DEFAULT: PartnerProfileFormState = {
  displayName: "",
  companyName: "",
  businessName: "",
  shortDescription: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  companyIdNumber: "",
  vatRegistered: false,
  vatRate: "",
  companyAddressCity: "",
  companyAddressLine: "",
  businessAddressCity: "",
  businessAddressLine: "",
  businessSameAsCompany: true,
  website: "",
  googleMapUrl: "",
  googleMapEmbedUrl: "",
  listingTierKey: "",
  contractAttachmentUrl: "",
  logoUrl: "",
  qrAccentColor: "",
  qrBadgeIconUrl: "",
  payments: [],
  facilities: [],
  cashCurrencies: [],
  minAge: "",
  publicTransport: "",
  reservationRequired: false,
  hasToilet: false,
  wheelchairAccessible: false,
};

interface PartnerPricingFormState {
  monthlyFee: string;
  discountRate: string;
  commissionBasis: PartnerMetaContract["commissionBasis"];
  commissionRateOriginal: string;
  commissionRateDiscounted: string;
  commissionRatesLinked: boolean;
  bonusPointsPerCzk: string;
  listingOnly: boolean;
  maxGuestsPerBooking: string;
}

const PRICING_FORM_DEFAULT: PartnerPricingFormState = {
  monthlyFee: "",
  discountRate: "",
  commissionBasis: "discounted",
  commissionRateOriginal: "",
  commissionRateDiscounted: "",
  commissionRatesLinked: true,
  bonusPointsPerCzk: "",
  listingOnly: false,
  maxGuestsPerBooking: "",
};

function formatNumberInput(value?: number | null, allowZero = false) {
  if (value === null || value === undefined) return "";
  if (!allowZero && value === 0) return "";
  if (Number.isNaN(value)) return "";
  return `${value}`;
}

function parseDecimalInput(value: string) {
  if (!value || !value.trim()) return undefined;
  const normalized = Number(value.replace(",", "."));
  if (!Number.isFinite(normalized)) return undefined;
  return normalized;
}

function parseCurrencyInput(value: string) {
  const numeric = parseDecimalInput(value);
  if (numeric === undefined) return undefined;
  if (numeric < 0) return undefined;
  return Number(numeric.toFixed(2));
}

function parsePercentInput(value: string) {
  const numeric = parseDecimalInput(value);
  if (numeric === undefined) return undefined;
  const clamped = Math.min(100, Math.max(0, numeric));
  return Number(clamped.toFixed(2));
}

function parseIntegerInput(value: string) {
  if (!value || !value.trim()) return undefined;
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) return undefined;
  const rounded = Math.round(normalized);
  if (rounded < 0) return undefined;
  return rounded;
}

function displayCurrencyFromString(raw: string) {
  if (!raw.trim()) return "—";
  const normalized = Number(raw.replace(",", "."));
  if (!Number.isFinite(normalized)) return "—";
  return formatCurrencyCZK(normalized);
}

function displayPercentFromString(raw: string) {
  if (!raw.trim()) return "—";
  const normalized = Number(raw.replace(",", "."));
  if (!Number.isFinite(normalized)) return "—";
  return `${normalized.toFixed(0)}%`;
}

function buildProfileFormFromMeta(
  meta: PartnerMeta | null,
  fallbackPartnerId: string
): PartnerProfileFormState {
  if (!meta) {
    return { ...PROFILE_FORM_DEFAULT, displayName: fallbackPartnerId };
  }
  return {
    displayName: meta.displayName ?? fallbackPartnerId,
    companyName: meta.info.companyName ?? "",
    businessName: meta.info.businessName ?? "",
    shortDescription: meta.info.shortDescription ?? "",
    contactName: meta.info.contactName ?? "",
    contactEmail: meta.info.contactEmail ?? "",
    contactPhone: meta.info.contactPhone ?? "",
    companyIdNumber: meta.info.companyIdNumber ?? "",
    vatRegistered: Boolean(meta.info.vatRegistered),
    vatRate: formatNumberInput(meta.info.vatRate),
    companyAddressCity: meta.info.companyAddress?.city ?? "",
    companyAddressLine: meta.info.companyAddress?.addressLine ?? "",
    businessAddressCity: meta.info.businessAddress?.city ?? "",
    businessAddressLine: meta.info.businessAddress?.addressLine ?? "",
    businessSameAsCompany:
      meta.info.businessAddress?.sameAsCompany ?? true,
    website: meta.info.website ?? "",
    googleMapUrl: meta.info.googleMapUrl ?? "",
    googleMapEmbedUrl: meta.info.googleMapEmbedUrl ?? "",
    listingTierKey: meta.listingTierKey ?? "",
    contractAttachmentUrl: meta.media.contractAttachmentUrl ?? "",
    logoUrl: meta.media.logoUrl ?? "",
    qrAccentColor: meta.media.qrAccentColor ?? "",
    qrBadgeIconUrl: meta.media.qrBadgeIconUrl ?? "",
    payments: [...(meta.info.payments ?? [])],
    facilities: [...(meta.info.facilities ?? [])],
    cashCurrencies:
      meta.info.cashCurrencies && meta.info.cashCurrencies.length > 0
        ? [...meta.info.cashCurrencies]
        : ["czk"],
    minAge: formatNumberInput(meta.info.minAge),
    publicTransport: meta.info.publicTransport ?? "",
    reservationRequired: Boolean(meta.info.reservationRequired),
    hasToilet: Boolean(meta.info.hasToilet),
    wheelchairAccessible: Boolean(meta.info.wheelchairAccessible),
  };
}

function buildPricingFormFromMeta(
  meta: PartnerMeta | null
): PartnerPricingFormState {
  if (!meta) {
    return { ...PRICING_FORM_DEFAULT };
  }
  const commissionRateOriginal =
    typeof meta.contract.commissionRateOriginal === "number"
      ? meta.contract.commissionRateOriginal
      : meta.contract.commissionRate;
  const commissionRateDiscounted =
    typeof meta.contract.commissionRateDiscounted === "number"
      ? meta.contract.commissionRateDiscounted
      : meta.contract.commissionRate;
  const commissionRatesLinked =
    commissionRateOriginal === commissionRateDiscounted;
  return {
    monthlyFee: formatNumberInput(meta.contract.monthlyFee),
    discountRate: formatNumberInput(meta.contract.discountRate),
    commissionBasis: meta.contract.commissionBasis ?? "discounted",
    commissionRateOriginal: formatNumberInput(commissionRateOriginal),
    commissionRateDiscounted: formatNumberInput(commissionRateDiscounted),
    commissionRatesLinked,
    bonusPointsPerCzk: formatNumberInput(meta.contract.bonusPointsPerCzk),
    listingOnly: Boolean(meta.contract.listingOnly),
    maxGuestsPerBooking: formatNumberInput(meta.ticketing.maxGuestsPerBooking, true),
  };
}

function CollapsibleSection({
  title,
  description,
  children,
  defaultOpen = true,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const contentId = useMemo(() => makeId("section-panel"), []);

  const toggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  const measureHeight = useCallback(() => {
    const node = contentRef.current;
    if (!node) return;
    setMeasuredHeight(node.scrollHeight);
  }, []);

  useEffect(() => {
    measureHeight();
  }, [measureHeight, open]);

  useEffect(() => {
    const node = contentRef.current;
    if (!node) return;
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measureHeight);
      return () => window.removeEventListener("resize", measureHeight);
    }
    const observer = new ResizeObserver(() => {
      measureHeight();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [measureHeight]);

  return (
    <Card
      className={cn(
        "border border-slate-200 bg-card shadow-none transition-shadow dark:border-slate-800 dark:bg-slate-900",
        open ? "shadow-none" : "shadow-none",
        "!gap-0 overflow-hidden py-0"
      )}
      data-state={open ? "open" : "closed"}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={contentId}
        className="group flex w-full items-start justify-between gap-4 px-6 py-6 text-left transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span className="flex flex-col gap-1">
          <CardTitle className="text-base font-semibold text-foreground">
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </span>
        <span className="rounded-full border border-transparent p-2 text-muted-foreground transition group-hover:border-slate-200">
          <ChevronDown
            className={cn(
              "size-4 transition-transform duration-200",
              open ? "rotate-180" : "rotate-0"
            )}
          />
        </span>
      </button>
      <div
        className={cn(
          "px-6 transition-[max-height,opacity] duration-300 ease-in-out",
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        )}
        id={contentId}
        style={{
          maxHeight: open ? measuredHeight ?? undefined : 0,
        }}
      >
        <div ref={contentRef}>
          <CardContent className="space-y-6 px-0 pb-6 pt-4">
            {children}
          </CardContent>
        </div>
      </div>
    </Card>
  );
}

interface SortableSectionCardProps {
  section: ContentSection;
  index: number;
  sectionsLength: number;
  onChangeType: (type: ContentSectionType) => void;
  onUpdate: (changes: Partial<ContentSection>) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onDuplicate: (index: number) => void;
  onRemove: (index: number) => void;
  activePartnerId: string;
}

function SortableSectionCard({
  section,
  index,
  sectionsLength,
  onChangeType,
  onUpdate,
  onMove,
  onDuplicate,
  onRemove,
  activePartnerId,
}: SortableSectionCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "max-w-full rounded-xl border border-slate-200 bg-background shadow-none transition hover:shadow-none focus-within:ring-2 focus-within:ring-primary/40 dark:border-slate-700",
        isDragging ? "ring-2 ring-primary/40 shadow-none" : ""
      )}
      {...attributes}
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...listeners}
          className="flex cursor-grab items-center gap-2 rounded-lg border border-transparent px-2 py-1 text-muted-foreground transition hover:border-slate-300 hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:cursor-grabbing"
          aria-label={`Reorder section ${index + 1}`}
        >
          <GripVertical className="size-4" aria-hidden />
          <span className="text-xs font-semibold uppercase tracking-[0.25em]">
            Section {index + 1}
          </span>
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <Input
            value={section.title}
            onChange={(event) => onUpdate({ title: event.target.value })}
            placeholder="Section title"
            className="w-full min-w-0 sm:max-w-xs"
          />
          <Select
            value={section.type}
            onValueChange={(value) => onChangeType(value as ContentSectionType)}
          >
            <SelectTrigger className="h-9 w-full min-w-[140px] justify-between sm:w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {SECTION_TYPE_ORDER.map((type) => (
                <SelectItem key={type} value={type}>
                  {SECTION_TYPE_META[type].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onMove(index, -1)}
            disabled={index === 0}
            aria-label="Move section up"
          >
            <ArrowUp className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onMove(index, 1)}
            disabled={index === sectionsLength - 1}
            aria-label="Move section down"
          >
            <ArrowDown className="size-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground"
                aria-label="More section actions"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuLabel>Quick actions</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => onDuplicate(index)}>
                <Copy className="mr-2 size-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onRemove(index)}>
                <Trash2 className="mr-2 size-4" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="space-y-4 px-4 pb-5 pt-4">
        {section.type === "heading" && (
          <div className="space-y-1">
            <Label>Heading text</Label>
            <Input
              value={section.value}
              onChange={(event) => onUpdate({ value: event.target.value })}
              placeholder="Immersive workshops for every school"
            />
          </div>
        )}
        {section.type === "paragraph" && (
          <div className="space-y-1">
            <Label>Paragraph</Label>
            <Textarea
              value={section.value}
              onChange={(event) => onUpdate({ value: event.target.value })}
              className="min-h-[140px]"
              placeholder="Write the supporting copy for this block."
            />
          </div>
        )}
        {section.type === "list" && (
          <div className="space-y-1">
            <Label>Bullet list (one item per line)</Label>
            <Textarea
              value={section.value}
              onChange={(event) => onUpdate({ value: event.target.value })}
              className="min-h-[140px]"
              placeholder={`Line 1\nLine 2\nLine 3`}
            />
            <p className="text-xs text-muted-foreground">
              Each line becomes a bullet in the published experience.
            </p>
          </div>
        )}
        {section.type === "image" && (
          <div className="grid gap-4 md:grid-cols-2">
            <ImageUploadField
              label="Section image"
              value={section.value}
              onChange={(url) => onUpdate({ value: url })}
              folder={`partners/${activePartnerId}/sections`}
            />
            <div className="space-y-1">
              <Label>Caption (optional)</Label>
              <Input
                value={section.subValue ?? ""}
                onChange={(event) =>
                  onUpdate({
                    subValue: event.target.value,
                  })
                }
                placeholder="Describe the image"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function makeId(prefix = "item") {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function extractMapEmbedUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const iframeMatch = trimmed.match(/<iframe[^>]*src=["']([^"']+)["']/i);
  if (iframeMatch && iframeMatch[1]) {
    return iframeMatch[1];
  }
  return trimmed;
}

function parseTimeToken(value?: string) {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const match = trimmed.match(
    /^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i
  );
  if (!match) return "";
  let hours = Number(match[1]);
  const minutes = match[2];
  const period = match[3]?.toUpperCase();
  if (period === "PM" && hours < 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  if (hours < 0 || hours > 23) return "";
  return `${hours.toString().padStart(2, "0")}:${minutes}`;
}

function formatTimeDisplay(value: string) {
  if (!value) return "";
  const [hourStr, minute] = value.split(":");
  const hours = Number(hourStr);
  if (Number.isNaN(hours)) return "";
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${minute} ${period}`;
}

function formatTimeRange(start: string, end: string) {
  const startLabel = formatTimeDisplay(start);
  const endLabel = formatTimeDisplay(end);
  if (!startLabel || !endLabel) return "";
  return `${startLabel} – ${endLabel}`;
}

function mapGlobalValuesToOptions(
  records: GlobalValueRecord[]
): SelectOption[] {
  return records.map((record) => ({
    value: record.key,
    label: record.label,
    description: record.description ?? undefined,
  }));
}

function buildSelectOptions(
  globals: GlobalValueRecord[],
  selectedValues: string[]
): SelectOption[] {
  const base = mapGlobalValuesToOptions(globals);
  const normalizedSelected = selectedValues
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  const missing = normalizedSelected.filter(
    (value) =>
      !base.some(
        (option) => option.value.toLowerCase() === value.toLowerCase()
      )
  );
  const missingOptions = missing.map((value) => ({
    value,
    label: `${value} (inactive)`,
    description:
      "Currently not defined in Globals. Add it there to manage centrally.",
  }));
  return [...base, ...missingOptions];
}

function parseSections(raw: unknown): ContentSection[] {
  if (!Array.isArray(raw)) return [];
  const sections: ContentSection[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const section = item as Record<string, unknown>;
    const typeValue =
      typeof section.type === "string" ? section.type : "paragraph";
    const value = typeof section.value === "string" ? section.value : "";
    const subValue =
      typeof section.subValue === "string" ? section.subValue : undefined;
    const type: ContentSectionType = [
      "heading",
      "paragraph",
      "image",
      "list",
    ].includes(typeValue)
      ? (typeValue as ContentSectionType)
      : "paragraph";
    sections.push({
      id:
        typeof section.id === "string" && section.id
          ? section.id
          : makeId("section"),
      type,
      title:
        typeof section.title === "string" && section.title.trim()
          ? section.title.trim()
          : getDefaultSectionTitle(type),
      value,
      subValue,
    });
  }
  return sections;
}

function buildOpeningHourDrafts(
  entries?: PartnerOpeningHourEntry[] | null
): OpeningHourDraft[] {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry) => {
      const [startRaw = "", endRaw = ""] = (entry.hours ?? "")
        .split(/–|-/)
        .map((token) => token.trim());
      return {
        id: makeId("hours"),
        day: entry.day ?? "",
        startTime: parseTimeToken(startRaw),
        endTime: parseTimeToken(endRaw),
      };
    })
    .filter((entry) => entry.day || entry.startTime || entry.endTime);
}

function buildTicketDetailDrafts(
  entries?: PartnerTicketDetail[] | null
): TicketDetailDraft[] {
  if (!Array.isArray(entries)) return [];
  return entries.map((entry) => ({
    id: entry.id ?? makeId("ticket-detail"),
    ticketType: entry.ticketType ?? "",
    label: entry.label ?? "",
    price:
      entry.price !== undefined && entry.price !== null
        ? `${entry.price}`
        : "",
    description: entry.description ?? "",
    adults: formatNumberInput(entry.inclusions?.adults),
    children: formatNumberInput(entry.inclusions?.children),
    teens: formatNumberInput(entry.inclusions?.teens),
  }));
}

function buildTicketAddonDrafts(
  entries?: PartnerTicketAddon[] | null
): TicketAddonDraft[] {
  if (!Array.isArray(entries)) return [];
  return entries.map((entry) => ({
    id: entry.id ?? makeId("ticket-addon"),
    label: entry.label ?? "",
    appliesToTicketType: entry.appliesToTicketType ?? "",
    guestType: entry.guestType ?? "",
    price:
      entry.price !== undefined && entry.price !== null
        ? `${entry.price}`
        : "",
    description: entry.description ?? "",
    maxPerBooking: formatNumberInput(entry.maxPerBooking),
  }));
}

function toDraft(entry?: PartnerShowcaseEntry) {
  const metadata = { ...(entry?.metadata ?? {}) } as Record<string, unknown>;
  if ("contentSections" in metadata) {
    delete metadata.contentSections;
  }
  if ("selectedFormId" in metadata) {
    delete metadata.selectedFormId;
  }
  return {
    title: entry?.title ?? entry?.name ?? "",
    subtitle: entry?.subtitle ?? "",
    description: entry?.description ?? "",
    heroImageUrl: entry?.heroImageUrl ?? "",
    formUrl: entry?.formUrl ?? "",
    ctaPrimaryLabel: entry?.ctaPrimaryLabel ?? "Generate QR",
    ctaSecondaryLabel: entry?.ctaSecondaryLabel ?? "More details",
    gallery:
      entry?.gallery?.map((item) => ({
        id: item.id || makeId("gallery"),
        imageUrl: item.imageUrl,
        caption: item.caption,
      })) ?? [],
    highlights:
      entry?.highlights?.map((item) => ({
        id: item.id || makeId("highlight"),
        title: item.title,
        description: item.description,
        icon: item.icon ?? "",
      })) ?? [],
    metadata,
  };
}

function toOptionalUrl(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function buildEntryFromResponse(
  meta: PartnerMeta,
  showcase: PartnerShowcaseRecord,
  categories: string[]
): PartnerShowcaseEntry {
  const metadata = { ...(showcase.metadata ?? {}) } as Record<string, unknown>;
  const selectedFormId =
    typeof metadata.selectedFormId === "string"
      ? (metadata.selectedFormId as string)
      : null;
  return {
    partnerId: meta.partnerId,
    name: meta.displayName ?? meta.partnerId,
    status: meta.status,
    categories,
    title: showcase.title,
    subtitle: showcase.subtitle,
    description: showcase.description,
    heroImageUrl: showcase.heroImageUrl,
    gallery: showcase.gallery,
    highlights: showcase.highlights,
    isFeatured: showcase.isFeatured,
    ctaPrimaryLabel: showcase.ctaPrimaryLabel,
    ctaPrimaryUrl: showcase.ctaPrimaryUrl,
    ctaSecondaryLabel: showcase.ctaSecondaryLabel,
    ctaSecondaryUrl: showcase.ctaSecondaryUrl,
    ageMin: showcase.ageMin,
    ageMax: showcase.ageMax,
    formUrl: showcase.formUrl,
    detailUrl: showcase.detailUrl,
    selectedFormId,
    metadata,
    info: meta.info,
    contract: meta.contract,
    ticketing: meta.ticketing,
    ticketDetails: meta.ticketing.ticketDetails,
    ticketAddons: meta.ticketing.addons ?? [],
    media: meta.media,
    bonusProgramEnabled: Boolean(meta.bonusProgramEnabled),
    listingTierKey: meta.listingTierKey ?? null,
  };
}

interface PartnerDetailEditorProps {
  directory: PartnerShowcaseDirectory;
  partnerEntries: PartnerShowcaseEntry[];
  activePartnerId: string;
  standardPartnerOptions: Array<{ value: string; label: string }>;
  onBack: () => void;
  onPartnerUpdated?: (payload: {
    entry: PartnerShowcaseEntry;
    meta: PartnerMeta;
  }) => void;
}

export function PartnerDetailEditor({
  directory,
  partnerEntries,
  activePartnerId,
  standardPartnerOptions,
  onBack,
  onPartnerUpdated,
}: PartnerDetailEditorProps) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string | undefined>(
    undefined
  );
  const [draft, setDraft] = useState(() => toDraft());
  const [profileForm, setProfileForm] =
    useState<PartnerProfileFormState>(() => ({ ...PROFILE_FORM_DEFAULT }));
  const [pricingForm, setPricingForm] =
    useState<PartnerPricingFormState>(() => ({ ...PRICING_FORM_DEFAULT }));
  const [ticketTypesForm, setTicketTypesForm] = useState<string[]>([]);
  const [familyRule, setFamilyRule] = useState("");
  const [ticketDetailsForm, setTicketDetailsForm] = useState<
    TicketDetailDraft[]
  >([]);
  const [maxGuestsPerBooking, setMaxGuestsPerBooking] = useState("");
  const [ticketAddonsForm, setTicketAddonsForm] = useState<TicketAddonDraft[]>(
    []
  );
  const [openingHours, setOpeningHours] = useState<OpeningHourDraft[]>([]);
  const [videoUrls, setVideoUrls] = useState<string[]>([]);
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [bonusProgramEnabled, setBonusProgramEnabled] = useState(false);
  const [notes, setNotes] = useState<PartnerNoteEntry[]>([]);
  const [newNoteBody, setNewNoteBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [sections, setSections] = useState<ContentSection[]>([]);
  const [status, setStatus] = useState<PartnerMeta["status"]>("active");
  const [partnerType, setPartnerType] =
    useState<PartnerMeta["type"]>("standard");
  const [transportationType, setTransportationType] = useState<
    "taxi" | "bus" | "limousine"
  >("taxi");
  const [transportParentIds, setTransportParentIds] = useState<string[]>([]);
  const [isFeatured, setIsFeatured] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );
  const gallerySwiperRef = useRef<SwiperType | null>(null);
  const galleryUploadInputRef = useRef<HTMLInputElement | null>(null);
  const [bulkUploadingGallery, setBulkUploadingGallery] = useState(false);

  const csrfToken = useMemo(() => getCsrfToken(), []);
  const categories: PartnerCategory[] = directory.categories;
  const categoryOptions = categories.map((category) => ({
    value: category.id,
    label: formatCategoryLabel(category.name),
  }));
  const formOptions =
    directory.forms?.map((form) => ({
      value: form.id,
      label: form.name,
      status: form.status,
    })) ?? [];
  const NO_FORM_VALUE = "__none__";
  const NO_LISTING_TIER_VALUE = "__listing_none__";
  const formsById = useMemo(() => {
    const map = new Map<
      string,
      { name: string; status: string; slug: string }
    >();
    directory.forms?.forEach((form) => {
      map.set(form.id, {
        name: form.name,
        status: form.status,
        slug: form.slug,
      });
    });
    return map;
  }, [directory.forms]);
  const {
    values: listingTierValues,
    loading: listingTierLoading,
  } = useGlobalValues("listing_tier", { includeInactive: false });
  const { values: paymentGlobals } = useGlobalValues("accepted_payment", {
    includeInactive: false,
  });
  const { values: cashCurrencyGlobals } = useGlobalValues("cash_currency", {
    includeInactive: false,
  });
  const { values: facilityGlobals } = useGlobalValues("facility", {
    includeInactive: false,
  });
  const {
    values: ticketTypeValues,
    loading: ticketTypeLoading,
  } = useGlobalValues("ticket_type", { includeInactive: false });
  const listingTierLabel = useMemo(() => {
    if (!profileForm.listingTierKey) return null;
    return (
      listingTierValues.find(
        (tier) => tier.key === profileForm.listingTierKey
      )?.label ?? profileForm.listingTierKey
    );
  }, [listingTierValues, profileForm.listingTierKey]);
  const paymentOptions = useMemo(
    () => buildSelectOptions(paymentGlobals, profileForm.payments),
    [paymentGlobals, profileForm.payments]
  );
  const cashCurrencyOptions = useMemo(
    () => buildSelectOptions(cashCurrencyGlobals, profileForm.cashCurrencies),
    [cashCurrencyGlobals, profileForm.cashCurrencies]
  );
  const facilityOptions = useMemo(
    () => buildSelectOptions(facilityGlobals, profileForm.facilities),
    [facilityGlobals, profileForm.facilities]
  );
  const ticketTypeOptions = useMemo(
    () =>
      ticketTypeValues.map((type) => ({
        value: type.key,
        label: type.label,
        description: type.description ?? undefined,
      })),
    [ticketTypeValues]
  );
  const selectedForm = selectedFormId
    ? formsById.get(selectedFormId) ?? null
    : null;
  const selectedFormMissing = Boolean(selectedFormId && !selectedForm);
  const isLive = status === "active";
  const sectionIds = useMemo(
    () => sections.map((section) => section.id),
    [sections]
  );
  const activeParentIds = useMemo(() => {
    if (partnerType === "transport") return transportParentIds;
    return [] as string[];
  }, [partnerType, transportParentIds]);

  const handleParentSelectionChange = useCallback(
    (nextIds: string[]) => {
      if (partnerType === "transport") {
        setTransportParentIds(nextIds);
      }
    },
    [partnerType]
  );

  const addOpeningHour = useCallback(() => {
    setOpeningHours((prev) => [
      ...prev,
      { id: makeId("hours"), day: "Monday", startTime: "", endTime: "" },
    ]);
  }, []);

  const updateOpeningHour = useCallback(
    (id: string, key: keyof Omit<OpeningHourDraft, "id">, value: string) => {
      setOpeningHours((prev) =>
        prev.map((entry) =>
          entry.id === id ? { ...entry, [key]: value } : entry
        )
      );
    },
    []
  );

  const removeOpeningHour = useCallback((id: string) => {
    setOpeningHours((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  const addTicketDetail = useCallback(() => {
    setTicketDetailsForm((prev) => [
      ...prev,
      {
        id: makeId("ticket-detail"),
        ticketType: "",
        label: "",
        price: "",
        description: "",
        adults: "",
        children: "",
        teens: "",
      },
    ]);
  }, []);

  const updateTicketDetail = useCallback(
    (
      id: string,
      key: keyof Omit<TicketDetailDraft, "id">,
      value: string
    ) => {
      setTicketDetailsForm((prev) =>
        prev.map((detail) =>
          detail.id === id ? { ...detail, [key]: value } : detail
        )
      );
    },
    []
  );

  const removeTicketDetail = useCallback((id: string) => {
    setTicketDetailsForm((prev) => prev.filter((detail) => detail.id !== id));
  }, []);

  const addTicketAddon = useCallback(() => {
    setTicketAddonsForm((prev) => [
      ...prev,
      {
        id: makeId("ticket-addon"),
        label: "",
        appliesToTicketType: "",
        guestType: "",
        price: "",
        description: "",
        maxPerBooking: "",
      },
    ]);
  }, []);

  const updateTicketAddon = useCallback(
    (
      id: string,
      key: keyof Omit<TicketAddonDraft, "id">,
      value: string
    ) => {
      setTicketAddonsForm((prev) =>
        prev.map((addon) =>
          addon.id === id ? { ...addon, [key]: value } : addon
        )
      );
    },
    []
  );

  const removeTicketAddon = useCallback((id: string) => {
    setTicketAddonsForm((prev) => prev.filter((addon) => addon.id !== id));
  }, []);

  const addVideoUrl = useCallback(() => {
    const url = newVideoUrl.trim();
    if (!url) return;
    setVideoUrls((prev) => {
      if (prev.includes(url)) return prev;
      return [...prev, url];
    });
    setNewVideoUrl("");
  }, [newVideoUrl]);

  const removeVideoUrl = useCallback((url: string) => {
    setVideoUrls((prev) => prev.filter((item) => item !== url));
  }, []);

  const toggleCategory = useCallback((categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  }, []);

  const handleAddNote = useCallback(() => {
    const body = newNoteBody.trim();
    if (!body) return;
    const entry: PartnerNoteEntry = {
      id: makeId("note"),
      body,
      createdAt: new Date().toISOString(),
    };
    setNotes((prev) => [entry, ...prev]);
    setNewNoteBody("");
  }, [newNoteBody]);

  const handleRemoveNote = useCallback((noteId: string) => {
    setNotes((prev) => prev.filter((note) => note.id !== noteId));
  }, []);

  const handleProfileInputChange = useCallback(
    (key: keyof PartnerProfileFormState) =>
      (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const value = event.target.value;
        setProfileForm((prev) => {
          const next = { ...prev, [key]: value };
          if (key === "companyAddressCity" && prev.businessSameAsCompany) {
            next.businessAddressCity = value;
          }
          if (key === "companyAddressLine" && prev.businessSameAsCompany) {
            next.businessAddressLine = value;
          }
          return next;
        });
      },
    []
  );

  const handleMapEmbedInputChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const value = extractMapEmbedUrl(event.target.value);
      setProfileForm((prev) => ({
        ...prev,
        googleMapEmbedUrl: value,
      }));
    },
    []
  );

  const handlePricingInputChange = useCallback(
    (key: keyof PartnerPricingFormState) =>
      (event: ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        setPricingForm((prev) => ({ ...prev, [key]: value }));
      },
    []
  );

  const handleCommissionRateInputChange = useCallback(
    (key: "commissionRateOriginal" | "commissionRateDiscounted") =>
      (event: ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        setPricingForm((prev) => {
          if (prev.commissionRatesLinked) {
            return {
              ...prev,
              commissionRateOriginal: value,
              commissionRateDiscounted: value,
            };
          }
          return { ...prev, [key]: value };
        });
      },
    []
  );

  const handleCommissionLinkToggle = useCallback((checked: boolean) => {
    setPricingForm((prev) => {
      if (checked) {
        const fallbackValue =
          prev.commissionRateOriginal || prev.commissionRateDiscounted || "";
        return {
          ...prev,
          commissionRatesLinked: true,
          commissionRateOriginal: fallbackValue,
          commissionRateDiscounted: fallbackValue,
        };
      }
      return { ...prev, commissionRatesLinked: false };
    });
  }, []);

  const activeEntry = useMemo(
    () => partnerEntries.find((item) => item.partnerId === activePartnerId),
    [activePartnerId, partnerEntries]
  );
  const monthlyFeeDisplay = useMemo(
    () => displayCurrencyFromString(pricingForm.monthlyFee),
    [pricingForm.monthlyFee]
  );
  const discountDisplay = useMemo(
    () => displayPercentFromString(pricingForm.discountRate),
    [pricingForm.discountRate]
  );
  const discountRateNumeric = useMemo(() => {
    const parsed = parsePercentInput(pricingForm.discountRate);
    return parsed === undefined ? 0 : parsed;
  }, [pricingForm.discountRate]);
  const previewDiscountedPrice = useCallback(
    (priceInput: string) => {
      const basePrice = parseCurrencyInput(priceInput);
      if (basePrice === undefined) return "—";
      if (!discountRateNumeric || discountRateNumeric <= 0) {
        return formatCurrencyCZK(basePrice);
      }
      const discounted = Number(
        (basePrice * (1 - discountRateNumeric / 100)).toFixed(2)
      );
      return formatCurrencyCZK(discounted);
    },
    [discountRateNumeric]
  );
  const commissionOriginalDisplay = useMemo(
    () => displayPercentFromString(pricingForm.commissionRateOriginal),
    [pricingForm.commissionRateOriginal]
  );
  const commissionDiscountDisplay = useMemo(
    () => displayPercentFromString(pricingForm.commissionRateDiscounted),
    [pricingForm.commissionRateDiscounted]
  );
  const companyAddressDisplay = useMemo(() => {
    const parts = [
      profileForm.companyAddressLine.trim(),
      profileForm.companyAddressCity.trim(),
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "—";
  }, [profileForm.companyAddressCity, profileForm.companyAddressLine]);
  const businessAddressDisplay = useMemo(() => {
    const parts = [
      profileForm.businessAddressLine.trim(),
      profileForm.businessAddressCity.trim(),
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "—";
  }, [profileForm.businessAddressCity, profileForm.businessAddressLine]);

  const loadMeta = useCallback(async () => {
    setLoadingMeta(true);
    try {
      const response = (await adminApi.partnerGet(activePartnerId, {
        headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined,
      })) as {
        item?: PartnerMeta | null;
        relationships?: Array<{
          parentPartnerId: string;
          relationship: "transport";
        }>;
      };
      const item = response?.item ?? null;
      const relationships = Array.isArray(response?.relationships)
        ? response.relationships
        : [];
      const transportParents = relationships
        .filter((rel) => rel.relationship === "transport")
        .map((rel) => rel.parentPartnerId);
      setTransportParentIds(transportParents);
      if (item) {
        setStatus(item.status);
        setPartnerType(item.type ?? "standard");
        setTransportationType(
          item.transportationType ?? (item.type === "transport" ? "taxi" : "taxi")
        );
        setProfileForm(buildProfileFormFromMeta(item, activePartnerId));
        setPricingForm(buildPricingFormFromMeta(item));
        setTicketTypesForm(item.ticketing?.ticketTypes ?? []);
        setFamilyRule(item.ticketing?.familyRule ?? "");
        setTicketDetailsForm(
          buildTicketDetailDrafts(item.ticketing?.ticketDetails ?? [])
        );
        setTicketAddonsForm(
          buildTicketAddonDrafts(item.ticketing?.addons ?? [])
        );
        setOpeningHours(buildOpeningHourDrafts(item.info?.openingHours ?? []));
        setVideoUrls(item.media?.videoUrls ?? []);
        setBonusProgramEnabled(Boolean(item.bonusProgramEnabled));
        setNotes(item.notes ?? []);
        setNewNoteBody("");
        setMaxGuestsPerBooking(
          formatNumberInput(item.ticketing?.maxGuestsPerBooking, true)
        );
      } else {
        setStatus("active");
        setPartnerType("standard");
        setTransportationType("taxi");
        setTransportParentIds([]);
        setProfileForm(buildProfileFormFromMeta(null, activePartnerId));
        setPricingForm(buildPricingFormFromMeta(null));
        setTicketTypesForm([]);
        setFamilyRule("");
        setTicketDetailsForm([]);
        setTicketAddonsForm([]);
        setOpeningHours([]);
        setVideoUrls([]);
        setBonusProgramEnabled(false);
        setNotes([]);
        setNewNoteBody("");
        setMaxGuestsPerBooking("");
      }
    } catch (error) {
      console.error("Failed to load partner meta", error);
      toast.error("Unable to load partner profile details.");
      setStatus("active");
      setPartnerType("standard");
      setTransportationType("taxi");
      setTransportParentIds([]);
      setProfileForm(buildProfileFormFromMeta(null, activePartnerId));
      setPricingForm(buildPricingFormFromMeta(null));
      setTicketTypesForm([]);
      setFamilyRule("");
      setTicketDetailsForm([]);
      setTicketAddonsForm([]);
      setOpeningHours([]);
      setVideoUrls([]);
      setBonusProgramEnabled(false);
      setNotes([]);
      setNewNoteBody("");
    } finally {
      setLoadingMeta(false);
    }
  }, [activePartnerId, csrfToken]);

  useEffect(() => {
    const entry = activeEntry;
    const nextDraft = toDraft(entry);
    const entryMetadata = (entry?.metadata ?? {}) as Record<string, unknown>;
    const entrySections = parseSections(entryMetadata.contentSections);
    const entrySelectedFormId =
      typeof entryMetadata.selectedFormId === "string"
        ? (entryMetadata.selectedFormId as string)
        : entry?.selectedFormId ?? undefined;
    setDraft(nextDraft);
    setIsFeatured(Boolean(entry?.isFeatured));
    setSelectedCategories(entry?.categories ?? []);
    setSelectedFormId(entrySelectedFormId);
    setSections(entrySections);
  }, [activeEntry]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    if (selectedFormId) {
      setDraft((prev) => ({
        ...prev,
        formUrl: "",
      }));
    }
  }, [selectedFormId]);

  function updateDraft<K extends keyof ReturnType<typeof toDraft>>(
    key: K,
    value: ReturnType<typeof toDraft>[K]
  ) {
    setDraft((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function updateGalleryItem(
    index: number,
    key: keyof PartnerShowcaseGalleryItem,
    value: string
  ) {
    setDraft((prev) => {
      const next = [...prev.gallery];
      const item = { ...next[index], [key]: value };
      next[index] = item;
      return { ...prev, gallery: next };
    });
  }

  function removeGalleryItem(index: number) {
    setDraft((prev) => {
      const next = prev.gallery.filter((_, idx) => idx !== index);
      return { ...prev, gallery: next };
    });
  }

  function addGalleryItem() {
    setDraft((prev) => ({
      ...prev,
      gallery: [
        ...prev.gallery,
        { id: makeId("gallery"), imageUrl: "", caption: "" },
      ],
    }));
  }

  const triggerGalleryUpload = useCallback(() => {
    galleryUploadInputRef.current?.click();
  }, []);

  const handleGalleryUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      if (files.length === 0) return;
      setBulkUploadingGallery(true);
      const successfulUploads: { id: string; imageUrl: string }[] = [];
      try {
        for (const file of files) {
          try {
            const result = await adminApi.uploadImage(
              file,
              {
                folder: `partners/${activePartnerId}/gallery`,
                contentType: file.type,
              },
              {}
            );
            if (result?.url) {
              successfulUploads.push({
                id: makeId("gallery"),
                imageUrl: result.url,
              });
            } else {
              toast.warning(
                `Upload finished for ${file.name}, but no URL was returned.`
              );
            }
          } catch (error) {
            toast.error(
              error instanceof Error
                ? `Failed to upload ${file.name}: ${error.message}`
                : `Failed to upload ${file.name}.`
            );
          }
        }

        if (successfulUploads.length > 0) {
          setDraft((prev) => ({
            ...prev,
            gallery: [
              ...prev.gallery,
              ...successfulUploads.map((item) => ({
                id: item.id,
                imageUrl: item.imageUrl,
                caption: "",
              })),
            ],
          }));
          setTimeout(() => {
            gallerySwiperRef.current?.update?.();
          }, 0);
          toast.success(
            successfulUploads.length === 1
              ? "Added 1 image to the gallery."
              : `Added ${successfulUploads.length} images to the gallery.`
          );
        }
      } finally {
        setBulkUploadingGallery(false);
        event.target.value = "";
      }
    },
    [activePartnerId]
  );

  function updateHighlight(
    index: number,
    key: keyof PartnerShowcaseHighlightItem,
    value: string
  ) {
    setDraft((prev) => {
      const next = [...prev.highlights];
      const item = { ...next[index], [key]: value };
      next[index] = item;
      return { ...prev, highlights: next };
    });
  }

  function removeHighlight(index: number) {
    setDraft((prev) => {
      const next = prev.highlights.filter((_, idx) => idx !== index);
      return { ...prev, highlights: next };
    });
  }

  function addHighlight() {
    setDraft((prev) => ({
      ...prev,
      highlights: [
        ...prev.highlights,
        { id: makeId("highlight"), title: "", description: "", icon: "" },
      ],
    }));
  }

  function addSection(type: ContentSectionType) {
    setSections((prev) => [
      ...prev,
      {
        id: makeId("section"),
        type,
        title: getDefaultSectionTitle(type),
        value: "",
        subValue: type === "image" ? "" : undefined,
      },
    ]);
  }

  function updateSection(index: number, changes: Partial<ContentSection>) {
    setSections((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...changes };
      return next;
    });
  }

  function changeSectionType(index: number, nextType: ContentSectionType) {
    setSections((prev) => {
      const next = [...prev];
      const current = next[index];
      if (!current || current.type === nextType) return prev;
      const nextValue =
        nextType === "image"
          ? ""
          : current.type === "image"
          ? current.subValue ?? ""
          : current.value;
      const nextSubValue = nextType === "image" ? "" : undefined;
      const defaultTitle = getDefaultSectionTitle(nextType);
      const currentDefaultTitle = getDefaultSectionTitle(current.type);
      next[index] = {
        ...current,
        type: nextType,
        title:
          current.title === currentDefaultTitle ? defaultTitle : current.title,
        value: nextValue,
        subValue: nextSubValue,
      };
      return next;
    });
  }

  function duplicateSection(index: number) {
    setSections((prev) => {
      const current = prev[index];
      if (!current) return prev;
      const copy: ContentSection = {
        ...current,
        id: makeId("section"),
      };
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
  }

  function removeSection(index: number) {
    setSections((prev) => prev.filter((_, idx) => idx !== index));
  }

  function moveSection(index: number, direction: -1 | 1) {
    setSections((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setSections((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return items;
        return arrayMove(items, oldIndex, newIndex);
      });
    },
    [setSections]
  );

  async function handleSave() {
    const currentPartnerId = activePartnerId;
    const normalizedDisplayName = profileForm.displayName.trim();
    if (!normalizedDisplayName) {
      toast.error("Display name is required.");
      return;
    }
    if (partnerType !== "standard" && activeParentIds.length === 0) {
      toast.error(
        "Select at least one linked standard partner for transportation profiles."
      );
      return;
    }
    const listingTierKey =
      profileForm.listingTierKey.trim().length > 0
        ? profileForm.listingTierKey.trim()
        : null;
    const vatRateValue = parsePercentInput(profileForm.vatRate);
    const monthlyFeeValue = parseCurrencyInput(pricingForm.monthlyFee);
    const discountRateValue = parsePercentInput(pricingForm.discountRate);
    const bonusPointsValue = parseDecimalInput(pricingForm.bonusPointsPerCzk);
    const commissionOriginalValue = parsePercentInput(
      pricingForm.commissionRateOriginal
    );
    const commissionDiscountValue = parsePercentInput(
      pricingForm.commissionRateDiscounted
    );
    const minAgeValue = parseIntegerInput(profileForm.minAge);
    const maxGuestsPerBookingValue = parseIntegerInput(maxGuestsPerBooking);
    const contractPayload: Record<string, unknown> = {
      commissionBasis: pricingForm.commissionBasis,
    };
    if (commissionOriginalValue !== undefined) {
      contractPayload.commissionRateOriginal = commissionOriginalValue;
    }
    if (commissionDiscountValue !== undefined) {
      contractPayload.commissionRateDiscounted = commissionDiscountValue;
    }
    const derivedCommissionRate =
      pricingForm.commissionBasis === "original"
        ? commissionOriginalValue ?? commissionDiscountValue
        : commissionDiscountValue ?? commissionOriginalValue;
    if (derivedCommissionRate !== undefined) {
      contractPayload.commissionRate = derivedCommissionRate;
    }
    if (monthlyFeeValue !== undefined) {
      contractPayload.monthlyFee = monthlyFeeValue;
    }
    if (discountRateValue !== undefined) {
      contractPayload.discountRate = discountRateValue;
    }
    if (bonusPointsValue !== undefined) {
      contractPayload.bonusPointsPerCzk = Math.max(0, bonusPointsValue);
    }
    contractPayload.listingOnly = Boolean(pricingForm.listingOnly);
    const sanitizedCashCurrencies = Array.from(
      new Set(
        (profileForm.cashCurrencies ?? []).map((currency) =>
          currency.trim()
        )
      )
    ).filter((currency) => currency.length > 0);
    const openingHoursPayload = openingHours
      .map((entry) => {
        const day = entry.day.trim();
        const hours = formatTimeRange(entry.startTime, entry.endTime);
        if (!day || !hours) return null;
        return { day, hours };
      })
      .filter(
        (entry): entry is { day: string; hours: string } => Boolean(entry)
      );
    const sanitizedVideoUrls = Array.from(
      new Set(videoUrls.map((url) => url.trim()).filter((url) => url.length > 0))
    );
    const normalizedWebsite = ensureExternalUrl(profileForm.website);
    const normalizedGoogleMapUrl = ensureExternalUrl(profileForm.googleMapUrl);
    const bookingCap =
      typeof maxGuestsPerBookingValue === "number" && maxGuestsPerBookingValue > 0
        ? maxGuestsPerBookingValue
        : null;
    const ticketDetailsPayload: TicketDetailsPayloadItem[] = ticketDetailsForm
      .map<TicketDetailsPayloadItem | null>((detail) => {
        const description = detail.description.trim();
        const label = detail.label.trim();
        const ticketType = detail.ticketType.trim();
        const priceValue = parseCurrencyInput(detail.price);
        const adultsValue = parseIntegerInput(detail.adults);
        const childrenValue = parseIntegerInput(detail.children);
        const teensValue = parseIntegerInput(detail.teens);
        if (!description && !label && priceValue === undefined && !ticketType) {
          return null;
        }
        return {
          id: detail.id,
          ticketType: ticketType || undefined,
          label: label || undefined,
          price: priceValue ?? null,
          description,
          inclusions:
            adultsValue !== undefined ||
            childrenValue !== undefined ||
            teensValue !== undefined
              ? {
                  adults: adultsValue ?? null,
                  children: childrenValue ?? null,
                  teens: teensValue ?? null,
                }
              : undefined,
        };
      })
      .filter(
        (detail): detail is TicketDetailsPayloadItem => Boolean(detail)
      );
    const ticketAddonsPayload: TicketAddonPayloadItem[] = ticketAddonsForm
      .map<TicketAddonPayloadItem | null>((addon) => {
        const label = addon.label.trim();
        if (!label) return null;
        const appliesToTicketType = addon.appliesToTicketType.trim();
        const guestType =
          addon.guestType === "adult" ||
          addon.guestType === "child" ||
          addon.guestType === "other"
            ? addon.guestType
            : undefined;
        const priceValue = parseCurrencyInput(addon.price);
        const description = addon.description.trim();
        const maxPerBookingValue = parseIntegerInput(addon.maxPerBooking);
        return {
          id: addon.id,
          label,
          appliesToTicketType: appliesToTicketType || undefined,
          guestType,
          price: priceValue ?? null,
          description,
          maxPerBooking: maxPerBookingValue ?? null,
        };
      })
      .filter(
        (addon): addon is TicketAddonPayloadItem => Boolean(addon)
      );
    const infoPayload = {
      contactName: profileForm.contactName.trim(),
      contactEmail: profileForm.contactEmail.trim(),
      contactPhone: profileForm.contactPhone.trim(),
      companyName: profileForm.companyName.trim(),
      businessName: profileForm.businessName.trim(),
      shortDescription: profileForm.shortDescription.trim(),
      companyIdNumber: profileForm.companyIdNumber.trim(),
      website: normalizedWebsite,
      googleMapUrl: normalizedGoogleMapUrl,
      googleMapEmbedUrl: profileForm.googleMapEmbedUrl.trim(),
      vatRegistered: profileForm.vatRegistered,
      vatRate:
        profileForm.vatRegistered && vatRateValue !== undefined
          ? vatRateValue
          : profileForm.vatRegistered
          ? 0
          : 0,
      companyAddress: {
        city: profileForm.companyAddressCity.trim(),
        addressLine: profileForm.companyAddressLine.trim(),
        sameAsCompany: false,
      },
      businessAddress: profileForm.businessSameAsCompany
        ? {
            city: profileForm.companyAddressCity.trim(),
            addressLine: profileForm.companyAddressLine.trim(),
            sameAsCompany: true,
          }
        : {
            city: profileForm.businessAddressCity.trim(),
            addressLine: profileForm.businessAddressLine.trim(),
            sameAsCompany: false,
          },
      payments: [...profileForm.payments],
      facilities: [...profileForm.facilities],
      cashCurrencies: sanitizedCashCurrencies,
      minAge: minAgeValue,
      openingHours: openingHoursPayload,
      publicTransport: profileForm.publicTransport.trim(),
      reservationRequired: profileForm.reservationRequired,
      hasToilet: profileForm.hasToilet,
      wheelchairAccessible: profileForm.wheelchairAccessible,
    };
    setSaving(true);
    try {
      const sanitizedSections = sections
        .map((section) => ({
          id: section.id || makeId("section"),
          type: section.type,
          title: section.title?.trim() || getDefaultSectionTitle(section.type),
          value: section.value.trim(),
          subValue: section.subValue?.trim() || undefined,
        }))
        .filter((section) => section.value.length > 0);
      const metadata: Record<string, unknown> = {
        ...(draft.metadata ?? {}),
      };
      if ("formUrl" in metadata) {
        delete metadata.formUrl;
      }
      if (sanitizedSections.length > 0) {
        metadata.contentSections = sanitizedSections;
      } else if ("contentSections" in metadata) {
        delete metadata.contentSections;
      }
      if (selectedFormId) {
        metadata.selectedFormId = selectedFormId;
      } else if ("selectedFormId" in metadata) {
        delete metadata.selectedFormId;
      }
      const uniqueCategoryIds = Array.from(new Set(selectedCategories));
      const parentPartnersPayload =
        partnerType === "standard"
          ? { transport: [] as string[] }
          : { transport: transportParentIds };
      const ticketTypesPayload = Array.from(
        new Set(
          ticketTypesForm.map((value) => value.trim()).filter((value) => value)
        )
      );
      const showcasePayload = {
        title: draft.title.trim() || undefined,
        subtitle: draft.subtitle.trim() || undefined,
        description: draft.description.trim() || undefined,
        isFeatured,
        heroImageUrl: toOptionalUrl(draft.heroImageUrl),
        formUrl: selectedFormId ? undefined : toOptionalUrl(draft.formUrl),
        ctaPrimaryLabel: draft.ctaPrimaryLabel.trim() || undefined,
        ctaSecondaryLabel: draft.ctaSecondaryLabel.trim() || undefined,
        gallery: draft.gallery
          .filter((item) => item.imageUrl.trim().length > 0)
          .map((item) => ({
            id: item.id || makeId("gallery"),
            imageUrl: item.imageUrl.trim(),
            caption: item.caption?.trim() || undefined,
          })),
        highlights: draft.highlights
          .filter((item) => item.title.trim().length > 0)
          .map((item) => ({
            id: item.id || makeId("highlight"),
            title: item.title.trim(),
            description: item.description?.trim() || undefined,
            icon: item.icon?.trim() || undefined,
          })),
        metadata,
      };
      const mediaPayload: Record<string, unknown> = {
        contractAttachmentUrl: profileForm.contractAttachmentUrl.trim(),
        videoUrls: sanitizedVideoUrls,
      };
      const logoUrlValue = toOptionalUrl(profileForm.logoUrl);
      if (logoUrlValue) {
        mediaPayload.logoUrl = logoUrlValue;
      }
      mediaPayload.qrAccentColor =
        profileForm.qrAccentColor.trim().length > 0
          ? profileForm.qrAccentColor.trim()
          : null;
      const qrBadgeIconUrlValue = toOptionalUrl(profileForm.qrBadgeIconUrl);
      if (qrBadgeIconUrlValue) {
        mediaPayload.qrBadgeIconUrl = qrBadgeIconUrlValue;
      } else {
        mediaPayload.qrBadgeIconUrl = null;
      }

      const headers = csrfToken ? { "x-csrf-token": csrfToken } : undefined;

      const [showcaseResponse, metaResponse] = await Promise.all([
        adminApi.showcasePartnerUpdate(
          currentPartnerId,
          {
            categoryIds: uniqueCategoryIds,
            showcase: showcasePayload,
          },
          { headers }
        ),
        adminApi.partnerUpdate(
          currentPartnerId,
          {
            displayName: normalizedDisplayName,
            status,
            type: partnerType,
            transportationType:
              partnerType === "transport" ? transportationType : null,
            listingTierKey,
            info: infoPayload,
            contract: contractPayload,
            ticketing: {
              ticketTypes: ticketTypesPayload,
              familyRule: familyRule.trim() || undefined,
              ticketDetails: ticketDetailsPayload,
              addons: ticketAddonsPayload,
              maxGuestsPerBooking: bookingCap ?? null,
            },
            media: mediaPayload,
            notes,
            bonusProgramEnabled,
            parentPartners: parentPartnersPayload,
          },
          { headers }
        ),
      ]);

      const showcaseResult = (
        showcaseResponse as {
          item?: { showcase: PartnerShowcaseRecord; categoryIds: string[] };
        }
      )?.item;
      const updatedMeta = metaResponse as PartnerMeta;

      if (updatedMeta) {
        setStatus(updatedMeta.status);
        setPartnerType(updatedMeta.type);
        setTransportationType(
          updatedMeta.transportationType ?? "taxi"
        );
        setProfileForm(buildProfileFormFromMeta(updatedMeta, activePartnerId));
        setPricingForm(buildPricingFormFromMeta(updatedMeta));
        setNotes(updatedMeta.notes ?? []);
        setTicketTypesForm(updatedMeta.ticketing?.ticketTypes ?? []);
        setFamilyRule(updatedMeta.ticketing?.familyRule ?? "");
        setTicketDetailsForm(
          buildTicketDetailDrafts(updatedMeta.ticketing?.ticketDetails ?? [])
        );
        setTicketAddonsForm(
          buildTicketAddonDrafts(updatedMeta.ticketing?.addons ?? [])
        );
        setOpeningHours(
          buildOpeningHourDrafts(updatedMeta.info?.openingHours ?? [])
        );
        setVideoUrls(updatedMeta.media?.videoUrls ?? []);
        setBonusProgramEnabled(Boolean(updatedMeta.bonusProgramEnabled));
      }

      if (showcaseResult && updatedMeta) {
        const nextEntry = buildEntryFromResponse(
          updatedMeta,
          showcaseResult.showcase,
          showcaseResult.categoryIds
        );
        setDraft(toDraft(nextEntry));
        setSelectedCategories(showcaseResult.categoryIds);
        setIsFeatured(Boolean(nextEntry.isFeatured));
        const nextSections = parseSections(
          (nextEntry.metadata as Record<string, unknown>)?.contentSections
        );
        setSections(nextSections);
        const nextFormId =
          typeof (nextEntry.metadata as Record<string, unknown>)
            ?.selectedFormId === "string"
            ? ((nextEntry.metadata as Record<string, unknown>)
                .selectedFormId as string)
            : undefined;
        setSelectedFormId(nextFormId);
        onPartnerUpdated?.({ entry: nextEntry, meta: updatedMeta });
      }

      toast.success("Partner settings saved.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save partner."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={onBack}>
          ← Back to partners
        </Button>
        <div className="text-sm text-muted-foreground">
          {activeEntry?.name ?? activePartnerId}
        </div>
      </div>

      <Card className="border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <CardContent className="grid gap-6 px-6 py-5 lg:grid-cols-3">
          <div className="space-y-4">
            <SummaryField label="Display name">
              <p className="text-lg font-semibold text-foreground">
                {profileForm.displayName || activePartnerId}
              </p>
            </SummaryField>
            <SummaryField label="Listing tier">
              {listingTierLoading ? (
                "Loading…"
              ) : listingTierLabel ? (
                <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                  {listingTierLabel}
                </span>
              ) : (
                "—"
              )}
            </SummaryField>
            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryField label="Website">
                {profileForm.website ? (
                  <a
                    href={ensureExternalUrl(profileForm.website)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {profileForm.website}
                  </a>
                ) : (
                  "—"
                )}
              </SummaryField>
              <SummaryField label="Map link">
                {profileForm.googleMapUrl ? (
                  <a
                    href={ensureExternalUrl(profileForm.googleMapUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    View map
                  </a>
                ) : (
                  "—"
                )}
              </SummaryField>
            </div>
          </div>

          <div className="space-y-4">
            <SummaryField label="Contact">
              <div className="space-y-1">
                <p>{profileForm.contactName || "Not set"}</p>
                <p className="text-xs text-muted-foreground">
                  {profileForm.contactEmail ? (
                    <a
                      href={`mailto:${profileForm.contactEmail}`}
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      {profileForm.contactEmail}
                    </a>
                  ) : (
                    "No email"
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {profileForm.contactPhone || "No phone"}
                </p>
              </div>
            </SummaryField>
            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryField label="Company address">
                {companyAddressDisplay}
              </SummaryField>
              <SummaryField label="Business address">
                {businessAddressDisplay}
              </SummaryField>
            </div>
          </div>

          <div className="space-y-4">
            <SummaryField label="Listing monthly fee">
              {monthlyFeeDisplay}
            </SummaryField>
            <SummaryField label="Discount">
              {discountDisplay}
            </SummaryField>
            <SummaryField label="Ticket catalog">
              {ticketDetailsForm.length} ticket types · {ticketAddonsForm.length} add-ons
            </SummaryField>
            <SummaryField label="Commission">
              <div className="space-y-1">
                <div>Original price: {commissionOriginalDisplay}</div>
                <div>Discounted price: {commissionDiscountDisplay}</div>
              </div>
            </SummaryField>
          </div>
        </CardContent>
      </Card>

      <CollapsibleSection
        title="Site & commission"
        description="Control whether the partner is visible on the marketing site and tune the revenue share."
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-lg border border-slate-200/70 p-3 md:flex-row md:items-center md:justify-between dark:border-slate-700/70">
            <div className="space-y-1">
              <Label>Site</Label>
              <p className="text-xs text-muted-foreground">
                Hidden partners remain accessible in admin but disappear from
                the public directory.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                {isLive ? "Live" : "Offline"}
              </span>
              <Switch
                checked={isLive}
                disabled={loadingMeta || saving}
                onCheckedChange={(checked) =>
                  setStatus(checked ? "active" : "hidden")
                }
              />
            </div>
          </div>
          <div className="flex flex-col gap-3 rounded-lg border border-slate-200/70 p-3 md:flex-row md:items-center md:justify-between dark:border-slate-700/70">
            <div className="space-y-1">
              <Label>Featured on homepage</Label>
              <p className="text-xs text-muted-foreground">
                Featured partners appear in the homepage carousel and curated
                highlights.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                {isFeatured ? "Featured" : "Standard"}
              </span>
              <Switch
                checked={isFeatured}
                disabled={loadingMeta || saving}
                onCheckedChange={setIsFeatured}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Partner type</Label>
              <Select
                value={partnerType}
                onValueChange={(value) =>
                  setPartnerType(value as PartnerMeta["type"])
                }
                disabled={loadingMeta || saving}
              >
                <SelectTrigger className="w-full justify-between">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard partner</SelectItem>
                <SelectItem value="transport">
                  Transportation partner
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Transportation partners are linked to standard partners for
              booking flows.
            </p>
          </div>
          {partnerType === "transport" ? (
            <div className="space-y-2">
              <Label>Transportation type</Label>
              <Select
                value={transportationType}
                onValueChange={(value) =>
                  setTransportationType(
                    value as "taxi" | "bus" | "limousine",
                  )
                }
                disabled={loadingMeta || saving}
              >
                <SelectTrigger className="w-full justify-between">
                  <SelectValue placeholder="Select transport service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="taxi">Taxi</SelectItem>
                  <SelectItem value="limousine">Limousine</SelectItem>
                  <SelectItem value="bus">Bus</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                This label appears anywhere the transport partner is shown.
              </p>
            </div>
          ) : null}
            <div className="space-y-2">
              <Label>Partner status</Label>
              <Select
                value={status}
                onValueChange={(value) =>
                  setStatus(value as PartnerMeta["status"])
                }
                disabled={loadingMeta || saving}
              >
                <SelectTrigger className="w-full justify-between">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active (Live)</SelectItem>
                  <SelectItem value="pending">Pending review</SelectItem>
                  <SelectItem value="hidden">Hidden (Offline)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Pending status keeps the partner hidden until you flip them
                live.
              </p>
            </div>
          </div>
          {partnerType !== "standard" ? (
            <div className="space-y-2 rounded-lg border border-slate-200/70 p-3 dark:border-slate-700/70">
              <div className="space-y-1">
                <Label>Linked standard partners</Label>
                <p className="text-xs text-muted-foreground">
                  Choose the primary partners that should reveal this transport
                  option inside their booking forms.
                </p>
              </div>
              <MultiSelect
                options={standardPartnerOptions}
                value={activeParentIds}
                onChange={handleParentSelectionChange}
                placeholder="Create a standard partner first to link transport providers."
                className="rounded-xl border border-slate-200/70 bg-white p-3 text-sm dark:border-slate-700/70 dark:bg-slate-900"
              />
            </div>
          ) : null}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Ticketing & descriptions"
        description="Select ticket types and add partner-specific pricing notes."
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Ticket types</Label>
            <MultiSelect
              options={ticketTypeOptions}
              value={ticketTypesForm}
              onChange={(next) => setTicketTypesForm(next)}
              placeholder={
                ticketTypeLoading
                  ? "Loading ticket types…"
                  : "Define ticket types under Admin → Globals if nothing appears."
              }
            />
            <p className="text-xs text-muted-foreground">
              Ticket types power filtering and fallbacks on the public site.
            </p>
          </div>
          <div className="space-y-1">
            <Label>Family / group rule</Label>
            <Input
              value={familyRule}
              onChange={(event) => setFamilyRule(event.target.value)}
              placeholder="Example: 2 adults + 2 children"
            />
          </div>
          <div className="space-y-1">
            <Label>Max guests per booking (all tickets)</Label>
            <Input
              type="number"
              min={0}
              value={maxGuestsPerBooking}
              onChange={(event) => setMaxGuestsPerBooking(event.target.value)}
              placeholder="Leave blank for no cap"
            />
            <p className="text-xs text-muted-foreground">
              Caps total ticket quantities per booking across all ticket types.
            </p>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>Ticket bundles</Label>
                <p className="text-xs text-muted-foreground">
                  Define each ticket type&apos;s base price and what it includes.
                  Customer-facing discounts are applied automatically.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addTicketDetail}
              >
                <Plus className="mr-2 size-4" />
                Add ticket
              </Button>
            </div>
            {ticketDetailsForm.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground dark:border-slate-700">
                No ticket bundles yet. Add at least one to publish pricing.
              </div>
            ) : (
              <div className="space-y-4">
                {ticketDetailsForm.map((detail) => {
                  const discountedPreview = previewDiscountedPrice(detail.price);
                  return (
                    <div
                      key={detail.id}
                      className="space-y-3 rounded-2xl border border-slate-200/70 bg-card/40 p-4 shadow-sm dark:border-slate-700/70"
                    >
                      <div className="grid gap-3 md:grid-cols-[1fr,1fr,auto]">
                        <div className="space-y-1">
                          <Label>Ticket type</Label>
                        <Select
                          value={detail.ticketType || ""}
                          onValueChange={(value) =>
                            updateTicketDetail(
                              detail.id,
                              "ticketType",
                              value
                            )
                          }
                        >
                          <SelectTrigger className="justify-between">
                            <SelectValue placeholder="Select ticket type" />
                          </SelectTrigger>
                          <SelectContent>
                            {ticketTypeOptions.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>Custom label</Label>
                          <Input
                            value={detail.label}
                            onChange={(event) =>
                              updateTicketDetail(
                                detail.id,
                                "label",
                                event.target.value
                              )
                            }
                            placeholder="Family ticket"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Base price (CZK)</Label>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={detail.price}
                            onChange={(event) =>
                              updateTicketDetail(
                                detail.id,
                                "price",
                                event.target.value
                              )
                            }
                            placeholder="799"
                          />
                        </div>
                      </div>
                      {(() => {
                        // Find global ticket type to check for sub-options
                        const globalTicketType = detail.ticketType
                          ? ticketTypeValues.find(
                              (t) => t.key === detail.ticketType
                            )
                          : null;
                        const metadataSubOptions =
                          globalTicketType?.metadata?.subOptions;
                        const hasSubOptions =
                          globalTicketType &&
                          Array.isArray(metadataSubOptions) &&
                          metadataSubOptions.length > 0;
                        const subOptions =
                          hasSubOptions && metadataSubOptions
                            ? (metadataSubOptions as string[]).map(
                                (subKey) => {
                                  const subType = ticketTypeValues.find(
                                    (t) => t.key === subKey
                                  );
                                  return {
                                    key: subKey,
                                    label: subType?.label ?? subKey,
                                  };
                                }
                              )
                            : [];
                        const showSubOptionFields =
                          hasSubOptions && subOptions.length > 0;

                        // Map sub-option keys to inclusion field names
                        const fieldMap: Record<
                          string,
                          "adults" | "children" | "teens"
                        > = {
                          adult: "adults",
                          child: "children",
                          children: "children",
                          teen: "teens",
                          teens: "teens",
                        };

                        let inclusionFields: React.ReactElement;
                        if (showSubOptionFields) {
                          inclusionFields = (
                            <>
                              {subOptions.map((subOption) => {
                                const fieldName =
                                  fieldMap[subOption.key.toLowerCase()] ?? "adults";
                                return (
                                  <div key={subOption.key} className="space-y-1">
                                    <Label>{subOption.label} included</Label>
                                    <Input
                                      type="number"
                                      min={0}
                                      step={1}
                                      value={
                                        detail[fieldName as keyof TicketDetailDraft] || ""
                                      }
                                      onChange={(event) =>
                                        updateTicketDetail(
                                          detail.id,
                                          fieldName as keyof Omit<
                                            TicketDetailDraft,
                                            "id"
                                          >,
                                          event.target.value
                                        )
                                      }
                                      placeholder="0"
                                    />
                                  </div>
                                );
                              })}
                            </>
                          );
                        } else if (detail.ticketType) {
                          inclusionFields = (
                            <>
                              <div className="space-y-1">
                                <Label>
                                  {globalTicketType?.label ?? detail.ticketType}{" "}
                                  included
                                </Label>
                                <Input
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={detail.adults}
                                  onChange={(event) =>
                                    updateTicketDetail(
                                      detail.id,
                                      "adults",
                                      event.target.value
                                    )
                                  }
                                  placeholder="Number included"
                                />
                              </div>
                            </>
                          );
                        } else {
                          inclusionFields = (
                            <>
                              <div className="space-y-1">
                                <Label>Adults included</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  value={detail.adults}
                                  onChange={(event) =>
                                    updateTicketDetail(
                                      detail.id,
                                      "adults",
                                      event.target.value
                                    )
                                  }
                                  placeholder="2"
                                />
                              </div>
                            </>
                          );
                        }

                        return (
                          <div className="grid gap-3 md:grid-cols-3">
                            {inclusionFields}
                          </div>
                        );
                      })()}
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1">
                          <Label>Description</Label>
                          <Textarea
                            value={detail.description}
                            onChange={(event) =>
                              updateTicketDetail(
                                detail.id,
                                "description",
                                event.target.value
                              )
                            }
                            placeholder="Explain inclusions, age rules, or other perks."
                            className="min-h-[100px]"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Discounted preview</Label>
                          <div className="rounded-2xl border border-slate-200/60 bg-white/60 px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-100">
                            {discountedPreview}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {discountRateNumeric > 0
                              ? `Applies ${discountRateNumeric.toFixed(
                                  0
                                )}% customer discount automatically.`
                              : "No discount set yet."}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                        <p>
                          Customers always see the discounted preview once the
                          partner discount is configured.
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => removeTicketDetail(detail.id)}
                        >
                          <Trash2 className="mr-2 size-4" />
                          Remove ticket
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>Add-ons</Label>
                <p className="text-xs text-muted-foreground">
                  Optional extras (e.g., extra child) guests can add to any
                  bundle.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addTicketAddon}
              >
                <Plus className="mr-2 size-4" />
                Add add-on
              </Button>
            </div>
            {ticketAddonsForm.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground dark:border-slate-700">
                No add-ons configured.
              </div>
            ) : (
              <div className="space-y-4">
                {ticketAddonsForm.map((addon) => {
                  const discountedPreview = previewDiscountedPrice(addon.price);
                  return (
                    <div
                      key={addon.id}
                      className="space-y-3 rounded-2xl border border-slate-200/70 bg-card/40 p-4 shadow-sm dark:border-slate-700/70"
                    >
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1">
                          <Label>Label</Label>
                          <Input
                            value={addon.label}
                            onChange={(event) =>
                              updateTicketAddon(
                                addon.id,
                                "label",
                                event.target.value
                              )
                            }
                            placeholder="Extra child"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Base price (CZK)</Label>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={addon.price}
                            onChange={(event) =>
                              updateTicketAddon(
                                addon.id,
                                "price",
                                event.target.value
                              )
                            }
                            placeholder="199"
                          />
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="space-y-1">
                          <Label>Applies to ticket type</Label>
                          <Select
                            value={
                              addon.appliesToTicketType ||
                              SELECT_ADDON_ANY_TICKET_VALUE
                            }
                            onValueChange={(value) =>
                              updateTicketAddon(
                                addon.id,
                                "appliesToTicketType",
                                value === SELECT_ADDON_ANY_TICKET_VALUE
                                  ? ""
                                  : value
                              )
                            }
                          >
                            <SelectTrigger className="justify-between">
                              <SelectValue placeholder="Any ticket" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={SELECT_ADDON_ANY_TICKET_VALUE}>
                                Any ticket bundle
                              </SelectItem>
                              {ticketTypeOptions.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>Guest type</Label>
                          <Select
                            value={addon.guestType || SELECT_ADDON_NO_GUEST_VALUE}
                            onValueChange={(value) =>
                              updateTicketAddon(
                                addon.id,
                                "guestType",
                                value === SELECT_ADDON_NO_GUEST_VALUE ? "" : value
                              )
                            }
                          >
                            <SelectTrigger className="justify-between">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={SELECT_ADDON_NO_GUEST_VALUE}>
                                Not specified
                              </SelectItem>
                              <SelectItem value="adult">Adult</SelectItem>
                              <SelectItem value="child">Child</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>Max per booking</Label>
                          <Input
                            type="number"
                            min={0}
                            value={addon.maxPerBooking}
                            onChange={(event) =>
                              updateTicketAddon(
                                addon.id,
                                "maxPerBooking",
                                event.target.value
                              )
                            }
                            placeholder="Unlimited"
                          />
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1">
                          <Label>Description</Label>
                          <Textarea
                            value={addon.description}
                            onChange={(event) =>
                              updateTicketAddon(
                                addon.id,
                                "description",
                                event.target.value
                              )
                            }
                            placeholder="Explain when this add-on is useful."
                            className="min-h-[80px]"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Discounted preview</Label>
                          <div className="rounded-2xl border border-slate-200/60 bg-white/60 px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-100">
                            {discountedPreview}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {discountRateNumeric > 0
                              ? `Matches the ${discountRateNumeric.toFixed(
                                  0
                                )}% customer discount.`
                              : "No discount set yet."}
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => removeTicketAddon(addon.id)}
                        >
                          <Trash2 className="mr-2 size-4" />
                          Remove add-on
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Guest requirements & facilities"
        description="Set visitor limits, working hours, accessibility, and transport info displayed on the public site."
      >
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Minimum age</Label>
              <Input
                type="number"
                min={0}
                value={profileForm.minAge}
                onChange={handleProfileInputChange("minAge")}
                placeholder="All ages"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Label>Working hours</Label>
                <p className="text-xs text-muted-foreground">
                  These rows appear on the public detail page. Leave blank to hide.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addOpeningHour}
              >
                <Plus className="mr-2 size-4" />
                Add day
              </Button>
            </div>
            {openingHours.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground dark:border-slate-700">
                No working hours added yet.
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {openingHours.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-2xl border border-slate-200/70 bg-card/40 p-4 dark:border-slate-700/70"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <Select
                        value={entry.day}
                        onValueChange={(value) =>
                          updateOpeningHour(entry.id, "day", value)
                        }
                      >
                        <SelectTrigger className="h-9 w-fit min-w-[140px] justify-between">
                          <SelectValue placeholder="Day" />
                        </SelectTrigger>
                        <SelectContent>
                          {DAY_OPTIONS.map((day) => (
                            <SelectItem key={day} value={day}>
                              {day}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => removeOpeningHour(entry.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/70 bg-background/80 p-3 dark:border-slate-800/70">
                      <div className="flex flex-1 items-center gap-2">
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">
                          Opens
                        </span>
                        <Select
                          value={entry.startTime}
                          onValueChange={(value) =>
                            updateOpeningHour(entry.id, "startTime", value)
                          }
                        >
                          <SelectTrigger className="h-8 w-[120px] justify-between">
                            <SelectValue placeholder="Start" />
                          </SelectTrigger>
                          <SelectContent>
                            {TIME_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-1 items-center gap-2">
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">
                          Closes
                        </span>
                        <Select
                          value={entry.endTime}
                          onValueChange={(value) =>
                            updateOpeningHour(entry.id, "endTime", value)
                          }
                        >
                          <SelectTrigger className="h-8 w-[120px] justify-between">
                            <SelectValue placeholder="End" />
                          </SelectTrigger>
                          <SelectContent>
                            {TIME_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {entry.startTime && entry.endTime
                        ? formatTimeRange(entry.startTime, entry.endTime)
                        : "Select start and end times to publish this row."}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Public transport guidance</Label>
              <Textarea
                value={profileForm.publicTransport}
                onChange={handleProfileInputChange("publicTransport")}
                placeholder="Tram 9 to Hlavni nadrazi, walk 3 minutes to the entrance."
                className="min-h-[120px]"
              />
            </div>
            <div className="space-y-4 rounded-2xl border border-slate-200/70 p-4 dark:border-slate-700/70">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Reservation required?
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Toggle on if guests must book in advance.
                  </p>
                </div>
                <Switch
                  checked={profileForm.reservationRequired}
                  onCheckedChange={(checked) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      reservationRequired: checked,
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    WC available on site
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Displayed inside the facilities list.
                  </p>
                </div>
                <Switch
                  checked={profileForm.hasToilet}
                  onCheckedChange={(checked) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      hasToilet: checked,
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Wheelchair accessible
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Indicates accessibility accommodations.
                  </p>
                </div>
                <Switch
                  checked={profileForm.wheelchairAccessible}
                  onCheckedChange={(checked) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      wheelchairAccessible: checked,
                    }))
                  }
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Facilities</Label>
            <MultiSelect
              options={facilityOptions}
              value={profileForm.facilities}
              onChange={(next) =>
                setProfileForm((prev) => ({ ...prev, facilities: next }))
              }
              placeholder="Select facilities available on site."
            />
            <p className="text-xs text-muted-foreground">
              Manage facility options under Admin → Globals → Facilities.
            </p>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Payments & booking"
        description="Accepted payment methods and currencies appear on the partner page."
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Accepted payments</Label>
            <MultiSelect
              options={paymentOptions}
              value={profileForm.payments}
              onChange={(next) =>
                setProfileForm((prev) => ({ ...prev, payments: next }))
              }
              placeholder="Define accepted payment methods."
            />
            <p className="text-xs text-muted-foreground">
              Configure payment methods in Admin → Globals → Accepted payments.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Cash currencies</Label>
            <MultiSelect
              options={cashCurrencyOptions}
              value={profileForm.cashCurrencies}
              onChange={(next) =>
                setProfileForm((prev) => ({ ...prev, cashCurrencies: next }))
              }
              placeholder="Select which currencies staff accept in person."
            />
            <p className="text-xs text-muted-foreground">
              Manage currencies under Admin → Globals → Cash currencies.
            </p>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Identity & contact"
        description="Company details, listing tier, and the primary points of contact."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-xl border border-slate-200/70 bg-card/30 p-4 dark:border-slate-700/70">
            <div className="grid gap-3">
              <div className="space-y-1">
                <Label>Display name</Label>
                <Input
                  value={profileForm.displayName}
                  onChange={handleProfileInputChange("displayName")}
                  placeholder="Displayed across dashboards and the site"
                  disabled={saving || loadingMeta}
                />
              </div>
              <div className="space-y-1">
                <Label>Company name</Label>
                <Input
                  value={profileForm.companyName}
                  onChange={handleProfileInputChange("companyName")}
                  placeholder="Legal company name"
                  disabled={saving || loadingMeta}
                />
              </div>
              <div className="space-y-1">
                <Label>Business / attraction name</Label>
                <Input
                  value={profileForm.businessName}
                  onChange={handleProfileInputChange("businessName")}
                  placeholder="Customer-facing experience"
                  disabled={saving || loadingMeta}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Monthly listing tier</Label>
              <Select
                value={
                  profileForm.listingTierKey.trim().length > 0
                    ? profileForm.listingTierKey
                    : NO_LISTING_TIER_VALUE
                }
                onValueChange={(value) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    listingTierKey:
                      value === NO_LISTING_TIER_VALUE ? "" : value,
                  }))
                }
                disabled={saving || listingTierLoading}
              >
                <SelectTrigger className="w-full justify-between">
                  <SelectValue placeholder="No tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_LISTING_TIER_VALUE}>
                    No tier
                  </SelectItem>
                  {listingTierValues.map((tier) => (
                    <SelectItem key={tier.id} value={tier.key}>
                      {tier.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Silver partners surface in the top 20 slots, Gold in the top 10,
                and Platinum in the top 5.
              </p>
            </div>
            <div className="space-y-1">
              <Label>Short description</Label>
              <Textarea
                value={profileForm.shortDescription}
                onChange={handleProfileInputChange("shortDescription")}
                rows={3}
                placeholder="1–2 sentences for admin teammates"
                disabled={saving || loadingMeta}
              />
            </div>
          </div>
          <div className="space-y-4 rounded-xl border border-slate-200/70 bg-card/30 p-4 dark:border-slate-700/70">
            <div className="grid gap-3">
              <div className="space-y-1">
                <Label>Contact person</Label>
                <Input
                  value={profileForm.contactName}
                  onChange={handleProfileInputChange("contactName")}
                  placeholder="Full name"
                  disabled={saving || loadingMeta}
                />
              </div>
              <div className="space-y-1">
                <Label>Contact email</Label>
                <Input
                  type="email"
                  value={profileForm.contactEmail}
                  onChange={handleProfileInputChange("contactEmail")}
                  placeholder="name@example.com"
                  disabled={saving || loadingMeta}
                />
              </div>
              <div className="space-y-1">
                <Label>Contact phone</Label>
                <Input
                  value={profileForm.contactPhone}
                  onChange={handleProfileInputChange("contactPhone")}
                  placeholder="+420 123 456 789"
                  disabled={saving || loadingMeta}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Company website</Label>
              <Input
                type="url"
                value={profileForm.website}
                onChange={handleProfileInputChange("website")}
                placeholder="https://example.com"
                disabled={saving || loadingMeta}
              />
            </div>
            <div className="space-y-1">
              <Label>Google Maps link</Label>
              <Input
                type="url"
                value={profileForm.googleMapUrl}
                onChange={handleProfileInputChange("googleMapUrl")}
                placeholder="https://maps.google.com/..."
                disabled={saving || loadingMeta}
              />
            </div>
            <div className="space-y-1">
              <Label>Google Maps embed code or URL</Label>
              <Textarea
                value={profileForm.googleMapEmbedUrl}
                onChange={handleMapEmbedInputChange}
                placeholder='<iframe src="https://www.google.com/maps/embed?..."></iframe>'
                className="min-h-[90px]"
                disabled={saving || loadingMeta}
              />
              <p className="text-xs text-muted-foreground">
                Paste the iframe snippet from Google Maps or the direct embed URL.
                We store only the src attribute.
              </p>
            </div>
            <div className="space-y-1">
              <Label>Company ID number</Label>
              <Input
                value={profileForm.companyIdNumber}
                onChange={handleProfileInputChange("companyIdNumber")}
                placeholder="Identifikační číslo (IČO)"
                disabled={saving || loadingMeta}
              />
            </div>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-xl border border-slate-200/70 bg-card/30 p-4 dark:border-slate-700/70">
            <div className="space-y-3">
              <div>
                <Label>Company address</Label>
                <p className="text-xs text-muted-foreground">
                  Used on invoices and contracts.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  value={profileForm.companyAddressCity}
                  onChange={handleProfileInputChange("companyAddressCity")}
                  placeholder="City"
                  disabled={saving || loadingMeta}
                />
                <Input
                  value={profileForm.companyAddressLine}
                  onChange={handleProfileInputChange("companyAddressLine")}
                  placeholder="Street / full address"
                  disabled={saving || loadingMeta}
                />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label>Business address</Label>
                  <p className="text-xs text-muted-foreground">
                    Where customers should arrive.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Same as company</span>
                  <Switch
                    checked={profileForm.businessSameAsCompany}
                    onCheckedChange={(checked) =>
                      setProfileForm((prev) => ({
                        ...prev,
                        businessSameAsCompany: checked,
                      }))
                    }
                    disabled={saving || loadingMeta}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  value={
                    profileForm.businessSameAsCompany
                      ? profileForm.companyAddressCity
                      : profileForm.businessAddressCity
                  }
                  onChange={handleProfileInputChange("businessAddressCity")}
                  placeholder="City"
                  disabled={
                    profileForm.businessSameAsCompany || saving || loadingMeta
                  }
                />
                <Input
                  value={
                    profileForm.businessSameAsCompany
                      ? profileForm.companyAddressLine
                      : profileForm.businessAddressLine
                  }
                  onChange={handleProfileInputChange("businessAddressLine")}
                  placeholder="Street / full address"
                  disabled={
                    profileForm.businessSameAsCompany || saving || loadingMeta
                  }
                />
              </div>
            </div>
            <div className="rounded-xl border border-slate-200/70 p-3 dark:border-slate-700/70">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    VAT applies
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Toggle whether VAT should be included on invoices.
                  </p>
                </div>
                <Switch
                  checked={profileForm.vatRegistered}
                  onCheckedChange={(checked) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      vatRegistered: checked,
                      vatRate: checked ? prev.vatRate : "",
                    }))
                  }
                  disabled={saving || loadingMeta}
                />
              </div>
              <div className="mt-3 space-y-1">
                <Label>VAT rate (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={profileForm.vatRate}
                  onChange={handleProfileInputChange("vatRate")}
                  placeholder="21"
                  disabled={
                    !profileForm.vatRegistered || saving || loadingMeta
                  }
                />
              </div>
            </div>
          </div>
          <div className="space-y-4 rounded-xl border border-slate-200/70 bg-card/30 p-4 dark:border-slate-700/70">
            <FileUploadField
              label="Contract attachment"
              description="Upload the signed agreement (PDF, DOC, or image)."
              value={profileForm.contractAttachmentUrl}
              onChange={(url) =>
                setProfileForm((prev) => ({
                  ...prev,
                  contractAttachmentUrl: url,
                }))
              }
              folder={`partners/${activePartnerId}/contracts`}
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              helperText="Uploads are stored securely and accessible to admins."
            />
            <div className="space-y-2">
              <Label>Internal notes</Label>
              <Textarea
                rows={3}
                value={newNoteBody}
                onChange={(event) => setNewNoteBody(event.target.value)}
                placeholder="Add a note for other admins"
              />
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddNote}
                  disabled={!newNoteBody.trim()}
                >
                  Add note
                </Button>
                <p className="text-xs text-muted-foreground">
                  Notes save when you click “Save partner”.
                </p>
              </div>
              <div className="space-y-2">
                {notes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No notes yet.
                  </p>
                ) : (
                  notes.map((note) => (
                    <div
                      key={note.id}
                      className="rounded-2xl border border-slate-200/70 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="whitespace-pre-line">{note.body}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {new Date(note.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveNote(note.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Financials & pricing"
        description="Align monthly fees, public pricing, and commission rules."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Listing monthly fee (CZK)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={pricingForm.monthlyFee}
              onChange={handlePricingInputChange("monthlyFee")}
              placeholder="0"
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">
              Recurring listing fee invoiced to the partner each month.
            </p>
          </div>
          <div className="space-y-1">
            <Label>Customer discount (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={pricingForm.discountRate}
              onChange={handlePricingInputChange("discountRate")}
              placeholder="E.g. 15"
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">
              Percentage off the original price shown to visitors.
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-card/30 p-4 dark:border-slate-700/70">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Listing-only partner</p>
              <p className="text-xs text-muted-foreground">
                Disable commission calculations and bill only the listing fee.
              </p>
            </div>
            <Switch
              checked={pricingForm.listingOnly}
              onCheckedChange={(checked) =>
                setPricingForm((prev) => ({ ...prev, listingOnly: checked }))
              }
              disabled={saving}
            />
          </div>
        </div>
        <div className="space-y-4 rounded-2xl border border-slate-200/70 p-4 dark:border-slate-700/70">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Commission percentages
              </p>
              <p className="text-xs text-muted-foreground">
                Set separate percentages for commission on original vs.
                discounted ticket prices. Link them to keep values in sync.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Link values
              </span>
              <Switch
                checked={pricingForm.commissionRatesLinked}
                onCheckedChange={handleCommissionLinkToggle}
                disabled={saving}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Original price commission (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={pricingForm.commissionRateOriginal}
                onChange={handleCommissionRateInputChange(
                  "commissionRateOriginal"
                )}
                placeholder="e.g. 10"
                disabled={saving}
              />
            </div>
            <div className="space-y-1">
              <Label>Discounted price commission (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={pricingForm.commissionRateDiscounted}
                onChange={handleCommissionRateInputChange(
                  "commissionRateDiscounted"
                )}
                placeholder="e.g. 15"
                disabled={saving || pricingForm.commissionRatesLinked}
              />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-card/30 p-4 dark:border-slate-700/70">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Bonus program eligible
              </p>
              <p className="text-xs text-muted-foreground">
                Enable to award Zabava bonus points for every CZK spent.
              </p>
            </div>
            <Switch
              checked={bonusProgramEnabled}
              onCheckedChange={setBonusProgramEnabled}
            />
          </div>
          {bonusProgramEnabled ? (
            <div className="mt-3 space-y-1">
              <Label>Points per CZK</Label>
              <Input
                type="number"
                min={0}
                step="0.1"
                value={pricingForm.bonusPointsPerCzk}
                onChange={handlePricingInputChange("bonusPointsPerCzk")}
                placeholder="e.g. 1"
              />
            </div>
          ) : null}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Categories & form"
        description="Choose categories where this partner appears and connect the booking form."
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Categories</Label>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {categoryOptions.map((category) => {
                const isActive = selectedCategories.includes(category.value);
                return (
                  <button
                    type="button"
                    key={category.value}
                    onClick={() => toggleCategory(category.value)}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-left text-sm transition",
                      isActive
                        ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/10 dark:text-indigo-100"
                        : "border-slate-200 bg-muted/40 text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-indigo-400 dark:hover:bg-slate-700"
                    )}
                  >
                    {category.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Selected categories determine where this partner surfaces across
              the site.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Booking form</Label>
            <Select
              value={selectedFormId ?? NO_FORM_VALUE}
              onValueChange={(value) =>
                setSelectedFormId(value === NO_FORM_VALUE ? undefined : value)
              }
              disabled={saving}
            >
              <SelectTrigger className="w-full justify-between">
                <SelectValue placeholder="No form selected" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_FORM_VALUE}>No form selected</SelectItem>
                {formOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Pick a form from Admin → Forms. The public booking page pulls its
              steps from here.
            </p>
            {selectedForm ? (
              <p className="text-xs text-emerald-600">
                Using “{selectedForm.name}” ({selectedForm.status}).
              </p>
            ) : selectedFormMissing ? (
              <p className="text-xs text-amber-600">
                The stored form is no longer published. Pick another form to
                keep booking available.
              </p>
            ) : null}
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Brand assets & media"
        description="Logos and promo videos enhance the partner detail header."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <ImageUploadField
            label="Logo"
            description="Shown beside the partner name on the detail page."
            value={profileForm.logoUrl}
            onChange={(url) =>
              setProfileForm((prev) => ({
                ...prev,
                logoUrl: url,
              }))
            }
            folder={`partners/${activePartnerId}/logo`}
          />
          <div className="space-y-2">
            <Label>Video URLs</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={newVideoUrl}
                onChange={(event) => setNewVideoUrl(event.target.value)}
                placeholder="https://youtu.be/..."
                className="flex-1"
              />
              <Button
                type="button"
                onClick={addVideoUrl}
                disabled={!newVideoUrl.trim()}
              >
                Add video
              </Button>
            </div>
            {videoUrls.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Supports YouTube, Vimeo, or direct MP4 links. We resize videos
                automatically on the public page.
              </p>
            ) : (
              <ul className="space-y-2 text-sm text-muted-foreground">
                {videoUrls.map((url) => (
                  <li
                    key={url}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-card/40 px-3 py-2 dark:border-slate-700/70"
                  >
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 truncate text-foreground underline-offset-2 hover:underline"
                    >
                      {url}
                    </a>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => removeVideoUrl(url)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="grid gap-6 pt-2 lg:grid-cols-2">
          <ImageUploadField
            label="QR badge icon"
            description="Displayed in the center of every QR code. Leave empty to fall back to initials."
            value={profileForm.qrBadgeIconUrl}
            onChange={(url) =>
              setProfileForm((prev) => ({
                ...prev,
                qrBadgeIconUrl: url,
              }))
            }
            folder={`partners/${activePartnerId}/qr-badge`}
          />
          <div className="space-y-2">
            <Label>QR accent color</Label>
            <Input
              value={profileForm.qrAccentColor}
              onChange={(event) =>
                setProfileForm((prev) => ({
                  ...prev,
                  qrAccentColor: event.target.value,
                }))
              }
              placeholder="#F97316"
            />
            <p className="text-xs text-muted-foreground">
              This color powers the dots and badge background inside generated QR
              codes. Provide a hex value like #EB5757.
            </p>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Partner card"
        description="These fields power the category listing tiles and featured partner cards."
      >
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Card title</Label>
              <Input
                value={draft.title}
                onChange={(event) => updateDraft("title", event.target.value)}
                placeholder="Amazing museum experience"
              />
            </div>
            <div className="space-y-2">
              <Label>Subtitle</Label>
              <Input
                value={draft.subtitle}
                onChange={(event) =>
                  updateDraft("subtitle", event.target.value)
                }
                placeholder="Hands-on adventures for curious minds."
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={draft.description}
              onChange={(event) =>
                updateDraft("description", event.target.value)
              }
              className="min-h-[120px]"
              placeholder="Brief summary for the partner card and detail view."
            />
          </div>
          <ImageUploadField
            label="Hero image"
            description="Displayed on cards, detail page, and embeds."
            value={draft.heroImageUrl}
            onChange={(url) => updateDraft("heroImageUrl", url)}
            folder={`partners/${activePartnerId}/hero`}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Primary button label</Label>
              <Input
                value={draft.ctaPrimaryLabel}
                onChange={(event) =>
                  updateDraft("ctaPrimaryLabel", event.target.value)
                }
                placeholder="Generate QR"
              />
            </div>
            <div className="space-y-2">
              <Label>Secondary button label</Label>
              <Input
                value={draft.ctaSecondaryLabel}
                onChange={(event) =>
                  updateDraft("ctaSecondaryLabel", event.target.value)
                }
                placeholder="More details"
              />
            </div>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Partner details"
        description="Configure booking fallbacks, gallery assets, highlights, and rich content for the detail page."
      >
        <div className="space-y-8">
          <div className="space-y-2">
            <Label>Booking link override</Label>
            {selectedFormId ? (
              <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                The public booking page will render the selected admin form.
                Clear the selection above to provide a custom URL.
              </div>
            ) : (
              <>
                <Input
                  value={draft.formUrl}
                  onChange={(event) =>
                    updateDraft("formUrl", event.target.value)
                  }
                  placeholder="Link to the external booking flow"
                />
                <p className="text-xs text-muted-foreground">
                  Optional fallback if this partner uses an external booking
                  provider.
                </p>
              </>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Gallery
                </h3>
                <p className="text-xs text-muted-foreground">
                  Upload images and add optional captions for the partner detail
                  page.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={galleryUploadInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleGalleryUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={triggerGalleryUpload}
                  disabled={bulkUploadingGallery}
                >
                  {bulkUploadingGallery ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <UploadCloud className="mr-2 size-4" />
                      Upload images
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addGalleryItem}
                >
                  <Plus className="mr-2 size-4" />
                  Add blank slide
                </Button>
              </div>
            </div>
            {draft.gallery.length > 0 ? (
              <div className="space-y-4">
                <div className="relative w-full max-w-3xl overflow-hidden">
                  <Swiper
                    spaceBetween={16}
                    slidesPerView={1}
                    onSwiper={(instance) => {
                      gallerySwiperRef.current = instance;
                    }}
                    onDestroy={() => {
                      gallerySwiperRef.current = null;
                    }}
                    className="w-full max-w-3xl overflow-hidden rounded-xl [&_.swiper-slide]:!h-auto [&_.swiper-slide]:!w-full"
                  >
                    {draft.gallery.map((item, index) => (
                      <SwiperSlide key={item.id ?? index}>
                        <div className="flex h-full flex-col gap-4 rounded-xl border border-slate-200 bg-background p-4 dark:border-slate-700">
                          <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3 text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground dark:border-slate-700">
                            <span>Slide {index + 1}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeGalleryItem(index)}
                              className="text-muted-foreground hover:text-destructive"
                              aria-label="Remove gallery image"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                          <div className="space-y-3">
                            <ImageUploadField
                              label="Gallery image"
                              value={item.imageUrl}
                              onChange={(url) =>
                                updateGalleryItem(index, "imageUrl", url)
                              }
                              folder={`partners/${activePartnerId}/gallery`}
                            />
                            <div className="space-y-1">
                              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Caption
                              </span>
                              <Input
                                value={item.caption ?? ""}
                                onChange={(event) =>
                                  updateGalleryItem(
                                    index,
                                    "caption",
                                    event.target.value
                                  )
                                }
                                placeholder="Short description (optional)"
                              />
                            </div>
                          </div>
                        </div>
                      </SwiperSlide>
                    ))}
                  </Swiper>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => gallerySwiperRef.current?.slidePrev()}
                    aria-label="Previous gallery image"
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => gallerySwiperRef.current?.slideNext()}
                    aria-label="Next gallery image"
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-muted/40 p-6 text-center text-sm text-muted-foreground dark:border-slate-700">
                No gallery images yet. Add one to preview the carousel.
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Highlights
                </h3>
                <p className="text-xs text-muted-foreground">
                  Quick reasons to choose this partner (optional).
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addHighlight}
              >
                <Plus className="mr-2 size-4" />
                Add highlight
              </Button>
            </div>
            {draft.highlights.length > 0 ? (
              <div className="space-y-3">
                {draft.highlights.map((item, index) => (
                  <div
                    key={item.id ?? index}
                    className="rounded-xl border border-slate-200 bg-background p-4 shadow-sm dark:border-slate-700"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3 text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground dark:border-slate-700">
                      <span>Highlight {index + 1}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeHighlight(index)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Remove highlight"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <div className="grid gap-4 pt-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Title
                        </span>
                        <Input
                          value={item.title}
                          onChange={(event) =>
                            updateHighlight(index, "title", event.target.value)
                          }
                          placeholder="Interactive labs"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Icon (optional)
                        </span>
                        <Input
                          value={item.icon ?? ""}
                          onChange={(event) =>
                            updateHighlight(index, "icon", event.target.value)
                          }
                          placeholder="Identifier for an icon"
                        />
                      </div>
                    </div>
                    <div className="space-y-1 pt-3">
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Description
                      </span>
                      <Textarea
                        value={item.description ?? ""}
                        onChange={(event) =>
                          updateHighlight(
                            index,
                            "description",
                            event.target.value
                          )
                        }
                        placeholder="Short supporting copy (optional)"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-muted/40 p-6 text-center text-sm text-muted-foreground dark:border-slate-700">
                No highlights added yet.
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Detail sections
                </h3>
                <p className="text-xs text-muted-foreground">
                  Build rich content for the partner detail embed.
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm">
                    <Plus className="mr-2 size-4" />
                    Add section
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>Section type</DropdownMenuLabel>
                  {SECTION_TYPE_ORDER.map((type) => (
                    <DropdownMenuItem
                      key={type}
                      onSelect={() => addSection(type)}
                    >
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-foreground">
                          {SECTION_TYPE_META[type].label}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {SECTION_TYPE_META[type].description}
                        </p>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {sections.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-muted/40 p-6 text-center text-sm text-muted-foreground dark:border-slate-700">
                Start by choosing a section type.
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={sectionIds}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-4">
                    {sections.map((section, index) => (
                      <SortableSectionCard
                        key={section.id}
                        section={section}
                        index={index}
                        sectionsLength={sections.length}
                        onChangeType={(nextType) =>
                          changeSectionType(index, nextType)
                        }
                        onUpdate={(changes) => updateSection(index, changes)}
                        onMove={moveSection}
                        onDuplicate={duplicateSection}
                        onRemove={removeSection}
                        activePartnerId={activePartnerId}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
      </CollapsibleSection>

      <div className="flex items-center justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onBack}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving || loadingMeta}
        >
          {saving ? "Saving…" : "Save partner"}
        </Button>
      </div>
    </div>
  );
}
const DAY_OPTIONS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const TIME_OPTIONS = Array.from({ length: 24 * 2 }, (_, index) => {
  const totalMinutes = index * 30;
  const hours24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const value = `${hours24.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const label = `${hours12}:${minutes.toString().padStart(2, "0")} ${period}`;
  return { value, label };
});

type SelectOption = { value: string; label: string; description?: string };
