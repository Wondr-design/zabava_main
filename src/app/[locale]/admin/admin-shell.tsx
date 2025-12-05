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
    <nav className="flex-1 space-y-6">
      {Object.entries(groupedNav).map(([section, items]) => (
        <div key={section} className="space-y-1">
          <div className="px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              {section}
            </span>
          </div>
          <div className="space-y-0.5">
            {items.map((item) => {
              const localizedHref = buildLocalizedPath(item.href, locale);
              const active =
                pathname === localizedHref || pathname.startsWith(`${localizedHref}/`);
              const Icon = item.icon;
              return (
                <LocalizedLink
                  key={item.href}
                  href={item.href}
                  className={`
                    group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150
                    ${active
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    }
                  `}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${active ? "text-background" : "text-muted-foreground group-hover:text-foreground"}`} aria-hidden />
                  <span>{item.label}</span>
                  {active && (
                    <div className="absolute right-3 h-1.5 w-1.5 rounded-full bg-background" aria-hidden />
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
        <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-[260px] lg:flex-col lg:border-r lg:border-border/50 lg:bg-card/50">
        {/* Sidebar Header */}
        <div className="flex h-16 shrink-0 items-center border-b border-border/50 px-4">
          <LocalizedLink href="/admin/dashboard" className="flex items-center gap-3 transition-opacity hover:opacity-80">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground text-sm font-bold text-background">
              Z
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">
                Zabava
              </span>
              <span className="text-[11px] text-muted-foreground">
                Admin Console
              </span>
            </div>
          </LocalizedLink>
        </div>

        {/* Navigation */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
          <AdminNavigation />
        </div>

        {/* Sidebar Footer */}
        <div className="shrink-0 border-t border-border/50 p-3">
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col lg:ml-[260px]">
        <header
          className={`sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur-xl transition-opacity duration-200 ${
            drawerOpen ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          <div className="flex h-16 items-center justify-between gap-4 px-4 lg:px-6">
            {/* Search Bar */}
            <div className="flex flex-1 items-center gap-4">
              <button
                type="button"
                className="group flex h-10 w-full max-w-md items-center gap-3 rounded-lg border border-border/60 bg-muted/40 px-3 text-sm text-muted-foreground transition-all hover:border-border hover:bg-muted/60"
                aria-label="Search admin console"
              >
                <Search className="h-4 w-4 shrink-0" aria-hidden />
                <span className="flex-1 text-left">Search...</span>
                <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </button>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-2">
              {/* Status indicator */}
              <div className="hidden items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1.5 md:flex">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="text-xs font-medium text-muted-foreground">Live</span>
              </div>

              {/* Divider */}
              <div className="hidden h-6 w-px bg-border/60 md:block" />

              {/* Theme Toggle */}
              <ThemeToggle />

              {/* Divider */}
              <div className="hidden h-6 w-px bg-border/60 sm:block" />

              {/* User Avatar */}
              <div className="relative">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
                  A
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full border-2 border-background bg-emerald-500">
                  <span className="sr-only">Online</span>
                </span>
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
