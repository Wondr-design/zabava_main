"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Check,
  ShieldCheck,
  Minus,
  Plus,
} from "lucide-react";

import type {
  PartnerFormConfig,
  PartnerFormField,
  PartnerFormRecord,
  PartnerFormPricingBundle,
  PartnerFormPricingAddon,
} from "@/lib/data/partner-forms";
import type {
  PartnerTicketDetail,
  PartnerTicketAddon,
} from "@/lib/data/partners";
import {
  computePartnerFormMetrics,
  estimatePointsFromMetrics,
} from "@/lib/services/partner-form-metrics";
import { EmailVerification } from "@/site/components/email-verification";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { QrPreviewCard } from "@/site/components/qr-preview-card";

interface PartnerFormRunnerProps {
  partnerId: string;
  partnerName: string;
  form: PartnerFormRecord;
  categories: string[];
  ticketCatalog?: PartnerTicketDetail[];
  ticketAddons?: PartnerTicketAddon[];
}

interface BookingResult {
  visitId: string;
  verifyUrl: string | null;
  qrCodeUrl: string | null;
  qrCodeExpiresAt: string | null;
}

type FieldErrors = Record<string, string>;

interface TicketCatalogItem {
  id: string;
  label: string;
  description: string;
  price: number | null;
  ticketType: string | null;
  inclusions?: {
    adults?: number | null;
    children?: number | null;
    teens?: number | null;
  };
  limits?: {
    adults?: number | null;
    children?: number | null;
    teens?: number | null;
    total?: number | null;
  };
}

type TicketCatalogBundle = TicketCatalogItem & { kind: "bundle" };
type TicketCatalogAddon = TicketCatalogItem & { kind: "addon" };

interface TicketSelectionEntry extends TicketCatalogItem {
  quantity: number;
  subtotal: number;
}

function roundCurrencyValue(value: number) {
  return Math.round(value * 100) / 100;
}

function initializeValues(form: PartnerFormRecord) {
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
          const defaultValue =
            typeof field.defaultValue === "number"
              ? field.defaultValue
              : typeof field.min === "number"
              ? field.min
              : 1;
          initial[key] = defaultValue;
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

export function PartnerFormRunner({
  partnerId,
  partnerName,
  form,
  categories,
  ticketCatalog = [],
  ticketAddons = [],
}: PartnerFormRunnerProps) {
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
  const bookingCap = useMemo(() => {
    const cap =
      (pricingStep?.pricing as any)?.maxGuestsPerBooking ??
      (form.config.pricing as any)?.maxGuestsPerBooking ??
      null;
    return typeof cap === "number" && cap > 0 ? cap : null;
  }, [pricingStep?.pricing, form.config.pricing]);
  const [currentStep, setCurrentStep] = useState(0);
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    initializeValues(form)
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BookingResult | null>(null);
  const currencyLabel =
    pricingStep?.pricing?.currency ??
    form.config.pricing?.currency ??
    "CZK";
  const { bundleCatalog, addonCatalog } = useMemo<{
    bundleCatalog: TicketCatalogBundle[];
    addonCatalog: TicketCatalogAddon[];
  }>(() => {
    const toNumberOrNull = (value: unknown): number | null =>
      typeof value === "number" ? value : null;

    const bundlesSource: Array<
      PartnerFormPricingBundle | PartnerTicketDetail
    > =
      pricingStep?.pricing?.bundles?.length
        ? pricingStep.pricing.bundles
        : ticketCatalog ?? [];
    const addonsSource: Array<
      PartnerFormPricingAddon | PartnerTicketAddon
    > =
      pricingStep?.pricing?.addons?.length
        ? pricingStep.pricing.addons
        : ticketAddons ?? [];

    const normalizeBundle = (
      item: PartnerFormPricingBundle | PartnerTicketDetail,
      index: number
    ): TicketCatalogBundle | null => {
      const baseId =
        (item as PartnerFormPricingBundle).id ??
        (item as PartnerTicketDetail).id ??
        (item as PartnerTicketDetail).ticketType ??
        (item as PartnerTicketDetail).label ??
        `bundle-${index}`;
      const id = String(baseId).trim();
      if (!id) return null;
      const label =
        (item as PartnerFormPricingBundle).label?.trim() ??
        (item as PartnerTicketDetail).label?.trim() ??
        (item as PartnerFormPricingBundle).ticketType ??
        (item as PartnerTicketDetail).ticketType ??
        `Ticket ${index + 1}`;
      const description =
        (item as PartnerFormPricingBundle).description?.trim() ??
        (item as PartnerTicketDetail).description?.trim() ??
        "";
      let discounted: number | null = null;
      const bundleDiscount = (item as PartnerFormPricingBundle)
        .discountedPrice;
      if (typeof bundleDiscount === "number") {
        discounted = bundleDiscount;
      } else {
        const detailDiscount = (item as PartnerTicketDetail).discountedPrice;
        if (typeof detailDiscount === "number") {
          discounted = detailDiscount;
        }
      }
      const fallbackPrice =
        toNumberOrNull((item as PartnerFormPricingBundle).price) ??
        toNumberOrNull((item as PartnerTicketDetail).price);
      const price: number | null = discounted !== null ? discounted : fallbackPrice;
      const ticketType =
        (item as PartnerFormPricingBundle).ticketType ??
        (item as PartnerTicketDetail).ticketType ??
        null;

      return {
        id,
        label,
        description,
        price,
        ticketType,
        kind: "bundle" as const,
        inclusions:
          (item as PartnerFormPricingBundle).inclusions ??
          (item as PartnerTicketDetail).inclusions ??
          undefined,
        limits:
          (item as PartnerFormPricingBundle).limits ??
          (item as PartnerTicketDetail).limits ??
          undefined,
      };
    };

    const normalizeAddon = (
      item: PartnerFormPricingAddon | PartnerTicketAddon,
      index: number
    ): TicketCatalogAddon | null => {
      const baseId =
        (item as PartnerFormPricingAddon).id ??
        (item as PartnerTicketAddon).id ??
        (item as PartnerFormPricingAddon).label ??
        (item as PartnerTicketAddon).label ??
        `addon-${index}`;
      const id = String(baseId).trim();
      if (!id) return null;
      const label =
        (item as PartnerFormPricingAddon).label?.trim() ??
        (item as PartnerTicketAddon).label?.trim() ??
        `Add-on ${index + 1}`;
      const description =
        (item as PartnerFormPricingAddon).description?.trim() ??
        (item as PartnerTicketAddon).description?.trim() ??
        "";
      let discountedAddon: number | null = null;
      const addonDiscount = (item as PartnerFormPricingAddon).discountedPrice;
      if (typeof addonDiscount === "number") {
        discountedAddon = addonDiscount;
      } else {
        const legacyAddonDiscount = (item as PartnerTicketAddon)
          .discountedPrice;
        if (typeof legacyAddonDiscount === "number") {
          discountedAddon = legacyAddonDiscount;
        }
      }
      const fallbackAddonPrice =
        toNumberOrNull((item as PartnerFormPricingAddon).price) ??
        toNumberOrNull((item as PartnerTicketAddon).price);
      const price: number | null =
        discountedAddon !== null ? discountedAddon : fallbackAddonPrice;
      const ticketType =
        (item as PartnerFormPricingAddon).appliesToTicketType ??
        (item as PartnerTicketAddon).appliesToTicketType ??
        null;

      return {
        id,
        label,
        description,
        price,
        ticketType,
        kind: "addon" as const,
      };
    };

    const bundles =
      bundlesSource
        ?.map((item, index) => normalizeBundle(item, index))
        .filter((entry): entry is TicketCatalogBundle => Boolean(entry)) ?? [];
    const addons =
      addonsSource
        ?.map((item, index) => normalizeAddon(item, index))
        .filter((entry): entry is TicketCatalogAddon => Boolean(entry)) ?? [];

    return { bundleCatalog: bundles, addonCatalog: addons };
  }, [pricingStep, ticketCatalog, ticketAddons]);

  const catalogSignature = useMemo(() => {
    const bundleKey = bundleCatalog.map((item) => `b:${item.id}`).join("|");
    const addonKey = addonCatalog.map((item) => `a:${item.id}`).join("|");
    return `${bundleKey}::${addonKey}`;
  }, [bundleCatalog, addonCatalog]);
  const [ticketQuantities, setTicketQuantities] = useState<Record<string, number>>({});
  const [addonQuantities, setAddonQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    setTicketQuantities({});
    setAddonQuantities({});
  }, [catalogSignature]);

  const adjustTicketQuantity = useCallback(
    (id: string, delta: number) => {
      setTicketQuantities((prev) => {
        const next = { ...prev };
        const current = next[id] ?? 0;
        const bundle = bundleCatalog.find((b) => b.id === id);
        const computeMax = () => {
          if (!bundle?.limits) return Number.POSITIVE_INFINITY;
          let cap = Number.POSITIVE_INFINITY;
          const { limits, inclusions } = bundle;
          const applyCap = (limitValue?: number | null, perUnit?: number | null) => {
            if (
              limitValue === null ||
              limitValue === undefined ||
              Number.isNaN(limitValue)
            ) {
              return;
            }
            const unit = perUnit && perUnit > 0 ? perUnit : 1;
            const qtyCap = Math.floor(limitValue / unit);
            cap = Math.min(cap, qtyCap);
          };
          if (typeof limits.total === "number") {
            cap = Math.min(cap, limits.total);
          }
          applyCap(limits.adults ?? null, inclusions?.adults ?? null);
          applyCap(limits.children ?? null, inclusions?.children ?? null);
          applyCap(limits.teens ?? null, inclusions?.teens ?? null);
          return cap;
        };
        const maxAllowed = computeMax();
        const proposed = current + delta;
        const clamped =
          maxAllowed === Number.POSITIVE_INFINITY
            ? Math.max(0, proposed)
            : Math.max(0, Math.min(proposed, maxAllowed));
        let finalQuantity = clamped;
        if (bookingCap !== null) {
          const otherTotal = Object.entries(prev).reduce(
            (sum, [key, qty]) => (key === id ? sum : sum + qty),
            0
          );
          const available = Math.max(bookingCap - otherTotal, 0);
          finalQuantity = Math.min(finalQuantity, available);
          if (finalQuantity < clamped) {
            setError(`Total tickets limited to ${bookingCap} per booking.`);
          }
        }
        if (clamped < proposed && bookingCap === null) {
          setError(
            `This ticket is limited to ${
              maxAllowed === 0 ? "0" : maxAllowed
            } per booking.`
          );
        }
        if (finalQuantity === 0) {
          delete next[id];
        } else {
          next[id] = finalQuantity;
        }
        return next;
      });
    },
    [bundleCatalog, bookingCap]
  );

  const adjustAddonQuantity = useCallback((id: string, delta: number) => {
    setAddonQuantities((prev) => {
      const next = { ...prev };
      const current = next[id] ?? 0;
      const updated = Math.max(0, current + delta);
      if (updated === 0) {
        delete next[id];
      } else {
        next[id] = updated;
      }
      return next;
    });
  }, []);

  const bundleSelections = useMemo<TicketSelectionEntry[]>(() => {
    const selections: TicketSelectionEntry[] = [];
    bundleCatalog.forEach((ticket) => {
      const quantity = ticketQuantities[ticket.id] ?? 0;
      if (ticket.price === null || quantity <= 0) {
        return;
      }
      const subtotal = roundCurrencyValue(ticket.price * quantity);
      selections.push({
        ...ticket,
        quantity,
        subtotal,
      });
    });
    return selections;
  }, [bundleCatalog, ticketQuantities]);

  const activeTicketTypeKeys = useMemo(() => {
    return bundleSelections
      .map((selection) => selection.ticketType)
      .filter((value): value is string => Boolean(value));
  }, [bundleSelections]);

  const visibleAddons = useMemo(() => {
    if (addonCatalog.length === 0) return [];
    if (activeTicketTypeKeys.length === 0) {
      return addonCatalog.filter((addon) => !addon.ticketType);
    }
    const activeSet = new Set(activeTicketTypeKeys);
    return addonCatalog.filter(
      (addon) => !addon.ticketType || activeSet.has(addon.ticketType)
    );
  }, [activeTicketTypeKeys, addonCatalog]);

  const addonSelections = useMemo<TicketSelectionEntry[]>(() => {
    const selections: TicketSelectionEntry[] = [];
    visibleAddons.forEach((addon) => {
      const quantity = addonQuantities[addon.id] ?? 0;
      if (addon.price === null || quantity <= 0) {
        return;
      }
      const subtotal = roundCurrencyValue(addon.price * quantity);
      selections.push({
        ...addon,
        quantity,
        subtotal,
      });
    });
    return selections;
  }, [visibleAddons, addonQuantities]);

  const renderPricingStepContent = () => {
    if (bundleCatalog.length === 0 && visibleAddons.length === 0) {
      return (
        <p className="text-sm text-indigo-200/80">
          Pricing for this partner hasn{"\u2019"}t been configured yet.
        </p>
      );
    }
    return (
      <div className="space-y-6">
        {bundleCatalog.length > 0 ? (
          <div className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/50 p-6">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-white">
                Ticket bundles
              </h3>
              <p className="text-sm text-indigo-200/80">
                Choose the bundle combinations that match your group. You can
                mix and match as needed.
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
                      <div className="text-base font-semibold text-white">
                        {bundle.label}
                      </div>
                      {bundle.description ? (
                        <p className="text-sm text-indigo-200/80">
                          {bundle.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      {bundle.price !== null ? (
                        <>
                          <div className="text-sm text-indigo-200/80">
                            {bundle.price.toLocaleString()} {currencyLabel}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() =>
                                adjustTicketQuantity(bundle.id, -1)
                              }
                              disabled={quantity === 0}
                              className="h-8 w-8 border-white/20 text-white"
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-10 text-center text-base font-semibold">
                              {quantity}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() =>
                                adjustTicketQuantity(bundle.id, 1)
                              }
                              className="h-8 w-8 border-white/20 text-white"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-indigo-200/70">
                          Contact partner for pricing to enable this bundle.
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between border-t border-white/5 pt-4 text-sm">
              <span className="text-indigo-200/80">Bundle total</span>
              <span className="text-lg font-semibold text-white">
                {bundleSelectionsTotal !== null
                  ? `${bundleSelectionsTotal.toLocaleString()} ${currencyLabel}`
                  : `0 ${currencyLabel}`}
              </span>
            </div>
          </div>
        ) : null}

        {visibleAddons.length > 0 ? (
          <div className="space-y-4 rounded-3xl border border-dashed border-white/10 bg-slate-950/40 p-6">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-white">Add-ons</h3>
              <p className="text-sm text-indigo-200/80">
                Optional extras that apply to your selected bundles. Add more
                guests or upgrades as needed.
              </p>
            </div>
            <div className="space-y-3">
              {visibleAddons.map((addon) => {
                const quantity = addonQuantities[addon.id] ?? 0;
                return (
                  <div
                    key={addon.id}
                    className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-base font-semibold text-white">
                          {addon.label}
                        </div>
                        <span className="rounded-full border border-white/20 px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.3em] text-indigo-200">
                          Add-on
                        </span>
                      </div>
                      {addon.description ? (
                        <p className="text-sm text-indigo-200/80">
                          {addon.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      {addon.price !== null ? (
                        <>
                          <div className="text-sm text-indigo-200/80">
                            {addon.price.toLocaleString()} {currencyLabel}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => adjustAddonQuantity(addon.id, -1)}
                              disabled={quantity === 0}
                              className="h-8 w-8 border-white/20 text-white"
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-10 text-center text-base font-semibold">
                              {quantity}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => adjustAddonQuantity(addon.id, 1)}
                              className="h-8 w-8 border-white/20 text-white"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-indigo-200/70">
                          Contact partner for pricing to enable this add-on.
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between border-t border-white/5 pt-4 text-sm">
              <span className="text-indigo-200/80">Add-on total</span>
              <span className="text-lg font-semibold text-white">
                {addonSelectionsTotal !== null
                  ? `${addonSelectionsTotal.toLocaleString()} ${currencyLabel}`
                  : `0 ${currencyLabel}`}
              </span>
            </div>
          </div>
        ) : null}
        {(bundleSelections.length > 0 || addonSelections.length > 0) && (
          <div className="space-y-2 rounded-3xl border border-white/10 bg-slate-950/60 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.25em] text-indigo-200/70">
                Selected tickets
              </span>
              <span className="text-sm font-semibold text-white">
                {bundleSelectionsTotal !== null
                  ? `${bundleSelectionsTotal.toLocaleString()} ${currencyLabel}`
                  : `0 ${currencyLabel}`}
              </span>
            </div>
            <div className="space-y-2">
              {bundleSelections.map((selection) => (
                <div
                  key={`selected-${selection.id}`}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-950/70 px-3 py-2"
                >
                  <span className="text-white">
                    {selection.label} × {selection.quantity}
                  </span>
                  <span className="text-indigo-200/80">
                    {selection.subtotal.toLocaleString()} {currencyLabel}
                  </span>
                </div>
              ))}
              {addonSelections.map((selection) => (
                <div
                  key={`selected-addon-${selection.id}`}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-950/70 px-3 py-2"
                >
                  <span className="text-white">
                    {selection.label} × {selection.quantity}
                  </span>
                  <span className="text-indigo-200/80">
                    {selection.subtotal.toLocaleString()} {currencyLabel}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-white/5 pt-3">
              <span className="text-indigo-200/80">Current total</span>
              <span className="text-lg font-semibold text-white">
                {combinedTotal !== null
                  ? `${combinedTotal.toLocaleString()} ${currencyLabel}`
                  : `0 ${currencyLabel}`}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const bundleSelectionsTotal = useMemo(() => {
    if (bundleSelections.length === 0) return null;
    const total = bundleSelections.reduce(
      (sum, entry) => sum + entry.subtotal,
      0
    );
    return roundCurrencyValue(total);
  }, [bundleSelections]);

  const addonSelectionsTotal = useMemo(() => {
    if (addonSelections.length === 0) return null;
    const total = addonSelections.reduce(
      (sum, entry) => sum + entry.subtotal,
      0
    );
    return roundCurrencyValue(total);
  }, [addonSelections]);

  const ticketSelectionsTotal = useMemo(() => {
    if (bundleSelectionsTotal === null && addonSelectionsTotal === null) {
      return null;
    }
    return roundCurrencyValue(
      (bundleSelectionsTotal ?? 0) + (addonSelectionsTotal ?? 0)
    );
  }, [addonSelectionsTotal, bundleSelectionsTotal]);

  useEffect(() => {
    setValues(initializeValues(form));
    setErrors({});
    setCurrentStep(0);
    setResult(null);
  }, [form]);

  const fieldDefinitions = useMemo(() => {
    const map = new Map<string, PartnerFormField>();
    form.config.steps.forEach((step) => {
      step.fields.forEach((field) => {
        map.set(field.id, field);
      });
    });
    return map;
  }, [form]);

  const emailFieldId = useMemo(() => {
    for (const field of fieldDefinitions.values()) {
      if (field.kind === "input" && field.type === "email") {
        return field.id;
      }
    }
    return undefined;
  }, [fieldDefinitions]);

  useEffect(() => {
    if (verifiedEmail && emailFieldId) {
      setValues((prev) => ({ ...prev, [emailFieldId]: verifiedEmail }));
    }
  }, [verifiedEmail, emailFieldId]);

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
        | PartnerFormConfig["steps"][number]["logic"]
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
    const labels: Record<string, string> = {};
    fieldDefinitions.forEach((field, id) => {
      labels[id] = field.label;
    });
    return labels;
  }, [fieldDefinitions]);

  const metrics = useMemo(
    () => computePartnerFormMetrics(form.config, values),
    [form, values]
  );
  const estimatedPoints = useMemo(
    () => estimatePointsFromMetrics(metrics),
    [metrics]
  );
  const baseFormTotal = metrics.totalPrice;
  const combinedTotal = useMemo(() => {
    if (ticketSelectionsTotal === null && baseFormTotal === null) {
      return null;
    }
    return roundCurrencyValue(
      (ticketSelectionsTotal ?? 0) + (baseFormTotal ?? 0)
    );
  }, [ticketSelectionsTotal, baseFormTotal]);

  const summaryFields = useMemo(
    () =>
      visibleStepIndexes
        .map((index) => steps[index])
        .flatMap((step) =>
          step.fields.filter((field) => evaluateLogic(field.logic))
        ),
    [steps, visibleStepIndexes, evaluateLogic]
  );

  useEffect(() => {
    const reviewStepIndex = steps.length;
    if (visibleStepIndexes.length === 0) {
      if (currentStep !== reviewStepIndex) {
        setCurrentStep(reviewStepIndex);
      }
      return;
    }
    if (currentStep === reviewStepIndex) {
      return;
    }
    if (!visibleStepIndexes.includes(currentStep)) {
      setCurrentStep(visibleStepIndexes[0]);
    }
  }, [visibleStepIndexes, currentStep, steps.length]);

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
    const value = values[field.id];
    if (field.required) {
      if (field.kind === "checkbox") {
        if (!value) return "Please confirm this field.";
      } else if (field.kind === "counter") {
        const numeric = Number(value ?? 0);
        if (!Number.isFinite(numeric)) return "Enter a valid number.";
        if (field.min !== undefined && numeric < field.min) {
          return `Minimum value is ${field.min}.`;
        }
        if (field.max !== undefined && numeric > field.max) {
          return `Maximum value is ${field.max}.`;
        }
      } else if (fieldIsEmpty(value)) {
        return "This field is required.";
      }
    }

    if (field.kind === "input" && value) {
      if (field.type === "email") {
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(String(value))) {
          return "Enter a valid email address.";
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

    if (!verifiedEmail) {
      setError("Verify your email before generating the QR code.");
      return;
    }

    setSubmitting(true);
    setResult(null);

    const submissionValues: Record<string, unknown> = {
      ...values,
      ...(emailFieldId ? { [emailFieldId]: verifiedEmail } : {}),
    };

    const ticketSelectionPayload =
      bundleSelections.length > 0
        ? bundleSelections.map((selection) => ({
            id: selection.id,
            ticketType: selection.ticketType,
            label: selection.label,
            quantity: selection.quantity,
            unitPrice: selection.price,
            subtotal: selection.subtotal,
          }))
        : undefined;

    const addonSelectionPayload =
      addonSelections.length > 0
        ? addonSelections.map((selection) => ({
            id: selection.id,
            appliesToTicketType: selection.ticketType,
            label: selection.label,
            quantity: selection.quantity,
            unitPrice: selection.price,
            subtotal: selection.subtotal,
          }))
        : undefined;

    const submissionMetadata = {
      category: categories.join(","),
      submittedFrom: "public-site",
      partnerName,
      formName: form.name,
      formSlug: form.slug,
      ...(ticketSelectionPayload
        ? {
            ticketSelections: ticketSelectionPayload,
            ticketSelectionsTotal: ticketSelectionsTotal ?? undefined,
          }
        : {}),
      ...(addonSelectionPayload
        ? {
            ticketAddons: addonSelectionPayload,
            ticketAddonsTotal: addonSelectionsTotal ?? undefined,
          }
        : {}),
    };

    try {
      const response = await fetch("/api/public/visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: verifiedEmail,
          partnerId,
          formId: form.id,
          form: {
            values: submissionValues,
            hidden: hiddenValues,
            labels: fieldLabels,
          },
          metadata: submissionMetadata,
          totalPrice: combinedTotal ?? undefined,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        throw new Error(
          payload.message ?? payload.error ?? "Unable to register visit."
        );
      }

      const payload = (await response.json()) as BookingResult & {
        success: boolean;
      };
      setResult({
        visitId: payload.visitId,
        verifyUrl: payload.verifyUrl,
        qrCodeUrl: payload.qrCodeUrl,
        qrCodeExpiresAt: payload.qrCodeExpiresAt,
      });
      setCurrentStep(steps.length);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to submit the form."
      );
    } finally {
      setSubmitting(false);
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
                    {option.price !== undefined ? (
                      <div className="pt-1 text-xs text-indigo-200/70">
                        {option.price.toLocaleString()} {currencyLabel}
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

  function renderSummary() {
    return (
      <div className="space-y-4 text-white">
        <h2 className="text-xl font-semibold">
          {form.config.summary?.title ?? "Review your selection"}
        </h2>
        <p className="text-sm text-indigo-200/80">
          {form.config.summary?.note ??
            "We’ll generate the QR and send it to your verified email."}
        </p>
        <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          {summaryFields.map((field) => (
            <div
              key={`summary-${field.id}`}
              className="flex flex-col gap-1 rounded-xl border border-white/5 bg-slate-950/60 px-3 py-2"
            >
              <span className="text-xs uppercase tracking-[0.25em] text-indigo-200/70">
                {field.label}
              </span>
              <span className="text-sm text-white">
                {formatFieldValue(field, values[field.id]) || "—"}
              </span>
            </div>
          ))}
        </div>

        {bundleSelections.length > 0 ? (
          <div className="space-y-2 rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm">
            <span className="text-xs uppercase tracking-[0.25em] text-indigo-200/70">
              Ticket selections
            </span>
            {bundleSelections.map((selection) => (
              <div
                key={`selection-${selection.id}`}
                className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-950/40 px-3 py-2"
              >
                <div className="text-sm">
                  <span className="font-medium">{selection.label}</span>
                  <span className="ml-2 text-xs text-indigo-200/70">
                    × {selection.quantity}
                  </span>
                </div>
                <span className="text-sm text-white">
                  {selection.subtotal.toLocaleString()} {currencyLabel}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {addonSelections.length > 0 ? (
          <div className="space-y-2 rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm">
            <span className="text-xs uppercase tracking-[0.25em] text-indigo-200/70">
              Add-ons
            </span>
            {addonSelections.map((selection) => (
              <div
                key={`addon-${selection.id}`}
                className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-950/40 px-3 py-2"
              >
                <div className="text-sm">
                  <span className="font-medium">{selection.label}</span>
                  <span className="ml-2 text-xs text-indigo-200/70">
                    × {selection.quantity}
                  </span>
                </div>
                <span className="text-sm text-white">
                  {selection.subtotal.toLocaleString()} {currencyLabel}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="space-y-2 rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-indigo-200/80">
              {form.config.summary?.totalLabel ?? "Total price"}
            </span>
            <span className="font-semibold text-white">
              {combinedTotal !== null
                ? `${combinedTotal.toLocaleString()} ${currencyLabel}`
                : "—"}
            </span>
          </div>
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

  if (result) {
    return (
      <div className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-8 text-white shadow-2xl shadow-black/30">
        <div className="flex items-center gap-3 text-sm uppercase tracking-[0.25em] text-indigo-200/70">
          <ShieldCheck className="h-5 w-5" />
          Confirmed!
        </div>
        <div className="space-y-3">
          <h2 className="text-3xl font-semibold">
            Your visit to {partnerName} is confirmed
          </h2>
          <p className="text-sm text-indigo-200/80">
            We’ve sent the QR pass to {verifiedEmail}. Keep it handy for
            check-in — you can also download it below.
          </p>
        </div>
        <QrPreviewCard
          heading="Your QR pass is ready"
          description={`We’ve also emailed the QR to ${verifiedEmail}. Present it when you arrive or download a copy.`}
          qrCodeUrl={result.qrCodeUrl}
          qrCodeExpiresAt={result.qrCodeExpiresAt}
          downloadLabel="Download QR"
        />
      </div>
    );
  }

  const reviewStepIndex = steps.length;
  const isReviewStep = currentStep === reviewStepIndex;
  const currentStepData = !isReviewStep ? steps[currentStep] ?? null : null;
  const currentVisiblePositionRaw = visibleStepIndexes.indexOf(currentStep);
  const currentVisiblePosition =
    currentVisiblePositionRaw === -1 ? 0 : currentVisiblePositionRaw;
  const totalVisibleSteps = visibleStepIndexes.length;
  const progressLabel = isReviewStep
    ? form.config.summary?.navLabel ?? "Review"
    : currentStepData?.title ?? "Step";
  const showProgressCounter =
    !isReviewStep && totalVisibleSteps > 0 && currentStepData !== null;
  const nextButtonLabel =
    currentStepData?.nextLabel ??
    (currentVisiblePosition === totalVisibleSteps - 1
      ? form.config.summary?.navLabel ?? "Review"
      : "Next");
  const backButtonLabel =
    currentStepData?.previousLabel ?? form.config.summary?.editLabel ?? "Back";

  return (
    <div className="space-y-10 rounded-3xl border border-white/10 bg-white/5 p-8 text-white shadow-2xl shadow-black/30">
      <div className="space-y-3">
        <h2 className="text-2xl font-semibold">Reserve your visit</h2>
        <p className="text-sm text-indigo-200/80">
          Confirm your email, walk through the steps, and we’ll generate your QR
          pass instantly.
        </p>
      </div>

      <EmailVerification
        type="visit"
        partnerId={partnerId}
        onVerified={(value) => setVerifiedEmail(value)}
        className="bg-white/10"
      />

      <div className="space-y-6">
        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-6">
          {isReviewStep ? (
            renderSummary()
          ) : currentStepData ? (
            <div className="space-y-5">
              <div className="space-y-1">
                {showProgressCounter ? (
                  <div className="text-xs uppercase tracking-[0.3em] text-indigo-200/70">
                    Step {currentVisiblePosition + 1} of {totalVisibleSteps}
                  </div>
                ) : null}
                <h3 className="text-xl font-semibold">
                  {currentStepData.title}
                </h3>
                {currentStepData.description ? (
                  <p className="text-sm text-indigo-200/80">
                    {currentStepData.description}
                  </p>
                ) : null}
              </div>
              {currentStepData.variant === "pricing" ? (
                renderPricingStepContent()
              ) : (
                <div className="space-y-4">
                  {currentStepData.fields
                    .filter((field) => evaluateLogic(field.logic))
                    .map((field) => renderField(field))}
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs uppercase tracking-[0.3em] text-indigo-200/60">
            {progressLabel}
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={
                submitting ||
                (visibleStepIndexes.length === 0
                  ? isReviewStep
                  : !isReviewStep &&
                    visibleStepIndexes[0] === currentStep &&
                    currentVisiblePosition === 0)
              }
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              {backButtonLabel}
            </Button>
            {isReviewStep ? (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                {form.config.summary?.confirmLabel ?? "Confirm & Generate QR"}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-2"
              >
                {nextButtonLabel}
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {error ? (
        <p className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}
    </div>
  );
}
