const czkFormatter = new Intl.NumberFormat("cs-CZ", {
  style: "currency",
  currency: "CZK",
  maximumFractionDigits: 0,
});

export function formatCurrencyCZK(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }
  return czkFormatter.format(value);
}
