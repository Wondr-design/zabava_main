"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useEffect } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { locales, isLocale } from "@/i18n/config";
import { useLocale, useTranslations } from "@/i18n/provider";
import { LocalizedLink } from "@/components/ui/localized-link";
import { stripLocaleFromPath } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const LOCALE_COOKIE = "zabava_locale";

export function SiteNav() {
  const pathname = usePathname() ?? "/";
  const locale = useLocale();
  const t = useTranslations("nav");
  const router = useRouter();
  const { scrollY } = useScroll();

  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const updateScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", updateScroll);
    return () => window.removeEventListener("scroll", updateScroll);
  }, []);

  const normalizedPath = stripLocaleFromPath(pathname);

  const navItems = [
    { href: "/", label: t("home") },
    { href: "/partners", label: t("partners") },
    { href: "/special-flash-deals", label: t("specialFlashDeals") },
    { href: "/faq", label: t("faq") },
    { href: "/reviews", label: t("reviews") },
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
    <header
      className={cn(
        "fixed top-0 z-50 w-full transition-all duration-300",
        isScrolled
          ? "border-b border-white/10 bg-slate-950/80 backdrop-blur-md py-3"
          : "border-transparent bg-transparent py-5"
      )}
    >
      <div className="mx-auto flex w-full max-w-[120rem] items-center justify-between px-4 lg:px-24">
        <LocalizedLink
          href="/"
          className="text-xl font-bold tracking-tight text-white transition hover:opacity-80"
          aria-label="Zabava home"
        >
          Zabava
        </LocalizedLink>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
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
                  "px-4 py-2 text-sm font-medium rounded-full transition-colors",
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                )}
              >
                {item.label}
              </LocalizedLink>
            );
          })}
        </nav>

        <div className="flex items-center gap-4">
          <button
            onClick={handleSwitchLocale}
            className="text-xs font-medium uppercase tracking-wider text-slate-300 hover:text-white transition-colors border border-white/10 rounded-full px-3 py-1.5 bg-white/5 hover:bg-white/10"
          >
            {locale === primaryLocale ? secondaryLocale : primaryLocale}
          </button>

          {/* Mobile Menu Trigger */}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden text-white hover:bg-white/10"
              >
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[300px] bg-slate-950 border-l border-white/10 text-white p-0"
            >
              <div className="flex flex-col gap-2 p-6 mt-10">
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
                        "px-4 py-3 text-lg font-medium rounded-xl transition-colors",
                        isActive
                          ? "bg-white/10 text-white"
                          : "text-slate-300 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      {item.label}
                    </LocalizedLink>
                  );
                })}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
