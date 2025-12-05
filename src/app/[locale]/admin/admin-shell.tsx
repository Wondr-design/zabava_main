"use client";

import { usePathname } from "next/navigation";
import React, { ReactNode, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";

import "@/styles/theme-vercel.css";

import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getSupabaseBrowser } from "@/lib/realtime/client";
import { LocalizedLink } from "@/components/ui/localized-link";
import { useLocalizedRouter } from "@/i18n/use-localized-router";
import { useLocale } from "@/i18n/provider";
import { buildLocalizedPath } from "@/i18n/routing";
import {
  BarChart3,
  BookText,
  FileText,
  Gift,
  HandshakeIcon,
  LayoutDashboard,
  MailCheck,
  Palette,
  TicketPercent,
  LogOut,
  Settings,
  Zap,
  Users2,
  Globe2,
} from "lucide-react";
import { DesignButton } from "@/components/design-system";
import { BodyThemeClass } from "@/components/body-theme-class";

export const AdminDrawerVisibilityContext = React.createContext<
  ((open: boolean) => void) | null
>(null);

const PRIMARY_NAV: Array<{
  href: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  section?: string;
}> = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, section: "Operations" },
  { href: "/admin/partners", label: "Partners", icon: HandshakeIcon, section: "Operations" },
  { href: "/admin/visits", label: "Visits", icon: TicketPercent, section: "Operations" },
  { href: "/admin/rewards", label: "Rewards", icon: Gift, section: "Operations" },
  { href: "/admin/invites", label: "Invites", icon: MailCheck, section: "Operations" },
  { href: "/admin/deals", label: "Deals", icon: Zap, section: "Operations" },
  { href: "/admin/forms", label: "Forms", icon: FileText, section: "Operations" },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3, section: "Insights" },
  { href: "/admin/accounts", label: "Team", icon: Users2, section: "Insights" },
  { href: "/admin/cms", label: "CMS", icon: BookText, section: "Configuration" },
  { href: "/admin/email-templates", label: "Email templates", icon: MailCheck, section: "Configuration" },
  { href: "/admin/billings", label: "Billings", icon: FileText, section: "Configuration" },
  { href: "/admin/globals", label: "Globals", icon: Globe2, section: "Configuration" },
  { href: "/admin/design-preview", label: "Design Kit", icon: Palette, section: "Configuration" },
  { href: "/admin/settings", label: "Settings", icon: Settings, section: "Configuration" },
];

function AdminNavigation() {
  const locale = useLocale();
  const pathname = usePathname() ?? "/";

  const groupedNav = useMemo(() => {
    const groups: Record<string, typeof PRIMARY_NAV> = {};
    for (const item of PRIMARY_NAV) {
      const section = item.section || "Other";
      if (!groups[section]) {
        groups[section] = [];
      }
      groups[section].push(item);
    }
    return groups;
  }, []);

  return (
    <nav className="space-y-6 text-sm font-medium text-muted-foreground">
      {Object.entries(groupedNav).map(([section, items]) => (
        <div key={section} className="space-y-2">
          <div className="px-4 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground/70">
            {section}
          </div>
          <div className="space-y-1">
            {items.map((item) => {
              const localizedHref = buildLocalizedPath(item.href, locale);
              const active =
                pathname === localizedHref || pathname.startsWith(`${localizedHref}/`);
              const Icon = item.icon;
              return (
                <LocalizedLink
                  key={item.href}
                  href={item.href}
                  className={
                    "flex items-center justify-between rounded-xl px-4 py-2.5 transition-all duration-200 " +
                    (active
                      ? "bg-primary/10 text-foreground ring-1 ring-primary/30 shadow-sm"
                      : "hover:bg-muted/60 hover:text-foreground")
                  }
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span>{item.label}</span>
                  </span>
                  {active && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
                  )}
                </LocalizedLink>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useLocalizedRouter();
  const locale = useLocale();
  const pathname = usePathname() ?? "/";
  const [signingOut, setSigningOut] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loginPath = useMemo(() => buildLocalizedPath("/admin/login", locale), [locale]);
  const isAuthRoute = pathname === loginPath;

  async function handleSignOut() {
    try {
      setSigningOut(true);
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/admin/login");
    } finally {
      setSigningOut(false);
    }
  }

  useEffect(() => {
    if (isAuthRoute) return;
    const supabase = getSupabaseBrowser();
    if (!supabase) return;

    const channel = supabase
      .channel("admin-dashboard-notifier")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "visit_registrations",
        },
        (payload) => {
          const email =
            (payload.new as { email?: string } | null)?.email ??
            (payload.old as { email?: string } | null)?.email ??
            "Visit";
          const event = payload.eventType?.toLowerCase?.() ?? "update";
          toast.info(`Visit ${event}`, {
            description: email,
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rewards",
        },
        (payload) => {
          const name =
            (payload.new as { name?: string } | null)?.name ??
            (payload.old as { name?: string } | null)?.name ??
            "Reward";
          const event = payload.eventType?.toLowerCase?.() ?? "update";
          toast.success(`Reward ${event}`, {
            description: name,
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isAuthRoute]);

  if (isAuthRoute) {
    return (
      <>
        <BodyThemeClass className="theme-vercel" />
        <div className="theme-vercel flex min-h-screen items-center justify-center bg-background text-foreground">
          {children}
        </div>
      </>
    );
  }

  return (
    <>
      <BodyThemeClass className="theme-vercel" />
      <div className="theme-vercel min-h-screen overflow-x-hidden bg-background text-foreground">
        <aside className="bg-card lg:fixed lg:inset-y-0 lg:left-0 lg:w-[280px] lg:border-r lg:shadow-sm">
        <div className="flex h-full flex-col gap-6 overflow-y-auto px-5 py-6">
          <div className="space-y-3">
            <LocalizedLink href="/admin/dashboard" className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/40">
                ZA
              </span>
              <div className="flex flex-col">
                <span className="text-xl font-semibold tracking-tight text-foreground">
                  Zabava Admin
                </span>
                <p className="text-xs text-muted-foreground">
                  Operations control centre
                </p>
              </div>
            </LocalizedLink>
          </div>

          <AdminNavigation />

          <div className="mt-auto space-y-4 text-sm text-muted-foreground">
            <DesignButton
              type="button"
              variant="destructive"
              onClick={handleSignOut}
              disabled={signingOut}
              className="w-full"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              {signingOut ? "Signing out…" : "Sign out"}
            </DesignButton>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col lg:ml-[280px]">
        <header
          className={`sticky top-0 z-10 border-b bg-background/95 backdrop-blur-sm transition-opacity duration-200 ${
            drawerOpen ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-6 lg:py-4">
            <div className="relative flex w-full items-center gap-3 rounded-xl border border-border/60 bg-muted/50 px-4 py-2.5 transition-all focus-within:border-primary/40 focus-within:bg-background focus-within:shadow-sm">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <input
                type="search"
                name="q"
                aria-label="Search admin console"
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                placeholder="Search partners, visits, rewards…"
                disabled
              />
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <div className="hidden items-center gap-3 sm:flex">
                <div className="hidden flex-col text-right lg:flex">
                  <span className="text-sm font-medium text-foreground">
                    Admin Console
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Secure session
                  </span>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-sm font-semibold text-primary-foreground shadow-sm">
                  ZA
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="w-full max-w-full flex-1 px-4 py-8 lg:px-8">
          <AdminDrawerVisibilityContext.Provider value={setDrawerOpen}>
            <div className="w-full max-w-full space-y-8 overflow-x-hidden">
              {children}
            </div>
          </AdminDrawerVisibilityContext.Provider>
        </main>
      </div>
    </div>
    </>
  );
}

export default AdminShell;
