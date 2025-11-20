"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

import { cn } from "@/lib/utils";
import { locales, isLocale } from "@/i18n/config";
import { useLocale, useTranslations } from "@/i18n/provider";
import { LocalizedLink } from "@/components/ui/localized-link";
import { stripLocaleFromPath } from "@/i18n/routing";

const LOCALE_COOKIE = "zabava_locale";

export function SiteNav() {
  const pathname = usePathname() ?? "/";
  const locale = useLocale();
  const t = useTranslations("nav");
  const router = useRouter();

  const normalizedPath = stripLocaleFromPath(pathname);

  const navItems = [
    { href: "/", label: t("home") },
    { href: "/partners", label: t("partners") },
    { href: "/special-flash-deals", label: t("specialFlashDeals") },
    { href: "/bonus", label: t("bonus") },
  ];
  const [primaryLocale, secondaryLocale] = locales;

  const altLocale = useMemo(() => {
    const currentIndex = locales.findIndex((entry) => entry === locale);
    return locales[(currentIndex + 1) % locales.length];
  }, [locale]);

  const handleSwitchLocale = useCallback(() => {
    const nextLocale = altLocale;
    const segments = pathname.split("/");
    if (segments.length > 1 && isLocale(segments[1])) {
      segments[1] = nextLocale;
    } else {
      segments.splice(1, 0, nextLocale);
    }
    const nextPath = segments.join("/") || `/${nextLocale}`;
    document.cookie = `${LOCALE_COOKIE}=${nextLocale}; path=/; max-age=${60 * 60 * 24 * 365}`;
    router.push(nextPath);
    router.refresh();
  }, [altLocale, pathname, router]);

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4 lg:px-8">
        <LocalizedLink
          href="/"
          className="text-lg font-semibold tracking-tight text-white transition hover:opacity-80"
          aria-label="Zabava home"
        >
          Zabava
        </LocalizedLink>
        <nav className="flex flex-wrap items-center gap-4 text-sm font-medium sm:gap-6">
          {navItems.map((item) => {
            const targetHref = item.href;
            const isActive =
              targetHref === "/"
                ? normalizedPath === "/"
                : normalizedPath === targetHref ||
                  normalizedPath.startsWith(`${targetHref}/`);
            return (
              <LocalizedLink
                key={item.href}
                href={targetHref}
                className={cn(
                  "transition hover:text-white whitespace-nowrap",
                  isActive ? "text-white" : "text-slate-300"
                )}
              >
                {item.label}
              </LocalizedLink>
            );
          })}
          <div className="flex items-center gap-2 sm:gap-3 ml-auto sm:ml-0">
            <span className="hidden text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 sm:inline">
              {t("language")}
            </span>
            <button
              type="button"
              onClick={handleSwitchLocale}
              className={
                "relative h-8 w-16 rounded-full bg-gradient-to-r from-violet-500/80 via-indigo-500/80 to-purple-500/80 shadow-inner shadow-indigo-900/20 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
              }
              aria-label={t("language")}
              aria-pressed={locale === secondaryLocale}
              title={`${t("language")}: ${altLocale.toUpperCase()}`}
            >
              <span className="absolute inset-0 flex items-center justify-between px-3 text-[0.7rem] font-semibold uppercase tracking-[0.2em]">
                <span className={cn("transition-colors", locale === primaryLocale ? "text-slate-900" : "text-slate-200/70")}>{primaryLocale.toUpperCase()}</span>
                <span className={cn("transition-colors", locale === secondaryLocale ? "text-slate-900" : "text-slate-200/70")}>{secondaryLocale.toUpperCase()}</span>
              </span>
              <span
                className={cn(
                  "absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow-lg shadow-indigo-900/40 transition-transform",
                  locale === secondaryLocale ? "translate-x-8" : "translate-x-0"
                )}
              />
            </button>
          </div>
        </nav>
      </div>
    </header>
  );
}
