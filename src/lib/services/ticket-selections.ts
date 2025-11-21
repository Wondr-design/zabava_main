export type TicketSelection = {
  id: string;
  quantity: number;
  points: number | null;
};

interface TicketSelectionSource {
  values?: Record<string, unknown>;
  hidden?: Record<string, unknown>;
}

export function parseTicketSelections(
  source?: TicketSelectionSource | null,
): TicketSelection[] {
  if (!source) return [];
  const rawSelections =
    (source.values?.__ticketSelections as unknown) ??
    (source.hidden?.__ticketSelections as unknown);
  if (!Array.isArray(rawSelections)) return [];
  return rawSelections
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const obj = entry as Record<string, unknown>;
      const id =
        typeof obj.id === "string" && obj.id.trim().length > 0
          ? obj.id.trim()
          : null;
      const quantity =
        typeof obj.quantity === "number"
          ? obj.quantity
          : Number(obj.quantity ?? 0);
      if (!id || !Number.isFinite(quantity) || quantity <= 0) return null;
      const points =
        typeof obj.points === "number"
          ? obj.points
          : Number(obj.points ?? NaN);
      return {
        id,
        quantity: Math.max(1, Math.floor(quantity)),
        points: Number.isFinite(points) ? points : null,
      } satisfies TicketSelection;
    })
    .filter((entry): entry is TicketSelection => entry !== null);
}
