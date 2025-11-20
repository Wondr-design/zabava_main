"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  X,
  Check,
} from "lucide-react";

import { adminApi } from "@/lib/web/api-client";
import type {
  GlobalValueRecord,
  GlobalValueType,
} from "@/lib/data/global-values";
import {
  PageHeader,
  SectionCard,
  DesignButton,
  DesignFormField,
  DesignInput,
  DesignTextarea,
  DesignSwitch,
  DesignSelect,
  DesignSelectContent,
  DesignSelectItem,
  DesignSelectTrigger,
  DesignSelectValue,
  StatusPill,
  FilterChip,
} from "@/components/design-system";

const TYPE_LABELS: Record<GlobalValueType, string> = {
  ticket_type: "Ticket types",
  category: "Categories",
  tag: "Tags",
  listing_tier: "Listing tiers",
  cash_currency: "Cash currencies",
  accepted_payment: "Accepted payments",
  facility: "Facilities",
};

const TYPE_DESCRIPTIONS: Record<GlobalValueType, string> = {
  ticket_type:
    "Configure the standard ticket types that deals, partners, and forms can reference.",
  category:
    "Define reusable categories for partners, deals, or rewards across the platform.",
  tag: "Manage the tag vocabulary used for rewards, deals, and analytics filters.",
  listing_tier:
    "Control the Silver/Gold/Platinum tiers that determine partner spotlight placement.",
  cash_currency:
    "Maintain the list of currencies partners can accept for cash payments.",
  accepted_payment:
    "Define reusable payment method labels (cash, cards, Apple Pay, etc.) that partner profiles can reference.",
  facility:
    "Manage the amenities/facilities icons that appear on partner detail cards.",
};

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
  subOptions: string[]; // Array of ticket type keys for sub-options
}

const EMPTY_FORM: FormState = {
  key: "",
  label: "",
  description: "",
  sortOrder: "0",
  isActive: true,
  subOptions: [],
};

export function GlobalsDashboard({ initialValues }: GlobalsDashboardProps) {
  const [activeType, setActiveType] = useState<GlobalValueType>("ticket_type");
  const [values, setValues] = useState<GlobalsByType>(initialValues);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const currentValues = useMemo(
    () => values[activeType] ?? [],
    [values, activeType]
  );

  // Available ticket types for sub-options (exclude the current one being edited)
  const availableTicketTypesForSubOptions = useMemo(() => {
    if (activeType !== "ticket_type") return [];
    return values.ticket_type
      .filter((t) => !editingId || t.id !== editingId)
      .filter((t) => t.isActive)
      .map((t) => ({ key: t.key, label: t.label }));
  }, [values.ticket_type, editingId, activeType]);

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
      // Store sub-options in metadata for ticket types (always set to ensure clearing works)
      if (activeType === "ticket_type") {
        if (form.subOptions.length > 0) {
          metadata.subOptions = form.subOptions;
        } else if (editingId) {
          // If editing and clearing sub-options, ensure metadata is updated
          metadata.subOptions = [];
        }
      }

      const payload = {
        label: form.label.trim(),
        key: form.key.trim() || undefined,
        description: form.description.trim() || undefined,
        sortOrder: Number.parseInt(form.sortOrder, 10) || 0,
        isActive: form.isActive,
        ...(activeType === "ticket_type" ? { metadata } : {}),
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

  function handleEdit(item: GlobalValueRecord) {
    setEditingId(item.id);
    const subOptions =
      activeType === "ticket_type" &&
      Array.isArray(item.metadata?.subOptions) &&
      typeof item.metadata.subOptions[0] === "string"
        ? (item.metadata.subOptions as string[])
        : [];
    setForm({
      key: item.key,
      label: item.label,
      description: item.description ?? "",
      sortOrder: `${item.sortOrder ?? 0}`,
      isActive: item.isActive,
      subOptions,
    });
  }

  async function handleDelete(id: string) {
    const item = currentValues.find((value) => value.id === id);
    if (!item) return;
    const confirmDelete = window.confirm(
      `Delete “${item.label}”? This cannot be undone.`
    );
    if (!confirmDelete) return;
    try {
      await adminApi.globalDelete(id, {});
      setValues((prev) => ({
        ...prev,
        [activeType]: prev[activeType].filter((value) => value.id !== id),
      }));
      if (editingId === id) {
        resetForm();
      }
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

  return (
    <div className="space-y-6 px-6 py-8">
      <PageHeader
        title="Global references"
        description="Manage reusable ticket types, categories, tags, and listing tiers for the entire platform."
        actions={
          <DesignButton
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refreshType()}
            disabled={refreshing}
          >
            {refreshing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Refreshing…
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </>
            )}
          </DesignButton>
        }
      />

      <div className="flex flex-wrap gap-2">
        {(Object.keys(TYPE_LABELS) as GlobalValueType[]).map((type) => (
          <FilterChip
            key={type}
            selected={activeType === type}
            onClick={() => {
              setActiveType(type);
              resetForm(type);
            }}
          >
            {TYPE_LABELS[type]}
          </FilterChip>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)]">
        <SectionCard
          title={editingId ? "Edit value" : "Create value"}
          description={TYPE_DESCRIPTIONS[activeType]}
        >
          <form className="space-y-4" onSubmit={handleSubmit}>
            <DesignFormField label="Label" required>
              <DesignInput
                value={form.label}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, label: event.target.value }))
                }
                placeholder="e.g. Adult"
                required
              />
            </DesignFormField>

            <DesignFormField
              label="Key"
              helper="Optional. Derived from the label if left blank."
            >
              <DesignInput
                value={form.key}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, key: event.target.value }))
                }
                placeholder="Derived from the label if left blank"
              />
            </DesignFormField>

            <DesignFormField
              label="Description"
              helper="Optional context for teammates"
            >
              <DesignTextarea
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                rows={3}
                placeholder="Optional context for teammates"
              />
            </DesignFormField>

            {activeType === "ticket_type" && (
              <DesignFormField
                label="Sub-options"
                helper="Select other ticket types that are available as sub-options for this ticket type (e.g., Family can include Child and Adult)"
              >
                <div className="space-y-2">
                  {availableTicketTypesForSubOptions.length === 0 ? (
                    <p className="text-xs text-[color:var(--ds-text-muted)]">
                      No other active ticket types available. Create other
                      ticket types first.
                    </p>
                  ) : (
                    <>
                      {form.subOptions.map((subOptionKey, index) => {
                        const selectedOption =
                          availableTicketTypesForSubOptions.find(
                            (opt) => opt.key === subOptionKey
                          );
                        const availableOptions =
                          availableTicketTypesForSubOptions.filter(
                            (opt) =>
                              !form.subOptions.includes(opt.key) ||
                              opt.key === subOptionKey
                          );
                        return (
                          <div
                            key={`${subOptionKey}-${index}`}
                            className="flex items-center gap-2"
                          >
                            <DesignSelect
                              value={subOptionKey}
                              onValueChange={(value) => {
                                const updated = [...form.subOptions];
                                updated[index] = value;
                                setForm((prev) => ({
                                  ...prev,
                                  subOptions: updated,
                                }));
                              }}
                            >
                              <DesignSelectTrigger className="flex-1">
                                <DesignSelectValue placeholder="Select ticket type" />
                              </DesignSelectTrigger>
                              <DesignSelectContent>
                                {availableOptions.map((opt) => (
                                  <DesignSelectItem
                                    key={opt.key}
                                    value={opt.key}
                                  >
                                    {opt.label}
                                  </DesignSelectItem>
                                ))}
                              </DesignSelectContent>
                            </DesignSelect>
                            <DesignButton
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setForm((prev) => ({
                                  ...prev,
                                  subOptions: prev.subOptions.filter(
                                    (_, i) => i !== index
                                  ),
                                }));
                              }}
                            >
                              <X className="h-4 w-4" />
                              <span className="sr-only">Remove</span>
                            </DesignButton>
                          </div>
                        );
                      })}
                      {form.subOptions.length <
                        availableTicketTypesForSubOptions.length && (
                        <DesignButton
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const nextAvailable =
                              availableTicketTypesForSubOptions.find(
                                (opt) => !form.subOptions.includes(opt.key)
                              );
                            if (nextAvailable) {
                              setForm((prev) => ({
                                ...prev,
                                subOptions: [
                                  ...prev.subOptions,
                                  nextAvailable.key,
                                ],
                              }));
                            }
                          }}
                          className="w-full"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add sub-option
                        </DesignButton>
                      )}
                    </>
                  )}
                </div>
              </DesignFormField>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <DesignFormField label="Sort order">
                <DesignInput
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      sortOrder: event.target.value,
                    }))
                  }
                />
              </DesignFormField>
              <div className="flex flex-col justify-between rounded-lg border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] p-3">
                <div className="space-y-1">
                  <label
                    htmlFor="global-active"
                    className="text-sm font-medium text-[color:var(--ds-text-strong)]"
                  >
                    Active status
                  </label>
                  <p className="text-xs text-[color:var(--ds-text-muted)]">
                    Inactive values stay available historically but cannot be
                    selected in new records.
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <DesignSwitch
                    id="global-active"
                    checked={form.isActive}
                    onCheckedChange={(checked) =>
                      setForm((prev) => ({ ...prev, isActive: checked }))
                    }
                  />
                  <span className="text-sm text-[color:var(--ds-text-muted)]">
                    {form.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <DesignButton type="submit" variant="primary" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {editingId ? "Saving…" : "Creating…"}
                  </>
                ) : editingId ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Save changes
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create value
                  </>
                )}
              </DesignButton>
              {editingId && (
                <DesignButton
                  type="button"
                  variant="outline"
                  onClick={() => resetForm()}
                  disabled={loading}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </DesignButton>
              )}
            </div>
          </form>
        </SectionCard>

        <SectionCard
          title={TYPE_LABELS[activeType]}
          description={
            <>
              {currentValues.length} value
              {currentValues.length === 1 ? "" : "s"} configured
            </>
          }
        >
          {currentValues.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] p-8 text-center">
              <p className="text-sm text-[color:var(--ds-text-muted)]">
                No values yet. Add your first entry to make it available
                throughout the admin experience.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {currentValues.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-4 rounded-xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] p-4 transition hover:border-[color:var(--ds-border-strong)] sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-[color:var(--ds-text-strong)]">
                        {item.label}
                      </span>
                      {item.key && (
                        <StatusPill tone="neutral" size="sm">
                          {item.key}
                        </StatusPill>
                      )}
                      {item.isActive ? (
                        <StatusPill tone="success" size="sm">
                          Active
                        </StatusPill>
                      ) : (
                        <StatusPill tone="warning" size="sm">
                          Inactive
                        </StatusPill>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-sm text-[color:var(--ds-text-muted)]">
                        {item.description}
                      </p>
                    )}
                    {activeType === "ticket_type" &&
                      Array.isArray(item.metadata?.subOptions) &&
                      (item.metadata.subOptions as unknown[]).length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-[color:var(--ds-text-subtle)]">
                            Sub-options:
                          </span>
                          {(item.metadata.subOptions as string[]).map(
                            (subKey) => {
                              const subOption = values.ticket_type.find(
                                (t) => t.key === subKey
                              );
                              return (
                                <StatusPill
                                  key={subKey}
                                  tone="neutral"
                                  size="sm"
                                >
                                  {subOption?.label ?? subKey}
                                </StatusPill>
                              );
                            }
                          )}
                        </div>
                      )}
                    <div className="flex items-center gap-4 text-xs text-[color:var(--ds-text-subtle)]">
                      <span>Sort order: {item.sortOrder}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <DesignButton
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(item)}
                    >
                      <Edit2 className="mr-2 h-3.5 w-3.5" />
                      Edit
                    </DesignButton>
                    <DesignButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handleToggleActive(item)}
                    >
                      {item.isActive ? "Disable" : "Activate"}
                    </DesignButton>
                    <DesignButton
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => void handleDelete(item.id)}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Delete
                    </DesignButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
