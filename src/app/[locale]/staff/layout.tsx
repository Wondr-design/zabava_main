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
import "../../../styles/theme-vercel.css";
import { LogOut, Menu, X } from "lucide-react";
import { LocalizedLink } from "@/components/ui/localized-link";
import { useLocalizedRouter } from "@/i18n/use-localized-router";
import { useLocale } from "@/i18n/provider";
import { buildLocalizedPath } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BodyThemeClass } from "@/components/body-theme-class";

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
          <Button
            key={item.href}
            asChild
            variant={active ? "default" : "ghost"}
            size="sm"
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
          </Button>
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
      <>
        <BodyThemeClass className="theme-vercel" />
        <div className="theme-vercel flex min-h-screen items-center justify-center bg-background text-foreground">
          <div className="w-full max-w-md px-4">{children}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <BodyThemeClass className="theme-vercel" />
      <div className="theme-vercel min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <LocalizedLink
            href="/staff/console"
            className="flex items-center gap-3 transition-opacity hover:opacity-80"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
              ZA
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-semibold tracking-tight text-foreground">
                Staff Console
              </span>
              <span className="text-xs text-muted-foreground">
                Quick access portal
              </span>
            </div>
          </LocalizedLink>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-3 sm:flex">
              <StaffNav />
              <ThemeToggle />
              <Button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                variant="destructive"
                size="sm"
              >
                <LogOut className="size-4" aria-hidden />
                {signingOut ? "Signing out…" : "Sign out"}
              </Button>
            </div>
            <div className="flex items-center gap-2 sm:hidden">
              <Drawer open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <DrawerTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    aria-label="Open staff menu"
                  >
                    {mobileMenuOpen ? (
                      <X className="size-5" aria-hidden />
                    ) : (
                      <Menu className="size-5" aria-hidden />
                    )}
                  </Button>
                </DrawerTrigger>
                <DrawerContent className="theme-vercel bg-background text-foreground">
                  <DrawerHeader className="space-y-2">
                    <DrawerTitle>Staff Console</DrawerTitle>
                    <DrawerDescription className="text-muted-foreground">
                      Navigate between console tools and settings.
                    </DrawerDescription>
                  </DrawerHeader>
                  <div className="space-y-4 px-6 py-2">
                    <StaffNav
                      orientation="vertical"
                      onNavigate={() => setMobileMenuOpen(false)}
                    />
                    <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-4 py-3">
                      <span className="text-sm text-foreground">Theme</span>
                      <ThemeToggle />
                    </div>
                    <Button
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
                    </Button>
                  </div>
                  <DrawerFooter className="border-t border-border bg-muted/60">
                    <DrawerClose asChild>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="w-full"
                      >
                        Close
                      </Button>
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
    </>
  );
}
