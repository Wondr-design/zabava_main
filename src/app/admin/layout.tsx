"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useState } from "react";

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
    <nav className="space-y-1 text-sm font-medium text-slate-300">
      {PRIMARY_NAV.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              "flex items-center justify-between rounded-xl px-4 py-2 transition-colors " +
              (active
                ? "bg-emerald-500/10 text-white ring-1 ring-emerald-400/50"
                : "hover:bg-slate-800/60 hover:text-white")
            }
          >
            <span>{item.label}</span>
            {active && <span className="text-xs text-emerald-300">•</span>}
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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="border-slate-900/60 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900/70 lg:min-h-screen lg:w-72 lg:border-r lg:border-white/10">
          <div className="flex h-full flex-col gap-8 px-6 py-8">
            <div>
              <Link
                href="/admin/dashboard"
                className="text-2xl font-semibold tracking-tight text-white"
              >
                Zabava Admin
              </Link>
              <p className="mt-2 text-sm text-slate-400">
                Operations control centre
              </p>
            </div>

            <AdminNavigation />

            <div className="mt-auto space-y-4 text-sm text-slate-400">
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                <p className="text-xs uppercase tracking-wider text-slate-500">
                  Need help?
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Visit the knowledge base or reach out to support for
                  onboarding partners faster.
                </p>
                <Link
                  href="/admin/analytics"
                  className="mt-3 inline-flex text-sm font-semibold text-emerald-300 hover:text-emerald-200"
                >
                  View insights →
                </Link>
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="w-full rounded-xl border border-white/10 px-4 py-2 text-left text-sm text-slate-300 transition-colors hover:border-red-400/60 hover:bg-red-500/10 hover:text-white disabled:opacity-70"
              >
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          </div>
        </aside>

        <div className="flex-1">
          <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/80 backdrop-blur">
            <div className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-8">
              <div className="flex w-full items-center gap-3 rounded-full border border-white/10 bg-slate-900/80 px-4 py-2">
                <span className="text-sm text-slate-500">Search console…</span>
                <input
                  type="search"
                  name="q"
                  aria-label="Search admin"
                  className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none"
                  placeholder="Find partners, visits, rewards"
                  disabled
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-sm font-medium text-slate-100">
                    Admin Console
                  </span>
                  <span className="text-xs text-slate-400">Secure session</span>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-sky-500 text-sm font-semibold text-white">
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
