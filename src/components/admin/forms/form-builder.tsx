"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  PartnerFormRecord,
  PartnerFormConfig,
  PartnerFormField,
  MAX_QR_EXPIRY_SECONDS,
  DEFAULT_QR_EXPIRY_SECONDS,
  PartnerFormStepCondition,
  PartnerFormStepLogic,
  buildPricingStepFromDealRequirements,
  buildPricingStepFromTicketing,
  type PartnerFormPricingBundle,
  type PartnerFormPricingAddon,
} from "@/lib/data/partner-forms";
import type { FlashDealStatus, DealType } from "@/lib/data/flash-deals";
import type { DealTicketRequirement } from "@/lib/deals/ticket-requirements";
import { adminApi } from "@/lib/web/api-client";
import { getCsrfToken } from "@/lib/web/csrf";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type {
  PartnerRelationship,
  PartnerMetaTicketing,
} from "@/lib/data/partners";
import type { RewardRecord } from "@/lib/data/rewards";
import { useGlobalValues } from "@/hooks/use-global-values";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  Save,
  RefreshCcw,
  CheckCircle2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { LocalizedLink } from "@/components/ui/localized-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ImageUploadField } from "@/components/admin/media/image-upload-field";

type PartnerOption = {
  id: string;
  displayName: string | null;
  type?: "standard" | "transport";
};

type DealOption = {
  id: string;
  title: string;
  slug: string | null;
  status: FlashDealStatus;
  partnerId: string;
  partnerName: string | null;
  dealType: DealType;
  minVisitors: number | null;
  ticketRequirements: DealTicketRequirement[];
  timeZoneLabel: string;
};

interface AdminFormBuilderProps {
  forms: PartnerFormRecord[];
  partners: PartnerOption[];
  initialSelectedId?: string | null;
  rewards: RewardRecord[];
  deals: DealOption[];
}

const FIELD_KIND_LABEL: Record<string, string> = {
  input: "Input",
  textarea: "Textarea",
  radio: "Choice",
  select: "Select",
  checkbox: "Checkbox",
  counter: "Counter",
  transport: "Transport",
};

const ADDABLE_FIELD_KINDS: SupportedFieldKind[] = [
  "input",
  "textarea",
  "checkbox",
  "counter",
  "radio",
  "select",
];

const SECONDS_IN_DAY = 60 * 60 * 24;
const MIN_QR_EXPIRY_SECONDS = 60;

function clampQrExpiry(seconds?: number | null) {
  const numeric = Number(seconds);
  const fallback = DEFAULT_QR_EXPIRY_SECONDS;
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback;
  }
  const normalized = Math.floor(numeric);
  return Math.min(
    Math.max(normalized, MIN_QR_EXPIRY_SECONDS),
    MAX_QR_EXPIRY_SECONDS
  );
}

function formatExpiryDays(seconds?: number | null) {
  const fallback = Math.round(DEFAULT_QR_EXPIRY_SECONDS / SECONDS_IN_DAY);
  const numeric = Number(seconds);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback.toString();
  }
  const days = numeric / SECONDS_IN_DAY;
  if (!Number.isFinite(days) || days <= 0) {
    return fallback.toString();
  }
  return Math.round(days).toString();
}

const STATUS_OPTIONS: Array<{
  value: PartnerFormRecord["status"];
  label: string;
  helper: string;
}> = [
  {
    value: "draft",
    label: "Saved",
    helper: "Keep editing until you’re ready to go live.",
  },
  {
    value: "published",
    label: "Live",
    helper: "Booking pages load this form for the selected partner.",
  },
  {
    value: "archived",
    label: "Archived",
    helper: "Hidden from use but preserved for later.",
  },
];

const STATUS_BADGE_CLASS: Record<PartnerFormRecord["status"], string> = {
  draft: "border-sky-100 bg-sky-50 text-sky-700",
  published: "border-emerald-100 bg-emerald-50 text-emerald-700",
  archived: "border-border bg-muted text-muted-foreground",
};

function getStatusOption(value: PartnerFormRecord["status"]) {
  return (
    STATUS_OPTIONS.find((option) => option.value === value) ?? STATUS_OPTIONS[0]
  );
}

function cloneForm(record: PartnerFormRecord): PartnerFormRecord {
  return {
    ...record,
    config: JSON.parse(JSON.stringify(record.config)) as PartnerFormConfig,
  };
}

function generateOptionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

function ensureTransport(config: PartnerFormConfig) {
  if (!config.transport) {
    config.transport = {
      enabled: false,
      yesLabel: "Yes",
      noLabel: "No",
      yesValue: "Yes",
      noValue: "No",
      busFieldId: "transportBus",
      partners: [],
      busFee: config.pricing?.transportFee ?? 0,
    };
  }
  return config.transport;
}

function ensureDeal(config: PartnerFormConfig) {
  if (!config.deal) {
    config.deal = {
      visitorsFieldId: "",
    };
  }
  return config.deal;
}

type SupportedFieldKind = Exclude<PartnerFormField["kind"], undefined>;
type StepCondition = PartnerFormStepCondition;
type StepBehavior = PartnerFormStepLogic["behavior"];

function createFieldTemplate(
  kind: SupportedFieldKind,
  overrides: Partial<PartnerFormField> = {}
): PartnerFormField {
  const id = overrides.id ?? `field-${generateOptionId()}`;
  const base: PartnerFormField = {
    id,
    kind,
    name: overrides.name ?? `${id}`.replace(/[^a-zA-Z0-9]+/g, "_"),
    label: overrides.label ?? "New field",
    required: false,
  };

  switch (kind) {
    case "input":
      return {
        ...base,
        type: "text",
        placeholder: "",
        ...overrides,
      };
    case "textarea":
      return {
        ...base,
        placeholder: "",
        ...overrides,
      };
    case "checkbox":
      return {
        ...base,
        defaultValue: false,
        ...overrides,
      };
    case "counter":
      return {
        ...base,
        min: 1,
        step: 1,
        defaultValue: 1,
        ...overrides,
      };
    case "radio":
    case "select":
      return {
        ...base,
        options: [
          {
            id: generateOptionId(),
            label: "Option A",
            value: "option-a",
          },
          {
            id: generateOptionId(),
            label: "Option B",
            value: "option-b",
          },
        ],
        ...overrides,
      };
    case "transport":
      return {
        ...base,
        note: overrides.note ?? "",
        options: [
          { id: generateOptionId(), label: "No", value: "No" },
          { id: generateOptionId(), label: "Yes", value: "Yes" },
        ],
      };
    default:
      return {
        ...base,
        ...overrides,
      };
  }
}

function createStepTemplate(index: number): PartnerFormConfig["steps"][number] {
  const numeric = index + 1;
  return {
    id: `step-${generateOptionId()}`,
    title: `Step ${numeric}`,
    subtitle: "",
    description: "",
    variant: "fields",
    logic: { behavior: "show", conditions: [] },
    fields: [
      createFieldTemplate("input", {
        label: "New field",
        name: `field_${numeric}`,
        placeholder: "Type here",
      }),
    ],
  };
}

function collectFieldMap(config: PartnerFormConfig) {
  const map = new Map<string, PartnerFormField>();
  for (const step of config.steps) {
    for (const field of step.fields) {
      map.set(field.id, field);
    }
  }
  return map;
}

function convertFieldKind(
  field: PartnerFormField,
  nextKind: SupportedFieldKind
): PartnerFormField {
  const base = createFieldTemplate(nextKind, {
    id: field.id,
    label: field.label,
    name: field.name,
    helperText: field.helperText,
    required: field.required,
  });
  if (nextKind === "input") {
    return {
      ...base,
      type: field.type ?? "text",
      placeholder: field.placeholder ?? "",
    };
  }
  if (nextKind === "textarea") {
    return {
      ...base,
      placeholder: field.placeholder ?? "",
    };
  }
  if (nextKind === "checkbox") {
    return {
      ...base,
      defaultValue: Boolean(field.defaultValue),
    };
  }
  if (nextKind === "counter") {
    return {
      ...base,
      min: field.min ?? 1,
      max: field.max,
      step: field.step ?? 1,
      defaultValue:
        typeof field.defaultValue === "number" ? field.defaultValue : 1,
    };
  }
  if (nextKind === "radio" || nextKind === "select") {
    return {
      ...base,
      options:
        field.options?.map((option) => ({
          ...option,
          price: option.price,
        })) ?? base.options,
    };
  }
  if (nextKind === "transport") {
    return {
      ...base,
      note: field.note ?? "",
    };
  }
  return { ...base };
}

function isPricingStep(step: PartnerFormConfig["steps"][number]) {
  return step.variant === "pricing";
}

function buildDealRequirementLabel(requirement: DealTicketRequirement) {
  if (requirement.subType) {
    return `${requirement.subType} · ${requirement.ticketType}`;
  }
  return requirement.ticketType;
}

function doesPricingStepMatchDeal(
  step: PartnerFormConfig["steps"][number],
  requirements: DealTicketRequirement[]
) {
  if (!isPricingStep(step)) {
    return false;
  }
  const bundles = step.pricing?.bundles ?? [];
  if (bundles.length !== requirements.length) {
    return false;
  }
  return bundles.every((bundle, index) => {
    const requirement = requirements[index];
    return (
      bundle.ticketType === requirement.ticketType &&
      bundle.label === buildDealRequirementLabel(requirement)
    );
  });
}

function ensurePricingPayload(
  pricing?: PartnerFormConfig["steps"][number]["pricing"]
) {
  return {
    currency: pricing?.currency ?? "CZK",
    allowCustomTotals:
      pricing?.allowCustomTotals === undefined
        ? true
        : pricing.allowCustomTotals,
    bundles: Array.isArray(pricing?.bundles) ? [...pricing!.bundles] : [],
    addons: Array.isArray(pricing?.addons) ? [...pricing!.addons] : [],
  };
}

type PricingPayload = ReturnType<typeof ensurePricingPayload>;

function createPricingBundleTemplate(): PartnerFormPricingBundle {
  return {
    id: `bundle-${generateOptionId()}`,
    ticketType: "",
    label: "New bundle",
    description: "",
    price: null,
    discountedPrice: null,
    inclusions: {},
  };
}

function createPricingAddonTemplate(): PartnerFormPricingAddon {
  return {
    id: `addon-${generateOptionId()}`,
    label: "New add-on",
    appliesToTicketType: "",
    description: "",
    price: null,
    discountedPrice: null,
    maxPerBooking: null,
  };
}

function parseAmountInput(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function cleanupConfig(config: PartnerFormConfig) {
  const fieldMap = collectFieldMap(config);
  if (config.deal) {
    const visitorsField = config.deal.visitorsFieldId
      ? fieldMap.get(config.deal.visitorsFieldId)
      : undefined;
    if (!visitorsField) {
      const fallbackCounter = Array.from(fieldMap.values()).find(
        (field) =>
          field.kind === "counter" ||
          (field.kind === "input" && field.type === "number")
      );
      if (fallbackCounter) {
        config.deal.visitorsFieldId = fallbackCounter.id;
      } else {
        config.deal = undefined;
      }
    }
    if (config.deal) {
      if (
        config.deal.consentFieldId &&
        !fieldMap.has(config.deal.consentFieldId)
      ) {
        config.deal.consentFieldId = undefined;
      }
      if (config.deal.notesFieldId && !fieldMap.has(config.deal.notesFieldId)) {
        config.deal.notesFieldId = undefined;
      }
    }
  }
  if (config.pricing) {
    if (!fieldMap.has(config.pricing.ticketFieldId)) {
      const fallbackTicket = Array.from(fieldMap.values()).find(
        (field) => field.kind === "radio"
      );
      if (fallbackTicket) {
        config.pricing.ticketFieldId = fallbackTicket.id;
        config.pricing.ticketPricing =
          fallbackTicket.options?.map((option) => ({
            value: option.value,
            label: option.label,
            price: option.price ?? 0,
          })) ?? [];
      } else {
        config.pricing = undefined;
      }
    }
    if (config.pricing) {
      if (!fieldMap.has(config.pricing.peopleFieldId)) {
        const counterField = Array.from(fieldMap.values()).find(
          (field) => field.kind === "counter"
        );
        if (counterField) {
          config.pricing.peopleFieldId = counterField.id;
        } else {
          config.pricing = undefined;
        }
      }
      if (config.pricing) {
        if (
          config.pricing.transportFieldId &&
          !fieldMap.has(config.pricing.transportFieldId)
        ) {
          config.pricing.transportFieldId = undefined;
        }
        if (
          config.pricing.transportBusFieldId &&
          !fieldMap.has(config.pricing.transportBusFieldId)
        ) {
          config.pricing.transportBusFieldId = undefined;
        }
      }
    }
  }
  if (config.transport) {
    const transportField = Array.from(fieldMap.values()).find(
      (field) => field.kind === "transport"
    );
    if (!transportField) {
      config.transport.enabled = false;
    }
  }
  config.steps = config.steps.map((step) => {
    const nextStep = { ...step };
    if (nextStep.logic) {
      const filteredConditions = (nextStep.logic.conditions ?? []).filter(
        (condition) =>
          typeof condition.fieldId === "string" &&
          condition.fieldId.trim().length > 0 &&
          fieldMap.has(condition.fieldId)
      );
      if (filteredConditions.length > 0) {
        nextStep.logic = {
          behavior: nextStep.logic.behavior ?? "show",
          conditions: filteredConditions,
        };
      } else {
        if (nextStep.logic.behavior && nextStep.logic.behavior !== "show") {
          nextStep.logic = {
            behavior: nextStep.logic.behavior,
            conditions: [],
          };
        } else {
          delete nextStep.logic;
        }
      }
    }
    nextStep.fields = nextStep.fields.map((field) => {
      if (!field.logic) return field;
      const filteredConditions = (field.logic.conditions ?? []).filter(
        (condition) =>
          typeof condition.fieldId === "string" &&
          condition.fieldId.trim().length > 0 &&
          fieldMap.has(condition.fieldId)
      );
      if (filteredConditions.length === 0) {
        if (field.logic.behavior && field.logic.behavior !== "show") {
          return {
            ...field,
            logic: {
              behavior: field.logic.behavior,
              conditions: [],
            },
          };
        }
        const nextField = { ...field } as Record<string, unknown>;
        delete nextField.logic;
        return nextField as PartnerFormField;
      }
      return {
        ...field,
        logic: {
          behavior: field.logic.behavior ?? "show",
          conditions: filteredConditions,
        },
      };
    });
    return nextStep;
  });
  config.qrExpiresInSeconds = clampQrExpiry(config.qrExpiresInSeconds);
  return config;
}

export function AdminFormBuilder({
  forms: initialForms,
  partners,
  initialSelectedId,
  rewards,
  deals,
}: AdminFormBuilderProps) {
  const defaultSelected =
    (initialSelectedId
      ? initialForms.find((item) => item.id === initialSelectedId)
      : initialForms[0]) ??
    initialForms[0] ??
    null;

  const [forms, setForms] = useState(initialForms);
  const [selectedId, setSelectedId] = useState<string | null>(
    defaultSelected?.id ?? null
  );
  const [draft, setDraft] = useState<PartnerFormRecord | null>(
    defaultSelected ? cloneForm(defaultSelected) : null
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [childRelationships, setChildRelationships] = useState<
    PartnerRelationship[]
  >([]);
  const [loadingRelationships, setLoadingRelationships] = useState(false);
  const [partnerTicketing, setPartnerTicketing] =
    useState<PartnerMetaTicketing | null>(null);
  const [partnerDiscountRate, setPartnerDiscountRate] = useState<number | null>(
    null
  );
  const previousPartnerIdRef = useRef<string | null>(null);
  const partnerLookup = useMemo(() => {
    return new Map(partners.map((partner) => [partner.id, partner]));
  }, [partners]);

  // Load global ticket types - single source of truth
  const { values: globalTicketTypes } = useGlobalValues("ticket_type", {
    includeInactive: false,
  });

  const hasPricingStep = useMemo(() => {
    if (!draft) return false;
    return draft.config.steps.some((step) => isPricingStep(step));
  }, [draft]);

  const applyDraft = useCallback(
    (mutator: (form: PartnerFormRecord) => void) => {
      setDraft((prev) => {
        if (!prev) return prev;
        const next = cloneForm(prev);
        mutator(next);
        return next;
      });
    },
    [setDraft],
  );

  const updateConfig = useCallback(
    (updater: (config: PartnerFormConfig) => PartnerFormConfig | void) => {
      applyDraft((form) => {
        const result = updater(form.config);
        if (result) {
          form.config = result;
        }
      });
    },
    [applyDraft],
  );

  // Ensure pricing step behavior matches form usage.
  useEffect(() => {
    if (!draft) return;
    if (!draft.partnerId || !draft.usageType) return; // Must have partner and form type

    if (draft.usageType === "deal") {
      const hasPricingSteps = draft.config.steps.some((step) =>
        isPricingStep(step),
      );
      if (hasPricingSteps) {
        applyDraft((form) => {
          const nextSteps = form.config.steps.filter(
            (step) => !isPricingStep(step),
          );
          form.config.steps = nextSteps;
        });
      }
      return;
    }

    const firstStep = draft.config.steps[0];
    const firstIsPricing = firstStep && isPricingStep(firstStep);
    if (firstIsPricing) {
      return;
    }
    applyDraft((form) => {
      if (!form.partnerId || !form.usageType) return;
      const pricingIndex = form.config.steps.findIndex((step) =>
        isPricingStep(step)
      );
      const existingStep =
        pricingIndex >= 0 ? form.config.steps[pricingIndex] : null;
      const partnerName =
        form.partnerId && partnerLookup.get(form.partnerId)?.displayName;
      const pricingStep = buildPricingStepFromTicketing({
        partnerName: partnerName ?? undefined,
        currency:
          existingStep?.pricing?.currency ??
          form.config.pricing?.currency ??
          "CZK",
        ticketDetails: partnerTicketing?.ticketDetails ?? [],
        addons: partnerTicketing?.addons ?? [],
        discountRate: partnerDiscountRate ?? undefined,
        stepId: existingStep?.id,
        title: existingStep?.title ?? "Pricing",
        description: existingStep?.description,
      });
      const otherSteps =
        pricingIndex >= 0
          ? form.config.steps.filter((_, idx) => idx !== pricingIndex)
          : form.config.steps;
      const nextSteps = [pricingStep, ...otherSteps];
      form.config.steps = nextSteps;
    });
  }, [draft, applyDraft, partnerLookup, partnerTicketing, partnerDiscountRate]);

  // Ensure deal forms always have a visitors field wired
  useEffect(() => {
    if (!draft || draft.usageType !== "deal") return;
    applyDraft((form) => {
      const integration = ensureDeal(form.config);
      const fieldMap = collectFieldMap(form.config);
      // If existing visitor field still exists, keep it
      if (integration.visitorsFieldId && fieldMap.has(integration.visitorsFieldId)) {
        return;
      }
      // Find first counter or number input
      const fallbackField =
        Array.from(fieldMap.values()).find(
          (field) =>
            field.kind === "counter" ||
            (field.kind === "input" && field.type === "number")
        ) ?? null;
      if (fallbackField) {
        integration.visitorsFieldId = fallbackField.id;
        return;
      }
      // If none exist, create a hidden counter at the top of the first step
      const firstStep = form.config.steps[0];
      const visitorField = createFieldTemplate("counter", {
        id: `visitors-${generateOptionId()}`,
        label: "Visitors",
        name: "visitors",
        min: 1,
        defaultValue: 1,
      });
      firstStep.fields = [visitorField, ...firstStep.fields];
      integration.visitorsFieldId = visitorField.id;
    });
  }, [draft, applyDraft]);

  const isLockedPricingStep = useCallback(
    (index: number) => {
      if (!draft) return false;
      const step = draft.config.steps[index];
      // Pricing step 1 is always read-only for all form types
      return index === 0 && step && isPricingStep(step);
    },
    [draft]
  );

  const selectedForm = useMemo(
    () => forms.find((item) => item.id === selectedId) ?? null,
    [forms, selectedId]
  );

  useEffect(() => {
    if (selectedForm) {
      setDraft(cloneForm(selectedForm));
    } else {
      setDraft(null);
    }
  }, [selectedForm]);

  useEffect(() => {
    const partnerId = draft?.partnerId;
    if (!partnerId) {
      setChildRelationships([]);
      setPartnerTicketing(null);
      setPartnerDiscountRate(null);
      previousPartnerIdRef.current = null;
      return;
    }
    const safePartnerId = partnerId as string;
    const previousPartnerId = previousPartnerIdRef.current;
    const controller = new AbortController();
    async function loadRelationships() {
      try {
        setLoadingRelationships(true);
        const response = await adminApi.partnerGet(safePartnerId, {
          signal: controller.signal,
        });
        const children = Array.isArray(response?.children)
          ? (response.children as PartnerRelationship[])
          : [];
        setChildRelationships(children);
        setPartnerTicketing(response?.item?.ticketing ?? null);
        setPartnerDiscountRate(
          typeof response?.item?.contract?.discountRate === "number"
            ? response.item.contract.discountRate
            : null
        );
        if (
          response?.item?.ticketing &&
          draft?.partnerId === safePartnerId &&
          (!hasPricingStep ||
            (previousPartnerId && previousPartnerId !== safePartnerId))
        ) {
          applyDraft((form) => {
            if (form.partnerId !== safePartnerId) return;
            const pricingIndex = form.config.steps.findIndex((step) =>
              isPricingStep(step)
            );
            const shouldReplace =
              pricingIndex >= 0 &&
              previousPartnerId &&
              previousPartnerId !== safePartnerId;
            const existingStep =
              pricingIndex >= 0 ? form.config.steps[pricingIndex] : null;
            const pricingStep = buildPricingStepFromTicketing({
              partnerName:
                partnerLookup.get(safePartnerId)?.displayName ?? undefined,
              currency:
                existingStep?.pricing?.currency ??
                form.config.pricing?.currency ??
                "CZK",
              ticketDetails: response.item?.ticketing?.ticketDetails ?? [],
              addons: response.item?.ticketing?.addons ?? [],
              discountRate:
                typeof response.item?.contract?.discountRate === "number"
                  ? response.item.contract.discountRate
                  : undefined,
              stepId: existingStep?.id,
              title: existingStep?.title,
              description: existingStep?.description,
            });
            if (shouldReplace && pricingIndex >= 0 && existingStep) {
              form.config.steps[pricingIndex] = {
                ...existingStep,
                pricing: pricingStep.pricing,
                fields: [],
              };
            } else if (pricingIndex === -1) {
              form.config.steps = [pricingStep, ...form.config.steps];
            }
          });
        }
      } catch (error) {
        if ((error as Error)?.name !== "AbortError") {
          console.error("Failed to load partner relationships", error);
        }
      } finally {
        setLoadingRelationships(false);
      }
    }
    void loadRelationships();
    previousPartnerIdRef.current = partnerId;
    return () => controller.abort();
  }, [draft?.partnerId, partnerLookup, hasPricingStep, applyDraft]);

  const hasUnsavedChanges = useMemo(() => {
    if (!draft || !selectedForm) return false;
    const simplify = (form: PartnerFormRecord) => ({
      name: form.name,
      slug: form.slug,
      status: form.status,
      description: form.description,
      partnerId: form.partnerId,
      config: {
        ...form.config,
        steps: form.config.steps,
      },
    });
    return (
      JSON.stringify(simplify(draft)) !== JSON.stringify(simplify(selectedForm))
    );
  }, [draft, selectedForm]);

  const fieldMap = useMemo(() => {
    if (!draft) return new Map<string, PartnerFormField>();
    return collectFieldMap(draft.config);
  }, [draft]);

  const counterFieldOptions = useMemo(() => {
    if (!draft) return [] as Array<{ value: string; label: string }>;
    return Array.from(fieldMap.values())
      .filter(
        (field) =>
          field.kind === "counter" ||
          (field.kind === "input" && field.type === "number")
      )
      .map((field) => ({
        value: field.id,
        label: field.label || field.name,
      }));
  }, [draft, fieldMap]);

  const checkboxFieldOptions = useMemo(() => {
    if (!draft) return [] as Array<{ value: string; label: string }>;
    return Array.from(fieldMap.values())
      .filter((field) => field.kind === "checkbox")
      .map((field) => ({ value: field.id, label: field.label || field.name }));
  }, [draft, fieldMap]);

  const rewardSelectOptions = useMemo(() => {
    const base = rewards
      .map((reward) => ({
        value: reward.id,
        label: reward.name,
        status: reward.status,
        pointsCost: reward.pointsCost,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
    if (
      draft?.rewardId &&
      !base.some((option) => option.value === draft.rewardId)
    ) {
      base.push({
        value: draft.rewardId,
        label: draft.rewardId,
        status: "inactive",
        pointsCost: 0,
      });
    }
    return base;
  }, [rewards, draft?.rewardId]);

  const dealSelectOptions = useMemo(() => {
    const base = deals
      .filter((deal) => Boolean(deal.slug))
      .map((deal) => ({
        value: deal.id,
        label: deal.partnerName
          ? `${deal.title} · ${deal.partnerName}`
          : deal.title,
        status: deal.status,
        slug: deal.slug,
        minVisitors: deal.minVisitors,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
    if (
      draft?.dealId &&
      !base.some((option) => option.value === draft.dealId)
    ) {
      base.push({
        value: draft.dealId,
        label: draft.dealId,
        status: "draft" as FlashDealStatus,
        slug: null,
        minVisitors: null,
      });
    }
    return base;
  }, [deals, draft?.dealId]);

  const dealLookup = useMemo(
    () => new Map(deals.map((deal) => [deal.id, deal])),
    [deals],
  );

  useEffect(() => {
    // For deal forms we no longer inject pricing/requirements into the form itself.
    // The public runner and server validation handle the requirement gate.
    // This avoids a render loop with the deal-only pricing removal effect.
    if (!draft || draft.usageType === "deal") return;
    const dealId = draft.dealId;
    if (!dealId) return;
    const deal = dealLookup.get(dealId);
    if (!deal || !deal.ticketRequirements.length) return;
    const currentPricingStep = draft.config.steps.find((step) =>
      isPricingStep(step)
    );
    if (
      currentPricingStep &&
      doesPricingStepMatchDeal(currentPricingStep, deal.ticketRequirements)
    ) {
      return;
    }
    updateConfig((config) => {
      const steps = config.steps.map((step) => ({ ...step }));
      const pricingIndex = steps.findIndex((step) => isPricingStep(step));
      if (pricingIndex >= 0) {
        const target = steps[pricingIndex];
        steps[pricingIndex] = buildPricingStepFromDealRequirements({
          stepId: target.id,
          title: target.title,
          description:
            target.description ??
            `Confirm the ticket requirements for ${deal.title}.`,
          currency: target.pricing?.currency ?? "CZK",
          ticketRequirements: deal.ticketRequirements,
          timeZoneLabel: deal.timeZoneLabel,
        });
      } else {
        const newStep = buildPricingStepFromDealRequirements({
          ticketRequirements: deal.ticketRequirements,
          description: `Confirm the ticket requirements for ${deal.title}.`,
          timeZoneLabel: deal.timeZoneLabel,
        });
        steps.unshift(newStep);
      }
      return cleanupConfig({ ...config, steps });
    });
  }, [draft, draft?.dealId, draft?.usageType, dealLookup, updateConfig]);

  function updateField(
    fieldId: string,
    mutator: (field: PartnerFormField) => PartnerFormField
  ) {
    applyDraft((form) => {
      for (const step of form.config.steps) {
        const index = step.fields.findIndex((field) => field.id === fieldId);
        if (index !== -1) {
          const updated = mutator({ ...step.fields[index] });
          step.fields[index] = updated;
          if (
            form.config.pricing &&
            form.config.pricing.ticketFieldId === updated.id
          ) {
            form.config.pricing.ticketPricing = (updated.options ?? []).map(
              (option) => ({
                value: option.value,
                label: option.label,
                price: option.price ?? 0,
              })
            );
          }
          if (updated.kind === "transport") {
            const transportConfig = ensureTransport(form.config);
            const yesOption = updated.options?.find(
              (option) => option.value === transportConfig.yesValue
            );
            const noOption = updated.options?.find(
              (option) => option.value === transportConfig.noValue
            );
            if (yesOption) {
              transportConfig.yesValue = yesOption.value;
              transportConfig.yesLabel = yesOption.label;
            }
            if (noOption) {
              transportConfig.noValue = noOption.value;
              transportConfig.noLabel = noOption.label;
            }
          }
          break;
        }
      }
      cleanupConfig(form.config);
    });
  }

  function handleReset() {
    if (!selectedForm) return;
    setDraft(cloneForm(selectedForm));
    toast.info("Reverted unsaved changes.");
  }

  async function handleSave(
    nextStatus?: PartnerFormRecord["status"],
    options: { toastLabel?: string } = {}
  ) {
    if (!draft) return;
    if (!draft.usageType) {
      toast.error(
        "Select the form type (standard, reward, or deal) before saving."
      );
      return;
    }
    if (!draft.partnerId) {
      toast.error(
        "Select a partner before saving. Partner is required for all forms."
      );
      return;
    }
    const previousStatus = draft.status;
    const targetStatus = nextStatus ?? draft.status;
    const statusChanged = targetStatus !== previousStatus;

    if (statusChanged) {
      applyDraft((form) => {
        form.status = targetStatus;
      });
    }

    setSaving(true);
    try {
      const configForSave = cleanupConfig(
        JSON.parse(JSON.stringify(draft.config)) as PartnerFormConfig
      );

      const response = await adminApi.formUpdate(
        draft.id,
        {
          name: draft.name,
          slug: draft.slug,
          status: targetStatus,
          description: draft.description,
          config: configForSave,
          usageType: draft.usageType,
          rewardId:
            draft.usageType === "reward" ? draft.rewardId ?? null : null,
          dealId: draft.usageType === "deal" ? draft.dealId ?? null : null,
        },
        {
          headers: { "x-csrf-token": getCsrfToken() },
        }
      );
      const updated = response.item as PartnerFormRecord;
      setForms((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
      setDraft(cloneForm(updated));
      const statusDetails = getStatusOption(updated.status);
      toast.success(
        options.toastLabel ??
          (statusChanged
            ? `Form marked as ${statusDetails.label}.`
            : "Form saved.")
      );
    } catch (error) {
      if (statusChanged) {
        applyDraft((form) => {
          form.status = previousStatus;
        });
      }
      toast.error(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!draft) return;
    const confirmDelete = window.confirm(
      "Delete this partner form? This cannot be undone."
    );
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await adminApi.formDelete(draft.id, {
        headers: { "x-csrf-token": getCsrfToken() },
      });
      setForms((prev) => prev.filter((item) => item.id !== draft.id));
      toast.success("Form deleted.");
      const nextSelected = forms.find((item) => item.id !== draft.id);
      setSelectedId(nextSelected?.id ?? null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete form."
      );
    } finally {
      setDeleting(false);
    }
  }

  function handleHiddenFieldChange(
    index: number,
    key: "name" | "value",
    nextValue: string
  ) {
    updateConfig((config) => {
      const next = { ...config };
      const fields = [...(next.hiddenFields ?? [])];
      fields[index] = {
        ...fields[index],
        [key]: nextValue,
      };
      next.hiddenFields = fields;
      return next;
    });
  }

  function handleHiddenFieldDelete(index: number) {
    updateConfig((config) => {
      const next = { ...config };
      next.hiddenFields = (next.hiddenFields ?? []).filter(
        (_, i) => i !== index
      );
      return next;
    });
  }

  function addHiddenField() {
    updateConfig((config) => {
      const next = { ...config };
      next.hiddenFields = [
        ...(next.hiddenFields ?? []),
        { name: "field_name", value: "" },
      ];
      return next;
    });
  }

  const ticketField =
    draft?.config.steps
      .flatMap((step) => step.fields)
      .find((field) => field.id === draft.config.pricing?.ticketFieldId) ??
    draft?.config.steps
      .flatMap((step) => step.fields)
      .find((field) => field.kind === "radio");

  const transportField =
    draft?.config.steps
      .flatMap((step) => step.fields)
      .find((field) => field.kind === "transport") ?? null;

  const handleAddTicketOption = () => {
    if (!ticketField) return;
    const newOptionId = generateOptionId();
    updateField(ticketField.id, (field) => {
      const options = [...(field.options ?? [])];
      options.push({
        id: newOptionId,
        label: "New ticket",
        value: `ticket-${options.length + 1}`,
        price: 0,
      });
      return {
        ...field,
        options,
      };
    });
  };

  function handleTicketOptionChange(
    optionIndex: number,
    key: "label" | "value" | "price" | "helperText",
    value: string
  ) {
    if (!ticketField) return;
    updateField(ticketField.id, (field) => {
      const options = [...(field.options ?? [])];
      const option = { ...options[optionIndex] };
      if (key === "price") {
        option.price = Number.isNaN(Number(value)) ? 0 : Number(value);
      } else {
        option[key] = value;
      }
      options[optionIndex] = option;
      return {
        ...field,
        options,
      };
    });
  }

  function handleTicketOptionDelete(index: number) {
    if (!ticketField) return;
    updateField(ticketField.id, (field) => {
      const options = (field.options ?? []).filter((_, i) => i !== index);
      return {
        ...field,
        options,
      };
    });
  }

  function handleTransportPartnerChange(
    index: number,
    key: "label" | "value" | "description" | "imageUrl",
    value: string
  ) {
    updateConfig((config) => {
      const transport = ensureTransport(config);
      const partners = [...transport.partners];
      partners[index] = {
        ...partners[index],
        [key]: value,
      };
      transport.partners = partners;
      return { ...config, transport };
    });
  }

  function handleTransportPartnerDelete(index: number) {
    updateConfig((config) => {
      const transport = ensureTransport(config);
      transport.partners = transport.partners.filter((_, i) => i !== index);
      return { ...config, transport };
    });
  }

  function handleAddTransportPartner() {
    updateConfig((config) => {
      const transport = ensureTransport(config);
      transport.partners = [
        ...transport.partners,
        {
          id: generateOptionId(),
          label: "New partner",
          value: `bus-${transport.partners.length + 1}`,
        },
      ];
      return { ...config, transport };
    });
  }

  function handleTransportToggle(enabled: boolean) {
    updateConfig((config) => {
      const transport = ensureTransport(config);
      transport.enabled = enabled;
      return { ...config, transport };
    });
  }

  function handleChangeFieldKind(fieldId: string, kind: SupportedFieldKind) {
    updateField(fieldId, (field) => convertFieldKind(field, kind));
  }

  function applyPartnerDiscount(
    amount?: number | null,
    fallback?: number | null
  ): number | null {
    if (amount === null || amount === undefined || Number.isNaN(amount)) {
      return fallback ?? null;
    }
    if (
      typeof partnerDiscountRate !== "number" ||
      Number.isNaN(partnerDiscountRate)
    ) {
      return amount ?? fallback ?? null;
    }
    const normalized = Math.min(Math.max(partnerDiscountRate, 0), 100);
    const discounted = Math.max(0, amount - amount * (normalized / 100));
    return Math.round(discounted * 100) / 100;
  }

  function handleTransportFeeChange(value: string) {
    const fee = Number.isNaN(Number(value)) ? 0 : Number(value);
    updateConfig((config) => {
      const transport = ensureTransport(config);
      transport.busFee = fee;
      if (!config.pricing) {
        const counterField =
          config.steps
            .flatMap((step) => step.fields)
            .find((field) => field.kind === "counter") ?? null;
        const initialPricing = {
          currency: "CZK",
          ticketFieldId:
            config.steps
              .flatMap((step) => step.fields)
              .find((field) => field.kind === "radio")?.id ?? "ticketType",
          peopleFieldId: counterField?.id ?? "numPeople",
          ticketPricing:
            ticketField?.options?.map((option) => ({
              value: option.value,
              label: option.label,
              price: option.price ?? 0,
            })) ?? [],
          transportFieldId: transportField?.id,
          transportYesValue: transport.yesValue ?? "Yes",
          transportFee: fee,
        };
        config.pricing = initialPricing;
      } else {
        config.pricing.transportFee = fee;
      }
      return { ...config, transport };
    });
  }

  function updatePricingStepAt(
    stepIndex: number,
    updater: (payload: PricingPayload) => void
  ) {
    updateConfig((config) => {
      const steps = config.steps.map((step) => ({ ...step }));
      const target = steps[stepIndex];
      if (!target || !isPricingStep(target)) {
        return config;
      }
      const payload = ensurePricingPayload(target.pricing);
      updater(payload);
      target.fields = [];
      target.pricing = payload;
      const nextConfig = cleanupConfig({ ...config, steps });
      return nextConfig;
    });
  }

  function handlePricingCurrencyChange(stepIndex: number, nextValue: string) {
    updatePricingStepAt(stepIndex, (payload) => {
      const normalized = nextValue.trim();
      payload.currency =
        normalized.length > 0 ? normalized.toUpperCase() : "CZK";
    });
  }

  function handlePricingAllowCustomTotals(stepIndex: number, allowed: boolean) {
    updatePricingStepAt(stepIndex, (payload) => {
      payload.allowCustomTotals = allowed;
    });
  }

  function handleAddPricingBundle(stepIndex: number) {
    updatePricingStepAt(stepIndex, (payload) => {
      payload.bundles = [...payload.bundles, createPricingBundleTemplate()];
    });
  }

  function handlePricingBundleUpdate(
    stepIndex: number,
    bundleIndex: number,
    changes: Partial<PartnerFormPricingBundle>
  ) {
    updatePricingStepAt(stepIndex, (payload) => {
      payload.bundles = payload.bundles.map((bundle, index) => {
        if (index !== bundleIndex) return bundle;
        const nextBundle: PartnerFormPricingBundle = {
          ...bundle,
          ...changes,
        };
        if (
          changes.ticketType !== undefined &&
          partnerTicketing?.ticketDetails &&
          typeof changes.ticketType === "string"
        ) {
          const normalizedType = changes.ticketType.trim().toLowerCase();
          if (normalizedType.length > 0) {
            const match = partnerTicketing.ticketDetails.find(
              (detail) => detail.ticketType?.toLowerCase() === normalizedType
            );
            if (match) {
              nextBundle.sourceId = match.id ?? nextBundle.sourceId;
              if (!nextBundle.label || nextBundle.label.trim().length === 0) {
                nextBundle.label =
                  match.label?.trim() || match.ticketType || nextBundle.label;
              }
              nextBundle.price =
                typeof match.price === "number"
                  ? match.price
                  : nextBundle.price ?? null;
              nextBundle.discountedPrice = applyPartnerDiscount(
                typeof match.price === "number"
                  ? match.price
                  : nextBundle.price ?? null,
                nextBundle.discountedPrice ?? null
              );
              nextBundle.inclusions = match.inclusions ?? nextBundle.inclusions;
            }
          }
        }
        if (changes.price !== undefined) {
          nextBundle.discountedPrice = applyPartnerDiscount(
            typeof nextBundle.price === "number" ? nextBundle.price : null,
            nextBundle.discountedPrice ?? null
          );
        }
        return nextBundle;
      });
    });
  }

  function handlePricingBundleInclusionChange(
    stepIndex: number,
    bundleIndex: number,
    field: "adults" | "children" | "teens",
    nextValue: number | null
  ) {
    updatePricingStepAt(stepIndex, (payload) => {
      const target = payload.bundles[bundleIndex];
      if (!target) return;
      const inclusions = { ...(target.inclusions ?? {}) };
      if (nextValue === null) {
        delete inclusions[field];
      } else {
        inclusions[field] = nextValue;
      }
      target.inclusions = inclusions;
    });
  }

  function handleDeletePricingBundle(stepIndex: number, bundleIndex: number) {
    updatePricingStepAt(stepIndex, (payload) => {
      payload.bundles = payload.bundles.filter(
        (_, index) => index !== bundleIndex
      );
    });
  }

  function handleAddPricingAddon(stepIndex: number) {
    updatePricingStepAt(stepIndex, (payload) => {
      payload.addons = [...payload.addons, createPricingAddonTemplate()];
    });
  }

  function handlePricingAddonUpdate(
    stepIndex: number,
    addonIndex: number,
    changes: Partial<PartnerFormPricingAddon>
  ) {
    updatePricingStepAt(stepIndex, (payload) => {
      payload.addons = payload.addons.map((addon, index) =>
        index === addonIndex
          ? ((): PartnerFormPricingAddon => {
              const nextAddon: PartnerFormPricingAddon = {
                ...addon,
                ...changes,
              };
              if (changes.price !== undefined) {
                nextAddon.discountedPrice = applyPartnerDiscount(
                  typeof nextAddon.price === "number" ? nextAddon.price : null,
                  nextAddon.discountedPrice ?? null
                );
              }
              return nextAddon;
            })()
          : addon
      );
    });
  }

  function handleDeletePricingAddon(stepIndex: number, addonIndex: number) {
    updatePricingStepAt(stepIndex, (payload) => {
      payload.addons = payload.addons.filter(
        (_, index) => index !== addonIndex
      );
    });
  }

  function handleSyncPricingFromPartner(stepIndex: number) {
    if (!draft?.partnerId || !partnerTicketing) {
      toast.error("No partner ticketing data available.");
      return;
    }
    const partnerId = draft.partnerId;
    updateConfig((config) => {
      const steps = config.steps.map((step) => ({ ...step }));
      const target = steps[stepIndex];
      if (!target || !isPricingStep(target)) {
        return config;
      }
      const partnerInfo = partnerLookup.get(partnerId);
      const refreshed = buildPricingStepFromTicketing({
        partnerName: partnerInfo?.displayName || partnerInfo?.id || undefined,
        currency: target.pricing?.currency ?? "CZK",
        ticketDetails: partnerTicketing.ticketDetails,
        addons: partnerTicketing.addons,
        discountRate: partnerDiscountRate ?? undefined,
        stepId: target.id,
        title: target.title,
        description: target.description,
      });
      steps[stepIndex] = {
        ...target,
        pricing: refreshed.pricing,
        fields: [],
      };
      const nextConfig = cleanupConfig({ ...config, steps });
      return nextConfig;
    });
    const partnerName =
      partnerLookup.get(draft.partnerId)?.displayName ?? "partner";
    toast.success(`Pricing synced from ${partnerName}.`);
  }

  function renderPricingStepEditor(
    step: PartnerFormConfig["steps"][number],
    stepIndex: number
  ) {
    if (!isPricingStep(step)) return null;
    const pricing = ensurePricingPayload(step.pricing);
    const currencyLabel = pricing.currency || "CZK";
    const partnerName =
      draft?.partnerId && partnerLookup.get(draft.partnerId)?.displayName;

    // Use global ticket types as single source of truth
    const ticketTypeOptions = globalTicketTypes
      .filter((t) => t.isActive)
      .map((t) => ({
        value: t.label,
        key: t.key,
        subOptions: Array.isArray(t.metadata?.subOptions)
          ? (t.metadata.subOptions as string[])
          : [],
      }))
      .sort((a, b) => a.value.localeCompare(b.value));

    const ticketTypeLookup = new Map(
      globalTicketTypes.map((t) => [t.key.toLowerCase(), t])
    );
    const ticketTypeSet = new Set(
      ticketTypeOptions.map((option) => option.value.toLowerCase())
    );
    const syncDisabled =
      !partnerTicketing || !draft?.partnerId || loadingRelationships;
    const isReadOnly = isLockedPricingStep(stepIndex);

    const isRewardForm = draft?.usageType === "reward";
    const pricingLabel = isRewardForm ? "Ticket points" : "Ticket pricing";
    const pricingDescription = isReadOnly
      ? "Pricing step 1 is read-only and automatically synced from partner/reward configuration."
      : isRewardForm
      ? "Configure points costs per ticket type for reward redemption."
      : "Configure bundles and add-ons surfaced on the booking experience.";

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {pricingLabel}
            </p>
            <p className="text-xs text-muted-foreground">
              {pricingDescription}
            </p>
          </div>
          {!isRewardForm && !isReadOnly ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => handleSyncPricingFromPartner(stepIndex)}
              disabled={syncDisabled}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Sync from {partnerName ?? "partner"}
            </Button>
          ) : null}
        </div>

        {isReadOnly && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <p className="font-semibold">Read-only pricing step</p>
            <p className="mt-1">
              Step 1 pricing is automatically synced from partner/reward
              configuration and cannot be edited here.
            </p>
          </div>
        )}

        {ticketTypeOptions.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Available ticket types:{" "}
            {ticketTypeOptions.map((opt) => opt.value).join(", ")}
          </p>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label className="text-xs uppercase text-muted-foreground">
              Currency
            </Label>
            <Input
              value={pricing.currency}
              onChange={(event) =>
                handlePricingCurrencyChange(stepIndex, event.target.value)
              }
              placeholder="CZK"
              disabled={isReadOnly}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase text-muted-foreground">
              Manual overrides
            </Label>
            <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-2">
              <Checkbox
                id={`pricing-override-${step.id}`}
                checked={pricing.allowCustomTotals}
                onCheckedChange={(value) =>
                  handlePricingAllowCustomTotals(stepIndex, value === true)
                }
                disabled={isReadOnly}
              />
              <div>
                <Label
                  htmlFor={`pricing-override-${step.id}`}
                  className="text-sm font-medium text-foreground"
                >
                  Allow totals override
                </Label>
                <p className="text-xs text-muted-foreground">
                  Staff can adjust the computed total before issuing a QR code.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Ticket bundles
              </p>
              <p className="text-xs text-muted-foreground">
                Required selections for this partner.
              </p>
            </div>
            {!isReadOnly && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddPricingBundle(stepIndex)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add bundle
              </Button>
            )}
          </div>

          {pricing.bundles.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
              No bundles yet. Add at least one ticket bundle to continue.
            </p>
          ) : isReadOnly ? (
            // Compact read-only view for step 1 pricing
            <div className="space-y-3">
              {pricing.bundles.map((bundle, bundleIndex) => {
                // Extract points from description (format: "XX pts")
                const pointsMatch = bundle.description?.match(/(\d+)\s*pts?/i);
                const points = pointsMatch ? parseInt(pointsMatch[1], 10) : null;
                const inclusions = bundle.inclusions;

                return (
                  <div
                    key={bundle.id ?? bundleIndex}
                    className="rounded-lg border border-border bg-muted/50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">
                            {bundle.label?.trim() || bundle.ticketType || `Bundle ${bundleIndex + 1}`}
                          </p>
                          {points !== null && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                              {points} {points === 1 ? "point" : "points"}
                            </span>
                          )}
                        </div>
                        {bundle.ticketType && (
                          <p className="text-xs text-muted-foreground">
                            Ticket type: {bundle.ticketType}
                          </p>
                        )}
                        {inclusions && (
                          <div className="flex flex-wrap gap-3 text-xs">
                            {inclusions.adults !== null && inclusions.adults !== undefined && (
                              <span className="text-muted-foreground">
                                <span className="font-medium">Adults:</span> {inclusions.adults}
                              </span>
                            )}
                            {inclusions.children !== null && inclusions.children !== undefined && (
                              <span className="text-muted-foreground">
                                <span className="font-medium">Children:</span> {inclusions.children}
                              </span>
                            )}
                            {inclusions.teens !== null && inclusions.teens !== undefined && (
                              <span className="text-muted-foreground">
                                <span className="font-medium">Teens:</span> {inclusions.teens}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              {pricing.bundles.map((bundle, bundleIndex) => {
                const normalizedType = (bundle.ticketType ?? "")
                  .toLowerCase()
                  .trim();
                // Find ticket type in globals to check for sub-options
                // Match by label first (what we display), then by key
                const matchedOption =
                  ticketTypeOptions.find(
                    (opt) => opt.value.toLowerCase() === normalizedType
                  ) ||
                  ticketTypeOptions.find(
                    (opt) => opt.key.toLowerCase() === normalizedType
                  );
                const globalTicketType = matchedOption?.key
                  ? ticketTypeLookup.get(matchedOption.key.toLowerCase())
                  : null;
                const hasSubOptions =
                  globalTicketType &&
                  Array.isArray(globalTicketType.metadata?.subOptions) &&
                  (globalTicketType.metadata.subOptions as string[]).length > 0;
                const subOptions = hasSubOptions
                  ? (globalTicketType.metadata.subOptions as string[]).map(
                      (subKey) => {
                        const subType = globalTicketTypes.find(
                          (t) => t.key === subKey
                        );
                        return {
                          key: subKey,
                          label: subType?.label ?? subKey,
                        };
                      }
                    )
                  : [];

                // If has sub-options, show those. Otherwise show generic fields based on ticket type
                const showSubOptionFields =
                  hasSubOptions && subOptions.length > 0;
                const isFamilyBundle =
                  normalizedType.includes("family") && !showSubOptionFields;
                const hideAdultsIncluded =
                  (normalizedType.includes("child") || showSubOptionFields) &&
                  !isFamilyBundle;
                const hideChildrenIncluded =
                  (normalizedType.includes("adult") || showSubOptionFields) &&
                  !isFamilyBundle;
                return (
                  <div
                    key={bundle.id ?? bundleIndex}
                    className="rounded-xl border border-border bg-card p-4 shadow-sm"
                  >
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {bundle.label?.trim() || `Bundle ${bundleIndex + 1}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {bundle.ticketType || "Custom ticket"}
                        </p>
                      </div>
                      {!isReadOnly && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            handleDeletePricingBundle(stepIndex, bundleIndex)
                          }
                          aria-label="Remove bundle"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs uppercase text-muted-foreground">
                          Ticket type
                        </Label>
                        <Select
                          value={bundle.ticketType ?? undefined}
                          onValueChange={(value) => {
                            handlePricingBundleUpdate(stepIndex, bundleIndex, {
                              ticketType: value.length > 0 ? value : null,
                            });
                          }}
                          disabled={isReadOnly}
                        >
                          <SelectTrigger
                            className="w-full"
                            disabled={isReadOnly}
                          >
                            <SelectValue placeholder="Select ticket type" />
                          </SelectTrigger>
                          <SelectContent>
                            {ticketTypeOptions.map((option) => (
                              <SelectItem
                                key={`${bundle.id}-option-${option.value}`}
                                value={option.value}
                              >
                                {option.value}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {isReadOnly
                            ? "Ticket types must be selected from Globals → Ticket types"
                            : "Select from global ticket types only. Manage in Globals → Ticket types."}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs uppercase text-muted-foreground">
                          Display label
                        </Label>
                        <Input
                          value={bundle.label ?? ""}
                          onChange={(event) =>
                            handlePricingBundleUpdate(stepIndex, bundleIndex, {
                              label: event.target.value,
                            })
                          }
                          placeholder="Family bundle"
                          disabled={isReadOnly}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-xs uppercase text-muted-foreground">
                          Description
                        </Label>
                        <Textarea
                          value={bundle.description ?? ""}
                          onChange={(event) =>
                            handlePricingBundleUpdate(stepIndex, bundleIndex, {
                              description: event.target.value,
                            })
                          }
                          placeholder="What's included in this bundle"
                          disabled={isReadOnly}
                        />
                      </div>
                      <div>
                        <Label className="text-xs uppercase text-muted-foreground">
                          {isRewardForm ? "Points" : `Price (${currencyLabel})`}
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          step={isRewardForm ? 1 : 10}
                          value={bundle.price ?? ""}
                          onChange={(event) =>
                            handlePricingBundleUpdate(stepIndex, bundleIndex, {
                              price: parseAmountInput(event.target.value),
                            })
                          }
                          placeholder={isRewardForm ? "e.g., 100" : undefined}
                          disabled={isReadOnly}
                        />
                      </div>
                      {!isRewardForm ? (
                        <div>
                          <Label className="text-xs uppercase text-muted-foreground">
                            Discounted price ({currencyLabel})
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            step={10}
                            value={bundle.discountedPrice ?? ""}
                            readOnly
                            aria-readonly="true"
                            title="Calculated automatically from discount percentage"
                          />
                        </div>
                      ) : null}
                      {showSubOptionFields ? (
                        subOptions.map((subOption) => {
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
                          const fieldName =
                            fieldMap[subOption.key.toLowerCase()] ?? "adults";
                          return (
                            <div key={subOption.key}>
                              <Label className="text-xs uppercase text-muted-foreground">
                                {subOption.label} included
                              </Label>
                              <Input
                                type="number"
                                min={0}
                                step={1}
                                value={bundle.inclusions?.[fieldName] ?? ""}
                                onChange={(event) =>
                                  handlePricingBundleInclusionChange(
                                    stepIndex,
                                    bundleIndex,
                                    fieldName,
                                    parseAmountInput(event.target.value)
                                  )
                                }
                                disabled={isReadOnly}
                              />
                            </div>
                          );
                        })
                      ) : (
                        <>
                          {!hideAdultsIncluded ? (
                            <div>
                              <Label className="text-xs uppercase text-muted-foreground">
                                Adults included
                              </Label>
                              <Input
                                type="number"
                                min={0}
                                step={1}
                                value={bundle.inclusions?.adults ?? ""}
                                onChange={(event) =>
                                  handlePricingBundleInclusionChange(
                                    stepIndex,
                                    bundleIndex,
                                    "adults",
                                    parseAmountInput(event.target.value)
                                  )
                                }
                                disabled={isReadOnly}
                              />
                            </div>
                          ) : null}
                          {!hideChildrenIncluded ? (
                            <div>
                              <Label className="text-xs uppercase text-muted-foreground">
                                Children included
                              </Label>
                              <Input
                                type="number"
                                min={0}
                                step={1}
                                value={bundle.inclusions?.children ?? ""}
                                onChange={(event) =>
                                  handlePricingBundleInclusionChange(
                                    stepIndex,
                                    bundleIndex,
                                    "children",
                                    parseAmountInput(event.target.value)
                                  )
                                }
                                disabled={isReadOnly}
                              />
                            </div>
                          ) : null}
                          {isFamilyBundle ? (
                            <div>
                              <Label className="text-xs uppercase text-muted-foreground">
                                Teens included
                              </Label>
                              <Input
                                type="number"
                                min={0}
                                step={1}
                                value={bundle.inclusions?.teens ?? ""}
                                onChange={(event) =>
                                  handlePricingBundleInclusionChange(
                                    stepIndex,
                                    bundleIndex,
                                    "teens",
                                    parseAmountInput(event.target.value)
                                  )
                                }
                                disabled={isReadOnly}
                              />
                            </div>
                          ) : null}
                        </>
                      )}
                      {/* Show ticket type name if no sub-options */}
                      {!showSubOptionFields &&
                        !isFamilyBundle &&
                        bundle.ticketType && (
                          <div>
                            <Label className="text-xs uppercase text-muted-foreground">
                              {bundle.ticketType} included
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              step={1}
                              value={bundle.inclusions?.adults ?? ""}
                              onChange={(event) =>
                                handlePricingBundleInclusionChange(
                                  stepIndex,
                                  bundleIndex,
                                  "adults",
                                  parseAmountInput(event.target.value)
                                )
                              }
                              disabled={isReadOnly}
                              placeholder="Number included"
                            />
                          </div>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Optional add-ons
              </p>
              <p className="text-xs text-muted-foreground">
                Applied on top of the selected bundle.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAddPricingAddon(stepIndex)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add add-on
            </Button>
          </div>
          {pricing.addons.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
              No add-ons defined. Add optional extras if the partner supports
              them.
            </p>
          ) : (
            <div className="space-y-4">
              {pricing.addons.map((addon, addonIndex) => (
                <div
                  key={addon.id ?? addonIndex}
                  className="rounded-xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {addon.label?.trim() || `Add-on ${addonIndex + 1}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Applies to {addon.appliesToTicketType || "any bundle"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove add-on"
                      onClick={() =>
                        handleDeletePricingAddon(stepIndex, addonIndex)
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label className="text-xs uppercase text-muted-foreground">
                        Label
                      </Label>
                      <Input
                        value={addon.label ?? ""}
                        onChange={(event) =>
                          handlePricingAddonUpdate(stepIndex, addonIndex, {
                            label: event.target.value,
                          })
                        }
                        placeholder="Photo package"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase text-muted-foreground">
                        Applies to ticket type
                      </Label>
                      <Select
                        value={
                          addon.appliesToTicketType &&
                          ticketTypeSet.has(
                            addon.appliesToTicketType.toLowerCase()
                          )
                            ? addon.appliesToTicketType
                            : addon.appliesToTicketType
                            ? "__custom"
                            : "__any"
                        }
                        onValueChange={(value) => {
                          if (value === "__any") {
                            handlePricingAddonUpdate(stepIndex, addonIndex, {
                              appliesToTicketType: null,
                            });
                            return;
                          }
                          if (value === "__custom") {
                            handlePricingAddonUpdate(stepIndex, addonIndex, {
                              appliesToTicketType:
                                addon.appliesToTicketType ?? "",
                            });
                            return;
                          }
                          handlePricingAddonUpdate(stepIndex, addonIndex, {
                            appliesToTicketType: value,
                          });
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Applies to any bundle" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__any">Any bundle</SelectItem>
                          {ticketTypeOptions.map((option) => (
                            <SelectItem
                              key={`${addon.id}-apply-${option.key}`}
                              value={option.value}
                            >
                              {option.value}
                            </SelectItem>
                          ))}
                          <SelectItem value="__custom">
                            Custom value…
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {addon.appliesToTicketType &&
                      !ticketTypeSet.has(
                        addon.appliesToTicketType.toLowerCase()
                      ) ? (
                        <Input
                          value={addon.appliesToTicketType ?? ""}
                          onChange={(event) =>
                            handlePricingAddonUpdate(stepIndex, addonIndex, {
                              appliesToTicketType:
                                event.target.value.trim().length > 0
                                  ? event.target.value
                                  : null,
                            })
                          }
                          placeholder="Enter custom ticket type"
                        />
                      ) : null}
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-xs uppercase text-muted-foreground">
                        Description
                      </Label>
                      <Textarea
                        value={addon.description ?? ""}
                        onChange={(event) =>
                          handlePricingAddonUpdate(stepIndex, addonIndex, {
                            description: event.target.value,
                          })
                        }
                        placeholder="Describe what’s included"
                      />
                    </div>
                    <div>
                      <Label className="text-xs uppercase text-muted-foreground">
                        Price ({currencyLabel})
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        step={10}
                        value={addon.price ?? ""}
                        onChange={(event) =>
                          handlePricingAddonUpdate(stepIndex, addonIndex, {
                            price: parseAmountInput(event.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs uppercase text-muted-foreground">
                        Discounted price ({currencyLabel})
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        step={10}
                        value={addon.discountedPrice ?? ""}
                        readOnly
                        aria-readonly="true"
                        title="Calculated automatically from discount percentage"
                      />
                    </div>
                    <div>
                      <Label className="text-xs uppercase text-muted-foreground">
                        Max per booking
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={addon.maxPerBooking ?? ""}
                        onChange={(event) =>
                          handlePricingAddonUpdate(stepIndex, addonIndex, {
                            maxPerBooking: parseAmountInput(event.target.value),
                          })
                        }
                        placeholder="Unlimited"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderHiddenFields() {
    if (!draft) return null;
    return (
      <Card className="border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle>Hidden fields</CardTitle>
          <CardDescription>
            Key-value pairs included with every form submission.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(draft.config.hiddenFields ?? []).map((field, index) => (
            <div
              key={`${field.name}-${index}`}
              className="grid gap-2 md:grid-cols-[1fr_1fr_auto]"
            >
              <div>
                <Label className="text-xs uppercase text-muted-foreground">
                  Name
                </Label>
                <Input
                  value={field.name}
                  onChange={(event) =>
                    handleHiddenFieldChange(index, "name", event.target.value)
                  }
                  placeholder="partner_id"
                />
              </div>
              <div>
                <Label className="text-xs uppercase text-muted-foreground">
                  Value
                </Label>
                <Input
                  value={field.value}
                  onChange={(event) =>
                    handleHiddenFieldChange(index, "value", event.target.value)
                  }
                  placeholder="wondrid"
                />
              </div>
              <div className="flex items-end justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleHiddenFieldDelete(index)}
                  aria-label="Remove hidden field"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addHiddenField}
          >
            <Plus className="h-4 w-4" />
            Add hidden field
          </Button>
        </CardContent>
      </Card>
    );
  }

  function renderTicketOptionsEditor() {
    if (!draft || !ticketField) return null;
    return (
      <Card className="border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle>Ticket options</CardTitle>
          <CardDescription>
            Configure available tickets and pricing for step 1.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(ticketField.options ?? []).map((option, index) => (
            <div
              key={option.id ?? index}
              className="grid gap-2 md:grid-cols-[1fr_1fr_120px_auto]"
            >
              <div>
                <Label className="text-xs uppercase text-muted-foreground">
                  Label
                </Label>
                <Input
                  value={option.label}
                  onChange={(event) =>
                    handleTicketOptionChange(index, "label", event.target.value)
                  }
                  placeholder="Adult"
                />
              </div>
              <div>
                <Label className="text-xs uppercase text-muted-foreground">
                  Value
                </Label>
                <Input
                  value={option.value}
                  onChange={(event) =>
                    handleTicketOptionChange(index, "value", event.target.value)
                  }
                  placeholder="Adult"
                />
              </div>
              <div>
                <Label className="text-xs uppercase text-muted-foreground">
                  Price ({draft.config.pricing?.currency ?? "CZK"})
                </Label>
                <Input
                  type="number"
                  value={option.price ?? 0}
                  onChange={(event) =>
                    handleTicketOptionChange(index, "price", event.target.value)
                  }
                  min={0}
                  step={10}
                />
              </div>
              <div className="flex items-end justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() => handleTicketOptionDelete(index)}
                  aria-label="Remove ticket option"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddTicketOption}
          >
            <Plus className="h-4 w-4" />
            Add ticket option
          </Button>
        </CardContent>
      </Card>
    );
  }

  function renderTransportSettings() {
    if (!draft) return null;
    const transport =
      draft.config.transport ??
      ({
        enabled: false,
        yesLabel: "Yes",
        noLabel: "No",
        yesValue: "Yes",
        noValue: "No",
        busFieldId: "transportBus",
        partners: [],
        busFee: draft.config.pricing?.transportFee ?? 0,
      } as NonNullable<PartnerFormConfig["transport"]>);
    return (
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <details open className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-t-xl bg-muted/80 px-4 py-3 text-sm font-medium">
            <span>Transport settings</span>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {transport.enabled ? "Enabled" : "Disabled"} · linked{" "}
              {linkedTransportCount} partners
            </span>
          </summary>
          <div className="space-y-4 border-t border-border bg-card/90 p-4">
            <p className="text-sm text-muted-foreground">
              Configure the optional transport step and manage related bus
              partners.
            </p>
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50/70 px-4 py-3">
              <div>
                <p className="font-medium text-foreground">Enable transport</p>
                <p className="text-sm text-muted-foreground">
                  Toggle to offer transport selection to visitors.
                </p>
              </div>
              <Checkbox
                id="transport-enabled"
                checked={transport.enabled}
                onCheckedChange={(checked) =>
                  handleTransportToggle(Boolean(checked))
                }
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label className="text-xs uppercase text-muted-foreground">
                  Yes label
                </Label>
                <Input
                  value={transport.yesLabel ?? "Yes"}
                  onChange={(event) => {
                    const nextLabel = event.target.value;
                    updateConfig((config) => {
                      const t = ensureTransport(config);
                      t.yesLabel = nextLabel;
                      return { ...config, transport: t };
                    });
                    if (transportField) {
                      updateField(transportField.id, (field) => {
                        const options = [...(field.options ?? [])];
                        const currentValue =
                          options[0]?.value ?? transport.yesValue ?? "Yes";
                        options[0] = {
                          ...(options[0] ?? {
                            id: generateOptionId(),
                            value: currentValue,
                          }),
                          label: nextLabel,
                        };
                        return { ...field, options };
                      });
                    }
                  }}
                />
              </div>
              <div>
                <Label className="text-xs uppercase text-muted-foreground">
                  No label
                </Label>
                <Input
                  value={transport.noLabel ?? "No"}
                  onChange={(event) => {
                    const nextLabel = event.target.value;
                    updateConfig((config) => {
                      const t = ensureTransport(config);
                      t.noLabel = nextLabel;
                      return { ...config, transport: t };
                    });
                    if (transportField) {
                      updateField(transportField.id, (field) => {
                        const options = [...(field.options ?? [])];
                        const currentValue =
                          options[1]?.value ?? transport.noValue ?? "No";
                        options[1] = {
                          ...(options[1] ?? {
                            id: generateOptionId(),
                            value: currentValue,
                          }),
                          label: nextLabel,
                        };
                        return { ...field, options };
                      });
                    }
                  }}
                />
              </div>
              <div>
                <Label className="text-xs uppercase text-muted-foreground">
                  Yes value
                </Label>
                <Input
                  value={transport.yesValue ?? "Yes"}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    updateConfig((config) => {
                      const t = ensureTransport(config);
                      t.yesValue = nextValue;
                      if (config.pricing) {
                        config.pricing.transportYesValue = nextValue;
                      }
                      return { ...config, transport: t };
                    });
                    if (transportField) {
                      updateField(transportField.id, (field) => {
                        const options = [...(field.options ?? [])];
                        const label =
                          options[0]?.label ?? transport.yesLabel ?? "Yes";
                        options[0] = {
                          ...(options[0] ?? { id: generateOptionId(), label }),
                          value: nextValue,
                        };
                        return { ...field, options };
                      });
                    }
                  }}
                />
              </div>
              <div>
                <Label className="text-xs uppercase text-muted-foreground">
                  No value
                </Label>
                <Input
                  value={transport.noValue ?? "No"}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    updateConfig((config) => {
                      const t = ensureTransport(config);
                      t.noValue = nextValue;
                      return { ...config, transport: t };
                    });
                    if (transportField) {
                      updateField(transportField.id, (field) => {
                        const options = [...(field.options ?? [])];
                        const label =
                          options[1]?.label ?? transport.noLabel ?? "No";
                        options[1] = {
                          ...(options[1] ?? { id: generateOptionId(), label }),
                          value: nextValue,
                        };
                        return { ...field, options };
                      });
                    }
                  }}
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label className="text-xs uppercase text-muted-foreground">
                  Transport fee ({draft.config.pricing?.currency ?? "CZK"})
                </Label>
                <Input
                  type="number"
                  value={transport.busFee ?? 0}
                  min={0}
                  step={50}
                  onChange={(event) =>
                    handleTransportFeeChange(event.target.value)
                  }
                />
              </div>
              <div>
                <Label className="text-xs uppercase text-muted-foreground">
                  Bus field name
                </Label>
                <Input
                  value={transport.busFieldId ?? "transportBus"}
                  onChange={(event) =>
                    updateConfig((config) => {
                      const t = ensureTransport(config);
                      t.busFieldId = event.target.value;
                      return { ...config, transport: t };
                    })
                  }
                />
              </div>
            </div>

            <details className="rounded-lg border border-border bg-muted/50/60">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 py-2 text-sm font-medium text-foreground">
                <span>
                  Bus partners{" "}
                  <span className="text-xs text-muted-foreground">
                    ({transport.partners.length})
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSyncTransportPartners}
                    disabled={loadingRelationships}
                  >
                    {loadingRelationships ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCcw className="mr-2 h-4 w-4" />
                    )}
                    Sync linked partners
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddTransportPartner}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add partner
                  </Button>
                </div>
              </summary>
              <div className="space-y-4 border-t border-border bg-card/80 px-4 py-4">
                <div>
                  <p className="font-medium text-foreground">Partner list</p>
                  <p className="text-sm text-muted-foreground">
                    Displayed when transport is set to “Yes”. Sync pulls active
                    transport partners linked to this merchant.
                  </p>
                </div>

                {transport.partners.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No partners configured. Use “Sync linked partners” to pull
                    connected providers or add options manually.
                  </p>
                ) : null}

                {transport.partners.map((partner, index) => (
                  <div
                    key={partner.id ?? index}
                    className="space-y-3 rounded-md border border-border bg-card/90 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-foreground">
                        {partner.label || "Bus partner"}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleTransportPartnerDelete(index)}
                        aria-label="Remove bus partner"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <Label className="text-xs uppercase text-muted-foreground">
                          Label
                        </Label>
                        <Input
                          value={partner.label}
                          onChange={(event) =>
                            handleTransportPartnerChange(
                              index,
                              "label",
                              event.target.value
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs uppercase text-muted-foreground">
                          Value
                        </Label>
                        <Input
                          value={partner.value}
                          onChange={(event) =>
                            handleTransportPartnerChange(
                              index,
                              "value",
                              event.target.value
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs uppercase text-muted-foreground">
                          Description
                        </Label>
                        <Input
                          value={partner.description ?? ""}
                          onChange={(event) =>
                            handleTransportPartnerChange(
                              index,
                              "description",
                              event.target.value
                            )
                          }
                        />
                      </div>
                      <ImageUploadField
                        label="Image (optional)"
                        value={partner.imageUrl ?? ""}
                        onChange={(url) =>
                          handleTransportPartnerChange(index, "imageUrl", url)
                        }
                        folder={`forms/${
                          selectedForm?.id ?? "new-form"
                        }/transport`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </details>
      </div>
    );
  }

  function handleAddStep(insertAfterIndex?: number) {
    if (!draft?.partnerId || !draft?.usageType) {
      toast.error(
        "Please select a partner and form type first before adding steps."
      );
      return;
    }
    updateConfig((config) => {
      const nextSteps = config.steps.map((step) => ({ ...step }));
      const newStep = createStepTemplate(config.steps.length);
      if (
        insertAfterIndex === undefined ||
        insertAfterIndex >= nextSteps.length - 1
      ) {
        nextSteps.push(newStep);
      } else {
        nextSteps.splice(insertAfterIndex + 1, 0, newStep);
      }
      const nextConfig = cleanupConfig({ ...config, steps: nextSteps });
      return { ...nextConfig };
    });
  }

  function handleDeleteStep(index: number) {
    if (isLockedPricingStep(index)) {
      toast.error(
        "Step 1 (pricing) cannot be deleted. It must remain as the first step and is automatically synced from partner/reward configuration."
      );
      return;
    }
    updateConfig((config) => {
      if (config.steps.length <= 1) {
        toast.error("At least one step is required.");
        return config;
      }
      const targetStep = config.steps[index];
      if (targetStep && isPricingStep(targetStep)) {
        toast.error("The pricing step is required and cannot be removed.");
        return config;
      }
      const nextSteps = config.steps.filter((_, i) => i !== index);
      const nextConfig = cleanupConfig({ ...config, steps: nextSteps });
      return { ...nextConfig };
    });
  }

  function handleAddField(stepId: string, kind: SupportedFieldKind) {
    if (!draft?.partnerId || !draft?.usageType) {
      toast.error(
        "Please select a partner and form type first before adding fields."
      );
      return;
    }
    updateConfig((config) => {
      const lockedIndex = config.steps.findIndex((step) => step.id === stepId);
      if (lockedIndex >= 0 && isLockedPricingStep(lockedIndex)) {
        toast.error(
          "Step 1 (pricing) is read-only and automatically synced from partner/reward configuration."
        );
        return config;
      }
      const next = {
        ...config,
        steps: config.steps.map((step) => ({ ...step })),
      };
      const target = next.steps.find((step) => step.id === stepId);
      if (!target) return config;
      target.fields = [...target.fields, createFieldTemplate(kind)];
      cleanupConfig(next);
      return next;
    });
  }

  function handleDeleteField(stepId: string, fieldId: string) {
    updateConfig((config) => {
      const next = {
        ...config,
        steps: config.steps.map((step) => ({ ...step })),
      };
      const target = next.steps.find((step) => step.id === stepId);
      if (!target) return config;
      if (target.fields.length <= 1) {
        toast.error("Each step needs at least one field.");
        return config;
      }
      target.fields = target.fields.filter((field) => field.id !== fieldId);
      cleanupConfig(next);
      return next;
    });
  }

  function handleAddCondition(stepIndex: number) {
    updateConfig((config) => {
      if (isLockedPricingStep(stepIndex)) {
        toast.error(
          "The first pricing step is managed by rewards and cannot be edited."
        );
        return config;
      }
      const next = {
        ...config,
        steps: config.steps.map((step, index) => {
          if (index !== stepIndex) return { ...step };
          const logic = {
            behavior: step.logic?.behavior ?? "show",
            conditions: [...(step.logic?.conditions ?? [])],
          };
          const defaultCondition: StepCondition = {
            fieldId: "",
            operator: "equals",
            value: "",
          };
          logic.conditions.push(defaultCondition);
          return {
            ...step,
            logic,
          };
        }),
      };
      return cleanupConfig(next);
    });
  }

  function handleConditionChange(
    stepIndex: number,
    conditionIndex: number,
    changes: Partial<StepCondition>
  ) {
    updateConfig((config) => {
      if (isLockedPricingStep(stepIndex)) {
        toast.error(
          "The first pricing step is managed by rewards and cannot be edited."
        );
        return config;
      }
      const next = {
        ...config,
        steps: config.steps.map((step, index) => {
          if (index !== stepIndex || !step.logic) return { ...step };
          const logic = {
            behavior: step.logic.behavior ?? "show",
            conditions: step.logic.conditions
              ? step.logic.conditions.map((condition, idx) =>
                  idx === conditionIndex
                    ? { ...condition, ...changes }
                    : { ...condition }
                )
              : [],
          };
          return {
            ...step,
            logic,
          };
        }),
      };
      return cleanupConfig(next);
    });
  }

  function handleDeleteCondition(stepIndex: number, conditionIndex: number) {
    updateConfig((config) => {
      if (isLockedPricingStep(stepIndex)) {
        toast.error(
          "The first pricing step is managed by rewards and cannot be edited."
        );
        return config;
      }
      const next = {
        ...config,
        steps: config.steps.map((step, index) => {
          if (index !== stepIndex || !step.logic) return { ...step };
          const logic = {
            behavior: step.logic.behavior ?? "show",
            conditions: step.logic.conditions
              ? step.logic.conditions
                  .filter((_, idx) => idx !== conditionIndex)
                  .map((condition) => ({ ...condition }))
              : [],
          };
          return {
            ...step,
            logic,
          };
        }),
      };
      return cleanupConfig(next);
    });
  }

  function handleLogicBehaviorChange(
    stepIndex: number,
    behavior: StepBehavior
  ) {
    updateConfig((config) => {
      const next = {
        ...config,
        steps: config.steps.map((step, index) => {
          if (index !== stepIndex) return { ...step };
          const logic = {
            behavior,
            conditions: [...(step.logic?.conditions ?? [])],
          };
          return {
            ...step,
            logic,
          };
        }),
      };
      return cleanupConfig(next);
    });
  }

  const linkedTransportCount = useMemo(
    () =>
      childRelationships.filter((rel) => rel.relationship === "transport")
        .length,
    [childRelationships]
  );

  function handleSyncTransportPartners() {
    if (!draft) return;
    const relevantRelationships = childRelationships.filter(
      (rel) => rel.relationship === "transport"
    );
    if (relevantRelationships.length === 0) {
      toast.info("No linked transport partners to sync.");
      return;
    }
    const unique = new Map<string, PartnerRelationship>();
    relevantRelationships.forEach((rel) => {
      if (rel.childPartnerId && !unique.has(rel.childPartnerId)) {
        unique.set(rel.childPartnerId, rel);
      }
    });
    if (unique.size === 0) {
      toast.info("No linked partners available to sync.");
      return;
    }
    updateConfig((config) => {
      const t = ensureTransport(config);
      t.enabled = true;
      t.partners = Array.from(unique.values()).map((rel) => {
        const partner = partnerLookup.get(rel.childPartnerId);
        const label = partner?.displayName?.trim() || rel.childPartnerId;
        return {
          id: rel.childPartnerId,
          label,
          value: rel.childPartnerId,
          description: "Transport partner",
        };
      });
      return { ...config, transport: t };
    });
    toast.success("Synced linked transport partners into the form.");
  }

  function renderStyling() {
    if (!draft) return null;
    const defaultTheme = {
      background: "#0b0f14",
      card: "#0f1720",
      accent: "#f59e0b",
      muted: "#9fb3c8",
      text: "#e6edf3",
    };
    const theme = {
      ...defaultTheme,
      ...(draft.config.styling?.theme ?? {}),
    };
    return (
      <Card className="border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle>Styling</CardTitle>
          <CardDescription>
            Customize colors and typography for the generated form.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            {(["background", "card", "accent", "muted", "text"] as const).map(
              (key) => (
                <div key={key} className="flex items-center gap-3">
                  <div className="w-8">
                    <input
                      type="color"
                      value={theme[key]}
                      onChange={(event) =>
                        updateConfig((config) => {
                          const next = { ...config };
                          const mergedTheme = {
                            ...defaultTheme,
                            ...(next.styling?.theme ?? {}),
                            [key]: event.target.value,
                          };
                          next.styling = {
                            theme: mergedTheme,
                            fontFamily:
                              next.styling?.fontFamily ??
                              'Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial',
                          };
                          return next;
                        })
                      }
                      className="h-9 w-9 cursor-pointer rounded border bg-transparent p-0"
                      aria-label={`${key} color`}
                    />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs uppercase text-muted-foreground">
                      {key.charAt(0).toUpperCase() + key.slice(1)} color
                    </Label>
                    <Input
                      value={theme[key]}
                      onChange={(event) =>
                        updateConfig((config) => {
                          const next = { ...config };
                          const mergedTheme = {
                            ...defaultTheme,
                            ...(next.styling?.theme ?? {}),
                            [key]: event.target.value,
                          };
                          next.styling = {
                            theme: mergedTheme,
                            fontFamily:
                              next.styling?.fontFamily ??
                              'Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial',
                          };
                          return next;
                        })
                      }
                    />
                  </div>
                </div>
              )
            )}
          </div>
          <div>
            <Label className="text-xs uppercase text-muted-foreground">
              Font family
            </Label>
            <Input
              value={
                draft.config.styling?.fontFamily ??
                'Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial'
              }
              onChange={(event) =>
                updateConfig((config) => {
                  const next = { ...config };
                  next.styling = {
                    theme: {
                      ...defaultTheme,
                      ...(next.styling?.theme ?? {}),
                    },
                    fontFamily: event.target.value,
                  };
                  return next;
                })
              }
              placeholder='Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial'
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderSteps() {
    if (!draft) return null;
    const steps = draft.config.steps;
    const dealRequirementRows =
      draft.usageType === "deal" && draft.dealId
        ? dealLookup.get(draft.dealId)?.ticketRequirements ?? []
        : [];
    const groupedDealRequirements = (() => {
      const formatLabel = (value: string) => {
        if (!value) return value;
        return value
          .split(/[\s-_]+/)
          .filter(Boolean)
          .map(
            (part) =>
              part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
          )
          .join(" ");
      };
      const map = new Map<
        string,
        {
          ticketType: string;
          items: { subType: string | null; quantity: number }[];
        }
      >();
      dealRequirementRows.forEach((req) => {
        const key = req.ticketType.toLowerCase();
        const entry =
          map.get(key) ??
          {
            ticketType: req.ticketType,
            items: [],
          };
        entry.items.push({
          subType: req.subType ?? null,
          quantity: req.quantity,
        });
        map.set(key, entry);
      });
      return Array.from(map.values()).map((entry) => ({
        ...entry,
        displayTicketType: formatLabel(entry.ticketType),
        items: entry.items.map((item) => ({
          ...item,
          displaySubType: item.subType ? formatLabel(item.subType) : null,
        })),
      }));
    })();
    const requirementItemCount = dealRequirementRows.length;
    const hasDealRequirementStep = requirementItemCount > 0;
    return (
      <Card className="border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle>Form steps</CardTitle>
          <CardDescription>
            Configure step titles, flow logic, and field labels displayed in the
            generated form.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {hasDealRequirementStep ? (
            <div className="space-y-3 rounded-xl border border-border bg-muted/50/60">
              <details open className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-t-xl bg-muted/80 px-4 py-3 text-sm font-medium">
                  <span>Step 1: Ticket requirements (read-only)</span>
                  <span className="text-xs text-muted-foreground">
                    {requirementItemCount} requirement
                    {requirementItemCount === 1 ? "" : "s"}
                  </span>
                </summary>
                <div className="space-y-4 border-t border-border bg-card/90 px-4 py-5 text-sm">
                  <p className="text-muted-foreground">
                    Pulled from the linked flash deal. Users see these
                    requirements before completing the form.
                  </p>
                  <div className="space-y-3">
                    {groupedDealRequirements.map((group) => {
                      const hasSubOptions = group.items.some(
                        (item) => item.subType,
                      );
                      const baseItem =
                        group.items.find((item) => !item.subType) ?? null;
                      const subItems = hasSubOptions
                        ? group.items.filter((item) => item.subType)
                        : [];
                      return (
                        <div
                          key={group.ticketType}
                          className="space-y-2 rounded-lg border border-border bg-muted/50 p-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="font-semibold text-foreground">
                                {group.displayTicketType}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Ticket type: {group.ticketType}
                              </span>
                            </div>
                            {!hasSubOptions && baseItem ? (
                              <span className="text-xs font-semibold text-foreground">
                                Qty {baseItem.quantity}
                              </span>
                            ) : null}
                          </div>
                          {hasSubOptions ? (
                            <div className="space-y-1">
                              {subItems.map((item, idx) => (
                                <div
                                  key={`${group.ticketType}-${item.subType ?? "base"}-${idx}`}
                                  className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2"
                                >
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-foreground">
                                      {`${group.displayTicketType} · ${item.displaySubType}`}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {`Sub-option: ${item.displaySubType}`}
                                    </span>
                                  </div>
                                  <span className="text-xs font-semibold text-foreground">
                                    Qty {item.quantity}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </details>
            </div>
          ) : null}
          {steps.map((step, index) => {
            const availableConditionFields = steps
              .slice(0, index)
              .flatMap((priorStep) =>
                priorStep.fields.map((field) => ({
                  id: field.id,
                  label: field.label || field.name,
                }))
              );
            const logicConditions = step.logic?.conditions ?? [];
            const stepIsPricing = isPricingStep(step);
            const pricingMeta = stepIsPricing
              ? ensurePricingPayload(step.pricing)
              : null;
            const summaryLabel =
              stepIsPricing && pricingMeta
                ? `${pricingMeta.bundles.length} bundles · ${pricingMeta.addons.length} add-ons`
                : `${step.fields.length} fields`;

            const stepNumber = hasDealRequirementStep ? index + 2 : index + 1;
            return (
              <div key={step.id} className="space-y-3">
                <div className="rounded-xl border border-border bg-muted/50/60">
                  <details open className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-t-xl bg-muted/80 px-4 py-3 text-sm font-medium">
                      <span>
                        Step {stepNumber}: {step.title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {summaryLabel}
                      </span>
                    </summary>
                    <div className="space-y-5 border-t border-border bg-card/90 px-4 py-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-muted-foreground">
                          Step settings
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteStep(index)}
                          disabled={
                            draft.config.steps.length <= 1 ||
                            isLockedPricingStep(index)
                          }
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove step
                        </Button>
                        {isLockedPricingStep(index) && (
                          <p className="text-xs text-amber-600">
                            Step 1 is read-only and cannot be removed
                          </p>
                        )}
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <Label className="text-xs uppercase text-muted-foreground">
                            Step title
                          </Label>
                          <Input
                            value={step.title}
                            onChange={(event) =>
                              updateConfig((config) => {
                                if (isLockedPricingStep(index)) {
                                  toast.error(
                                    "Step 1 (pricing) is read-only and cannot be edited."
                                  );
                                  return config;
                                }
                                const next = { ...config };
                                next.steps[index] = {
                                  ...next.steps[index],
                                  title: event.target.value,
                                };
                                return next;
                              })
                            }
                            disabled={isLockedPricingStep(index)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs uppercase text-muted-foreground">
                            Subtitle
                          </Label>
                          <Input
                            value={step.subtitle ?? ""}
                            onChange={(event) =>
                              updateConfig((config) => {
                                if (isLockedPricingStep(index)) {
                                  toast.error(
                                    "Step 1 (pricing) is read-only and cannot be edited."
                                  );
                                  return config;
                                }
                                const next = { ...config };
                                next.steps[index] = {
                                  ...next.steps[index],
                                  subtitle: event.target.value,
                                };
                                return next;
                              })
                            }
                            placeholder="Optional helper text"
                            disabled={isLockedPricingStep(index)}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <Label className="text-xs uppercase text-muted-foreground">
                            Description
                          </Label>
                          <Textarea
                            value={step.description ?? ""}
                            onChange={(event) =>
                              updateConfig((config) => {
                                if (isLockedPricingStep(index)) {
                                  toast.error(
                                    "Step 1 (pricing) is read-only and cannot be edited."
                                  );
                                  return config;
                                }
                                const next = { ...config };
                                next.steps[index] = {
                                  ...next.steps[index],
                                  description: event.target.value,
                                };
                                return next;
                              })
                            }
                            placeholder="Short helper message shown under the step title."
                            disabled={isLockedPricingStep(index)}
                          />
                        </div>
                      </div>

                      <div className="space-y-3 rounded-lg border border-dashed border-border bg-muted/50 p-4">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              Conditional logic
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Show or hide this step based on responses from
                              earlier steps.
                            </p>
                          </div>
                          <Select
                            value={step.logic?.behavior ?? "show"}
                            onValueChange={(value) =>
                              handleLogicBehaviorChange(
                                index,
                                value as StepBehavior
                              )
                            }
                          >
                            <SelectTrigger className="w-full justify-between md:w-[220px]">
                              <SelectValue placeholder="Choose behavior" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="show">
                                Show step when conditions match
                              </SelectItem>
                              <SelectItem value="hide">
                                Hide step when conditions match
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {availableConditionFields.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            Add fields to a previous step to enable conditional
                            logic.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {logicConditions.map(
                              (condition, conditionIndex) => (
                                <div
                                  key={`${step.id}-condition-${conditionIndex}`}
                                  className="grid gap-2 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.5fr)_auto]"
                                >
                                  <Select
                                    value={condition.fieldId}
                                    onValueChange={(value) =>
                                      handleConditionChange(
                                        index,
                                        conditionIndex,
                                        {
                                          fieldId: value,
                                        }
                                      )
                                    }
                                  >
                                    <SelectTrigger className="justify-between">
                                      <SelectValue placeholder="Select field" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {availableConditionFields.map(
                                        (option) => (
                                          <SelectItem
                                            key={option.id}
                                            value={option.id}
                                          >
                                            {option.label}
                                          </SelectItem>
                                        )
                                      )}
                                    </SelectContent>
                                  </Select>
                                  <Select
                                    value={condition.operator ?? "equals"}
                                    onValueChange={(value) =>
                                      handleConditionChange(
                                        index,
                                        conditionIndex,
                                        {
                                          operator:
                                            value as StepCondition["operator"],
                                        }
                                      )
                                    }
                                  >
                                    <SelectTrigger className="justify-between">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="equals">
                                        Equals
                                      </SelectItem>
                                      <SelectItem value="not_equals">
                                        Does not equal
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Input
                                    value={String(condition.value ?? "")}
                                    onChange={(event) =>
                                      handleConditionChange(
                                        index,
                                        conditionIndex,
                                        {
                                          value: event.target.value,
                                        }
                                      )
                                    }
                                    placeholder="Match value"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() =>
                                      handleDeleteCondition(
                                        index,
                                        conditionIndex
                                      )
                                    }
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              )
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleAddCondition(index)}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Add condition
                            </Button>
                          </div>
                        )}
                      </div>

                      <Separator />

                      {stepIsPricing ? (
                        renderPricingStepEditor(step, index)
                      ) : (
                        <>
                          <div className="space-y-4">
                            {step.fields.map((field, fieldIndex) => {
                              const priorFields = step.fields
                                .slice(0, fieldIndex)
                                .map((prior) => ({
                                  id: prior.id,
                                  label: prior.label || prior.name,
                                }));
                              const conditionOptions = [
                                ...availableConditionFields,
                                ...priorFields,
                              ];
                              return (
                                <FieldEditor
                                  key={field.id}
                                  field={field}
                                  onChange={(updated) =>
                                    updateField(field.id, () => updated)
                                  }
                                  onDelete={() =>
                                    handleDeleteField(step.id, field.id)
                                  }
                                  disableDelete={step.fields.length <= 1}
                                  onKindChange={(nextKind) =>
                                    handleChangeFieldKind(field.id, nextKind)
                                  }
                                  conditionOptions={conditionOptions}
                                />
                              );
                            })}
                          </div>

                          <div className="space-y-3">
                            <p className="text-sm font-medium">Add field</p>
                            <div className="flex flex-wrap gap-2">
                              {ADDABLE_FIELD_KINDS.map((kind) => (
                                <Button
                                  key={`${step.id}-${kind}`}
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleAddField(step.id, kind)}
                                >
                                  <Plus className="mr-2 h-3 w-3" />
                                  {FIELD_KIND_LABEL[kind]}
                                </Button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </details>
                </div>
                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="border border-dashed border-border bg-background text-muted-foreground hover:bg-muted"
                    onClick={() => handleAddStep(index)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add step below
                  </Button>
                </div>
              </div>
            );
          })}
          <div className="flex justify-center pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleAddStep()}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add step
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const partnerShort =
    draft?.partnerId && partnerLookup.get(draft.partnerId)?.displayName
      ? partnerLookup.get(draft.partnerId)?.displayName
      : draft?.partnerId ?? "—";
  const statusDetails = draft ? getStatusOption(draft.status) : null;
  const statusHelper = draft
    ? statusDetails?.helper ??
      "Adjust the configuration and publish when you’re ready."
    : "Select a saved partner form to start editing.";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-6 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  asChild
                  className="border-border bg-muted/50 text-muted-foreground hover:bg-muted"
                >
                  <LocalizedLink href="/admin/forms">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to forms
                  </LocalizedLink>
                </Button>
                {draft ? (
                  <Badge
                    variant="outline"
                    className="border-border bg-muted/50 text-foreground"
                  >
                    {partnerShort}
                  </Badge>
                ) : null}
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-foreground">
                  {draft ? draft.name : "Choose a partner form"}
                </h1>
                <p className="text-sm text-muted-foreground">{statusHelper}</p>
              </div>
            </div>
            <div className="min-w-[240px] space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Switch form
              </Label>
              <Select
                value={selectedId ?? "__none"}
                onValueChange={(value) => {
                  if (value === "__none") {
                    setSelectedId(null);
                    return;
                  }
                  setSelectedId(value);
                }}
              >
                <SelectTrigger className="w-full border-border bg-muted/50">
                  <SelectValue placeholder="Select form" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none" disabled>
                    {forms.length === 0
                      ? "No forms available"
                      : "Select a form"}
                  </SelectItem>
                  {forms.map((form) => (
                    <SelectItem key={form.id} value={form.id}>
                      {form.name} · {form.partnerId ?? "—"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t border-border pt-4">
            <div className="flex flex-wrap items-center gap-2">
              {STATUS_OPTIONS.map((option) => {
                const isActive = draft?.status === option.value;
                return (
                  <Button
                    key={option.value}
                    type="button"
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    disabled={!draft}
                    className={cn(
                      "rounded-full px-4 py-2 text-sm font-medium",
                      isActive
                        ? "bg-foreground text-background hover:bg-foreground/90"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    )}
                    onClick={() => {
                      if (!draft) return;
                      applyDraft((form) => {
                        form.status = option.value;
                      });
                    }}
                  >
                    {option.label}
                  </Button>
                );
              })}
              {draft ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium",
                    STATUS_BADGE_CLASS[draft.status]
                  )}
                >
                  {statusDetails?.label}
                </Badge>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!selectedForm || !hasUnsavedChanges}
                onClick={handleReset}
                className="flex items-center gap-2"
              >
                <RefreshCcw className="h-4 w-4" />
                Reset
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                disabled={saving || !draft || !hasUnsavedChanges}
                onClick={() => handleSave()}
                className="flex items-center gap-2"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save changes
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!draft || saving}
                onClick={() =>
                  handleSave("published", {
                    toastLabel: "Form published and set to Live.",
                  })
                }
                className="flex items-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Save & Publish
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleting || !draft}
                className="flex items-center gap-2"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete
              </Button>
            </div>
          </div>

          {draft ? (
            <>
              {(!draft.partnerId || !draft.usageType) && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <p className="font-semibold">Configuration required</p>
                  <p className="mt-1">
                    Please select a <strong>partner</strong> and{" "}
                    <strong>form type</strong> below before configuring steps
                    and fields. The pricing step will be automatically created
                    once both are selected.
                  </p>
                </div>
              )}
              <div className="grid gap-6 border-t border-border pt-4 md:grid-cols-[1.8fr_1fr]">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Form name
                    </Label>
                    <Input
                      value={draft.name}
                      onChange={(event) =>
                        applyDraft((form) => {
                          form.name = event.target.value;
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Slug
                    </Label>
                    <Input
                      value={draft.slug}
                      onChange={(event) =>
                        applyDraft((form) => {
                          form.slug = event.target.value;
                        })
                      }
                      placeholder="wondr-form"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Partner <span className="text-red-500">*</span>
                    </Label>
                    <Input value={partnerShort ?? "—"} disabled />
                    <p className="text-xs text-muted-foreground">
                      Partner is set when creating the form and cannot be
                      changed here.
                    </p>
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Description
                    </Label>
                    <Textarea
                      value={draft.description ?? ""}
                      onChange={(event) =>
                        applyDraft((form) => {
                          form.description = event.target.value;
                        })
                      }
                      placeholder="Internal notes about this form."
                      rows={3}
                    />
                  </div>
                </div>
                <div className="grid gap-4">
                  <div className="space-y-3 rounded-xl border border-border bg-muted/50/70 p-4 text-sm shadow-sm dark:border-border dark:bg-card dark:text-foreground">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground dark:text-foreground">
                          Usage type
                        </p>
                        <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                          Control whether this form books visits or redeems
                          rewards.
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-border bg-card"
                      >
                        {draft.usageType === "reward"
                          ? "Reward"
                          : draft.usageType === "deal"
                          ? "Deal"
                          : "Visit"}
                      </Badge>
                    </div>
                    <Select
                      value={draft.usageType}
                      onValueChange={(value) => {
                        applyDraft((form) => {
                          const nextUsage =
                            value as PartnerFormRecord["usageType"];
                          form.usageType = nextUsage;
                          if (nextUsage !== "reward") {
                            form.rewardId = null;
                          }
                          if (nextUsage === "deal") {
                            if (!form.dealId) {
                              const firstDeal = dealSelectOptions[0];
                              form.dealId = firstDeal?.value ?? null;
                            }
                            const integration = ensureDeal(form.config);
                            if (!integration.visitorsFieldId) {
                              const fallback = counterFieldOptions[0];
                              integration.visitorsFieldId =
                                fallback?.value ?? "";
                            }
                          } else {
                            form.dealId = null;
                            form.config.deal = undefined;
                          }
                        });
                      }}
                    >
                      <SelectTrigger className="w-full border-border bg-background">
                        <SelectValue placeholder="Select usage" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="visit">
                          Standard visit form
                        </SelectItem>
                        <SelectItem value="reward">
                          Reward redemption form
                        </SelectItem>
                        <SelectItem value="deal">Flash deal form</SelectItem>
                      </SelectContent>
                    </Select>

                    {draft.usageType === "reward" ? (
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-muted-foreground">
                          Linked reward
                        </Label>
                        {rewardSelectOptions.length > 0 ? (
                          <Select
                            value={draft.rewardId ?? "__none"}
                            onValueChange={(value) =>
                              applyDraft((form) => {
                                form.rewardId =
                                  value === "__none" ? null : value;
                              })
                            }
                          >
                            <SelectTrigger className="w-full border-border bg-background">
                              <SelectValue placeholder="Select reward" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none">
                                Select reward…
                              </SelectItem>
                              {rewardSelectOptions.map((reward) => (
                                <SelectItem
                                  key={reward.value}
                                  value={reward.value}
                                >
                                  {reward.label} · {reward.pointsCost} pts
                                  {reward.status !== "active"
                                    ? " (inactive)"
                                    : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="rounded-lg border border-dashed border-border bg-muted/50 p-3 text-xs text-muted-foreground dark:border-border dark:bg-muted/40 dark:text-muted-foreground">
                            No rewards found. Manage rewards in the{" "}
                            <LocalizedLink
                              href="/admin/rewards"
                              className="font-medium text-indigo-600 dark:text-indigo-300"
                            >
                              rewards console
                            </LocalizedLink>
                            .
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                          Customers will complete this form when redeeming the
                          selected reward.
                        </p>
                      </div>
                    ) : null}
                    {draft.usageType === "deal" ? (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-muted-foreground">
                            Linked deal
                          </Label>
                          {dealSelectOptions.length > 0 ? (
                            <Select
                              value={draft.dealId ?? "__none"}
                              onValueChange={(value) =>
                                applyDraft((form) => {
                                  form.dealId =
                                    value === "__none" ? null : value;
                                })
                              }
                            >
                              <SelectTrigger className="w-full border-border bg-background">
                                <SelectValue placeholder="Select deal" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none" disabled>
                                  Select deal…
                                </SelectItem>
                                {dealSelectOptions.map((deal) => (
                                  <SelectItem
                                    key={deal.value}
                                    value={deal.value}
                                  >
                                    {deal.label}
                                    {deal.minVisitors
                                      ? ` · min ${deal.minVisitors}`
                                      : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="rounded-lg border border-dashed border-border bg-muted/50 p-3 text-xs text-muted-foreground dark:border-border dark:bg-muted/40 dark:text-muted-foreground">
                              No eligible deals found. Publish a flash deal
                              first.
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-muted-foreground">
                            Visitors field
                          </Label>
                          {counterFieldOptions.length > 0 ? (
                            <Select
                              value={
                                draft.config.deal?.visitorsFieldId ?? "__none"
                              }
                              onValueChange={(value) =>
                                updateConfig((config) => {
                                  const integration = ensureDeal(config);
                                  integration.visitorsFieldId =
                                    value === "__none" ? "" : value;
                                })
                              }
                            >
                              <SelectTrigger className="w-full border-border bg-background">
                                <SelectValue placeholder="Select field" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none" disabled>
                                  Select field…
                                </SelectItem>
                                {counterFieldOptions.map((option) => (
                                  <SelectItem
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="rounded-lg border border-dashed border-border bg-muted/50 p-3 text-xs text-muted-foreground dark:border-border dark:bg-muted/40 dark:text-muted-foreground">
                              Add a counter or numeric input to capture visitor
                              count.
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-muted-foreground">
                            Marketing consent checkbox (optional)
                          </Label>
                          <Select
                            value={
                              draft.config.deal?.consentFieldId ?? "__none"
                            }
                            onValueChange={(value) =>
                              updateConfig((config) => {
                                const integration = ensureDeal(config);
                                integration.consentFieldId =
                                  value === "__none" ? undefined : value;
                              })
                            }
                          >
                            <SelectTrigger className="w-full border-border bg-background">
                              <SelectValue placeholder="Select consent field" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none">
                                No consent field
                              </SelectItem>
                              {checkboxFieldOptions.map((option) => (
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
                        <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                          Visitors will generate a flash deal QR tied to the
                          selected offer.
                        </p>
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Form title
                    </Label>
                    <Input
                      value={draft.config.title}
                      onChange={(event) =>
                        updateConfig((config) => ({
                          ...config,
                          title: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Subtitle
                    </Label>
                    <Input
                      value={draft.config.subtitle ?? ""}
                      onChange={(event) =>
                        updateConfig((config) => ({
                          ...config,
                          subtitle: event.target.value,
                        }))
                      }
                      placeholder="Supporting copy shown under title."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      QR expiry (days)
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      max={Math.floor(MAX_QR_EXPIRY_SECONDS / SECONDS_IN_DAY)}
                      step={1}
                      value={formatExpiryDays(
                        draft.config.qrExpiresInSeconds ??
                          DEFAULT_QR_EXPIRY_SECONDS
                      )}
                      onChange={(event) => {
                        const days = Number(event.target.value);
                        const nextSeconds =
                          Number.isFinite(days) && days > 0
                            ? days * SECONDS_IN_DAY
                            : DEFAULT_QR_EXPIRY_SECONDS;
                        updateConfig((config) => ({
                          ...config,
                          qrExpiresInSeconds: clampQrExpiry(nextSeconds),
                        }));
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Applies to new QR codes generated from this form. Maximum
                      is 7 days (Supabase signed URL limit).
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/50/60 p-6 text-sm text-muted-foreground">
              Select an existing form from the list to begin editing.
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          {draft ? (
            <>
              {renderHiddenFields()}
              {renderSteps()}
              {renderTicketOptionsEditor()}
              {renderTransportSettings()}
              {renderStyling()}
            </>
          ) : (
            <Card className="border-border bg-card shadow-sm">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No form selected yet. Choose a form from the list above to
                unlock the builder. New forms can be created from the overview.
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className="border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle>Summary</CardTitle>
              <CardDescription>
                {draft ? (
                  <>
                    Status updates for form <strong>{draft.name}</strong>
                  </>
                ) : (
                  "Select a form to view status and metadata."
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              {draft ? (
                <>
                  <p className="flex items-center gap-2">
                    <CheckCircle2
                      className={cn(
                        "h-4 w-4",
                        hasUnsavedChanges
                          ? "text-amber-500"
                          : "text-emerald-500"
                      )}
                    />
                    {hasUnsavedChanges
                      ? "Unsaved changes detected"
                      : "All changes are saved"}
                  </p>
                  <p>
                    Created:{" "}
                    <span className="font-medium text-foreground">
                      {new Date(draft.createdAt).toLocaleString()}
                    </span>
                  </p>
                  <p>
                    Updated:{" "}
                    <span className="font-medium text-foreground">
                      {new Date(draft.updatedAt).toLocaleString()}
                    </span>
                  </p>
                </>
              ) : (
                <p>Select a form from the list to see activity details.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

interface FieldEditorProps {
  field: PartnerFormField;
  onChange: (field: PartnerFormField) => void;
  onDelete?: () => void;
  disableDelete?: boolean;
  onKindChange?: (kind: SupportedFieldKind) => void;
  conditionOptions: Array<{ id: string; label: string }>;
}

function FieldEditor({
  field,
  onChange,
  onDelete,
  disableDelete,
  onKindChange,
  conditionOptions,
}: FieldEditorProps) {
  const currentKind = (field.kind as SupportedFieldKind) ?? "input";
  const selectableKinds: SupportedFieldKind[] = [
    ...new Set<SupportedFieldKind>([...ADDABLE_FIELD_KINDS, "transport"]),
  ];
  const logic: PartnerFormStepLogic = field.logic ?? {
    behavior: "show",
    conditions: [],
  };
  const conditions: StepCondition[] = logic.conditions ?? [];
  const logicEnabled = conditions.length > 0;

  const updateField = (patch: Partial<PartnerFormField>) => {
    onChange({ ...field, ...patch });
  };

  const ensureLogicEnabled = () => {
    if (logicEnabled) return;
    const defaultCondition: StepCondition = {
      fieldId: conditionOptions[0]?.id ?? "",
      operator: "equals",
      value: "",
    };
    const nextConditions: StepCondition[] =
      conditions.length > 0 ? [...conditions] : [defaultCondition];
    updateField({
      logic: {
        behavior: logic.behavior ?? "show",
        conditions: nextConditions,
      },
    });
  };

  const disableLogic = () => {
    const clone = { ...field } as PartnerFormField & {
      logic?: PartnerFormStepLogic;
    };
    delete clone.logic;
    onChange(clone);
  };

  const addCondition = () => {
    ensureLogicEnabled();
    const nextConditions = [
      ...((field.logic?.conditions ?? []) as StepCondition[]),
      {
        fieldId: conditionOptions[0]?.id ?? "",
        operator: "equals" as StepCondition["operator"],
        value: "",
      },
    ];
    updateField({
      logic: {
        behavior: field.logic?.behavior ?? "show",
        conditions: nextConditions,
      },
    });
  };

  const updateCondition = (index: number, patch: Partial<StepCondition>) => {
    const baseConditions = (field.logic?.conditions ?? []) as StepCondition[];
    const next = baseConditions.map((condition, idx) =>
      idx === index ? { ...condition, ...patch } : condition
    );
    updateField({
      logic: {
        behavior: field.logic?.behavior ?? "show",
        conditions: next,
      },
    });
  };

  const removeCondition = (index: number) => {
    const baseConditions = (field.logic?.conditions ?? []) as StepCondition[];
    const next = baseConditions.filter((_, idx) => idx !== index);
    if (next.length === 0) {
      disableLogic();
      return;
    }
    updateField({
      logic: {
        behavior: field.logic?.behavior ?? "show",
        conditions: next,
      },
    });
  };

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="font-medium">{field.label}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{FIELD_KIND_LABEL[field.kind ?? "input"]}</span>
            <span>·</span>
            <span>{field.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs uppercase text-muted-foreground">
              Field type
            </Label>
            <Select
              value={currentKind}
              onValueChange={(value) => {
                const nextKind = value as SupportedFieldKind;
                if (onKindChange) {
                  onKindChange(nextKind);
                }
              }}
            >
              <SelectTrigger className="w-[140px] border-border bg-muted/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {selectableKinds.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {FIELD_KIND_LABEL[kind] ?? kind}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {onDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onDelete}
              disabled={disableDelete}
              aria-label="Remove field"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label className="text-xs uppercase text-muted-foreground">
            Label
          </Label>
          <Input
            value={field.label}
            onChange={(event) => updateField({ label: event.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">
            Field name
          </Label>
          <Input
            value={field.name}
            onChange={(event) => updateField({ name: event.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">
            Helper text
          </Label>
          <Input
            value={field.helperText ?? ""}
            onChange={(event) =>
              updateField({ helperText: event.target.value })
            }
            placeholder="Optional hint shown below the field."
          />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <Checkbox
            checked={Boolean(field.required)}
            onCheckedChange={(checked) =>
              updateField({ required: Boolean(checked) })
            }
            id={`${field.id}-required`}
          />
          <Label
            htmlFor={`${field.id}-required`}
            className="text-sm font-medium text-muted-foreground"
          >
            Required
          </Label>
        </div>
      </div>

      {field.kind === "input" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label className="text-xs uppercase text-muted-foreground">
              Placeholder
            </Label>
            <Input
              value={field.placeholder ?? ""}
              onChange={(event) =>
                updateField({ placeholder: event.target.value })
              }
            />
          </div>
          <div>
            <Label className="text-xs uppercase text-muted-foreground">
              Input type
            </Label>
            <Select
              value={field.type ?? "text"}
              onValueChange={(value: "text" | "email" | "number") =>
                updateField({ type: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="number">Number</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      {field.kind === "textarea" ? (
        <div>
          <Label className="text-xs uppercase text-muted-foreground">
            Placeholder
          </Label>
          <Input
            value={field.placeholder ?? ""}
            onChange={(event) =>
              updateField({ placeholder: event.target.value })
            }
          />
        </div>
      ) : null}

      {field.kind === "checkbox" ? (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={Boolean(field.defaultValue)}
            onCheckedChange={(checked) =>
              updateField({ defaultValue: Boolean(checked) })
            }
            id={`${field.id}-default`}
          />
          <Label
            htmlFor={`${field.id}-default`}
            className="text-sm font-medium text-muted-foreground"
          >
            Checked by default
          </Label>
        </div>
      ) : null}

      <div className="space-y-3 rounded-lg border border-dashed border-border bg-muted/50 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">
              Conditional display
            </p>
            <p className="text-xs text-muted-foreground">
              Show or hide this field based on previous answers.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={logicEnabled}
              onCheckedChange={(checked) => {
                if (checked) {
                  ensureLogicEnabled();
                } else {
                  disableLogic();
                }
              }}
              disabled={conditionOptions.length === 0 && !logicEnabled}
            />
            Enable conditions
          </label>
        </div>

        {logicEnabled ? (
          conditionOptions.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Add another field earlier in the form before setting conditions.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Label className="text-xs uppercase text-muted-foreground">
                  Behavior
                </Label>
                <Select
                  value={field.logic?.behavior ?? "show"}
                  onValueChange={(value) =>
                    updateField({
                      logic: {
                        behavior: value as StepBehavior,
                        conditions:
                          conditions.length > 0
                            ? conditions
                            : [
                                {
                                  fieldId: conditionOptions[0]?.id ?? "",
                                  operator: "equals",
                                  value: "",
                                },
                              ],
                      },
                    })
                  }
                >
                  <SelectTrigger className="w-full max-w-[200px] justify-between">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="show">Show when matched</SelectItem>
                    <SelectItem value="hide">Hide when matched</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {conditions.map((condition, conditionIndex) => (
                <div
                  key={`${field.id}-logic-${conditionIndex}`}
                  className="grid gap-2 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.5fr)_auto]"
                >
                  <Select
                    value={condition.fieldId}
                    onValueChange={(value) =>
                      updateCondition(conditionIndex, { fieldId: value })
                    }
                  >
                    <SelectTrigger className="justify-between">
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      {conditionOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={condition.operator ?? "equals"}
                    onValueChange={(value) =>
                      updateCondition(conditionIndex, {
                        operator: value as StepCondition["operator"],
                      })
                    }
                  >
                    <SelectTrigger className="justify-between">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equals">Equals</SelectItem>
                      <SelectItem value="not_equals">Does not equal</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={String(condition.value ?? "")}
                    onChange={(event) =>
                      updateCondition(conditionIndex, {
                        value: event.target.value,
                      })
                    }
                    placeholder="Match value"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCondition(conditionIndex)}
                    aria-label="Remove condition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCondition}
              >
                <Plus className="mr-2 h-4 w-4" /> Add condition
              </Button>
            </div>
          )
        ) : (
          <p className="text-xs text-muted-foreground">
            Enable conditional display to control when this field appears.
          </p>
        )}
      </div>

      {field.kind === "counter" ? (
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label className="text-xs uppercase text-muted-foreground">
              Minimum
            </Label>
            <Input
              type="number"
              value={field.min ?? 1}
              min={1}
              onChange={(event) =>
                updateField({ min: Number(event.target.value) || 1 })
              }
            />
          </div>
          <div>
            <Label className="text-xs uppercase text-muted-foreground">
              Maximum
            </Label>
            <Input
              type="number"
              value={field.max ?? ""}
              min={field.min ?? 1}
              onChange={(event) =>
                updateField({
                  max: event.target.value
                    ? Number(event.target.value)
                    : undefined,
                })
              }
            />
          </div>
          <div>
            <Label className="text-xs uppercase text-muted-foreground">
              Default
            </Label>
            <Input
              type="number"
              value={Number(field.defaultValue ?? 1)}
              min={field.min ?? 1}
              onChange={(event) =>
                updateField({
                  defaultValue: Number(event.target.value) || 1,
                })
              }
            />
          </div>
        </div>
      ) : null}

      {field.kind === "transport" ? (
        <div>
          <Label className="text-xs uppercase text-muted-foreground">
            Additional note
          </Label>
          <Textarea
            value={field.note ?? ""}
            onChange={(event) => updateField({ note: event.target.value })}
            placeholder="Optional note explaining transport choices."
          />
        </div>
      ) : null}

      {(field.kind === "radio" || field.kind === "select") && (
        <div className="space-y-3">
          <Label className="text-xs uppercase text-muted-foreground">
            Options
          </Label>
          {(field.options ?? []).map((option, index) => (
            <div
              key={option.id ?? index}
              className="grid gap-2 md:grid-cols-[1fr_1fr_auto] lg:grid-cols-[1fr_1fr_120px_auto]"
            >
              <Input
                value={option.label}
                onChange={(event) => {
                  const options = [...(field.options ?? [])];
                  options[index] = {
                    ...options[index],
                    label: event.target.value,
                  };
                  updateField({ options });
                }}
                placeholder="Label"
              />
              <Input
                value={option.value}
                onChange={(event) => {
                  const options = [...(field.options ?? [])];
                  options[index] = {
                    ...options[index],
                    value: event.target.value,
                  };
                  updateField({ options });
                }}
                placeholder="Value"
              />
              {field.kind === "radio" ? (
                <Input
                  type="number"
                  value={typeof option.price === "number" ? option.price : ""}
                  onChange={(event) => {
                    const options = [...(field.options ?? [])];
                    const nextPrice = Number(event.target.value);
                    options[index] = {
                      ...options[index],
                      price: Number.isNaN(nextPrice) ? undefined : nextPrice,
                    };
                    updateField({ options });
                  }}
                  placeholder="Price"
                />
              ) : (
                <div />
              )}
              <div className="flex items-end justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const nextOptions = (field.options ?? []).filter(
                      (_, i) => i !== index
                    );
                    updateField({ options: nextOptions });
                  }}
                  aria-label="Remove option"
                  disabled={(field.options ?? []).length <= 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const nextOptions = [
                ...(field.options ?? []),
                {
                  id: generateOptionId(),
                  label: `Option ${(field.options ?? []).length + 1}`,
                  value: `option-${(field.options ?? []).length + 1}`,
                },
              ];
              updateField({ options: nextOptions });
            }}
          >
            <Plus className="mr-2 h-3 w-3" />
            Add option
          </Button>
        </div>
      )}
    </div>
  );
}
