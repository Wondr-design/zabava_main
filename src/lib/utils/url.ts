export function ensureExternalUrl(value?: string | null) {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^[a-z]+:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

const BACHELOR_LABEL_REGEX = /^bachelor party$/i;

export function formatCategoryLabel(label: string) {
  if (BACHELOR_LABEL_REGEX.test(label.trim())) {
    return "Bachelor/Bachelorette Party";
  }
  return label;
}
