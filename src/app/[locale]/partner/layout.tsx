"use client";

import { ReactNode, useMemo } from "react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { usePathname } from "next/navigation";
import "../../../styles/theme-partner.css";
import { LocalizedLink } from "@/components/ui/localized-link";
import { useLocale } from "@/i18n/provider";
import { buildLocalizedPath } from "@/i18n/routing";
import { Settings, Clock } from "lucide-react";
import { DesignButton } from "@/components/design-system";

export default function PartnerLayout({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const pathname = usePathname() ?? "/";
  const loginPath = useMemo(() => buildLocalizedPath("/partner/login", locale), [locale]);
  const isAuthRoute = pathname === loginPath;

  if (isAuthRoute) {
    return (
      <div className="theme-partner flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="w-full max-w-md px-4">{children}</div>
      </div>
    );
  }

  return (
    <div className="theme-partner min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <LocalizedLink
              href="/partner/dashboard"
              className="flex items-center gap-3 transition-opacity hover:opacity-80"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/40">
                ZA
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-semibold tracking-tight text-foreground">
                  Partner Console
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" aria-hidden />
                  <span>Last synced: Just now</span>
                </span>
              </div>
            </LocalizedLink>
          </div>
          <div className="flex items-center gap-3">
            <DesignButton asChild variant="tonal" size="sm" className="gap-2">
              <LocalizedLink href="/partner/settings">
                <Settings className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Settings</span>
              </LocalizedLink>
            </DesignButton>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-8">{children}</div>
      </main>
    </div>
  );
}
