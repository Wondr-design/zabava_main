export type DealTicketRequirement = {
  ticketType: string;
  subType?: string | null;
  quantity: number;
};

export const DEAL_TICKET_REQUIREMENT_METADATA_KEY = "selectedDealTicketRequirement";

export function buildDealRequirementKey(ticketType: string, subType?: string | null) {
  return `${ticketType.trim().toLowerCase()}::${(subType ?? "").trim().toLowerCase()}`;
}

export function parseDealTicketRequirement(value: unknown): DealTicketRequirement | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const rawTicketType = typeof record.ticketType === "string" ? record.ticketType.trim() : "";
  const rawQuantity = record.quantity;
  const numericQuantity =
    typeof rawQuantity === "number" && Number.isFinite(rawQuantity) ? Math.floor(rawQuantity) : null;
  const rawSubType =
    typeof record.subType === "string"
      ? record.subType.trim()
      : record.subType === null
      ? null
      : undefined;
  if (!rawTicketType || numericQuantity === null || numericQuantity < 1) {
    return null;
  }
  return {
    ticketType: rawTicketType,
    subType: rawSubType ?? undefined,
    quantity: numericQuantity,
  };
}
