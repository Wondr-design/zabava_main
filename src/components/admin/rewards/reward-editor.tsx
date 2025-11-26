"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Image as ImageIcon, Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";

import { ImageUploadField } from "@/components/admin/media/image-upload-field";
import { MultiSelect } from "@/components/ui/multi-select";
import { formatDateTime } from "@/lib/format/date";
import {
  DEFAULT_QR_EXPIRY_SECONDS,
  type PartnerFormRecord,
} from "@/lib/data/partner-forms";
import type { RedemptionHistoryItem } from "@/lib/data/redemptions";
import {
  type RewardRecord,
  type RewardPartnerConfig,
  type RewardPartnerTicket,
  type CreateRewardInput,
  type UpdateRewardInput,
} from "@/lib/data/rewards";
import { useGlobalValues } from "@/hooks/use-global-values";
import { adminApi } from "@/lib/web/api-client";
import {
  PageHeader,
  SectionCard,
  DesignButton,
  DesignFormField,
  DesignInput,
  DesignTextarea,
  DesignSelect,
  DesignSelectContent,
  DesignSelectItem,
  DesignSelectTrigger,
  DesignSelectValue,
} from "@/components/design-system";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: RewardRecord["status"][] = ["active", "inactive"];

type PartnerOption = {
  partnerId: string;
  partnerName: string;
  rewardOptIn?: boolean;
};

type FormOption = {
  id: string;
  name: string;
  status: string;
  partnerId: string | null;
  partnerName: string | null;
  updatedAt: string | null;
  usageType?: "visit" | "reward" | "deal";
  config?: PartnerFormRecord["config"];
};

type UsageTotals = {
  used: number;
  rejected: number;
};

type RewardPreview = {
  name: string;
  description: string;
  pointsCost: number;
  heroImage: string | null;
  category: string;
  tags: string[];
};

type RewardPartnerConfigLike =
  | RewardPartnerConfig
  | {
      formId?: string | null;
      tickets?: RewardPartnerTicket[] | null;
    };

function normalizePartnerConfigValue(
  value: RewardPartnerConfigLike | null | undefined,
): RewardPartnerConfig {
  const ticketsSource = Array.isArray(value?.tickets)
    ? (value?.tickets as RewardPartnerTicket[] | undefined)
    : undefined;
  return {
    formId: value?.formId ?? null,
    tickets: ticketsSource ?? [],
  };
}

function formatExpiry(seconds?: number | null) {
  const fallbackSeconds = DEFAULT_QR_EXPIRY_SECONDS;
  const numeric = Number(seconds);
  const normalized =
    Number.isFinite(numeric) && numeric > 0
      ? Math.floor(numeric)
      : fallbackSeconds;
  const hours = normalized / 3600;

  if (hours >= 48 && Number.isInteger(hours / 24)) {
    const days = Math.round(hours / 24);
    return days === 1 ? "1 day" : `${days} days`;
  }

  if (hours >= 1) {
    if (Number.isInteger(hours)) {
      return hours === 1 ? "1 hour" : `${hours} hours`;
    }
    const rounded = Math.round(hours * 10) / 10;
    return `${rounded} hours`;
  }

  const minutes = Math.max(1, Math.round(normalized / 60));
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

function normalizeDateInput(value: string) {
  if (!value) return null;
  return `${value}T00:00:00.000Z`;
}

function formatDateInputValue(value: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

export interface RewardEditorProps {
  reward: RewardRecord | null;
  mode: "create" | "edit";
  onBack: () => void;
  onSaved: (rewardId: string) => void;
}

export function RewardEditor({
  reward,
  mode,
  onBack,
  onSaved,
}: RewardEditorProps) {
  const isEdit = mode === "edit" && Boolean(reward?.id);
  const [name, setName] = useState(reward?.name ?? "");
  const [description, setDescription] = useState(reward?.description ?? "");
  const [pointsCost, setPointsCost] = useState(reward?.pointsCost ?? 0);
  const [category, setCategory] = useState<string>(reward?.category ?? "");
  const [status, setStatus] = useState<RewardRecord["status"]>(
    reward?.status ?? "active"
  );

  const [transportIncluded, setTransportIncluded] = useState<boolean>(
    reward?.transportIncluded ?? false
  );
  const [rewardAvailable, setRewardAvailable] = useState<boolean>(
    reward?.isAvailable ?? true
  );
  const [showAvailabilityDate, setShowAvailabilityDate] = useState<boolean>(
    reward?.showAvailabilityDate ?? false,
  );
  const [selectedPartners, setSelectedPartners] = useState<string[]>(
    reward?.availableFor ? reward.availableFor.slice(0, 1) : []
  );
  const [partnerOptions, setPartnerOptions] = useState<PartnerOption[]>([]);
  const [partnerSearch, setPartnerSearch] = useState("");
  // Partner-specific configurations: Map<partnerId, { formId: string | null, tickets: RewardPartnerTicket[] }>
  const [partnerConfigs, setPartnerConfigs] = useState<
    Map<string, RewardPartnerConfig>
  >(() => {
    if (!reward?.partnerConfigs) {
      return new Map<string, RewardPartnerConfig>();
    }
    const entries =
      reward.partnerConfigs instanceof Map
        ? Array.from(reward.partnerConfigs.entries())
        : Object.entries(
            reward.partnerConfigs as Record<string, RewardPartnerConfigLike>,
          );
    return new Map(
      entries.map(([partnerId, value]) => [
        partnerId,
        normalizePartnerConfigValue(value),
      ]),
    );
  });
  const [tags, setTags] = useState<string[]>(reward?.tags ?? []);
  const [instructions, setInstructions] = useState(
    reward?.redemptionInstructions ?? ""
  );
  const [imageUrl, setImageUrl] = useState(reward?.imageUrl ?? "");
  const [partnerLogoUrl, setPartnerLogoUrl] = useState(
    reward?.partnerLogoUrl ?? ""
  );
  const [heroImages, setHeroImages] = useState<string[]>(
    reward?.heroImages ?? []
  );
  const [heroInput, setHeroInput] = useState(
    reward?.heroImages?.join("\n") ?? ""
  );
  const [redemptionFormId, setRedemptionFormId] = useState(
    reward?.redemptionFormId ?? ""
  );
  const [monthlyRedemptionLimit, setMonthlyRedemptionLimit] = useState(
    reward?.monthlyRedemptionLimit !== undefined &&
      reward?.monthlyRedemptionLimit !== null
      ? String(reward.monthlyRedemptionLimit)
      : ""
  );
  const [dailyRedemptionLimit, setDailyRedemptionLimit] = useState(
    reward?.dailyRedemptionLimit !== undefined &&
      reward?.dailyRedemptionLimit !== null
      ? String(reward.dailyRedemptionLimit)
      : ""
  );
  const [validFrom, setValidFrom] = useState<string | null>(
    reward?.validFrom ?? null
  );
  const [validUntil, setValidUntil] = useState<string | null>(
    reward?.validUntil ?? null
  );
  const [stockLimitValue, setStockLimitValue] = useState(
    typeof reward?.stock === "number" && reward.stock > 0
      ? String(reward.stock)
      : ""
  );
  const [forms, setForms] = useState<FormOption[]>([]);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formPreview, setFormPreview] = useState<PartnerFormRecord | null>(
    null
  );

  const [usage, setUsage] = useState<RedemptionHistoryItem[]>([]);
  const [usageTotals, setUsageTotals] = useState<UsageTotals>({
    used: 0,
    rejected: 0,
  });
  const { values: categoryValues } = useGlobalValues("category", {
    includeInactive: true,
  });
  const { values: tagValues } = useGlobalValues("tag", {
    includeInactive: true,
  });
  const { values: ticketTypeValues } = useGlobalValues("ticket_type", {
    includeInactive: true,
  });

  const categoryOptions = useMemo(() => {
    const base = categoryValues
      .map((item) => ({
        value: item.key,
        label: item.label,
        isActive: item.isActive,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
    if (category && !base.some((option) => option.value === category)) {
      base.push({ value: category, label: category, isActive: false });
    }
    return base;
  }, [categoryValues, category]);

  const tagOptions = useMemo(() => {
    const base = tagValues.map((item) => ({
      value: item.key,
      label: item.label,
      description: item.isActive ? undefined : "Inactive",
    }));
    const extras = tags
      .filter((key) => !base.some((option) => option.value === key))
      .map((key) => ({
        value: key,
        label: key,
        description: "Legacy tag",
      }));
    return [...base, ...extras];
  }, [tagValues, tags]);

  const ticketTypeOptions = useMemo(
    () =>
      ticketTypeValues
        .map((item) => ({
          value: item.key,
          label: item.label,
          isActive: item.isActive,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [ticketTypeValues]
  );

  useEffect(() => {
    if (!category && categoryOptions.length > 0) {
      setCategory(categoryOptions[0].value);
    }
  }, [category, categoryOptions]);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!reward) {
      setName("");
      setDescription("");
      setPointsCost(0);
      setCategory("");
      setTransportIncluded(false);
      setRewardAvailable(true);
      setShowAvailabilityDate(false);
      setStatus("active");
      setSelectedPartners([]);
      setPartnerConfigs(new Map<string, RewardPartnerConfig>());
      setTags([]);
      setInstructions("");
      setImageUrl("");
      setPartnerLogoUrl("");
      setHeroImages([]);
      setHeroInput("");
      setRedemptionFormId("");
      setMonthlyRedemptionLimit("");
      setDailyRedemptionLimit("");
      setValidFrom(null);
      setValidUntil(null);
      setStockLimitValue("");
      setSaveError(null);
      return;
    }
    setName(reward.name ?? "");
    setDescription(reward.description ?? "");
    setPointsCost(reward.pointsCost ?? 0);
    setCategory(reward.category ?? "");
    setTransportIncluded(reward.transportIncluded ?? false);
    setRewardAvailable(reward.isAvailable ?? true);
    setShowAvailabilityDate(reward.showAvailabilityDate ?? false);
    setStatus(reward.status ?? "active");
    setSelectedPartners(reward.availableFor ?? []);
    // Convert plain object to Map if it's not already a Map (comes from JSON as plain object)
    if (reward.partnerConfigs) {
      const entries =
        reward.partnerConfigs instanceof Map
          ? Array.from(reward.partnerConfigs.entries())
          : Object.entries(
              reward.partnerConfigs as Record<string, RewardPartnerConfigLike>,
            );
      setPartnerConfigs(
        new Map(
          entries.map(([partnerId, value]) => [
            partnerId,
            normalizePartnerConfigValue(value),
          ]),
        ),
      );
      const firstPartnerId = entries[0]?.[0];
      setSelectedPartners(firstPartnerId ? [firstPartnerId] : []);
    } else {
      setPartnerConfigs(new Map<string, RewardPartnerConfig>());
      setSelectedPartners([]);
    }
    setTags(reward.tags ?? []);
    setInstructions(reward.redemptionInstructions ?? "");
    setImageUrl(reward.imageUrl ?? "");
    setPartnerLogoUrl(reward.partnerLogoUrl ?? "");
    setHeroImages(reward.heroImages ?? []);
    setHeroInput(reward.heroImages?.join("\n") ?? "");
    setRedemptionFormId(reward.redemptionFormId ?? "");
    setMonthlyRedemptionLimit(
      reward.monthlyRedemptionLimit !== undefined &&
        reward.monthlyRedemptionLimit !== null
        ? String(reward.monthlyRedemptionLimit)
        : ""
    );
    setDailyRedemptionLimit(
      reward.dailyRedemptionLimit !== undefined &&
        reward.dailyRedemptionLimit !== null
        ? String(reward.dailyRedemptionLimit)
        : ""
    );
    setValidFrom(reward.validFrom ?? null);
    setValidUntil(reward.validUntil ?? null);
    const hasStockLimit =
      typeof reward.stock === "number" && reward.stock > 0;
    setStockLimitValue(hasStockLimit ? String(reward.stock ?? "") : "");
    setSaveError(null);
  }, [reward]); // reset when reward changes

  useEffect(() => {
    const points: number[] = [];
    partnerConfigs.forEach((config) => {
      (config.tickets ?? []).forEach((ticket) => {
        if (typeof ticket.points === "number" && ticket.points >= 0) {
          points.push(ticket.points);
        }
      });
    });
    const nextValue = points.length > 0 ? Math.min(...points) : 0;
    setPointsCost((prev) => (prev !== nextValue ? nextValue : prev));
  }, [partnerConfigs]);

  // Initialize defaults for new rewards only when options first become available
  const categoryInitializedRef = useRef(false);

  useEffect(() => {
    if (reward) {
      categoryInitializedRef.current = false;
      return; // Don't initialize if editing existing reward
    }
    if (
      !categoryInitializedRef.current &&
      !category &&
      categoryOptions.length > 0
    ) {
      setCategory(categoryOptions[0].value);
      categoryInitializedRef.current = true;
    }
  }, [reward, category, categoryOptions]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const partnerList = await adminApi.partnersList({});
        if (cancelled) return;
        const opts: PartnerOption[] = (partnerList.items ?? [])
          .map((item) => ({
            partnerId: item.partnerId,
            partnerName: item.displayName ?? item.partnerId,
            rewardOptIn:
              (item as { bonusProgramEnabled?: boolean })
                .bonusProgramEnabled === true,
          }))
          .filter((opt) => opt.rewardOptIn === true);
        setPartnerOptions(opts);
        // Drop any previously selected partners that aren't opted in
        setSelectedPartners((prev) =>
          prev
            .filter((id) => opts.some((opt) => opt.partnerId === id))
            .slice(0, 1)
        );
      } catch {
        if (!cancelled) setPartnerOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setFormLoading(true);
    setFormError(null);
    (async () => {
      try {
        const res = await adminApi.formsList({
          status: "published",
          usageType: "reward",
          limit: 200,
        });
        if (cancelled) return;
        const items = Array.isArray(res.items)
          ? (res.items as PartnerFormRecord[])
          : [];
        const mapped: FormOption[] = items.map((form) => ({
          id: form.id,
          name: form.name,
          status: form.status,
          partnerId: form.partnerId,
          partnerName: form.config.partner?.name ?? null,
          updatedAt: form.updatedAt ?? null,
          usageType: form.usageType,
          config: form.config,
        }));
        setForms(mapped);
      } catch (error) {
        if (!cancelled) {
          setForms([]);
          setFormError(
            error instanceof Error ? error.message : "Failed to load forms"
          );
        }
      } finally {
        if (!cancelled) setFormLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!redemptionFormId) {
      setFormPreview(null);
      return;
    }
    setFormLoading(true);
    setFormError(null);
    (async () => {
      try {
        const res = await adminApi.formGet(redemptionFormId, {});
        if (!cancelled)
          setFormPreview((res?.item ?? null) as PartnerFormRecord | null);
      } catch (error) {
        if (!cancelled)
          setFormError(
            error instanceof Error
              ? error.message
              : "Failed to load form preview"
          );
      } finally {
        if (!cancelled) setFormLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [redemptionFormId]);

  useEffect(() => {
    if (!isEdit || !reward?.id) {
      setUsage([]);
      setUsageTotals({ used: 0, rejected: 0 });
      setUsageError(null);
      setUsageLoading(false);
      return;
    }
    let cancelled = false;
    setUsageLoading(true);
    setUsageError(null);
    (async () => {
      try {
        const res = await adminApi.rewardGet(reward.id, {});
        if (cancelled) return;
        const usageItems = Array.isArray(res.usage)
          ? (res.usage as RedemptionHistoryItem[])
          : [];
        const totals: UsageTotals = {
          used:
            res.usageTotals?.used ??
            usageItems.filter((entry) => entry.status === "used").length,
          rejected:
            res.usageTotals?.rejected ??
            usageItems.filter((entry) => entry.status === "rejected").length,
        };
        setUsage(usageItems);
        setUsageTotals(totals);
      } catch (error) {
        if (!cancelled) {
          setUsage([]);
          setUsageError(
            error instanceof Error
              ? error.message
              : "Failed to load redemption history"
          );
        }
      } finally {
        if (!cancelled) setUsageLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, reward?.id]);

  const filteredPartners = useMemo(() => {
    const term = partnerSearch.trim().toLowerCase();
    if (!term) return partnerOptions;
    return partnerOptions.filter((option) => {
      const name = option.partnerName.toLowerCase();
      return (
        option.partnerId.toLowerCase().includes(term) || name.includes(term)
      );
    });
  }, [partnerOptions, partnerSearch]);

  const preview: RewardPreview = useMemo(
    () => ({
      name,
      description,
      pointsCost,
      heroImage: imageUrl || heroImages[0] || null,
      category:
        categoryOptions.find((option) => option.value === category)?.label ??
        category,
      tags,
    }),
    [
      name,
      description,
      pointsCost,
      imageUrl,
      heroImages,
      category,
      categoryOptions,
      tags,
    ]
  );

  function handlePartnerToggle(id: string) {
    const isAlreadySelected = selectedPartners[0] === id;
    setSelectedPartners(isAlreadySelected ? [] : [id]);
    setPartnerConfigs((prevConfigs) => {
      if (isAlreadySelected) {
        return new Map<string, RewardPartnerConfig>();
      }
      const nextConfigs = new Map<string, RewardPartnerConfig>();
      const existing = prevConfigs.get(id);
      nextConfigs.set(id, existing ?? { formId: null, tickets: [] });
      return nextConfigs;
    });
  }

  function handleHeroChange(value: string) {
    setHeroInput(value);
    const urls = value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    setHeroImages(urls);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);

    try {
      if (!name.trim()) throw new Error("Name is required");
      const normalizedMonthlyLimit =
        monthlyRedemptionLimit.trim().length === 0
          ? undefined
          : Math.max(0, Math.floor(Number(monthlyRedemptionLimit)));
      const normalizedDailyLimit =
        dailyRedemptionLimit.trim().length === 0
          ? undefined
          : Math.max(0, Math.floor(Number(dailyRedemptionLimit)));
      if (
        normalizedMonthlyLimit !== undefined &&
        (!Number.isFinite(normalizedMonthlyLimit) ||
          normalizedMonthlyLimit < 0)
      ) {
        throw new Error(
          "Monthly redemption limit must be a number greater than or equal to zero"
        );
      }
      if (
        normalizedDailyLimit !== undefined &&
        (!Number.isFinite(normalizedDailyLimit) || normalizedDailyLimit < 0)
      ) {
        throw new Error(
          "Daily redemption limit must be a number greater than or equal to zero"
        );
      }
      if (validFrom && validUntil) {
        if (new Date(validUntil) < new Date(validFrom)) {
          throw new Error(
            "Valid until date must be later than the start date"
          );
        }
      }

      // Note: Reward forms and ticket configurations are optional during creation
      // They can be added later in the partner-specific configuration section

      // Get list of partners - use selected partners or fall back to partner configs
      const partnerIds =
        selectedPartners.length > 0
          ? selectedPartners
          : partnerConfigs.size > 0
          ? [Array.from(partnerConfigs.keys())[0]!]
          : [];

      const trimmedStock = stockLimitValue.trim();
      let normalizedStockLimit: number | null = null;
      if (trimmedStock.length > 0) {
        const parsedStock = Math.floor(Number(trimmedStock));
        if (!Number.isFinite(parsedStock) || parsedStock <= 0) {
          throw new Error("Total redemption limit must be greater than zero");
        }
        normalizedStockLimit = parsedStock;
      }

      const payload: CreateRewardInput = {
        name: name.trim(),
        description: description.trim(),
        pointsCost,
        category,
        status,
        availableFor: partnerIds,
        tags,
        redemptionInstructions: instructions.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        heroImages,
        partnerLogoUrl: partnerLogoUrl.trim() || undefined,
        redemptionFormId: "", // Not used anymore - each partner must have their own form
        transportIncluded,
        isAvailable: rewardAvailable,
        showAvailabilityDate,
        validFrom: validFrom ?? undefined,
        validUntil: validUntil ?? undefined,
        monthlyRedemptionLimit:
          normalizedMonthlyLimit === undefined
            ? undefined
            : normalizedMonthlyLimit,
        dailyRedemptionLimit:
          normalizedDailyLimit === undefined ? undefined : normalizedDailyLimit,
        stock: normalizedStockLimit,
        stockWindowDays: null,
      };

      // Prepare partner configs for API call - convert Map to plain object for JSON serialization
      const partnerConfigsEntries =
        partnerIds.length > 0
          ? Array.from(partnerConfigs.entries()).filter(([partnerId]) =>
              partnerIds.includes(partnerId)
            )
          : [];
      const partnerConfigsPayload: Record<string, RewardPartnerConfig> | undefined =
        partnerConfigsEntries.length > 0
          ? Object.fromEntries(partnerConfigsEntries)
          : undefined;

      const partnerPayload = partnerConfigsPayload
        ? { ...payload, partnerConfigs: partnerConfigsPayload }
        : payload;

      if (isEdit && reward?.id) {
        const updateBody =
          partnerPayload as UpdateRewardInput & {
            partnerConfigs?: Record<string, RewardPartnerConfig>;
          };
        const updated = await adminApi.rewardUpdate(
          reward.id,
          updateBody,
          {},
        );
        toast.success("Reward updated");
        onSaved(updated?.id ?? reward.id);
      } else {
        const createBody =
          partnerPayload as CreateRewardInput & {
            partnerConfigs?: Record<string, RewardPartnerConfig>;
          };
        const created = await adminApi.rewardCreate(
          createBody,
          {},
        );
        toast.success("Reward created");
        onSaved(created?.id ?? "");
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to save reward";
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  function renderPartnerList() {
    if (filteredPartners.length === 0) {
      return (
        <p className="px-4 py-3 text-sm text-muted-foreground">
          No partners match that search.
        </p>
      );
    }
    return (
      <ul className="divide-y divide-border">
        {filteredPartners.map((option) => {
          const checked = selectedPartners.includes(option.partnerId);
          return (
            <li
              key={option.partnerId}
              className="flex items-center gap-3 px-4 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => handlePartnerToggle(option.partnerId)}
                className="h-4 w-4 rounded border-border text-primary"
              />
              <div className="flex flex-1 flex-col">
                <span className="font-medium text-foreground">
                  {option.partnerName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {option.partnerId}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="space-y-6 px-6 py-8">
      <PageHeader
        title={name || (isEdit ? reward?.name ?? "Reward" : "New reward")}
        description="Manage metadata, media, and redemption flow for this reward. Changes sync immediately to the bonus portal."
        breadcrumbs={
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm text-[color:var(--ds-text-muted)] hover:text-[color:var(--ds-text-strong)] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to rewards
          </button>
        }
        actions={
          saving ? (
            <div className="inline-flex items-center gap-2 text-sm text-[color:var(--ds-text-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" /> Saving…
            </div>
          ) : null
        }
      />

      {saveError ? (
        <SectionCard className="border-[color:var(--ds-danger)]/30 bg-[color:var(--ds-danger)]/10">
          <p className="text-sm font-medium text-[color:var(--ds-danger)]">
            {saveError}
          </p>
        </SectionCard>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
      >
        <div className="space-y-6">
          <SectionCard title="Basics" description="Core reward information">
            <div className="grid gap-6 md:grid-cols-2">
              <DesignFormField
                label="Reward name"
                required
                helper="A clear, descriptive name for this reward"
              >
                <DesignInput
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  placeholder="Spa weekend for two"
                />
              </DesignFormField>
              <DesignFormField
                label="Category"
                required
                helper="Manage available options in Globals → Categories"
              >
                <DesignSelect value={category} onValueChange={setCategory}>
                  <DesignSelectTrigger>
                    <DesignSelectValue placeholder="Select category" />
                  </DesignSelectTrigger>
                  <DesignSelectContent>
                    {categoryOptions.length === 0 ? (
                      <DesignSelectItem value="__none__" disabled>
                        No categories configured
                      </DesignSelectItem>
                    ) : (
                      categoryOptions.map((option) => (
                        <DesignSelectItem
                          key={option.value}
                          value={option.value}
                        >
                          {option.label}
                          {option.isActive ? "" : " (inactive)"}
                        </DesignSelectItem>
                      ))
                    )}
                  </DesignSelectContent>
                </DesignSelect>
              </DesignFormField>
              <DesignFormField
                label="Status"
                helper="Active rewards are visible to users"
              >
                <DesignSelect
                  value={status}
                  onValueChange={(value) =>
                    setStatus(value as RewardRecord["status"])
                  }
                >
                  <DesignSelectTrigger>
                    <DesignSelectValue />
                  </DesignSelectTrigger>
                  <DesignSelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <DesignSelectItem key={option} value={option}>
                        {option}
                      </DesignSelectItem>
                    ))}
                  </DesignSelectContent>
                </DesignSelect>
              </DesignFormField>
              <DesignFormField
                label="Reward settings"
                className="md:col-span-2"
              >
                <div className="flex flex-wrap gap-4">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={rewardAvailable}
                      onChange={(event) =>
                        setRewardAvailable(event.target.checked)
                      }
                      className="h-4 w-4 rounded border-input text-primary"
                    />
                    <span>Mark as available</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={transportIncluded}
                      onChange={(event) =>
                        setTransportIncluded(event.target.checked)
                      }
                      className="h-4 w-4 rounded border-input text-primary"
                    />
                    <span>Transport included</span>
                  </label>
                </div>
              </DesignFormField>
              <DesignFormField
                label="Validity window"
                helper="Optional start and end dates when this reward can be redeemed."
                className="md:col-span-2"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-foreground">
                      Starts on
                    </span>
                    <DesignInput
                      type="date"
                      value={formatDateInputValue(validFrom)}
                      onChange={(event) =>
                        setValidFrom(
                          event.target.value
                            ? normalizeDateInput(event.target.value)
                            : null
                        )
                      }
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-foreground">
                      Ends on
                    </span>
                    <DesignInput
                      type="date"
                      value={formatDateInputValue(validUntil)}
                      onChange={(event) =>
                        setValidUntil(
                          event.target.value
                            ? normalizeDateInput(event.target.value)
                            : null
                        )
                      }
                      min={formatDateInputValue(validFrom)}
                    />
                  </label>
                </div>
                <div className="mt-4 space-y-1 text-sm">
                  <span className="font-medium text-foreground">
                    Total limit (validity window)
                  </span>
                  <DesignInput
                    type="number"
                    min={0}
                    value={stockLimitValue}
                    onChange={(event) => setStockLimitValue(event.target.value)}
                    placeholder="Unlimited"
                  />
                  <span className="text-xs text-muted-foreground">
                    Maximum redemptions across this validity window. Leave blank
                    for unlimited.
                  </span>
                </div>
              </DesignFormField>
              <DesignFormField
                label="Redemption limits"
                helper="Configure caps per day, month, and total availability."
                className="md:col-span-2"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-foreground">
                      Daily limit
                    </span>
                    <DesignInput
                      type="number"
                      min={0}
                      value={dailyRedemptionLimit}
                      onChange={(event) =>
                        setDailyRedemptionLimit(event.target.value)
                      }
                      placeholder="Unlimited"
                    />
                    <span className="text-xs text-muted-foreground">
                      Maximum redemptions per calendar day. Leave blank for
                      unlimited.
                    </span>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-foreground">
                      Monthly limit
                    </span>
                    <DesignInput
                      type="number"
                      min={0}
                      value={monthlyRedemptionLimit}
                      onChange={(event) =>
                        setMonthlyRedemptionLimit(event.target.value)
                      }
                      placeholder="Unlimited"
                    />
                    <span className="text-xs text-muted-foreground">
                      Maximum redemptions per calendar month. Leave blank for
                      unlimited.
                    </span>
                  </label>
                </div>
              </DesignFormField>
              <DesignFormField
                label="Short description"
                helper="Highlight the experience members receive"
                className="md:col-span-2"
              >
                <DesignTextarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  placeholder="Highlight the experience members receive."
                />
              </DesignFormField>
            </div>
          </SectionCard>

          <SectionCard
            title="Audience & visibility"
            description="Configure who can see and redeem this reward"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    Partner visibility
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={filteredPartners.length === 0}
                      onClick={() => {
                        const partnerId = filteredPartners[0]?.partnerId;
                        if (partnerId) {
                          handlePartnerToggle(partnerId);
                        }
                      }}
                      className={cn(
                        "rounded-full border border-border px-3 py-1 text-xs",
                        filteredPartners.length === 0
                          ? "cursor-not-allowed text-muted-foreground/70"
                          : "text-muted-foreground hover:border-primary hover:text-foreground"
                      )}
                    >
                      Select first result
                    </button>
                    <button
                      type="button"
                    onClick={() => {
                      setSelectedPartners([]);
                      setPartnerConfigs(
                        new Map<string, RewardPartnerConfig>()
                      );
                    }}
                      className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-foreground"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <input
                  value={partnerSearch}
                  onChange={(event) => setPartnerSearch(event.target.value)}
                  placeholder="Search partners by ID or name"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                />
                <p className="text-xs text-muted-foreground">
                  Only one partner can be targeted per reward. Use Clear to
                  remove the current selection.
                </p>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-input bg-background">
                  {renderPartnerList()}
                </div>
                {selectedPartners.length > 0 ? (
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {selectedPartners.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handlePartnerToggle(id)}
                        className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1"
                      >
                        {id}
                        <span className="text-muted-foreground">×</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Visible to all partners by default.
                  </p>
                )}
              </div>

              {/* Partner-Specific Configuration */}
              {selectedPartners.length > 0 ? (
                <div className="mt-6 space-y-4 rounded-xl border border-border bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Partner-specific configuration
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        <strong>Optional:</strong> Each partner can have their
                        own reward form and partner-specific points costs. Forms
                        can be added later before the reward is made available.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {selectedPartners.map((partnerId) => {
                      const partnerOption = partnerOptions.find(
                        (p) => p.partnerId === partnerId
                      );
                      const config = partnerConfigs.get(partnerId) ?? {
                        formId: null,
                        tickets: [],
                      };
                      const rewardForms = forms.filter(
                        (f) => f.usageType === "reward"
                      );
                      const hasForm =
                        config.formId && config.formId.trim().length > 0;

                      return (
                        <div
                          key={partnerId}
                          className="rounded-lg border border-border bg-background p-4"
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {partnerOption?.partnerName ?? partnerId}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {partnerId}
                              </p>
                            </div>
                            {hasForm ? (
                              <span className="rounded-full border border-emerald-500/50 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                                Form assigned
                              </span>
                            ) : (
                              <span className="rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                                Form not set
                              </span>
                            )}
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="space-y-1 text-sm">
                              <span className="font-medium text-foreground">
                                Reward form
                              </span>
                              <select
                                value={config.formId ?? ""}
                                onChange={(event) => {
                                  const newConfigs = new Map(partnerConfigs);
                                  const currentConfig = newConfigs.get(
                                    partnerId
                                  ) ?? { formId: null, tickets: [] };
                                  newConfigs.set(partnerId, {
                                    ...currentConfig,
                                    formId: event.target.value || null,
                                  });
                                  setPartnerConfigs(newConfigs);
                                }}
                                className={`w-full rounded-lg border px-3 py-2 text-sm text-foreground focus:outline-none ${
                                  hasForm
                                    ? "border-input bg-background focus:border-primary"
                                    : "border-border bg-background focus:border-primary"
                                }`}
                              >
                                <option value="">
                                  Select a reward form (optional)
                                </option>
                                {rewardForms.map((form) => (
                                  <option key={form.id} value={form.id}>
                                    {form.name}
                                  </option>
                                ))}
                              </select>
                              <span className="text-xs text-muted-foreground">
                                Optional: Assign a reward form for this partner.
                                Reward forms can be added later before making
                                the reward available.
                              </span>
                            </label>
                            <TicketPointsEditor
                              Options={ticketTypeOptions}
                              globalTicketTypes={ticketTypeValues}
                              value={config.tickets}
                              onChange={(tickets) => {
                                const newConfigs = new Map(partnerConfigs);
                                const currentConfig = newConfigs.get(
                                  partnerId
                                ) ?? { formId: null, tickets: [] };
                                newConfigs.set(partnerId, {
                                  ...currentConfig,
                                  tickets,
                                });
                                setPartnerConfigs(newConfigs);
                              }}
                              basePoints={pointsCost}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <label className="space-y-1 text-sm">
                <span className="font-medium text-foreground">Tags</span>
                <MultiSelect
                  options={tagOptions}
                  value={tags}
                  onChange={setTags}
                  placeholder="No tag options available. Configure under Globals → Tags."
                />
                <span className="text-xs text-muted-foreground">
                  Manage available tags in Globals → Tags.
                </span>
              </label>
            </div>
          </SectionCard>

          <SectionCard
            title="Media & branding"
            description="Upload images and configure visual branding for this reward"
          >
            <div className="space-y-4">
              <ImageUploadField
                label="Primary image"
                description="Displayed on reward tiles and confirmation emails."
                value={imageUrl}
                onChange={setImageUrl}
                folder={`rewards/${reward?.id ?? "new-reward"}`}
              />
              <ImageUploadField
                label="Partner logo"
                description="Shown alongside the reward name to highlight the partner."
                value={partnerLogoUrl}
                onChange={setPartnerLogoUrl}
                folder={`rewards/${reward?.id ?? "new-reward"}/partner`}
              />
              <label className="space-y-1 text-sm">
                <span className="font-medium text-foreground">
                  Additional hero images (one URL per line)
                </span>
                <textarea
                  value={heroInput}
                  onChange={(event) => handleHeroChange(event.target.value)}
                  rows={3}
                  placeholder="https://…/image1.jpg\nhttps://…/image2.jpg"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground shadow-inner focus:border-primary focus:outline-none"
                />
                <span className="text-xs text-muted-foreground">
                  These rotate in the bonus experience hero carousel.
                </span>
              </label>
            </div>
          </SectionCard>

          {/* Ticket Points Pricing */}
          <SectionCard
            title="Redemption flow"
            description="Configure how users redeem this reward"
          >
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">
                  <strong>Important:</strong> Each partner must have their own
                  reward form assigned in the Partner-specific configuration
                  section above. There is no default form - all partners must be
                  explicitly configured.
                </p>
              </div>
              {formLoading ? (
                <p className="text-sm text-muted-foreground">
                  Loading form details…
                </p>
              ) : null}
              {formError ? (
                <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {formError}
                </p>
              ) : null}
              {redemptionFormId ? (
                <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                  {formPreview ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">
                          {formPreview.name}
                        </span>
                        <span className="rounded-full border border-border px-2 py-0.5 text-xs uppercase text-muted-foreground">
                          {formPreview.status}
                        </span>
                      </div>
                      <p>
                        Partner:{" "}
                        {formPreview.config.partner?.name ??
                          formPreview.partnerId ??
                          "—"}
                      </p>
                      <p>Steps: {formPreview.config.steps.length}</p>
                      <p>
                        QR expiry:{" "}
                        {formatExpiry(formPreview.config.qrExpiresInSeconds)}
                      </p>
                      <p className="text-xs">
                        {formPreview.config.summary?.note ??
                          "Open the Partner Forms section to edit fields."}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Select a form to preview configuration details.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard
            title="Instructions"
            description="Set redemption instructions for staff and members"
          >
            <label className="space-y-1 text-sm">
              <span className="font-medium text-foreground">
                Redemption instructions
              </span>
              <textarea
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                rows={4}
                placeholder="e.g. Present QR code at check-in desk. Valid Monday–Thursday only."
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground shadow-inner focus:border-primary focus:outline-none"
              />
            </label>
          </SectionCard>

          {isEdit ? (
            <SectionCard
              title="Recent redemptions"
              description="View redemption history and statistics for this reward"
            >
              {usageLoading ? (
                <p className="text-sm text-muted-foreground">
                  Loading redemption history…
                </p>
              ) : usageError ? (
                <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {usageError}
                </p>
              ) : usage.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No bonus redemptions recorded yet.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="min-w-full divide-y divide-border text-xs">
                    <thead className="bg-muted text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Code</th>
                        <th className="px-3 py-2 text-left">Member</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-left">Processed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-background text-foreground">
                      {usage.slice(0, 20).map((entry) => (
                        <tr key={entry.code}>
                          <td className="px-3 py-2 font-mono text-[11px]">
                            {entry.code}
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-medium">{entry.email}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {entry.processedBy?.name ||
                                entry.processedBy?.email ||
                                "—"}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                entry.status === "used"
                                  ? "bg-emerald-500/20 text-emerald-700"
                                  : entry.status === "rejected"
                                  ? "bg-destructive/20 text-destructive"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {entry.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {formatDateTime(
                              entry.processedAt || entry.redeemedAt || null
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {usage.length > 20 ? (
                    <p className="px-3 py-2 text-[11px] text-muted-foreground">
                      Showing 20 of {usage.length} records. Export analytics for
                      the full list.
                    </p>
                  ) : null}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Used: {usageTotals.used.toLocaleString()} · Rejected:{" "}
                {usageTotals.rejected.toLocaleString()}
              </p>
            </SectionCard>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-[color:var(--ds-border-subtle)]">
            <DesignButton
              type="button"
              variant="ghost"
              onClick={onBack}
              disabled={saving}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </DesignButton>
            <DesignButton type="submit" variant="primary" disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create reward"}
            </DesignButton>
          </div>
        </div>

        <aside className="space-y-6">
          <SectionCard
            title={preview.name || "Reward name"}
            description={
              preview.description || "Reward description will appear here."
            }
          >
            <div className="overflow-hidden rounded-2xl border border-border bg-muted/40">
              {preview.heroImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.heroImage}
                  alt=""
                  className="h-48 w-full object-cover"
                />
              ) : (
                <div className="flex h-48 items-center justify-center bg-muted">
                  <ImageIcon className="h-10 w-10 text-muted-foreground" />
                </div>
              )}
              <div className="space-y-4 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="rounded-full bg-primary/15 px-3 py-1 text-primary">
                    {pointsCost > 0
                      ? `${preview.pointsCost.toLocaleString()} pts`
                      : "Set ticket points"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {preview.category ? (
                    <span className="rounded-full border border-border px-3 py-1">
                      {preview.category}
                    </span>
                  ) : null}
                  {preview.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-border px-3 py-1 capitalize"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  className="w-full rounded-2xl bg-amber-400 py-3 text-sm font-semibold text-amber-950 shadow hover:bg-amber-300"
                >
                  Redeem reward
                </button>
              </div>
            </div>
            <p className="mt-4 text-xs text-[color:var(--ds-text-muted)]">
              Preview mirrors the bonus portal card using the selected images
              and metadata. Hero images look best at 1200×675px with the focus
              near the center.
            </p>
          </SectionCard>
        </aside>
      </form>
    </div>
  );
}

function TicketPointsEditor({
  Options,
  globalTicketTypes,
  value,
  onChange,
  basePoints,
}: {
  Options: Array<{ value: string; label: string; isActive?: boolean }>;
  globalTicketTypes: Array<{
    key: string;
    label: string;
    metadata?: Record<string, unknown>;
  }>;
  value: RewardPartnerTicket[];
  onChange: (tickets: RewardPartnerTicket[]) => void;
  basePoints: number;
}) {
  const usedKeys = new Set(value.map((t) => t.key));
  const availableOptions = Options.filter((opt) => !usedKeys.has(opt.value));

  const addTicket = () => {
    const nextOption = availableOptions[0];
    if (!nextOption) return;
    onChange([
      ...value,
      {
        key: nextOption.value,
        label: nextOption.label,
        points: basePoints,
      },
    ]);
  };

  const updateTicket = (idx: number, partial: Partial<RewardPartnerTicket>) => {
    const next = value.map((t, i) => (i === idx ? { ...t, ...partial } : t));
    onChange(next);
  };

  const removeTicket = (idx: number) => {
    const next = value.filter((_, i) => i !== idx);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm font-medium text-foreground">
        <span>Ticket types & points</span>
        <DesignButton
          type="button"
          size="sm"
          variant="secondary"
          onClick={addTicket}
          disabled={availableOptions.length === 0}
        >
          Add ticket
        </DesignButton>
      </div>
      {value.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Add ticket types from Globals to set partner-specific points.
          {basePoints > 0
            ? ` New entries default to ${basePoints} pts.`
            : " Set the points value for each ticket you add."}
        </p>
      ) : (
        <div className="space-y-2">
          {value.map((ticket, idx) => {
            // Find global ticket type to check for sub-options
            const globalTicketType = globalTicketTypes.find(
              (t) => t.key === ticket.key
            );
            const metadataSubOptions = globalTicketType?.metadata?.subOptions;
            const hasSubOptions =
              globalTicketType &&
              Array.isArray(metadataSubOptions) &&
              metadataSubOptions.length > 0;
            const subOptions =
              hasSubOptions && metadataSubOptions
                ? (metadataSubOptions as string[]).map((subKey) => {
                    const subType = globalTicketTypes.find(
                      (t) => t.key === subKey
                    );
                    return {
                      key: subKey,
                      label: subType?.label ?? subKey,
                    };
                  })
                : [];
            const showSubOptionFields = hasSubOptions && subOptions.length > 0;

            return (
              <div
                key={`${ticket.key}-${idx}`}
                className="flex flex-col gap-3 rounded-lg border border-input bg-background p-3"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Ticket type
                    </label>
                    <select
                      value={ticket.key}
                      onChange={(event) => {
                        const selectedKey = event.target.value;
                        const selectedOption = Options.find(
                          (opt) => opt.value === selectedKey
                        );
                        updateTicket(idx, {
                          key: selectedKey,
                          label: selectedOption?.label ?? selectedKey,
                          inclusions: undefined, // Reset inclusions when ticket type changes
                        });
                      }}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    >
                      {[
                        {
                          value: ticket.key,
                          label:
                            Options.find((opt) => opt.value === ticket.key)
                              ?.label ??
                            ticket.label ??
                            ticket.key,
                        },
                        ...availableOptions,
                      ]
                        .filter(
                          (opt, idx2, arr) =>
                            opt.value &&
                            arr.findIndex((o) => o.value === opt.value) === idx2
                        )
                        .map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="flex items-end gap-2 sm:w-48">
                    <div className="flex-1 space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Points
                      </label>
                      <DesignInput
                        type="number"
                        min={1}
                        value={ticket.points}
                        onChange={(event) =>
                          updateTicket(idx, {
                            points: Number(event.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <DesignButton
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTicket(idx)}
                      className="self-center text-destructive"
                    >
                      <X className="h-4 w-4" />
                      <span className="sr-only">Remove</span>
                    </DesignButton>
                  </div>
                </div>
                {/* Inclusions: Show sub-options if Family, otherwise show ticket type name */}
                {showSubOptionFields ? (
                  <div className="grid gap-2 rounded-lg border border-input/50 bg-muted/30 p-2 sm:grid-cols-2">
                    {subOptions.map((subOption) => {
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
                        <div key={subOption.key} className="space-y-1">
                          <label className="text-xs font-semibold text-muted-foreground">
                            {subOption.label} included
                          </label>
                          <DesignInput
                            type="number"
                            min={0}
                            step={1}
                            value={ticket.inclusions?.[fieldName] ?? ""}
                            onChange={(event) => {
                              const numValue =
                                event.target.value === ""
                                  ? null
                                  : Number(event.target.value) || 0;
                              updateTicket(idx, {
                                inclusions: {
                                  ...ticket.inclusions,
                                  [fieldName]: numValue,
                                },
                              });
                            }}
                            placeholder="0"
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">
                      {ticket.label ?? ticket.key} included
                    </label>
                    <DesignInput
                      type="number"
                      min={0}
                      step={1}
                      value={ticket.inclusions?.adults ?? ""}
                      onChange={(event) => {
                        const numValue =
                          event.target.value === ""
                            ? null
                            : Number(event.target.value) || 0;
                        updateTicket(idx, {
                          inclusions: {
                            ...ticket.inclusions,
                            adults: numValue,
                          },
                        });
                      }}
                      placeholder="Number included"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
