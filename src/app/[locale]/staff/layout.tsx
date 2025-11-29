"use client";

import { usePathname } from "next/navigation";
import { ReactNode, useMemo, useState } from "react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
  DrawerDescription,
  DrawerFooter,
  DrawerTrigger,
} from "@/components/ui/drawer";
import "../../../styles/theme-staff.css";
import { LogOut, Menu, X } from "lucide-react";
import { LocalizedLink } from "@/components/ui/localized-link";
import { useLocalizedRouter } from "@/i18n/use-localized-router";
import { useLocale } from "@/i18n/provider";
import { buildLocalizedPath } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { DesignButton, FilterChip } from "@/components/design-system";

const NAV_ITEMS = [
  { href: "/staff/console", label: "Console" },
  { href: "/staff/settings", label: "Settings" },
];

function StaffNav({
  orientation = "horizontal",
  onNavigate,
}: {
  orientation?: "horizontal" | "vertical";
  onNavigate?: () => void;
}) {
  const locale = useLocale();
  const pathname = usePathname() ?? "/";
  const vertical = orientation === "vertical";

  return (
    <nav
      className={cn(
        "flex gap-2",
        vertical && "flex-col",
      )}
    >
      {NAV_ITEMS.map((item) => {
        const localizedHref = buildLocalizedPath(item.href, locale);
        const active =
          pathname === localizedHref || pathname.startsWith(`${localizedHref}/`);
        return (
          <FilterChip
            key={item.href}
            asChild
            selected={active}
            size="md"
            className={cn(
              "text-sm",
              vertical ? "w-full justify-start" : "justify-center",
            )}
          >
            <LocalizedLink
              href={item.href}
              className="flex-1 no-underline"
              onClick={onNavigate}
            >
              <span className={cn("block", vertical ? "text-left" : "text-center")}>
                {item.label}
              </span>
            </LocalizedLink>
          </FilterChip>
        );
      })}
    </nav>
  );
}

export default function StaffLayout({ children }: { children: ReactNode }) {
  const router = useLocalizedRouter();
  const locale = useLocale();
  const pathname = usePathname() ?? "/";
  const [signingOut, setSigningOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const loginPath = useMemo(() => buildLocalizedPath("/staff/login", locale), [locale]);
  const signupPrefix = useMemo(() => buildLocalizedPath("/staff/signup", locale), [locale]);
  const isAuthRoute =
    pathname === loginPath || pathname.startsWith(`${signupPrefix}`);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore network errors, we'll still redirect
    }
    router.replace("/staff/login");
  }

  if (isAuthRoute) {
    return (
      <div className="theme-staff flex min-h-screen items-center justify-center bg-[color:var(--ds-surface-base)] text-[color:var(--ds-text-strong)]">
        <div className="w-full max-w-md px-4">{children}</div>
      </div>
    );
  }

  return (
    <div className="theme-staff min-h-screen bg-[color:var(--ds-surface-base)] text-[color:var(--ds-text-strong)]">
      <header className="sticky top-0 z-10 border-b border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-base)]/95 backdrop-blur-sm shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <LocalizedLink
            href="/staff/console"
            className="flex items-center gap-3 transition-opacity hover:opacity-80"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--ds-primary)] text-sm font-semibold text-[color:var(--ds-primary-foreground)] shadow-sm shadow-[color:var(--ds-primary)]/40">
              ZA
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-semibold tracking-tight text-[color:var(--ds-text-strong)]">
                Staff Console
              </span>
              <span className="text-xs text-[color:var(--ds-text-muted)]">
                Quick access portal
              </span>
            </div>
          </LocalizedLink>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-3 sm:flex">
              <StaffNav />
              <ThemeToggle />
              <DesignButton
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                variant="destructive"
                size="sm"
              >
                <LogOut className="size-4" aria-hidden />
                {signingOut ? "Signing out…" : "Sign out"}
              </DesignButton>
            </div>
            <div className="flex items-center gap-2 sm:hidden">
              <Drawer open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <DrawerTrigger asChild>
                  <DesignButton
                    variant="tonal"
                    size="icon"
                    aria-label="Open staff menu"
                  >
                    {mobileMenuOpen ? (
                      <X className="size-5" aria-hidden />
                    ) : (
                      <Menu className="size-5" aria-hidden />
                    )}
                  </DesignButton>
                </DrawerTrigger>
                <DrawerContent className="theme-staff bg-[color:var(--ds-surface-base)] text-[color:var(--ds-text-strong)]">
                  <DrawerHeader className="space-y-2">
                    <DrawerTitle>Staff Console</DrawerTitle>
                    <DrawerDescription className="text-[color:var(--ds-text-muted)]">
                      Navigate between console tools and settings.
                    </DrawerDescription>
                  </DrawerHeader>
                  <div className="space-y-4 px-6 py-2">
                    <StaffNav
                      orientation="vertical"
                      onNavigate={() => setMobileMenuOpen(false)}
                    />
                    <div className="flex items-center justify-between rounded-2xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] px-4 py-3">
                      <span className="text-sm text-[color:var(--ds-text-strong)]">Theme</span>
                      <ThemeToggle />
                    </div>
                    <DesignButton
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleSignOut().catch(() => undefined);
                      }}
                      disabled={signingOut}
                      variant="destructive"
                      className="w-full"
                    >
                      <LogOut className="size-4" aria-hidden />
                      {signingOut ? "Signing out…" : "Sign out"}
                    </DesignButton>
                  </div>
                  <DrawerFooter className="border-t border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)]/60">
                    <DrawerClose asChild>
                      <DesignButton
                        type="button"
                        variant="tonal"
                        size="sm"
                        className="w-full"
                      >
                        Close
                      </DesignButton>
                    </DrawerClose>
                  </DrawerFooter>
                </DrawerContent>
              </Drawer>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-8">{children}</div>
      </main>
    </div>
  );
}
