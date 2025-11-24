"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

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
import { ImageUploadField } from "@/components/admin/media/image-upload-field";
import type { FlashDealStatus } from "@/lib/data/flash-deals";
import type { PartnerTicketInclusions } from "@/lib/data/partners";
import { getCsrfToken } from "@/lib/web/csrf";
import { useLocalizedRouter } from "@/i18n/use-localized-router";

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
  status: FlashDealStatus;
  title: string;
  slug: string;
  description: string;
  discountPercent: string;
  minVisitors: string;
  commissionPercent: string;
  priceOverrideCzk: string;
  bonusPointsOverride: string;
  isFeatured: boolean;
  bannerLeadHours: string;
  qrValidityDays: string;
  usageLimit: string;
  usageLimitDaily: string;
  validFrom: string;
  validTo: string;
  autoExpire: boolean;
  sendReminders: boolean;
  heroImageUrl: string;
  heroImageAlt: string;
  formId: string | null;
  ticketTypes: string[];
  timeZone: string;
}

type TicketConditionRow = {
  id: string;
  ticketType: string;
  subType?: string;
  quantity: number;
  label: string;
  inclusionKey?: string | null;
  isInclusion?: boolean;
  isOrphan?: boolean;
};

type PartnerTicketDetailSummary = {
  id: string;
  ticketType: string;
  label: string | null;
  inclusions?: PartnerTicketInclusions | null;
};

export type DealFormMode = "create" | "edit";

export interface DealFormInitialData {
  id: string;
  partnerId: string;
  status: FlashDealStatus;
  title: string;
  slug: string | null;
  description: string | null;
  discountPercent: number;
  minVisitors: number;
  commissionPercent: number;
  priceOverrideCzk: number | null;
  bonusPointsOverride: number | null;
  isFeatured: boolean;
  bannerLeadHours: number;
  qrValiditySeconds: number;
  usageLimit: number | null;
  usageLimitDaily: number | null;
  validFrom: string | null;
  validTo: string | null;
  validDays: number[] | null;
  autoExpire: boolean;
  sendReminders: boolean;
  formId?: string | null;
  ticketTypes: string[];
  ticketRequirements: Array<{
    ticketType: string;
    subType?: string;
    quantity: number;
  }>;
  heroImageUrl?: string | null;
  heroImageAlt?: string | null;
  timeZone?: string | null;
}

const INITIAL_FORM: DealCreateFormState = {
  partnerId: "",
  status: "draft",
  title: "",
  slug: "",
  description: "",
  discountPercent: "10",
  minVisitors: "1",
  commissionPercent: "20",
  priceOverrideCzk: "",
  bonusPointsOverride: "",
  isFeatured: false,
  bannerLeadHours: "0",
  qrValidityDays: String(DEFAULT_QR_VALIDITY_DAYS),
  usageLimit: "",
  usageLimitDaily: "",
  validFrom: "",
  validTo: "",
  autoExpire: true,
  sendReminders: false,
  heroImageUrl: "",
  heroImageAlt: "",
  formId: null,
  ticketTypes: [],
  timeZone: "",
};

const createRowId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

const buildRequirementKey = (
  ticketType: string,
  subType?: string,
  inclusionKey?: string | null
) => {
  const normalizedType = ticketType.trim().toLowerCase();
  const normalizedSubType = (subType ?? "").trim().toLowerCase();
  const normalizedInclusion = (inclusionKey ?? "").trim().toLowerCase();
  return `${normalizedType}::${normalizedSubType}::${normalizedInclusion}`;
};

const formatRequirementLabel = (
  ticketType: string,
  subType?: string | null,
  fallbackLabel?: string | null
) => {
  const normalizedSubType = subType?.trim();
  if (normalizedSubType) {
    return `${normalizedSubType} · ${ticketType}`;
  }
  const normalizedFallback = fallbackLabel?.trim();
  return normalizedFallback && normalizedFallback.length
    ? normalizedFallback
    : ticketType;
};

const formatInclusionLabel = (key: string) => {
  return (
    key
      .split(/[_\s]+/)
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ") || key
  );
};

function toInputDateTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export type PartnerOption = {
  id: string;
  label: string;
  status: string;
  defaultCommission?: number | null;
  ticketTypes?: string[] | null;
};

interface DealCreateFormProps {
  partnerOptions: PartnerOption[];
  formOptions?: Array<{ id: string; name: string }>;
  mode?: DealFormMode;
  existingDeal?: DealFormInitialData | null;
  readOnly?: boolean;
  showWarnings?: boolean;
}

export function DealCreateForm({
  partnerOptions,
  formOptions = [],
  mode = "create",
  existingDeal,
  readOnly = false,
  showWarnings = false,
}: DealCreateFormProps) {
  const initialFormState: DealCreateFormState = useMemo(() => {
    if (!existingDeal) return { ...INITIAL_FORM };
    const qrDays = Math.max(
      1,
      Math.round(
        (existingDeal.qrValiditySeconds ||
          DEFAULT_QR_VALIDITY_DAYS * 24 * 60 * 60) /
          (24 * 60 * 60),
      ),
    );
    return {
      partnerId: existingDeal.partnerId,
      status: existingDeal.status,
      title: existingDeal.title,
      slug: existingDeal.slug ?? "",
      description: existingDeal.description ?? "",
      discountPercent: String(existingDeal.discountPercent),
      minVisitors: String(existingDeal.minVisitors),
      commissionPercent: String(existingDeal.commissionPercent),
      priceOverrideCzk:
        existingDeal.priceOverrideCzk !== null
          ? String(existingDeal.priceOverrideCzk)
          : "",
      bonusPointsOverride:
        existingDeal.bonusPointsOverride !== null
          ? String(existingDeal.bonusPointsOverride)
          : "",
      isFeatured: existingDeal.isFeatured,
      bannerLeadHours: String(existingDeal.bannerLeadHours ?? 0),
      qrValidityDays: String(qrDays),
      usageLimit:
        existingDeal.usageLimit !== null ? String(existingDeal.usageLimit) : "",
      usageLimitDaily:
        existingDeal.usageLimitDaily !== null
          ? String(existingDeal.usageLimitDaily)
          : "",
      validFrom: toInputDateTime(existingDeal.validFrom ?? null),
      validTo: toInputDateTime(existingDeal.validTo ?? null),
      autoExpire: existingDeal.autoExpire,
      sendReminders: existingDeal.sendReminders,
      formId: existingDeal.formId ?? "",
      heroImageUrl: existingDeal.heroImageUrl ?? "",
      heroImageAlt: existingDeal.heroImageAlt ?? "",
      ticketTypes: existingDeal.ticketTypes ?? [],
      timeZone: existingDeal.timeZone ?? "",
    };
  }, [existingDeal]);

  const [form, setForm] = useState<DealCreateFormState>(initialFormState);
  const [validDays, setValidDays] = useState<number[]>(
    existingDeal?.validDays ?? [],
  );
  const [useCustomCommission, setUseCustomCommission] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [ticketRequirements, setTicketRequirements] = useState<
    TicketConditionRow[]
  >(
    (existingDeal?.ticketRequirements ?? []).map((condition) => ({
      id: createRowId(),
      ticketType: condition.ticketType,
      subType: condition.subType,
      quantity: condition.quantity,
      label: formatRequirementLabel(condition.ticketType, condition.subType),
      inclusionKey: undefined,
      isInclusion: false,
    })),
  );
  const [validityMode, setValidityMode] = useState<
    "valid_days" | "date_range" | "always_on"
  >(
    existingDeal?.validFrom && existingDeal?.validTo
      ? "date_range"
      : existingDeal?.validDays?.length
      ? "valid_days"
      : "always_on",
  );
  const router = useLocalizedRouter();
  const isEditMode = mode === "edit";
  const isReadOnly = readOnly === true;
  const activeDealId = existingDeal?.id ?? null;
  const suppressValidityResetRef = useRef(false);
  const [ticketDetailCache, setTicketDetailCache] = useState<
    Record<string, PartnerTicketDetailSummary[]>
  >({});
  const [ticketDetailsLoading, setTicketDetailsLoading] = useState(false);
const [ticketDetailsError, setTicketDetailsError] = useState<string | null>(
  null
);
const previousPartnerRef = useRef<string | null>(null);
const [linkedFormId, setLinkedFormId] = useState<string | null>(
  existingDeal?.formId ?? null,
);

  useEffect(() => {
    if (!existingDeal) return;
    const qrDays = Math.max(
      1,
      Math.round(
        (existingDeal.qrValiditySeconds ||
          DEFAULT_QR_VALIDITY_DAYS * 24 * 60 * 60) /
          (24 * 60 * 60)
      )
    );
    setForm({
      partnerId: existingDeal.partnerId,
      status: existingDeal.status,
      title: existingDeal.title,
      slug: existingDeal.slug ?? "",
      description: existingDeal.description ?? "",
      discountPercent: String(existingDeal.discountPercent),
      minVisitors: String(existingDeal.minVisitors),
      commissionPercent: String(existingDeal.commissionPercent),
      priceOverrideCzk:
        existingDeal.priceOverrideCzk !== null
          ? String(existingDeal.priceOverrideCzk)
          : "",
      bonusPointsOverride:
        existingDeal.bonusPointsOverride !== null
          ? String(existingDeal.bonusPointsOverride)
          : "",
      isFeatured: existingDeal.isFeatured,
      bannerLeadHours: String(existingDeal.bannerLeadHours ?? 0),
      qrValidityDays: String(qrDays),
      usageLimit:
        existingDeal.usageLimit !== null ? String(existingDeal.usageLimit) : "",
      usageLimitDaily:
        existingDeal.usageLimitDaily !== null
          ? String(existingDeal.usageLimitDaily)
          : "",
      validFrom: toInputDateTime(existingDeal.validFrom ?? null),
      validTo: toInputDateTime(existingDeal.validTo ?? null),
      autoExpire: existingDeal.autoExpire,
      sendReminders: existingDeal.sendReminders,
      formId: existingDeal.formId ?? null,
      heroImageUrl: existingDeal.heroImageUrl ?? "",
      heroImageAlt: existingDeal.heroImageAlt ?? "",
      ticketTypes: existingDeal.ticketTypes ?? [],
      timeZone: existingDeal.timeZone ?? "",
    });
    setValidDays(existingDeal.validDays ?? []);
    setTicketRequirements(
      (existingDeal.ticketRequirements ?? []).map((condition) => ({
        id: createRowId(),
        ticketType: condition.ticketType,
        subType: condition.subType,
        quantity: condition.quantity,
        label: formatRequirementLabel(condition.ticketType, condition.subType),
        inclusionKey: undefined,
        isInclusion: false,
      }))
    );
    suppressValidityResetRef.current = true;
    if (existingDeal.validFrom && existingDeal.validTo) {
      setValidityMode("date_range");
    } else if (existingDeal.validDays && existingDeal.validDays.length) {
      setValidityMode("valid_days");
    } else {
      setValidityMode("always_on");
    }
  }, [existingDeal]);

  const selectedPartner = useMemo(
    () => partnerOptions.find((option) => option.id === form.partnerId) ?? null,
    [form.partnerId, partnerOptions]
  );
  const currentPartnerTicketDetails = form.partnerId
    ? ticketDetailCache[form.partnerId]
    : undefined;

  const ticketConditionSummary = useMemo(() => {
    const active = ticketRequirements.filter(
      (condition) => condition.quantity > 0
    );
    if (!active.length) return null;
    return active
      .map((condition) => `${condition.quantity} × ${condition.label}`)
      .join(" + ");
  }, [ticketRequirements]);

  const groupedTicketRequirements = useMemo(() => {
    const groups = new Map<
      string,
      {
        ticketType: string;
        label: string;
        rows: TicketConditionRow[];
      }
    >();
    ticketRequirements.forEach((condition) => {
      const key = condition.ticketType;
      const group = groups.get(key);
      if (group) {
        group.rows.push(condition);
      } else {
        groups.set(key, {
          ticketType: condition.ticketType,
          label: formatRequirementLabel(
            condition.ticketType,
            undefined,
            condition.ticketType
          ),
          rows: [condition],
        });
      }
    });
    const sortRows = (rows: TicketConditionRow[]) =>
      [...rows].sort((a, b) => {
        if (a.isInclusion && !b.isInclusion) return 1;
        if (!a.isInclusion && b.isInclusion) return -1;
        return (a.label ?? "").localeCompare(b.label ?? "");
      });
  return Array.from(groups.values()).map((group) => ({
    ...group,
    rows: sortRows(group.rows),
  }));
}, [ticketRequirements]);

  const partnerDefaultCommission = useMemo(() => {
    const entry = partnerOptions.find((option) => option.id === form.partnerId);
    return typeof entry?.defaultCommission === "number"
      ? entry.defaultCommission
      : null;
  }, [partnerOptions, form.partnerId]);

  const isActivationOn = form.status === "live";

  const handleActivationToggle = useCallback((checked: boolean) => {
    setForm((current) => ({
      ...current,
      status: checked
        ? "live"
        : current.status === "live"
          ? "draft"
          : current.status,
    }));
  }, []);

  const canSubmit = useMemo(
    () => Boolean(form.partnerId.trim() && form.title.trim()),
    [form.partnerId, form.title]
  );

  useEffect(() => {
    if (!form.partnerId) {
      setTicketRequirements([]);
      previousPartnerRef.current = null;
      return;
    }
    if (
      previousPartnerRef.current &&
      previousPartnerRef.current !== form.partnerId
    ) {
      setTicketRequirements([]);
    }
    previousPartnerRef.current = form.partnerId;
  }, [form.partnerId, isEditMode]);

  useEffect(() => {
    if (!useCustomCommission && typeof partnerDefaultCommission === "number") {
      setForm((current) => ({
        ...current,
        commissionPercent: String(partnerDefaultCommission),
      }));
    }
  }, [useCustomCommission, partnerDefaultCommission]);

  const hasSavedRequirements = Boolean(existingDeal?.ticketRequirements?.length);

  useEffect(() => {
    if (!form.partnerId) return;
    if (ticketDetailCache[form.partnerId]) return;
    if (hasSavedRequirements) return;
    let cancelled = false;
    setTicketDetailsLoading(true);
    setTicketDetailsError(null);
    // Clear any stale requirements while loading fresh partner ticket details.
    setTicketRequirements([]);
    const params = new URLSearchParams({ partnerId: form.partnerId });
    void fetch(`/api/admin/partners?${params.toString()}`, {
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `Failed to load partner ticket types (HTTP ${response.status})`
          );
        }
        const data = (await response.json()) as {
          item?: {
            ticketing?: {
              ticketDetails?: Array<{
                id?: string | null;
                ticketType?: string | null;
                label?: string | null;
                inclusions?: PartnerTicketInclusions | null;
              }> | null;
            };
          };
        };
        const rawDetails: Array<{
          id?: string | null;
          ticketType?: string | null;
          label?: string | null;
          inclusions?: PartnerTicketInclusions | null;
        }> = Array.isArray(data.item?.ticketing?.ticketDetails)
          ? (data.item?.ticketing?.ticketDetails ?? [])
          : [];
        const details: PartnerTicketDetailSummary[] = [];
        rawDetails.forEach((detail) => {
          const baseId =
            detail.id && detail.id.trim().length > 0
              ? detail.id
              : (detail.ticketType ?? detail.label ?? "").trim();
          const ticketType = (detail.ticketType ?? detail.label ?? "").trim();
          if (!baseId || !ticketType) {
            return;
          }
          details.push({
            id: baseId,
            ticketType,
            label: detail.label ?? null,
            inclusions: detail.inclusions ?? null,
          });
        });
        if (!cancelled) {
          setTicketDetailCache((current) => ({
            ...current,
            [form.partnerId]: details,
          }));
        }
      })
      .catch((error) => {
        if (cancelled) return;
        const message =
          error instanceof Error
            ? error.message
            : "Failed to load partner ticket types.";
        setTicketDetailsError(message);
        setTicketDetailCache((current) => ({
          ...current,
          [form.partnerId]: [],
        }));
        toast.error(message);
      })
      .finally(() => {
        if (!cancelled) {
          setTicketDetailsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [form.partnerId, ticketDetailCache]);

  useEffect(() => {
    if (!form.partnerId) return;
    if (currentPartnerTicketDetails === undefined) return;
    setTicketRequirements((current) => {
      const existingMap = new Map(
        current.map((item) => [
          buildRequirementKey(item.ticketType, item.subType, item.inclusionKey),
          item,
        ]),
      );
      const next: TicketConditionRow[] = [];

      const upsertRequirement = ({
        ticketType,
        label,
        subType,
        inclusionKey = null,
        isInclusion = false,
        isOrphan = false,
      }: {
        ticketType: string;
        label: string;
        subType?: string;
        inclusionKey?: string | null;
        isInclusion?: boolean;
        isOrphan?: boolean;
      }) => {
        // Keyed only by ticketType + subType so saved requirements without inclusionKey still match.
        const key = buildRequirementKey(ticketType, subType);
        const existing = existingMap.get(key);
        if (existing) {
          next.push({
            ...existing,
            label,
            subType,
            inclusionKey,
            isInclusion,
            isOrphan,
          });
          existingMap.delete(key);
        } else {
          next.push({
            id: createRowId(),
            ticketType,
            subType,
            quantity: 0,
            label,
            inclusionKey,
            isInclusion,
            isOrphan,
          });
        }
      };

      for (const detail of currentPartnerTicketDetails) {
        const baseType = (
          detail.ticketType ??
          detail.label ??
          detail.id ??
          ""
        ).trim();
        if (!baseType) continue;
        const normalizedLabel = detail.label?.trim() || baseType;

        const inclusions = detail.inclusions ?? {};
        const inclusionEntries = Object.entries(inclusions).filter(
          ([, value]) => value !== null && value !== undefined,
        );

        if (inclusionEntries.length > 0) {
          // Composite ticket: expose sub-options only (e.g., adult/child counts), not the composite itself.
          inclusionEntries.forEach(([inclusionKey]) => {
            const inclusionLabel = formatInclusionLabel(inclusionKey);
            upsertRequirement({
              ticketType: baseType,
              label: inclusionLabel,
              subType: inclusionLabel,
              inclusionKey,
              isInclusion: true,
            });
          });
        } else {
          // Simple ticket: single requirement row.
          upsertRequirement({
            ticketType: baseType,
            label: normalizedLabel,
            subType: normalizedLabel,
          });
        }
      }

      return next;
    });
  }, [form.partnerId, currentPartnerTicketDetails]);

  useEffect(() => {
    if (isEditMode) return;
    if (!form.partnerId && partnerOptions.length > 0) {
      setForm((current) => ({ ...current, partnerId: partnerOptions[0].id }));
    }
  }, [form.partnerId, isEditMode, partnerOptions]);

  useEffect(() => {
    const activeConditions = ticketRequirements.filter(
      (condition) => condition.quantity > 0
    );
    const maxRequired = activeConditions.reduce(
      (max, condition) => Math.max(max, condition.quantity),
      0
    );
    const nextTicketTypes = Array.from(
      new Set(
        activeConditions
          .map((condition) => condition.ticketType)
          .filter(Boolean)
      )
    );
    setForm((current) => ({
      ...current,
      minVisitors: maxRequired > 0 ? String(maxRequired) : current.minVisitors,
      ticketTypes: nextTicketTypes,
    }));
  }, [ticketRequirements]);

  const requirementPreview = useMemo(() => {
    return groupedTicketRequirements.map((group) => {
      const subItems = group.rows.map((row) => ({
        subType: row.subType ?? null,
        quantity: row.quantity,
      }));
      const totalQuantity = subItems.reduce((sum, item) => sum + item.quantity, 0);
      return {
        ticketType: group.ticketType,
        subItems,
        totalQuantity,
      };
    });
  }, [groupedTicketRequirements]);

  useEffect(() => {
    if (suppressValidityResetRef.current) {
      suppressValidityResetRef.current = false;
      return;
    }
    if (validityMode === "always_on") {
      setForm((current) => ({ ...current, validFrom: "", validTo: "" }));
      setValidDays([]);
    } else if (validityMode === "valid_days") {
      setForm((current) => ({ ...current, validFrom: "", validTo: "" }));
    } else if (validityMode === "date_range") {
      setValidDays([]);
    }
  }, [validityMode]);

  const toggleDay = useCallback((value: number) => {
    setValidDays((current) =>
      current.includes(value)
        ? current.filter((day) => day !== value)
        : [...current, value]
    );
  }, []);

  const updateTicketCondition = useCallback(
    (id: string, updates: Partial<TicketConditionRow>) => {
      setTicketRequirements((current) =>
        current.map((condition) =>
          condition.id === id ? { ...condition, ...updates } : condition
        )
      );
    },
    []
  );

  const resetForm = useCallback(() => {
    setForm({ ...INITIAL_FORM });
    setValidDays([]);
    setUseCustomCommission(true);
    setTicketRequirements([]);
    setValidityMode("valid_days");
    setLinkedFormId(null);
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isReadOnly) return;
      if (!canSubmit || submitting) return;
      if (isEditMode && !activeDealId) {
        toast.error("Missing deal id");
        return;
      }
      setSubmitting(true);
      try {
        const qrValidityDays = Math.max(
          1,
          Number(form.qrValidityDays) || DEFAULT_QR_VALIDITY_DAYS
        );

        const payload: Record<string, unknown> = {
          title: form.title.trim(),
          status: form.status,
          discountPercent: Number(form.discountPercent) || 0,
          commissionPercent: Number(form.commissionPercent) || 0,
          qrValiditySeconds: qrValidityDays * 24 * 60 * 60,
          autoExpire: form.autoExpire,
          sendReminders: form.sendReminders,
          isFeatured: form.isFeatured,
          bannerLeadHours: Math.max(0, Number(form.bannerLeadHours) || 0),
          formId: linkedFormId ?? null,
        };
        if (form.timeZone.trim()) {
          payload.timeZone = form.timeZone.trim();
        }

        if (!isEditMode) {
          payload.partnerId = form.partnerId.trim();
        }

        if (form.slug.trim()) payload.slug = form.slug.trim();
        if (form.description.trim())
          payload.description = form.description.trim();
        if (form.priceOverrideCzk.trim()) {
          payload.priceOverrideCzk = Number(form.priceOverrideCzk);
        }
        if (form.bonusPointsOverride.trim()) {
          payload.bonusPointsOverride = Number(form.bonusPointsOverride);
        }
        if (form.usageLimit.trim()) {
          payload.usageLimit = Number(form.usageLimit);
        }
        if (form.usageLimitDaily.trim()) {
          payload.usageLimitDaily = Number(form.usageLimitDaily);
        }
        let calculatedValidFrom: string | null = null;
        let calculatedValidTo: string | null = null;

        if (validityMode === "date_range") {
          if (!form.validFrom || !form.validTo) {
            throw new Error("Please provide both start and end dates.");
          }
          calculatedValidFrom = form.validFrom
            ? new Date(form.validFrom).toISOString()
            : null;
          calculatedValidTo = form.validTo
            ? new Date(form.validTo).toISOString()
            : null;
        } else if (validityMode === "valid_days") {
          if (!validDays.length) {
            throw new Error("Please select at least one valid day.");
          }
        }

        if (calculatedValidFrom) {
          payload.validFrom = calculatedValidFrom;
        }
        if (calculatedValidTo) {
          payload.validTo = calculatedValidTo;
        }
        if (validityMode === "valid_days" && validDays.length) {
          payload.validDays = validDays;
        }
        const requirements = ticketRequirements
          .map((condition) => ({
            ticketType: condition.ticketType.trim(),
            subType: condition.subType?.trim() || undefined,
            quantity: Math.max(0, condition.quantity),
          }))
          .filter(
            (condition) => condition.ticketType && condition.quantity > 0
          );
        if (requirements.length > 0) {
          payload.ticketRequirements = requirements;
          const requiredHeadcount = requirements.reduce(
            (max, item) => Math.max(max, item.quantity),
            0
          );
          payload.minVisitors = Math.max(requiredHeadcount, Number(form.minVisitors) || 1);
          payload.ticketTypes = Array.from(
            new Set(requirements.map((item) => item.ticketType))
          );
        } else {
          const ticketTypes = Array.from(
            new Set(
              form.ticketTypes
                .map((value) => value.trim())
                .filter((value) => value.length > 0)
            )
          );
          if (ticketTypes.length) payload.ticketTypes = ticketTypes;
          payload.minVisitors = Math.max(Number(form.minVisitors) || 1, 1);
        }

        if (!isEditMode) {
          const mediaItems: Array<{
            url: string;
            mediaType?: string;
            altText?: string;
            sortOrder?: number;
          }> = [];
          const heroUrl = form.heroImageUrl.trim();
          if (heroUrl) {
            mediaItems.push({
              url: heroUrl,
              mediaType: "image/hero",
              altText: form.heroImageAlt.trim() || undefined,
              sortOrder: 0,
            });
          }
          if (mediaItems.length) {
            payload.media = mediaItems;
          }
        }

        const endpoint =
          isEditMode && activeDealId
            ? `/api/admin/deals/${activeDealId}`
            : "/api/admin/deals";
        const method = isEditMode ? "PUT" : "POST";

        const response = await fetch(endpoint, {
          method,
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": getCsrfToken(),
          },
          credentials: "include",
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          let message = `Failed to ${isEditMode ? "update" : "create"} deal (HTTP ${response.status})`;
          try {
            const data = (await response.json()) as { error?: string };
            if (data?.error) message = data.error;
          } catch {
            // ignore
          }
          throw new Error(message);
        }

        toast.success(isEditMode ? "Deal updated" : "Deal created");
        if (isEditMode && activeDealId) {
          router.push(`/admin/deals/${activeDealId}`);
        } else {
          resetForm();
          router.push("/admin/deals");
        }
      } catch (error) {
        console.error("deal_create_form_submit_error", error);
        const message =
          error instanceof Error
            ? error.message
            : `Failed to ${isEditMode ? "update" : "create"} deal.`;
        toast.error(message);
      } finally {
        setSubmitting(false);
      }
    },
    [
      activeDealId,
      canSubmit,
      form.autoExpire,
      form.bonusPointsOverride,
      form.commissionPercent,
      form.description,
      form.discountPercent,
      form.heroImageAlt,
      form.heroImageUrl,
      form.isFeatured,
      form.minVisitors,
      form.partnerId,
      form.priceOverrideCzk,
      form.qrValidityDays,
      form.bannerLeadHours,
      form.sendReminders,
      form.slug,
      form.status,
      form.ticketTypes,
      form.title,
      form.usageLimit,
      form.usageLimitDaily,
      form.timeZone,
      form.validFrom,
      form.validTo,
      isEditMode,
      isReadOnly,
      validityMode,
      resetForm,
      router,
      linkedFormId,
      showWarnings,
      submitting,
      validDays,
      ticketRequirements,
    ]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <fieldset disabled={isReadOnly} className="space-y-8">
        <SectionCard
          title="Partner & activation"
          description="Choose which partner owns this deal and how it should launch."
        >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="partnerId">Partner</Label>
            <Select
              value={form.partnerId || undefined}
              onValueChange={(value) =>
                setForm((current) => ({ ...current, partnerId: value }))
              }
              disabled={!partnerOptions.length || isReadOnly}
            >
              <SelectTrigger id="partnerId">
                <SelectValue
                  placeholder={
                    partnerOptions.length
                      ? "Select a partner"
                      : "No partners available"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {partnerOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={form.status}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  status: value as FlashDealStatus,
                }))
              }
              disabled={isReadOnly}
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
              Toggle on to activate immediately. Scheduled deals respect their
              validity window.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Linked flash-deal form</Label>
            <Select
              value={linkedFormId ?? "__none"}
              onValueChange={(value) =>
                setLinkedFormId(value === "__none" ? null : value)
              }
              disabled={isReadOnly}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a form (usage: deal)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">No linked form</SelectItem>
                {formOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Linked form:{" "}
              <span className="font-semibold text-foreground">
                {linkedFormId
                  ? formOptions.find((form) => form.id === linkedFormId)?.name ??
                    "Unknown form"
                  : "Not linked"}
              </span>
            </p>
            {!isReadOnly ? (
              <p className="text-xs text-muted-foreground">
                Only forms with usage type “deal” are eligible. Linked form drives the public “Generate QR” flow.
              </p>
            ) : null}
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
          <div className="space-y-2">
            <Label htmlFor="dealId">Deal ID</Label>
            <Input
              id="dealId"
              value={
                isEditMode && activeDealId ? activeDealId : "Generated on save"
              }
              disabled
              readOnly
            />
            <p className="text-xs text-muted-foreground">
              IDs are assigned automatically when the deal is saved.
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Deal story & hero"
        description="Craft the public-facing copy and visuals."
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Deal title</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              placeholder="Summer family bundle"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              rows={4}
              placeholder="Describe what’s included, restrictions, and any highlights."
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ImageUploadField
              label="Hero image"
              description="Displayed on the public Special Deals listing."
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
                  setForm((current) => ({
                    ...current,
                    heroImageAlt: event.target.value,
                  }))
                }
                placeholder="Short description for accessibility"
              />
              <p className="text-xs text-muted-foreground">
                Provide an accessible description for screen readers.
              </p>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Visibility"
        description="Control whether this deal is featured on the public site."
      >
        <div className="grid gap-4 md:grid-cols-[1.2fr,0.8fr]">
          <ToggleField
            label="Show on public site"
            description="Feature this deal in the public listings."
            checked={form.isFeatured}
            onCheckedChange={(checked) =>
              setForm((current) => ({ ...current, isFeatured: checked }))
            }
          />
          <NumberField
            label="Banner lead time (hours)"
            value={form.bannerLeadHours}
            onChange={(value) =>
              setForm((current) => ({ ...current, bannerLeadHours: value }))
            }
            min={0}
            step="1"
            helperText="When featured, start showing the banner this many hours before expiry."
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Value & incentives"
        description="Configure pricing, required visitors, and commission."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <NumberField
            label="Discount %"
            value={form.discountPercent}
            onChange={(value) =>
              setForm((current) => ({ ...current, discountPercent: value }))
            }
            min={0}
            max={100}
            step="0.1"
            required
            disabled
            helperText="Discount is managed automatically."
          />
          <NumberField
            label="Min visitors"
            value={form.minVisitors}
            onChange={(value) =>
              setForm((current) => ({ ...current, minVisitors: value }))
            }
            min={1}
            step="1"
            required
            disabled
            helperText="Calculated automatically from the ticket mix."
          />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="commissionPercent">Commission %</Label>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Custom</span>
                <Switch
                  checked={useCustomCommission}
                  disabled
                  onCheckedChange={(checked) => {
                    setUseCustomCommission(checked);
                    if (
                      !checked &&
                      typeof partnerDefaultCommission === "number"
                    ) {
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
                setForm((current) => ({
                  ...current,
                  commissionPercent: event.target.value,
                }))
              }
              min={0}
              max={100}
              step="0.1"
              required
              disabled
            />
            <p className="text-xs text-muted-foreground">
              Commission is controlled by partner defaults.
            </p>
          </div>
          <NumberField
            label="Flat price override (CZK)"
            value={form.priceOverrideCzk}
            onChange={(value) =>
              setForm((current) => ({ ...current, priceOverrideCzk: value }))
            }
            min={0}
            step="0.5"
            disabled
            helperText="Price overrides are disabled for deals."
          />
          <NumberField
            label="Bonus points override"
            value={form.bonusPointsOverride}
            onChange={(value) =>
              setForm((current) => ({ ...current, bonusPointsOverride: value }))
            }
            min={0}
            step="1"
            disabled
            helperText="Bonus overrides are disabled for deals."
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Automation & reminders"
        description="Control expiry behaviour and follow-up nudges."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <ToggleField
            label="Auto expire"
            description="Mark the deal as expired automatically once the end date passes."
            checked={form.autoExpire}
            onCheckedChange={(checked) =>
              setForm((current) => ({ ...current, autoExpire: checked }))
            }
          />
          <ToggleField
            label="Send reminders"
            description="Queue reminder emails for users who haven’t redeemed yet."
            checked={form.sendReminders}
            onCheckedChange={(checked) =>
              setForm((current) => ({ ...current, sendReminders: checked }))
            }
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Validity window"
        description="Define when the deal is redeemable."
      >
        <div className="grid gap-4 md:grid-cols-2">
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
        </div>
        <div className="space-y-2">
          <Label htmlFor="validityMode">Validity mode</Label>
          <Select
            value={validityMode}
            onValueChange={(value) =>
              setValidityMode(
                value as "valid_days" | "date_range" | "always_on"
              )
            }
          >
            <SelectTrigger id="validityMode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="valid_days">Valid on selected days</SelectItem>
              <SelectItem value="date_range">
                Specific start & end dates
              </SelectItem>
              <SelectItem value="always_on">
                Always on (manual control)
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Choose how long the deal should stay active. Options adapt the
            fields you need to fill.
          </p>
        </div>

        {validityMode === "valid_days" ? (
          <>
            <div className="space-y-2">
              <Label>Valid days</Label>
              <div className="flex flex-wrap gap-3">
                {WEEKDAYS.map((day) => (
                  <label
                    key={day.value}
                    className="flex items-center gap-2 text-sm"
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
            <UsageLimitFields
              usageLimit={form.usageLimit}
              usageLimitDaily={form.usageLimitDaily}
              onUsageLimitChange={(value) =>
                setForm((current) => ({ ...current, usageLimit: value }))
              }
              onUsageLimitDailyChange={(value) =>
                setForm((current) => ({ ...current, usageLimitDaily: value }))
              }
            />
          </>
        ) : null}

        {validityMode === "date_range" ? (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="validFrom">Starts at</Label>
                <Input
                  id="validFrom"
                  type="datetime-local"
                  value={form.validFrom}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      validFrom: event.target.value,
                    }))
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
                    setForm((current) => ({
                      ...current,
                      validTo: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <UsageLimitFields
              usageLimit={form.usageLimit}
              usageLimitDaily={form.usageLimitDaily}
              onUsageLimitChange={(value) =>
                setForm((current) => ({ ...current, usageLimit: value }))
              }
              onUsageLimitDailyChange={(value) =>
                setForm((current) => ({ ...current, usageLimitDaily: value }))
              }
            />
          </>
        ) : null}

        {validityMode === "always_on" ? (
          <>
            <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
              This deal will remain live until you pause or expire it manually.
            </p>
            <UsageLimitFields
              usageLimit={form.usageLimit}
              usageLimitDaily={form.usageLimitDaily}
              onUsageLimitChange={(value) =>
                setForm((current) => ({ ...current, usageLimit: value }))
              }
              onUsageLimitDailyChange={(value) =>
                setForm((current) => ({ ...current, usageLimitDaily: value }))
              }
            />
          </>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Ticketing & conditions"
        description="Set the required quantity per ticket type. Composite tickets (with inclusions like adult/child) expose their sub-options only."
      >
        {requirementPreview.length ? (
          <TicketRequirementPreview requirements={requirementPreview} />
        ) : null}
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              Ticket requirements
            </p>
            <p className="text-xs text-muted-foreground">
              Set the required count for each ticket type defined on the partner (similar to per-ticket pricing). Parents with inclusions use their sub-options.
            </p>
          </div>
          {!form.partnerId ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-muted-foreground">
              Select a partner to load ticket types.
            </p>
          ) : ticketDetailsLoading &&
            currentPartnerTicketDetails === undefined ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-muted-foreground">
              Loading ticket types&hellip;
            </p>
          ) : ticketDetailsError ? (
            <p className="rounded-2xl border border-dashed border-rose-200 bg-white px-4 py-3 text-sm text-rose-600">
              {ticketDetailsError}
            </p>
          ) : ticketRequirements.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-muted-foreground">
              No ticket types configured for this partner. Add ticket types in
              the partner profile first.
            </p>
          ) : (
            <div className="space-y-4">
              {groupedTicketRequirements.map((group) => (
                <div
                  key={group.ticketType}
                  className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-semibold text-foreground">
                      {group.label}
                    </p>
                    <p className="text-[11px] font-mono text-muted-foreground">
                      {group.ticketType}
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {group.rows.map((row) => (
                      <div key={row.id} className="space-y-2">
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                          {row.label}
                        </Label>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-muted-foreground">
                            {row.isInclusion
                              ? `Inclusion of ${group.label}`
                              : row.subType
                                ? `Subtype of ${group.label}`
                                : "Base ticket"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            className="w-24"
                            value={String(row.quantity)}
                            onChange={(event) =>
                              updateTicketCondition(row.id, {
                                quantity: Math.max(
                                  0,
                                  Number(event.target.value) || 0
                                ),
                              })
                            }
                            disabled={isReadOnly}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                {ticketConditionSummary
                  ? `Requires ${ticketConditionSummary} (highest single-ticket requirement: ${form.minVisitors} visitor${form.minVisitors === "1" ? "" : "s"}).`
                  : "No minimum headcount enforced."}
              </p>
            </div>
          )}
        </div>
      </SectionCard>
    </fieldset>

      {!isReadOnly ? (
        <div className="flex items-center justify-end gap-3">
          <Button
            type="submit"
            className="rounded-xl"
            disabled={!canSubmit || submitting}
          >
            {submitting
              ? isEditMode
                ? "Saving…"
                : "Creating…"
              : isEditMode
                ? "Save changes"
                : "Create deal"}
          </Button>
        </div>
      ) : null}
    </form>
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
    <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
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
  disabled,
  helperText,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  min?: number;
  max?: number;
  step?: string;
  required?: boolean;
  disabled?: boolean;
  helperText?: string;
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
        disabled={disabled}
      />
      {helperText ? (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      ) : null}
    </div>
  );
}

function TicketRequirementPreview({
  requirements,
}: {
  requirements: Array<{
    ticketType: string;
    subItems: Array<{ subType: string | null; quantity: number }>;
    totalQuantity: number;
  }>;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-slate-950/40 p-4 text-sm text-slate-200">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
          Step 1 preview · Ticket confirmation
        </p>
        <p className="text-xs text-slate-400">
          Select a ticket type and confirm your headcount.
        </p>
      </div>
      <div className="space-y-3 pt-3">
        {requirements.map((requirement) => (
          <div
            key={requirement.ticketType}
            className="rounded-2xl border border-slate-700/70 bg-slate-900/50 px-4 py-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white">
                {requirement.ticketType}
              </span>
              <span className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
                {requirement.totalQuantity} guest
                {requirement.totalQuantity === 1 ? "" : "s"}
              </span>
            </div>
            {requirement.subItems.length ? (
              <p className="mt-2 text-[11px] text-slate-400">
                Includes{" "}
                {requirement.subItems
                  .map((sub) =>
                    sub.subType
                      ? `${sub.quantity} × ${sub.subType}`
                      : `${sub.quantity} × ${requirement.ticketType}`
                  )
                  .join(" · ")}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
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
    <div className="flex items-start justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function UsageLimitFields({
  usageLimit,
  usageLimitDaily,
  onUsageLimitChange,
  onUsageLimitDailyChange,
}: {
  usageLimit: string;
  usageLimitDaily: string;
  onUsageLimitChange: (value: string) => void;
  onUsageLimitDailyChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <NumberField
        label="Usage limit (lifetime)"
        value={usageLimit}
        onChange={onUsageLimitChange}
        min={1}
        step="1"
        helperText="Maximum total redemptions allowed over the selected window."
      />
      <NumberField
        label="Usage limit (daily)"
        value={usageLimitDaily}
        onChange={onUsageLimitDailyChange}
        min={1}
        step="1"
        helperText="Optional daily cap to prevent overuse on busy days."
      />
    </div>
  );
}
