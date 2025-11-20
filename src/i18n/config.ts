export const locales = ["en", "cs"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export function isLocale(value: string | undefined | null): value is Locale {
  if (!value) return false;
  return (locales as readonly string[]).includes(value);
}

export function resolveLocale(
  value?: string | null,
  fallback: Locale = defaultLocale,
): Locale {
  if (isLocale(value)) return value;
  return fallback;
}
