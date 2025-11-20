"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
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
    ticketTypeOptions?: Array<{ value: string; label: string }>;
    transportOptions?: Array<{ value: string; label: string }>;
  };
}

type EditableKey =
  | "numPeople"
  | "ticketType"
  | "transport"
  | "totalPrice"
  | "categories"
  | "visitNotes";

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
  const [visit, setVisit] = useState<VisitRegistrationRecord>(initialVisit);
  const [numPeople, setNumPeople] = useState<number | undefined>(
    visit.num_people ?? undefined
  );
  const [totalPrice, setTotalPrice] = useState<number | undefined>(
    visit.total_price ?? undefined
  );
  const [ticketType, setTicketType] = useState<string>(visit.ticket_type ?? "");
  const [transport, setTransport] = useState<string>(visit.transport ?? "");
  const [categories, setCategories] = useState<string>(visit.categories ?? "");
  const [visitNotes, setVisitNotes] = useState<string>(visit.visit_notes ?? "");

  const [saving, setSaving] = useState(false);
  const [marking, setMarking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<Record<EditableKey, boolean>>({
    numPeople: false,
    ticketType: false,
    transport: false,
    totalPrice: false,
    categories: false,
    visitNotes: false,
  });

  const resetEditingState = useCallback(() => {
    setEditing({
      numPeople: false,
      ticketType: false,
      transport: false,
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
      setTransport(json.visit.transport ?? "");
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
        numPeople,
        totalPrice,
        ticketType: ticketType || undefined,
        transport: transport || undefined,
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
  }, [
    categories,
    numPeople,
    resetEditingState,
    ticketType,
    totalPrice,
    transport,
    visitId,
    visitNotes,
  ]);

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
      const data = await res.json();
      toast.success("Visit marked as completed.");
      if (data?.visit?.visitId) {
        await refreshData();
      } else {
        await refreshData();
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to mark visit as visited."
      );
    } finally {
      setMarking(false);
    }
  }, [numPeople, partnerId, refreshData, visit.email, visit.num_people, visitId]);

  const createdAt = formatDateTime(visit.created_at);
  const visitedAt = formatDateTime(visit.visited_at);
  const expiresAt =
    typeof visit.payload?.qrCodeExpiresAt === "string"
      ? formatDateTime(visit.payload.qrCodeExpiresAt)
      : null;

  const transportOptions = formOptions?.transportOptions ?? [];
  const ticketTypeOptions = formOptions?.ticketTypeOptions ?? [];

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
          {renderEditableCard("numPeople", "Number of guests", {
            description: "Present guests at the venue.",
            editor: (
              <DesignInput
                type="number"
                min={1}
                max={50}
                inputMode="numeric"
                value={typeof numPeople === "number" ? String(numPeople) : ""}
                onChange={(event) =>
                  setNumPeople(
                    event.target.value ? Number(event.target.value) : undefined,
                  )
                }
              />
            ),
            display: (
              <p className="text-base font-semibold">
                {typeof numPeople === "number" ? numPeople : "—"}
              </p>
            ),
          })}

          {renderEditableCard("ticketType", "Ticket type", {
            description: "Select a ticket profile or add a free-form label.",
            editor:
              ticketTypeOptions.length > 0 ? (
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
                    {ticketTypeOptions.map((option) => (
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

          {renderEditableCard("transport", "Transport method", {
            description: "How the guest arrived for the visit.",
            editor:
              transportOptions.length > 0 ? (
                <DesignSelect
                  value={transport ? transport : SELECT_UNSET_VALUE}
                  onValueChange={(value) =>
                    setTransport(value === SELECT_UNSET_VALUE ? "" : value)
                  }
                >
                  <DesignSelectTrigger aria-label="Transport method">
                    <DesignSelectValue placeholder="Select transport method" />
                  </DesignSelectTrigger>
                  <DesignSelectContent>
                    <DesignSelectItem value={SELECT_UNSET_VALUE}>
                      No transport recorded
                    </DesignSelectItem>
                    {transportOptions.map((option) => (
                      <DesignSelectItem key={option.value} value={option.value}>
                        {option.label}
                      </DesignSelectItem>
                    ))}
                  </DesignSelectContent>
                </DesignSelect>
              ) : (
                <DesignInput
                  value={transport}
                  onChange={(event) => setTransport(event.target.value)}
                  placeholder="e.g. taxi, private"
                />
              ),
            display: (
              <p className="text-base font-semibold">
                {transport ? transport : "—"}
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
