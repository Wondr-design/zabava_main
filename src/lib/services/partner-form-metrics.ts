import type { PartnerFormConfig } from "@/lib/data/partner-forms";

export interface PartnerFormMetrics {
  numPeople: number | null;
  ticketType: string | null;
  transportChoice: string | null;
  transportPartner: string | null;
  transportSelected: boolean;
  totalPrice: number | null;
  currency: string | null;
}

function parsePositiveInt(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const normalized = Math.round(numeric);
  if (normalized <= 0) return null;
  return normalized;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computePartnerFormMetrics(
  config: PartnerFormConfig,
  values: Record<string, unknown>,
): PartnerFormMetrics {
  const metrics: PartnerFormMetrics = {
    numPeople: null,
    ticketType: null,
    transportChoice: null,
    transportPartner: null,
    transportSelected: false,
    totalPrice: null,
    currency: config.pricing?.currency ?? null,
  };

  const pricing = config.pricing;
  if (!pricing) {
    return metrics;
  }

  const numPeople = parsePositiveInt(values[pricing.peopleFieldId]);
  if (numPeople !== null) {
    metrics.numPeople = numPeople;
  }

  if (values[pricing.ticketFieldId] !== undefined) {
    metrics.ticketType = String(values[pricing.ticketFieldId] ?? "");
  }

  if (pricing.transportFieldId) {
    const transportValue = values[pricing.transportFieldId];
    if (transportValue !== undefined) {
      metrics.transportChoice = String(transportValue ?? "");
    }
  }

  if (pricing.transportBusFieldId) {
    const busValue = values[pricing.transportBusFieldId];
    if (busValue !== undefined) {
      metrics.transportPartner = String(busValue ?? "");
    }
  }

  const yesValue =
    pricing.transportYesValue ??
    config.transport?.yesValue ??
    "Yes";

  if (metrics.transportChoice) {
    metrics.transportSelected =
      metrics.transportChoice.toLowerCase() === yesValue.toLowerCase();
  }

  let totalPrice = 0;
  let hasPrice = false;

  if (metrics.ticketType) {
    const ticketOption = (pricing.ticketPricing ?? []).find(
      (option) => option.value === metrics.ticketType,
    );
    if (ticketOption && Number.isFinite(ticketOption.price)) {
      const peopleCount = metrics.numPeople ?? 1;
      totalPrice += ticketOption.price * peopleCount;
      hasPrice = true;
    }
  }

  if (metrics.transportSelected) {
    const transportFee =
      pricing.transportFee ??
      config.transport?.busFee ??
      0;
    if (Number.isFinite(transportFee) && transportFee > 0) {
      totalPrice += transportFee;
      hasPrice = true;
    }
  }

  metrics.totalPrice = hasPrice ? roundCurrency(totalPrice) : null;
  return metrics;
}

export function estimatePointsFromMetrics(
  metrics: PartnerFormMetrics,
): number | null {
  const hasInputs =
    metrics.numPeople !== null ||
    metrics.totalPrice !== null ||
    (metrics.ticketType?.length ?? 0) > 0;
  if (!hasInputs) return null;

  const numPeople = metrics.numPeople ?? 1;
  const ticket = (metrics.ticketType ?? "").toLowerCase();
  let points = 0;
  switch (ticket) {
    case "vip":
      points = 50 * numPeople;
      break;
    case "family":
      points = 30 * numPeople;
      break;
    case "group":
      points = 20 * numPeople;
      break;
    case "student":
      points = 15 * numPeople;
      break;
    default:
      points = 10 * numPeople;
      break;
  }

  if (metrics.totalPrice !== null && metrics.totalPrice > 0) {
    points = Math.max(points, Math.floor(metrics.totalPrice / 100));
  }

  if (metrics.transportSelected) {
    points += 5;
  }

  return Math.max(0, Math.round(points));
}
