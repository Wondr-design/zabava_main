import type { Locale } from "./config";
import { isLocale } from "./config";

export function isExternalHref(href: string) {
  return /^([a-z][a-z0-9+\-.]*:)?\/\//i.test(href) || href.startsWith("mailto:") || href.startsWith("tel:");
}

export function normalizeHref(href: string) {
  if (!href) return "/";
  if (href.startsWith("#")) return href;
  if (!href.startsWith("/")) {
    return `/${href}`;
  }
  return href;
}

export function buildLocalizedPath(
  href: string,
  locale: Locale,
  options: { preserveLocale?: boolean; absolute?: boolean; origin?: string; targetLocale?: Locale } = {},
) {
  const normalized = normalizeHref(href);

  if (isExternalHref(normalized) || normalized.startsWith("#")) {
    return normalized;
  }

  const targetLocale = options.targetLocale ?? locale;

  const segments = normalized.split("/");
  if (segments.length > 1 && isLocale(segments[1]) && !options.targetLocale) {
    segments[1] = locale;
    return segments.join("/");
  }
  if (segments.length > 1 && isLocale(segments[1]) && options.targetLocale) {
    segments[1] = targetLocale;
    return segments.join("/");
  }
  const encoded = `/${targetLocale}${normalized === "/" ? "" : normalized}`;

  if (options.absolute && options.origin) {
    return new URL(encoded, options.origin).toString();
  }

  return encoded;
}

export function stripLocaleFromPath(pathname: string) {
  if (!pathname) return "/";
  const segments = pathname.split("/");
  if (segments.length > 1 && isLocale(segments[1])) {
    const rest = segments.slice(2).join("/");
    return rest ? `/${rest}` : "/";
  }
  return pathname;
}
