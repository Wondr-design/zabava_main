"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Minus,
  Plus,
} from "lucide-react";

import type {
  PartnerFormField,
  PartnerFormRecord,
} from "@/lib/data/partner-forms";
import {
  computePartnerFormMetrics,
  estimatePointsFromMetrics,
} from "@/lib/services/partner-form-metrics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type FieldErrors = Record<string, string>;

export interface RewardRedemptionRunnerProps {
  form: PartnerFormRecord;
  rewardName: string;
  prefillEmail?: string | null;
  submitting: boolean;
  submissionError?: string | null;
  onSubmit: (payload: {
    values: Record<string, unknown>;
    hidden: Record<string, string>;
    labels: Record<string, string>;
  }) => Promise<void>;
  onCancel: () => void;
}

function initializeValues(
  form: PartnerFormRecord,
  prefillEmail?: string | null
) {
  const initial: Record<string, unknown> = {};
  form.config.steps.forEach((step) => {
    step.fields.forEach((field) => {
      const key = field.id;
      switch (field.kind) {
        case "checkbox":
          initial[key] =
            field.defaultValue !== undefined
              ? Boolean(field.defaultValue)
              : false;
          break;
        case "counter": {
          const fallback =
            typeof field.defaultValue === "number"
              ? field.defaultValue
              : typeof field.min === "number"
              ? field.min
              : 1;
          initial[key] = fallback;
          break;
        }
        case "radio":
        case "select":
        case "transport": {
          if (field.defaultValue !== undefined) {
            initial[key] = String(field.defaultValue);
          } else if (field.options?.length) {
            initial[key] = field.options[0]?.value ?? "";
          } else {
            initial[key] = "";
          }
          break;
        }
        default:
          initial[key] = field.defaultValue ?? "";
      }
      if (
        prefillEmail &&
        field.kind === "input" &&
        field.type === "email" &&
        !initial[key]
      ) {
        initial[key] = prefillEmail;
      }
    });
  });
  const transportConfig = form.config.transport;
  if (
    transportConfig?.busFieldId &&
    initial[transportConfig.busFieldId] === undefined
  ) {
    initial[transportConfig.busFieldId] = "";
  }
  return initial;
}

function resolveOptionLabel(field: PartnerFormField, value: unknown) {
  const needle = value !== undefined && value !== null ? String(value) : "";
  const option = field.options?.find(
    (entry) => entry.value === needle || entry.id === needle
  );
  return option?.label ?? needle;
}

function formatFieldValue(field: PartnerFormField, value: unknown) {
  switch (field.kind) {
    case "checkbox":
      return value ? "Yes" : "No";
    case "counter":
      return String(value ?? "0");
    case "radio":
    case "select":
    case "transport":
      return resolveOptionLabel(field, value);
    default:
      return String(value ?? "");
  }
}

function fieldIsEmpty(value: unknown) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  return false;
}

export function RewardRedemptionRunner({
  form,
  rewardName,
  prefillEmail,
  submitting,
  submissionError,
  onSubmit,
  onCancel,
}: RewardRedemptionRunnerProps) {
  const steps = form.config.steps;
  const transportConfig = form.config.transport ?? null;
  const pricingStep = useMemo(() => {
    return (
      steps.find(
        (step) =>
          step.variant === "pricing" &&
          step.pricing &&
          Array.isArray(step.pricing?.bundles)
      ) ?? null
    );
  }, [steps]);

  // Build bundle catalog for interactive selection
  const bundleCatalog = useMemo(() => {
    if (!pricingStep?.pricing?.bundles) return [];
    return pricingStep.pricing.bundles.map((bundle) => ({
      id: bundle.id ?? bundle.ticketType ?? "",
      label: bundle.label ?? bundle.ticketType ?? "",
      description: bundle.description ?? "",
      points: (() => {
        const pointsMatch = bundle.description?.match(/(\d+)\s*pts?/i);
        return pointsMatch ? parseInt(pointsMatch[1], 10) : null;
      })(),
      ticketType: bundle.ticketType ?? null,
      inclusions: bundle.inclusions,
    }));
  }, [pricingStep]);

  const catalogSignature = useMemo(() => {
    return bundleCatalog.map((item) => `b:${item.id}`).join("|");
  }, [bundleCatalog]);

  const [ticketQuantities, setTicketQuantities] = useState<
    Record<string, number>
  >({});

  useEffect(() => {
    setTicketQuantities({});
  }, [catalogSignature]);

  const adjustTicketQuantity = useCallback(
    (id: string, delta: number) => {
      setTicketQuantities((prev) => {
        const next = { ...prev };
        const current = next[id] ?? 0;
        const updated = Math.max(0, current + delta);
        if (updated === 0) {
          delete next[id];
        } else {
          next[id] = updated;
        }
        // Store selected ticket type in form values (use first selected bundle's ticket type)
        const selectedBundle = bundleCatalog.find(
          (b) => b.id === id && updated > 0
        );
        if (selectedBundle?.ticketType) {
          setValues((prev) => ({
            ...prev,
            // Use form config's ticketFieldId if available, otherwise use a default field name
            [form.config.pricing?.ticketFieldId ?? "ticketType"]:
              selectedBundle.ticketType,
          }));
        }
        return next;
      });
    },
    [bundleCatalog, form.config.pricing]
  );

  const [currentStep, setCurrentStep] = useState(0);
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    initializeValues(form, prefillEmail)
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValues(initializeValues(form, prefillEmail));
    setErrors({});
    setCurrentStep(0);
    setError(null);
  }, [form, prefillEmail]);

  const fieldDefinitions = useMemo(() => {
    const map = new Map<string, PartnerFormField>();
    steps.forEach((step) => {
      step.fields.forEach((field) => {
        map.set(field.id, field);
      });
    });
    return map;
  }, [steps]);

  const hiddenValues = useMemo(() => {
    const map: Record<string, string> = {};
    (form.config.hiddenFields ?? []).forEach((hidden) => {
      map[hidden.name] = String(hidden.value ?? "");
    });
    return map;
  }, [form.config.hiddenFields]);

  const getFieldValue = useCallback(
    (fieldId: string) => {
      if (fieldId in values) {
        return values[fieldId];
      }
      if (fieldId in hiddenValues) {
        return hiddenValues[fieldId];
      }
      return undefined;
    },
    [values, hiddenValues]
  );

  const evaluateLogic = useCallback(
    (
      logic?:
        | PartnerFormRecord["config"]["steps"][number]["logic"]
        | PartnerFormField["logic"]
        | null
    ) => {
      if (!logic || (logic.conditions ?? []).length === 0) {
        return true;
      }
      const conditions = logic.conditions ?? [];
      const matches = conditions.every((condition) => {
        const raw = getFieldValue(condition.fieldId ?? "");
        const expected =
          condition.value !== undefined && condition.value !== null
            ? String(condition.value)
            : "";
        const actual = raw === undefined || raw === null ? "" : String(raw);
        if (condition.operator === "not_equals") {
          return actual !== expected;
        }
        return actual === expected;
      });
      if (logic.behavior === "hide") {
        return !matches;
      }
      return matches;
    },
    [getFieldValue]
  );

  const isStepVisible = useCallback(
    (step: PartnerFormRecord["config"]["steps"][number]) =>
      evaluateLogic(step.logic),
    [evaluateLogic]
  );

  const visibleStepIndexes = useMemo(
    () =>
      steps
        .map((step, index) => (isStepVisible(step) ? index : null))
        .filter((index): index is number => index !== null),
    [steps, isStepVisible]
  );

  const fieldLabels = useMemo(() => {
    const map = new Map<string, PartnerFormField>();
    steps.forEach((step) => {
      step.fields.forEach((field) => {
        map.set(field.id, field);
      });
    });
    return map;
  }, [steps]);

  const summaryFields = useMemo(() => {
    const summary = form.config.summary;
    if (!summary) return [];
    return (summary.extraRows ?? [])
      .map((row) => {
        const field = fieldLabels.get(row.name);
        if (!field) return null;
        return {
          id: field.id,
          label: row.label ?? field.label,
          field,
        };
      })
      .filter(
        (
          entry
        ): entry is { id: string; label: string; field: PartnerFormField } =>
          entry !== null
      );
  }, [form.config.summary, fieldLabels]);

  const fallbackSummaryFields = useMemo(() => {
    const entries: {
      id: string;
      label: string;
      field: PartnerFormField;
    }[] = [];
    const skipKinds = new Set([
      "paragraph",
      "title",
      "info",
      "html",
      "heading",
    ]);
    steps.forEach((step) => {
      step.fields.forEach((field) => {
        if (skipKinds.has(field.kind as string)) return;
        entries.push({
          id: field.id,
          label: field.label,
          field,
        });
      });
    });
    return entries;
  }, [steps]);
  const summaryEntries =
    summaryFields.length > 0 ? summaryFields : fallbackSummaryFields;

  const metrics = useMemo(() => {
    return computePartnerFormMetrics(form.config, values);
  }, [form.config, values]);

  const selectedTicketEntries = useMemo(() => {
    return Object.entries(ticketQuantities)
      .map(([bundleId, qty]) => {
        if (qty <= 0) return null;
        const bundle = bundleCatalog.find((entry) => entry.id === bundleId);
        if (!bundle) return null;
        return {
          id: bundleId,
          label: bundle.label,
          quantity: qty,
          points: bundle.points,
          totalPoints: bundle.points !== null ? bundle.points * qty : null,
        };
      })
      .filter(
        (
          entry
        ): entry is {
          id: string;
          label: string;
          quantity: number;
          points: number | null;
          totalPoints: number | null;
        } => entry !== null
      );
  }, [ticketQuantities, bundleCatalog]);

  const estimatedPoints = useMemo(() => {
    if (selectedTicketEntries.length > 0) {
      const total = selectedTicketEntries
        .map((ticket) =>
          ticket.points !== null ? ticket.points * ticket.quantity : null
        )
        .filter((value): value is number => value !== null)
        .reduce((sum, value) => sum + value, 0);
      if (Number.isFinite(total)) return total;
    }
    return estimatePointsFromMetrics(metrics);
  }, [metrics, selectedTicketEntries]);

  function setFieldValue(fieldId: string, value: unknown) {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
    setErrors((prev) => {
      if (!prev[fieldId]) return prev;
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  }

  function validateField(field: PartnerFormField) {
    if (!evaluateLogic(field.logic)) {
      return null;
    }
    if (!field.required) return null;
    const value = values[field.id];
    if (fieldIsEmpty(value)) {
      return "This field is required.";
    }

    if (field.kind === "input") {
      if (field.type === "email") {
        const emailValue = String(value ?? "");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
          return "Enter a valid email.";
        }
      }
      if (field.type === "number") {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
          return "Enter a valid number.";
        }
        if (field.min !== undefined && numeric < field.min) {
          return `Minimum value is ${field.min}.`;
        }
        if (field.max !== undefined && numeric > field.max) {
          return `Maximum value is ${field.max}.`;
        }
      }
    }

    if (field.kind === "counter" && value !== undefined) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) {
        return "Enter a valid number.";
      }
      if (field.min !== undefined && numeric < field.min) {
        return `Minimum value is ${field.min}.`;
      }
      if (field.max !== undefined && numeric > field.max) {
        return `Maximum value is ${field.max}.`;
      }
    }

    return null;
  }

  function validateStep(stepIndex: number) {
    const step = steps[stepIndex];
    if (!step) return true;
    const nextErrors: FieldErrors = {};
    step.fields.forEach((field) => {
      if (!evaluateLogic(field.logic)) {
        return;
      }
      const message = validateField(field);
      if (message) {
        nextErrors[field.id] = message;
      }
      if (
        field.kind === "transport" &&
        transportConfig?.busFieldId &&
        (transportConfig.partners?.length ?? 0) > 0
      ) {
        const yesValue = (
          transportConfig.yesValue ??
          (field.options ?? []).find((opt) => opt.value)?.value ??
          "Yes"
        ).toLowerCase();
        const transportValue = String(values[field.id] ?? "").toLowerCase();
        if (transportValue === yesValue) {
          const linked = values[transportConfig.busFieldId];
          const partnerSelected =
            typeof linked === "string" && linked.trim().length > 0;
          if (!partnerSelected) {
            nextErrors[transportConfig.busFieldId] =
              "Select a transport partner.";
          }
        }
      }
    });
    if (Object.keys(nextErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...nextErrors }));
      return false;
    }
    setErrors((prev) => {
      const next = { ...prev };
      step.fields.forEach((field) => {
        delete next[field.id];
      });
      return next;
    });
    return true;
  }

  function handleNext() {
    if (visibleStepIndexes.length === 0) {
      setCurrentStep(steps.length);
      return;
    }
    const reviewStepIndex = steps.length;
    if (currentStep === reviewStepIndex) return;
    const position = visibleStepIndexes.indexOf(currentStep);
    const stepIndexToValidate =
      position === -1 ? visibleStepIndexes[0] : visibleStepIndexes[position];
    if (!validateStep(stepIndexToValidate)) return;
    const nextVisible =
      position === -1
        ? visibleStepIndexes[0]
        : visibleStepIndexes[position + 1];
    if (nextVisible !== undefined) {
      setCurrentStep(nextVisible);
    } else {
      setCurrentStep(reviewStepIndex);
    }
  }

  function handleBack() {
    const reviewStepIndex = steps.length;
    if (currentStep === reviewStepIndex) {
      const lastVisible = visibleStepIndexes[visibleStepIndexes.length - 1];
      setCurrentStep(lastVisible ?? 0);
      return;
    }
    const position = visibleStepIndexes.indexOf(currentStep);
    if (position <= 0) {
      setCurrentStep(visibleStepIndexes[0] ?? 0);
    } else {
      setCurrentStep(visibleStepIndexes[position - 1]);
    }
  }

  async function handleSubmit() {
    setError(null);
    for (const stepIndex of visibleStepIndexes) {
      if (!validateStep(stepIndex)) {
        setCurrentStep(stepIndex);
        return;
      }
    }

    const labels: Record<string, string> = {};
    fieldDefinitions.forEach((field, key) => {
      labels[key] = field.label;
    });

    try {
      await onSubmit({
        values: {
          ...values,
          __ticketSelections: selectedTicketEntries,
        },
        hidden: hiddenValues,
        labels,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit form");
    }
  }

  function renderField(field: PartnerFormField) {
    const value = values[field.id];
    const fieldError = errors[field.id];
    const helper = field.helperText;
    const label = field.label;

    switch (field.kind) {
      case "textarea":
        return (
          <div className="space-y-2" key={field.id}>
            <label className="text-sm font-medium text-white">{label}</label>
            <Textarea
              value={String(value ?? "")}
              onChange={(event) => setFieldValue(field.id, event.target.value)}
              placeholder={field.placeholder}
              className="min-h-[140px] border-white/10 bg-slate-950/70 text-white"
            />
            {helper ? (
              <p className="text-xs text-indigo-200/70">{helper}</p>
            ) : null}
            {fieldError ? (
              <p className="text-xs text-rose-300">{fieldError}</p>
            ) : null}
          </div>
        );
      case "checkbox":
        return (
          <label
            key={field.id}
            className={cn(
              "flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white",
              fieldError ? "border-rose-400" : ""
            )}
          >
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(event) =>
                setFieldValue(field.id, event.target.checked)
              }
              className="h-5 w-5 rounded border-white/20 bg-transparent text-indigo-400"
            />
            <span className="flex-1">
              {label}
              {helper ? (
                <span className="block text-xs text-indigo-200/70">
                  {helper}
                </span>
              ) : null}
              {fieldError ? (
                <span className="block text-xs text-rose-300">
                  {fieldError}
                </span>
              ) : null}
            </span>
          </label>
        );
      case "radio":
        return (
          <div className="space-y-3" key={field.id}>
            <p className="text-sm font-medium text-white">{label}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(field.options ?? []).map((option) => {
                const selected = String(value ?? "") === option.value;
                const optionRecord = option as Record<string, unknown>;
                const optionDescription =
                  typeof optionRecord.description === "string"
                    ? optionRecord.description
                    : undefined;
                return (
                  <button
                    type="button"
                    key={option.id}
                    onClick={() => setFieldValue(field.id, option.value)}
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-left text-sm transition",
                      selected
                        ? "border-indigo-400/80 bg-indigo-500/20 text-white"
                        : "border-white/10 bg-slate-950/60 text-indigo-100 hover:border-indigo-300/70"
                    )}
                  >
                    <div className="font-medium">{option.label}</div>
                    {optionDescription ? (
                      <div className="text-xs text-indigo-200/70">
                        {optionDescription}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
            {helper ? (
              <p className="text-xs text-indigo-200/70">{helper}</p>
            ) : null}
            {fieldError ? (
              <p className="text-xs text-rose-300">{fieldError}</p>
            ) : null}
          </div>
        );
      case "transport": {
        const transportYesValue = (
          transportConfig?.yesValue ??
          (field.options ?? []).find((opt) => opt.value)?.value ??
          "Yes"
        ).toLowerCase();
        const selectedValue = String(value ?? "");
        const isTransportSelected =
          selectedValue.toLowerCase() === transportYesValue;
        const selectedPartnerValue = transportConfig?.busFieldId
          ? String(values[transportConfig.busFieldId] ?? "")
          : "";
        const busFieldError = transportConfig?.busFieldId
          ? errors[transportConfig.busFieldId]
          : undefined;
        return (
          <div className="space-y-4" key={field.id}>
            <div className="space-y-3">
              <p className="text-sm font-medium text-white">{label}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {(field.options ?? []).map((option) => {
                  const selected = String(value ?? "") === option.value;
                  const optionRecord = option as Record<string, unknown>;
                  const optionDescription =
                    typeof optionRecord.description === "string"
                      ? optionRecord.description
                      : undefined;
                  return (
                    <button
                      type="button"
                      key={option.id}
                      onClick={() => {
                        setValues((prev) => {
                          const next: Record<string, unknown> = {
                            ...prev,
                            [field.id]: option.value,
                          };
                          if (
                            transportConfig?.busFieldId &&
                            option.value.toLowerCase() !== transportYesValue
                          ) {
                            next[transportConfig.busFieldId] = "";
                          }
                          return next;
                        });
                        setErrors((prev) => {
                          const cleared = { ...prev };
                          delete cleared[field.id];
                          if (transportConfig?.busFieldId) {
                            delete cleared[transportConfig.busFieldId];
                          }
                          return cleared;
                        });
                      }}
                      className={cn(
                        "rounded-2xl border px-4 py-3 text-left text-sm transition",
                        selected
                          ? "border-emerald-300/80 bg-emerald-500/20 text-white"
                          : "border-white/10 bg-slate-950/60 text-indigo-100 hover:border-indigo-300/70"
                      )}
                    >
                      <div className="font-medium">{option.label}</div>
                      {optionDescription ? (
                        <div className="text-xs text-indigo-200/70">
                          {optionDescription}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {isTransportSelected && transportConfig?.partners?.length ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-white">
                  Select transport partner
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {transportConfig.partners.map((partner) => {
                    const partnerSelected =
                      partner.value === selectedPartnerValue;
                    return (
                      <button
                        type="button"
                        key={partner.id ?? partner.value}
                        onClick={() => {
                          if (!transportConfig.busFieldId) return;
                          setValues((prev) => ({
                            ...prev,
                            [transportConfig.busFieldId!]: partner.value,
                            [field.id]:
                              prev[field.id] ??
                              (field.options ?? [])[0]?.value ??
                              "Yes",
                          }));
                          setErrors((prev) => {
                            if (!transportConfig.busFieldId) return prev;
                            if (!prev[transportConfig.busFieldId]) return prev;
                            const cleared = { ...prev };
                            delete cleared[transportConfig.busFieldId];
                            return cleared;
                          });
                        }}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition",
                          partnerSelected
                            ? "border-emerald-300/80 bg-emerald-500/20 text-white"
                            : "border-white/10 bg-slate-950/60 text-indigo-100 hover:border-indigo-300/70"
                        )}
                      >
                        <span className="font-medium">{partner.label}</span>
                        {partnerSelected ? (
                          <Check className="h-4 w-4 text-emerald-200" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                {busFieldError ? (
                  <p className="text-xs text-rose-300">{busFieldError}</p>
                ) : null}
              </div>
            ) : null}

            {helper ? (
              <p className="text-xs text-indigo-200/70">{helper}</p>
            ) : null}
            {fieldError ? (
              <p className="text-xs text-rose-300">{fieldError}</p>
            ) : null}
          </div>
        );
      }
      case "select":
        return (
          <div className="space-y-2" key={field.id}>
            <label className="text-sm font-medium text-white">{label}</label>
            <select
              value={String(value ?? "")}
              onChange={(event) => setFieldValue(field.id, event.target.value)}
              className={cn(
                "w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-white",
                fieldError ? "border-rose-400" : ""
              )}
            >
              {(field.options ?? []).map((option) => (
                <option key={option.id} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {helper ? (
              <p className="text-xs text-indigo-200/70">{helper}</p>
            ) : null}
            {fieldError ? (
              <p className="text-xs text-rose-300">{fieldError}</p>
            ) : null}
          </div>
        );
      case "counter": {
        const numericValue = Number(value ?? 1);
        return (
          <div className="space-y-2" key={field.id}>
            <label className="text-sm font-medium text-white">{label}</label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="border-white/10 bg-slate-950/60 text-white"
                onClick={() =>
                  setFieldValue(
                    field.id,
                    Math.max(field.min ?? 1, numericValue - (field.step ?? 1))
                  )
                }
              >
                -
              </Button>
              <span className="w-12 text-center text-lg font-semibold text-white">
                {numericValue}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="border-white/10 bg-slate-950/60 text-white"
                onClick={() =>
                  setFieldValue(
                    field.id,
                    Math.min(field.max ?? 99, numericValue + (field.step ?? 1))
                  )
                }
              >
                +
              </Button>
            </div>
            {helper ? (
              <p className="text-xs text-indigo-200/70">{helper}</p>
            ) : null}
            {fieldError ? (
              <p className="text-xs text-rose-300">{fieldError}</p>
            ) : null}
          </div>
        );
      }
      default:
        return (
          <div className="space-y-2" key={field.id}>
            <label className="text-sm font-medium text-white">{label}</label>
            <Input
              value={String(value ?? "")}
              onChange={(event) => setFieldValue(field.id, event.target.value)}
              placeholder={field.placeholder}
              type={
                field.type === "number"
                  ? "number"
                  : field.type === "email"
                  ? "email"
                  : "text"
              }
              className={cn(
                "border-white/10 bg-slate-950/60 text-white",
                fieldError ? "border-rose-400" : ""
              )}
            />
            {helper ? (
              <p className="text-xs text-indigo-200/70">{helper}</p>
            ) : null}
            {fieldError ? (
              <p className="text-xs text-rose-300">{fieldError}</p>
            ) : null}
          </div>
        );
    }
  }

  function renderPricingStepContent() {
    if (bundleCatalog.length === 0) {
      return (
        <p className="text-sm text-indigo-200/80">
          Ticket types haven{"\u2019"}t been configured for this reward yet.
        </p>
      );
    }

    return (
      <div className="space-y-6">
        <div className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/50 p-6">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-white">Ticket bundles</h3>
            <p className="text-sm text-indigo-200/80">
              Choose the ticket types you want to redeem. You can select
              multiple bundles.
            </p>
          </div>
          <div className="space-y-3">
            {bundleCatalog.map((bundle) => {
              const quantity = ticketQuantities[bundle.id] ?? 0;
              return (
                <div
                  key={bundle.id}
                  className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-base font-semibold text-white">
                        {bundle.label}
                      </div>
                      {bundle.points !== null && (
                        <div className="rounded-full bg-amber-400/20 px-3 py-1 text-sm font-semibold text-amber-300">
                          {bundle.points}{" "}
                          {bundle.points === 1 ? "point" : "points"}
                        </div>
                      )}
                    </div>
                    {bundle.description &&
                      bundle.description !== `${bundle.points} pts` && (
                        <p className="text-sm text-indigo-200/80">
                          {bundle.description}
                        </p>
                      )}
                    {bundle.inclusions && (
                      <div className="flex flex-wrap gap-3 text-xs text-indigo-200/70">
                        {bundle.inclusions.adults !== null &&
                          bundle.inclusions.adults !== undefined && (
                            <span>Adults: {bundle.inclusions.adults}</span>
                          )}
                        {bundle.inclusions.children !== null &&
                          bundle.inclusions.children !== undefined && (
                            <span>Children: {bundle.inclusions.children}</span>
                          )}
                        {bundle.inclusions.teens !== null &&
                          bundle.inclusions.teens !== undefined && (
                            <span>Teens: {bundle.inclusions.teens}</span>
                          )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => adjustTicketQuantity(bundle.id, -1)}
                        disabled={quantity === 0}
                        className="h-8 w-8 border-white/20 text-white"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-10 text-center text-base font-semibold text-white">
                        {quantity}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => adjustTicketQuantity(bundle.id, 1)}
                        className="h-8 w-8 border-white/20 text-white"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {selectedTicketEntries.length > 0 ? (
            <div className="space-y-2 rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.25em] text-indigo-200/70">
                  Selected tickets
                </span>
                <span className="font-semibold text-white">
                  {estimatedPoints !== null
                    ? `${estimatedPoints.toLocaleString()} pts`
                    : "—"}
                </span>
              </div>
              <ul className="space-y-1 text-white">
                {selectedTicketEntries.map((ticket) => (
                  <li
                    key={`selected-${ticket.id}`}
                    className="flex items-center justify-between"
                  >
                    <span>
                      {ticket.label} × {ticket.quantity}
                    </span>
                    <span className="text-indigo-200/80">
                      {ticket.totalPoints !== null
                        ? `${ticket.totalPoints.toLocaleString()} pts`
                        : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  function renderStep(
    step: PartnerFormRecord["config"]["steps"][number],
    stepNumber: number,
    totalSteps: number
  ) {
    const isPricingStep = step.variant === "pricing" && step.pricing;

    return (
      <div className="space-y-5">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.3em] text-indigo-200/70">
            Step {stepNumber} of {totalSteps}
          </p>
          <h2 className="text-xl font-semibold text-white">{step.title}</h2>
          {step.subtitle ? (
            <p className="text-sm text-indigo-200/80">{step.subtitle}</p>
          ) : null}
          {step.description ? (
            <p className="text-sm text-indigo-200/70">{step.description}</p>
          ) : null}
        </div>
        {isPricingStep ? (
          renderPricingStepContent()
        ) : (
          <div className="space-y-4">
            {step.fields.map((field) =>
              evaluateLogic(field.logic) ? renderField(field) : null
            )}
          </div>
        )}
      </div>
    );
  }

  function renderSummary() {
    const displaySummaryEntries = summaryEntries.filter(
      (entry) => !fieldIsEmpty(values[entry.id])
    );
    const showEmptyMessage =
      displaySummaryEntries.length === 0 && selectedTicketEntries.length === 0;

    return (
      <div className="space-y-4 text-white">
        <h2 className="text-xl font-semibold">
          {form.config.summary?.title ?? "Review your selection"}
        </h2>
        <p className="text-sm text-indigo-200/80">
          {form.config.summary?.note ??
            "Confirm the details to generate your bonus QR code."}
        </p>
        <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          {displaySummaryEntries.length > 0
            ? displaySummaryEntries.map((field) => (
                <div
                  key={`summary-${field.id}`}
                  className="flex flex-col gap-1 rounded-xl border border-white/5 bg-slate-950/60 px-3 py-2"
                >
                  <span className="text-xs uppercase tracking-[0.25em] text-indigo-200/70">
                    {field.label}
                  </span>
                  <span className="text-sm text-white">
                    {formatFieldValue(field.field, values[field.id]) || "—"}
                  </span>
                </div>
              ))
            : null}
          {selectedTicketEntries.length > 0 ? (
            <div className="flex flex-col gap-2 rounded-xl border border-white/5 bg-slate-950/60 px-3 py-2">
              <span className="text-xs uppercase tracking-[0.25em] text-indigo-200/70">
                Selected tickets
              </span>
              <ul className="space-y-1 text-sm text-white">
                {selectedTicketEntries.map((ticket) => (
                  <li key={ticket.id} className="flex items-center justify-between">
                    <span>
                      {ticket.label} × {ticket.quantity}
                    </span>
                    <span className="text-indigo-200/80">
                      {ticket.totalPoints !== null
                        ? `${ticket.totalPoints.toLocaleString()} pts`
                        : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {showEmptyMessage ? (
            <p className="text-sm text-indigo-200/70">
              No additional details required. You can confirm the redemption
              now.
            </p>
          ) : null}
        </div>

        <div className="space-y-2 rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-indigo-200/80">
              {form.config.summary?.pointsLabel ?? "Estimated points"}
            </span>
            <span className="font-semibold text-white">
              {estimatedPoints !== null ? estimatedPoints : "—"}
            </span>
          </div>
          {metrics.transportSelected ? (
            <div className="flex items-center justify-between">
              <span className="text-indigo-200/80">
                {form.config.summary?.busLabel ?? "Transport"}
              </span>
              <span className="font-semibold text-white">
                {metrics.transportPartner ?? "Requested"}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const totalSteps = visibleStepIndexes.length;
  const currentVisibleIndex = visibleStepIndexes.indexOf(currentStep);
  const displayStepNumber =
    currentVisibleIndex === -1 ? totalSteps : currentVisibleIndex + 1;
  const isReviewStep = currentStep === steps.length;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.3em] text-indigo-200/70">
          {isReviewStep
            ? "Confirm details"
            : `Step ${displayStepNumber} of ${totalSteps}`}
        </p>
        <h1 className="text-2xl font-semibold text-white">{rewardName}</h1>
        <p className="text-sm text-indigo-200/80">
          Complete the redemption form to generate the bonus QR code.
        </p>
      </div>

      <div className="space-y-4">
        {isReviewStep
          ? renderSummary()
          : visibleStepIndexes.length === 0
          ? null
          : renderStep(steps[currentStep], displayStepNumber, totalSteps)}
      </div>

      {error ? (
        <p className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-100">
          {error}
        </p>
      ) : null}
      {submissionError ? (
        <p className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-100">
          {submissionError}
        </p>
      ) : null}

      <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            className="text-slate-200 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            disabled={
              isReviewStep
                ? visibleStepIndexes.length === 0
                : currentVisibleIndex <= 0
            }
            className="flex items-center gap-2 border-white/20 text-white hover:border-white/40"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
        <Button
          type="button"
          onClick={isReviewStep ? handleSubmit : handleNext}
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-5 py-2 font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating…
            </>
          ) : isReviewStep ? (
            "Generate QR"
          ) : (
            <>
              Next
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
