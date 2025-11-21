"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Save,
  ClipboardCheck,
  Pencil,
  X,
} from "lucide-react";

import type { VisitRegistrationRecord } from "@/lib/data/visits";
import { getCsrfToken } from "@/lib/web/csrf";
import {
  DesignButton,
  DesignInput,
  DesignSelect,
  DesignSelectContent,
  DesignSelectItem,
  DesignSelectTrigger,
  DesignSelectValue,
  DesignTextarea,
  SectionCard,
  StatusPill,
  SurfaceCard,
} from "@/components/design-system";
import { cn } from "@/lib/utils";

interface StaffVisitEditorProps {
  initialVisit: VisitRegistrationRecord;
  partnerId: string;
  formOptions?: {
    fallbackTicketTypeOptions?: Array<{ value: string; label: string; price?: number | null }>;
    ticketCatalog?: TicketCatalogEntry[];
    currency?: string;
  };
}

export type TicketCatalogEntry = {
  value: string;
  label: string;
  price: number | null;
  discountedPrice: number | null;
};

type EditableKey = "ticketType" | "totalPrice" | "categories" | "visitNotes";

type TicketSelectionEntry = {
  id: string;
  label: string;
  ticketType: string | null;
  quantity: number;
  unitPrice: number | null;
  subtotal: number | null;
};

function parseNumericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeTicketKey(value?: string | null) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

function normalizeTicketSelection(entry: unknown): TicketSelectionEntry | null {
  if (!entry || typeof entry !== "object") return null;
  const record = entry as Record<string, unknown>;
  const idCandidates = [record.id, record.ticketType, record.value].filter(
    (candidate): candidate is string =>
      typeof candidate === "string" && candidate.trim().length > 0,
  );
  const rawId = idCandidates[0]?.trim();
  if (!rawId) return null;

  const labelCandidates = [
    typeof record.label === "string" ? record.label.trim() : "",
    typeof record.ticketType === "string" ? record.ticketType.trim() : "",
    rawId,
  ].filter((candidate) => candidate.length > 0);
  const label = labelCandidates[0] ?? rawId;

  const ticketType =
    typeof record.ticketType === "string" && record.ticketType.trim().length > 0
      ? record.ticketType.trim()
      : null;

  const parsedQuantity =
    parseNumericValue(record.quantity) ??
    parseNumericValue(record.qty) ??
    parseNumericValue(record.count) ??
    1;
  const quantity = parsedQuantity > 0 ? parsedQuantity : 1;

  const unitPrice =
    parseNumericValue(record.unitPrice) ??
    parseNumericValue(record.price) ??
    parseNumericValue(record.cost) ??
    null;

  const subtotal =
    parseNumericValue(record.subtotal) ??
    (typeof unitPrice === "number" ? unitPrice * quantity : null);

  return {
    id: rawId,
    label,
    ticketType,
    quantity,
    unitPrice,
    subtotal,
  };
}

interface VisitResponse {
  visit: VisitRegistrationRecord;
}

const SELECT_UNSET_VALUE = "__unset__";

function formatDateTime(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return format(parsed, "dd MMM yyyy HH:mm");
}

export function StaffVisitEditor({
  initialVisit,
  partnerId,
  formOptions,
}: StaffVisitEditorProps) {
  const router = useRouter();
  const [visit, setVisit] = useState<VisitRegistrationRecord>(initialVisit);
  const [numPeople, setNumPeople] = useState<number | undefined>(
    visit.num_people ?? undefined
  );
  const [totalPrice, setTotalPrice] = useState<number | undefined>(
    visit.total_price ?? undefined
  );
  const [ticketType, setTicketType] = useState<string>(visit.ticket_type ?? "");
  const [categories, setCategories] = useState<string>(visit.categories ?? "");
  const [visitNotes, setVisitNotes] = useState<string>(visit.visit_notes ?? "");

  const [saving, setSaving] = useState(false);
  const [marking, setMarking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<Record<EditableKey, boolean>>({
    ticketType: false,
    totalPrice: false,
    categories: false,
    visitNotes: false,
  });

  const resetEditingState = useCallback(() => {
    setEditing({
      ticketType: false,
      totalPrice: false,
      categories: false,
      visitNotes: false,
    });
  }, []);

  const visitId = visit.id;
  const payload = (visit.payload ?? {}) as Record<string, unknown>;
  const isFlashDeal =
    (visit as { qr_type?: string }).qr_type === "flash" ||
    payload.source === "special_flash_deal";
  const flashDealTitle =
    typeof payload.dealTitle === "string" ? payload.dealTitle : null;
  const flashDealSlug =
    typeof payload.dealSlug === "string" ? payload.dealSlug : null;
  const flashDealId =
    typeof payload.dealId === "string" ? payload.dealId : null;
  const requiredVisitors =
    typeof payload.visitors === "number"
      ? payload.visitors
      : typeof payload.minVisitors === "number"
      ? payload.minVisitors
      : undefined;
  const actualVisitorsCurrent =
    typeof numPeople === "number"
      ? numPeople
      : typeof visit.num_people === "number"
      ? visit.num_people
      : undefined;
  const visitorsWarning =
    isFlashDeal &&
    typeof requiredVisitors === "number" &&
    typeof actualVisitorsCurrent === "number" &&
    actualVisitorsCurrent < requiredVisitors;

  const payloadSummary = useMemo(() => {
    const payloadData = visit.payload ?? {};
    return Object.entries(payloadData)
      .filter(([key]) =>
        [
          "fullName",
          "partnerId",
          "ticketType",
          "numPeople",
          "transport",
          "totalPrice",
          "categories",
          "notes",
          "visitDate",
          "dealTitle",
          "dealSlug",
          "dealId",
          "visitors",
        ].includes(key)
      )
      .map(([key, value]) => ({
        key,
        value:
          typeof value === "object"
            ? JSON.stringify(value, null, 2)
            : String(value),
      }));
  }, [visit.payload]);

  const payloadMetadata =
    typeof payload.metadata === "object" && payload.metadata !== null
      ? (payload.metadata as Record<string, unknown>)
      : undefined;
  const payloadForm =
    typeof payload.form === "object" && payload.form !== null
      ? (payload.form as Record<string, unknown>)
      : undefined;

  const refreshData = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/staff/visit/${visitId}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to refresh visit data");
      }
      const json = (await res.json()) as VisitResponse;
      setVisit(json.visit);
      setNumPeople(json.visit.num_people ?? undefined);
      setTotalPrice(json.visit.total_price ?? undefined);
      setTicketType(json.visit.ticket_type ?? "");
      setCategories(json.visit.categories ?? "");
      setVisitNotes(json.visit.visit_notes ?? "");
      resetEditingState();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to refresh visit data."
      );
    } finally {
      setRefreshing(false);
    }
  }, [resetEditingState, visitId]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const csrf = getCsrfToken();
      const body = {
        totalPrice,
        ticketType: ticketType || undefined,
        categories: categories || undefined,
        visitNotes: visitNotes || undefined,
      };

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (csrf) headers["x-csrf-token"] = csrf;
      const res = await fetch(`/api/staff/visit/${visitId}`, {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload?.error ?? "Failed to save changes.");
      }
      const json = (await res.json()) as VisitResponse;
      setVisit(json.visit);
      resetEditingState();
      toast.success("Visit details updated.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save changes."
      );
    } finally {
      setSaving(false);
    }
  }, [categories, resetEditingState, ticketType, totalPrice, visitId, visitNotes]);

  const handleMarkVisited = useCallback(async () => {
    setMarking(true);
    try {
      const csrf = getCsrfToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (csrf) headers["x-csrf-token"] = csrf;
      const res = await fetch("/api/partner/mark-visited", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          email: visit.email,
          partnerId,
          visitId,
          actualVisitors:
            typeof numPeople === "number"
              ? numPeople
              : typeof visit.num_people === "number"
              ? visit.num_people
              : undefined,
        }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload?.error ?? "Failed to mark visit as completed.");
      }
      await res.json();
      toast.success("Visit marked as completed.");
      setTimeout(() => {
        router.replace("/staff/console");
      }, 600);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to mark visit as visited."
      );
    } finally {
      setMarking(false);
    }
  }, [numPeople, partnerId, router, visit.email, visit.num_people, visitId]);

  const createdAt = formatDateTime(visit.created_at);
  const visitedAt = formatDateTime(visit.visited_at);
  const expiresAt =
    typeof visit.payload?.qrCodeExpiresAt === "string"
      ? formatDateTime(visit.payload.qrCodeExpiresAt)
      : null;

  const fallbackTicketTypeOptions = formOptions?.fallbackTicketTypeOptions ?? [];
  const ticketCatalog = formOptions?.ticketCatalog ?? [];
  const currencyCode = formOptions?.currency ?? "CZK";

  const ticketSelectOptions = useMemo(() => {
    if (ticketCatalog.length > 0) {
      return ticketCatalog.map((entry) => ({
        value: entry.value,
        label: buildTicketOptionLabel(entry.label, entry.discountedPrice ?? entry.price),
      }));
    }
    const map = new Map<string, { value: string; label: string }>();
    const addOption = (value?: string | null, label?: string | null, price?: number | null) => {
      if (!value) return;
      const normalized = normalizeTicketKey(value);
      if (!normalized || map.has(normalized)) return;
      const optionLabel =
        label && label.trim().length > 0 ? label : value;
      map.set(normalized, {
        value,
        label: buildTicketOptionLabel(optionLabel, price),
      });
    };

    fallbackTicketTypeOptions.forEach((option) =>
      addOption(option.value, option.label, option.price),
    );
    if (ticketType) {
      addOption(ticketType, ticketType);
    }

    return Array.from(map.values());
  }, [fallbackTicketTypeOptions, ticketCatalog, ticketType, buildTicketOptionLabel]);

  const ticketCatalogIndex = useMemo(() => {
    const map = new Map<string, TicketCatalogEntry>();
    ticketCatalog.forEach((entry) => {
      const normalizedValue = normalizeTicketKey(entry.value);
      if (normalizedValue) {
        map.set(normalizedValue, entry);
      }
      const normalizedLabel = normalizeTicketKey(entry.label);
      if (normalizedLabel && !map.has(normalizedLabel)) {
        map.set(normalizedLabel, entry);
      }
    });
    return map;
  }, [ticketCatalog]);

  const rawTicketSelections = useMemo(() => {
    const sources: unknown[] = [];
    sources.push(payload.ticketSelections);
    if (payloadMetadata) {
      sources.push(payloadMetadata.ticketSelections);
    }
    if (payloadForm) {
      sources.push(payloadForm.ticketSelections);
      const valuesSource =
        typeof payloadForm.values === "object" && payloadForm.values !== null
          ? (payloadForm.values as Record<string, unknown>)
          : undefined;
      const hiddenSource =
        typeof payloadForm.hidden === "object" && payloadForm.hidden !== null
          ? (payloadForm.hidden as Record<string, unknown>)
          : undefined;
      if (valuesSource) {
        sources.push(valuesSource.__ticketSelections);
      }
      if (hiddenSource) {
        sources.push(hiddenSource.__ticketSelections);
      }
    }
    const listSource = sources.find((source) => Array.isArray(source));
    return Array.isArray(listSource) ? listSource : [];
  }, [payload, payloadForm, payloadMetadata]);

  const ticketSelections = useMemo(() => {
    if (rawTicketSelections.length === 0) return [];
    return rawTicketSelections
      .map((entry) => normalizeTicketSelection(entry))
      .filter(
        (entry): entry is TicketSelectionEntry => entry !== null && Boolean(entry.id),
      )
      .map((entry) => {
        const normalizedKey = normalizeTicketKey(entry.ticketType ?? entry.id);
        const catalogMatch = normalizedKey
          ? ticketCatalogIndex.get(normalizedKey)
          : undefined;
        const unitPrice =
          entry.unitPrice ??
          (catalogMatch
            ? typeof catalogMatch.discountedPrice === "number"
              ? catalogMatch.discountedPrice
              : typeof catalogMatch.price === "number"
              ? catalogMatch.price
              : null
            : null);
        const subtotal =
          entry.subtotal ??
          (typeof unitPrice === "number" ? unitPrice * entry.quantity : null);
        return {
          ...entry,
          label:
            entry.label || catalogMatch?.label || entry.ticketType || entry.id,
          ticketType: entry.ticketType ?? catalogMatch?.value ?? entry.id,
          unitPrice,
          subtotal,
        };
      });
  }, [rawTicketSelections, ticketCatalogIndex]);

  const ticketSelectionsTotal = useMemo(() => {
    const totalSources = [
      parseNumericValue((payload as Record<string, unknown>).ticketSelectionsTotal),
      payloadMetadata ? parseNumericValue(payloadMetadata.ticketSelectionsTotal) : null,
      payloadForm ? parseNumericValue(payloadForm.ticketSelectionsTotal) : null,
    ];
    const explicitTotal = totalSources.find(
      (value): value is number => typeof value === "number",
    );
    if (explicitTotal !== undefined) {
      return explicitTotal;
    }
    const computed = ticketSelections.reduce((sum, entry) => {
      const amount =
        typeof entry.subtotal === "number"
          ? entry.subtotal
          : typeof entry.unitPrice === "number"
          ? entry.unitPrice * entry.quantity
          : null;
      return typeof amount === "number" ? sum + amount : sum;
    }, 0);
    return ticketSelections.length > 0 ? computed : null;
  }, [payload, payloadForm, payloadMetadata, ticketSelections]);

  const currencyFormatter = useMemo(() => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currencyCode,
        maximumFractionDigits: 2,
      });
    } catch {
      return null;
    }
  }, [currencyCode]);

  const formatCurrencyAmount = useCallback(
    (value: number | null | undefined) => {
      if (typeof value !== "number" || Number.isNaN(value)) {
        return "—";
      }
      return currencyFormatter
        ? currencyFormatter.format(value)
        : `${value.toLocaleString()} ${currencyCode}`.trim();
    },
    [currencyCode, currencyFormatter],
  );

  const buildTicketOptionLabel = useCallback(
    (baseLabel: string, price?: number | null) => {
      if (typeof price === "number") {
        return `${baseLabel} · ${formatCurrencyAmount(price)}`;
      }
      return baseLabel;
    },
    [formatCurrencyAmount],
  );

  const toggleEditing = (key: EditableKey, next?: boolean) => {
    setEditing((prev) => ({
      ...prev,
      [key]: typeof next === "boolean" ? next : !prev[key],
    }));
  };

  const isEditing = (key: EditableKey) => Boolean(editing[key]);

  const renderEditToggle = (
    key: EditableKey,
    label: string,
    disabled?: boolean
  ) => (
    <DesignButton
      type="button"
      onClick={() => toggleEditing(key)}
      variant="tonal"
      size="icon"
      className="rounded-full"
      aria-label={isEditing(key) ? `Stop editing ${label}` : `Edit ${label}`}
      disabled={disabled}
    >
      {isEditing(key) ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
    </DesignButton>
  );

  const renderEditableCard = (
    key: EditableKey,
    label: string,
    config: {
      description?: string;
      helper?: ReactNode;
      span?: boolean;
      editor: ReactNode;
      display: ReactNode;
    },
  ) => {
    const { description, helper, span, editor, display } = config;
    const editing = isEditing(key);
    return (
      <SurfaceCard
        className={cn(
          "space-y-3 border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-4",
          span && "sm:col-span-2",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ds-text-subtle)]">
              {label}
            </p>
            {description ? (
              <p className="text-[11px] text-[color:var(--ds-text-muted)]">
                {description}
              </p>
            ) : null}
          </div>
          {renderEditToggle(key, label)}
        </div>
        <div className="space-y-2 text-sm text-[color:var(--ds-text-strong)]">
          {editing ? editor : display}
          {helper ? (
            <p className="text-[11px] text-[color:var(--ds-text-muted)]">{helper}</p>
          ) : null}
        </div>
      </SurfaceCard>
    );
  };

  return (
    <div className="flex flex-col gap-8 pb-12">
      {isFlashDeal ? (
        <SectionCard
          className="space-y-4 border-[color:var(--ds-danger)]/40 bg-[color:var(--ds-danger)]/10"
          title="Flash deal requirements"
          description="Minimum visitor counts are enforced. Update the guest count to the number currently present."
          actions={<StatusPill tone="danger">Flash Deal</StatusPill>}
        >
          <dl className="grid gap-3 text-sm text-[color:var(--ds-text-strong)] sm:grid-cols-2">
            {flashDealTitle ? (
              <SurfaceCard className="rounded-2xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-4">
                <dt className="text-xs uppercase tracking-[0.3em] text-[color:var(--ds-text-subtle)]">
                  Deal
                </dt>
                <dd className="mt-1 text-base font-semibold">
                  {flashDealTitle}
                </dd>
                {flashDealSlug ? (
                  <dd className="mt-1 text-[11px] text-[color:var(--ds-text-muted)]">
                    Slug: {flashDealSlug}
                  </dd>
                ) : null}
                {flashDealId ? (
                  <dd className="mt-1 text-[11px] text-[color:var(--ds-text-muted)]">
                    ID: {flashDealId}
                  </dd>
                ) : null}
              </SurfaceCard>
            ) : null}
            {typeof requiredVisitors === "number" ? (
              <SurfaceCard className="rounded-2xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-4">
                <dt className="text-xs uppercase tracking-[0.3em] text-[color:var(--ds-text-subtle)]">
                  Required visitors
                </dt>
                <dd className="mt-1 text-base font-semibold">
                  {requiredVisitors}
                </dd>
                <dd className="mt-1 text-[11px] text-[color:var(--ds-text-muted)]">
                  Minimum group size for this flash deal.
                </dd>
              </SurfaceCard>
            ) : null}
            <SurfaceCard className="rounded-2xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-4">
              <dt className="text-xs uppercase tracking-[0.3em] text-[color:var(--ds-text-subtle)]">
                Recorded visitors
              </dt>
              <dd className="mt-1 text-base font-semibold">
                {actualVisitorsCurrent ?? "—"}
              </dd>
              <dd className="mt-1 text-[11px] text-[color:var(--ds-text-muted)]">
                Update the guest count before confirming arrival.
              </dd>
            </SurfaceCard>
          </dl>
          {visitorsWarning ? (
            <SurfaceCard className="rounded-2xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-danger)]/10 p-4 text-sm text-[color:var(--ds-danger)]">
              <span className="font-semibold">
                At least {requiredVisitors} visitors must be present.
              </span>{" "}
              Update the guest count or decline the QR until the full group arrives.
            </SurfaceCard>
          ) : null}
        </SectionCard>
      ) : null}

      <SectionCard
        title="Visit summary"
        description="Confirm the guest’s details captured during registration."
        className="space-y-4"
      >
        <div className="grid gap-3 text-sm text-[color:var(--ds-text-strong)] sm:grid-cols-2">
          <SurfaceCard className="rounded-2xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-4">
            <dt className="text-xs uppercase tracking-[0.3em] text-[color:var(--ds-text-subtle)]">
              Visitor
            </dt>
            <dd className="mt-1 break-all text-base font-medium">
              {visit.email}
            </dd>
          </SurfaceCard>
          <SurfaceCard className="rounded-2xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-4">
            <dt className="text-xs uppercase tracking-[0.3em] text-[color:var(--ds-text-subtle)]">
              Status
            </dt>
            <dd className="mt-1 text-base font-medium">
              {visit.status === "visited" ? "Visited" : "Pending"}
            </dd>
          </SurfaceCard>
          <SurfaceCard className="rounded-2xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-4">
            <dt className="text-xs uppercase tracking-[0.3em] text-[color:var(--ds-text-subtle)]">
              Registered
            </dt>
            <dd className="mt-1 text-base font-medium">
              {createdAt ?? "Unknown"}
            </dd>
          </SurfaceCard>
          <SurfaceCard className="rounded-2xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-4">
            <dt className="text-xs uppercase tracking-[0.3em] text-[color:var(--ds-text-subtle)]">
              Checked in
            </dt>
            <dd className="mt-1 text-base font-medium">
              {visitedAt ?? "Not yet"}
            </dd>
          </SurfaceCard>
          <SurfaceCard className="rounded-2xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-4">
            <dt className="text-xs uppercase tracking-[0.3em] text-[color:var(--ds-text-subtle)]">
              Estimated points
            </dt>
            <dd className="mt-1 text-base font-medium">
              {(visit.estimated_points ?? 0).toLocaleString()}
            </dd>
          </SurfaceCard>
          {expiresAt ? (
            <SurfaceCard className="rounded-2xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-warning)]/15 p-4 text-[color:var(--ds-warning)]">
              <dt className="text-xs uppercase tracking-[0.3em]">QR expires</dt>
              <dd className="mt-1 text-base font-medium text-[color:var(--ds-text-strong)]">
                {expiresAt}
              </dd>
            </SurfaceCard>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title="Ticket details"
        description="Cross-check the guest’s selections against the partner catalog before editing."
        className="space-y-4"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <SurfaceCard className="space-y-4 rounded-2xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-4">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ds-text-subtle)]">
                Guest ticket selections
              </p>
              <p className="text-[11px] text-[color:var(--ds-text-muted)]">
                Pulled from the QR registration payload.
              </p>
            </div>
            {ticketSelections.length === 0 ? (
              <p className="rounded-xl bg-[color:var(--ds-surface-muted)] px-3 py-2 text-xs text-[color:var(--ds-text-muted)]">
                No ticket selections were captured for this visit.
              </p>
            ) : (
              <ul className="divide-y divide-[color:var(--ds-border-subtle)] rounded-2xl border border-[color:var(--ds-border-subtle)] text-sm">
                {ticketSelections.map((selection, index) => {
                  const lineSubtotal =
                    selection.subtotal ??
                    (typeof selection.unitPrice === "number"
                      ? selection.unitPrice * selection.quantity
                      : null);
                  return (
                    <li key={`${selection.id}-${index}`} className="flex flex-col gap-1 px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-[color:var(--ds-text-strong)]">
                            {selection.label}
                          </p>
                          <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--ds-text-subtle)]">
                            {selection.ticketType ?? "Ticket"}
                          </p>
                        </div>
                        <p className="text-base font-semibold text-[color:var(--ds-text-strong)]">
                          {formatCurrencyAmount(lineSubtotal)}
                        </p>
                      </div>
                      <p className="text-xs text-[color:var(--ds-text-muted)]">
                        {selection.quantity.toLocaleString()} ×{" "}
                        {formatCurrencyAmount(selection.unitPrice)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
            {ticketSelectionsTotal !== null ? (
              <div className="flex items-center justify-between border-t border-dashed border-[color:var(--ds-border-subtle)] pt-3 text-sm text-[color:var(--ds-text-strong)]">
                <span className="text-xs uppercase tracking-[0.3em] text-[color:var(--ds-text-subtle)]">
                  Estimated ticket total
                </span>
                <span className="text-base font-semibold">
                  {formatCurrencyAmount(ticketSelectionsTotal)}
                </span>
              </div>
            ) : null}
          </SurfaceCard>

          <SurfaceCard className="space-y-4 rounded-2xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-4">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ds-text-subtle)]">
                Partner ticket catalog
              </p>
              <p className="text-[11px] text-[color:var(--ds-text-muted)]">
                Configured ticket types available for this partner.
              </p>
            </div>
            {ticketCatalog.length === 0 ? (
              <p className="rounded-xl bg-[color:var(--ds-surface-muted)] px-3 py-2 text-xs text-[color:var(--ds-text-muted)]">
                This partner does not have ticket pricing configured yet.
              </p>
            ) : (
              <ul className="divide-y divide-[color:var(--ds-border-subtle)] rounded-2xl border border-[color:var(--ds-border-subtle)] text-sm">
                {ticketCatalog.map((entry) => (
                  <li key={entry.value} className="flex items-center justify-between gap-3 px-3 py-3">
                    <div>
                      <p className="text-base font-semibold text-[color:var(--ds-text-strong)]">
                        {entry.label}
                      </p>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--ds-text-subtle)]">
                        {entry.value}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-[color:var(--ds-text-strong)]">
                      {typeof entry.discountedPrice === "number"
                        ? formatCurrencyAmount(entry.discountedPrice)
                        : "Price not set"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SurfaceCard>
        </div>
      </SectionCard>

      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-[color:var(--ds-primary)]" />
            <span>Update visit details</span>
          </span>
        }
        description="Adjust guest counts or logistics if things changed at the door."
        className="space-y-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {renderEditableCard("ticketType", "Ticket type", {
            description: "Select a ticket profile or add a free-form label.",
            editor:
              ticketSelectOptions.length > 0 ? (
                <DesignSelect
                  value={ticketType ? ticketType : SELECT_UNSET_VALUE}
                  onValueChange={(value) =>
                    setTicketType(value === SELECT_UNSET_VALUE ? "" : value)
                  }
                >
                  <DesignSelectTrigger aria-label="Ticket type">
                    <DesignSelectValue placeholder="Select ticket type" />
                  </DesignSelectTrigger>
                  <DesignSelectContent>
                    <DesignSelectItem value={SELECT_UNSET_VALUE}>
                      No ticket
                    </DesignSelectItem>
                    {ticketSelectOptions.map((option) => (
                      <DesignSelectItem key={option.value} value={option.value}>
                        {option.label}
                      </DesignSelectItem>
                    ))}
                  </DesignSelectContent>
                </DesignSelect>
              ) : (
                <DesignInput
                  value={ticketType}
                  onChange={(event) => setTicketType(event.target.value)}
                  placeholder="e.g. VIP, family"
                />
              ),
            display: (
              <p className="text-base font-semibold">
                {ticketType ? ticketType : "—"}
              </p>
            ),
          })}

          {renderEditableCard("totalPrice", "Estimated spend", {
            description: "What the guest reported spending.",
            helper: "Leave blank if spend is unknown.",
            editor: (
              <DesignInput
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={typeof totalPrice === "number" ? String(totalPrice) : ""}
                onChange={(event) =>
                  setTotalPrice(
                    event.target.value ? Number(event.target.value) : undefined,
                  )
                }
                placeholder="e.g. 5000"
              />
            ),
            display: (
              <p className="text-base font-semibold">
                {typeof totalPrice === "number"
                  ? totalPrice.toLocaleString()
                  : "—"}
              </p>
            ),
          })}

          {renderEditableCard("categories", "Categories / tags", {
            description: "Comma-separated themes to keep analytics clean.",
            span: true,
            editor: (
              <DesignInput
                value={categories}
                onChange={(event) => setCategories(event.target.value)}
                placeholder="e.g. family, food"
              />
            ),
            display: (
              <p className="text-base font-semibold">
                {categories ? categories : "—"}
              </p>
            ),
          })}

          {renderEditableCard("visitNotes", "Internal notes", {
            description: "Add context for other staff members.",
            span: true,
            editor: (
              <DesignTextarea
                value={visitNotes}
                onChange={(event) => setVisitNotes(event.target.value)}
                rows={6}
                placeholder="Add context for other staff members..."
              />
            ),
            display: (
              <p className="whitespace-pre-wrap text-sm">
                {visitNotes ? visitNotes : "No internal notes"}
              </p>
            ),
          })}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <DesignButton
            variant="tonal"
            type="button"
            onClick={refreshData}
            disabled={refreshing}
            className="w-full sm:w-auto"
          >
            {refreshing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Refreshing…
              </>
            ) : (
              <>
                <RefreshCcw className="size-4" />
                Refresh data
              </>
            )}
          </DesignButton>
          <DesignButton
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="size-4" />
                Save changes
              </>
            )}
          </DesignButton>
          <DesignButton
            variant="secondary"
            type="button"
            onClick={handleMarkVisited}
            disabled={visit.status === "visited" || marking}
            className="w-full sm:w-auto"
          >
            {marking ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Updating…
              </>
            ) : (
              <>
                <ClipboardCheck className="size-4" />
                Mark visited
              </>
            )}
          </DesignButton>
        </div>
      </SectionCard>

      <SectionCard
        title="Original form details"
        description="What the guest submitted during registration."
        className="space-y-4"
      >
        {payloadSummary.length === 0 ? (
          <SurfaceCard className="rounded-2xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] p-4 text-sm text-[color:var(--ds-text-muted)]">
            No additional form fields were captured for this visit.
          </SurfaceCard>
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2">
            {payloadSummary.map(({ key, value }) => (
              <SurfaceCard
                key={key}
                className="space-y-2 rounded-2xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-4"
              >
                <dt className="text-xs uppercase tracking-[0.3em] text-[color:var(--ds-text-subtle)]">
                  {key}
                </dt>
                <dd className="whitespace-pre-wrap font-mono text-xs text-[color:var(--ds-text-strong)]">
                  {value}
                </dd>
              </SurfaceCard>
            ))}
          </dl>
        )}
      </SectionCard>
    </div>
  );
}
