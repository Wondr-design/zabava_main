"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useEffect } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Menu, X, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";

import GlassSurface from "@/components/GlassSurface";
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
  const { setTheme, theme } = useTheme();

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
    <header className="fixed top-4 inset-x-0 z-50 flex justify-center px-4 transition-all duration-300">
      <GlassSurface
        width="auto"
        height="auto"
        borderRadius={50}
        displace={15}
        distortionScale={-150}
        redOffset={5}
        greenOffset={15}
        blueOffset={25}
        brightness={60}
        opacity={0.8}
        blur={11}
        saturation={1}
        mixBlendMode="screen"
        borderWidth={0.5}
        backgroundOpacity={0.1}
        className={cn(
          "mx-auto !p-0 shadow-2xl transition-all duration-300",
          isScrolled ? "opacity-70" : ""
        )}
      >
        <div className="flex w-full items-center justify-between gap-4 px-6 py-3">
          <LocalizedLink
            href="/"
            className="text-xl font-bold tracking-tight text-white transition hover:opacity-80 ml-2"
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
                    "px-4 py-2 text-sm font-medium rounded-full transition-colors whitespace-nowrap",
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

          <div className="flex items-center gap-3">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="relative flex items-center justify-center text-slate-300 hover:text-white transition-colors border border-white/10 rounded-full h-[30px] w-[30px] bg-white/5 hover:bg-white/10"
              aria-label="Toggle theme"
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </button>

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
                  className="md:hidden text-white hover:bg-white/10 rounded-full h-8 w-8"
                >
                  <Menu className="h-5 w-5" />
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
      </GlassSurface>
    </header>
  );
}
