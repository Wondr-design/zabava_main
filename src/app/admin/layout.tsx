"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useState } from "react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import "../../styles/theme-admin.css";

const PRIMARY_NAV = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/partners", label: "Partners" },
  { href: "/admin/visits", label: "Visits" },
  { href: "/admin/rewards", label: "Rewards" },
  { href: "/admin/invites", label: "Invites" },
  { href: "/admin/analytics", label: "Analytics" },
];

function AdminNavigation() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1 text-sm font-medium text-muted-foreground">
      {PRIMARY_NAV.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              "flex items-center justify-between rounded-xl px-4 py-2 transition-colors " +
              (active
                ? "bg-primary/10 text-primary-foreground ring-1 ring-primary/50"
                : "hover:bg-muted/60 hover:text-foreground")
            }
          >
            <span>{item.label}</span>
            {active && <span className="text-xs text-primary">•</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    try {
      setSigningOut(true);
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/admin/login");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="theme-admin min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="bg-card lg:min-h-screen lg:w-72 lg:border-r">
          <div className="flex h-full flex-col gap-8 px-6 py-8">
            <div>
              <Link
                href="/admin/dashboard"
                className="text-2xl font-semibold tracking-tight text-foreground"
              >
                Zabava Admin
              </Link>
              <p className="mt-2 text-sm text-muted-foreground">
                Operations control centre
              </p>
            </div>

            <AdminNavigation />

            <div className="mt-auto space-y-4 text-sm text-muted-foreground">
              <div className="rounded-2xl border bg-muted/70 p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Need help?
                </p>
                <p className="mt-2 text-sm text-foreground">
                  Visit the knowledge base or reach out to support for
                  onboarding partners faster.
                </p>
                <Link
                  href="/admin/analytics"
                  className="mt-3 inline-flex text-sm font-semibold text-primary hover:text-primary/80"
                >
                  View insights →
                </Link>
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="w-full rounded-xl border px-4 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-destructive/60 hover:bg-destructive/10 hover:text-destructive disabled:opacity-70"
              >
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          </div>
        </aside>

        <div className="flex-1">
          <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
            <div className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-8">
              <div className="flex w-full items-center gap-3 rounded-full border bg-muted/80 px-4 py-2">
                <span className="text-sm text-muted-foreground">
                  Search console…
                </span>
                <input
                  type="search"
                  name="q"
                  aria-label="Search admin"
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                  placeholder="Find partners, visits, rewards"
                  disabled
                />
              </div>
              <div className="flex items-center gap-4">
                <ThemeToggle />
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-sm font-medium text-foreground">
                    Admin Console
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Secure session
                  </span>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-sm font-semibold text-primary-foreground">
                  ZA
                </div>
              </div>
            </div>
          </header>

          <main className="px-4 py-8 lg:px-8">
            <div className="space-y-8">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
