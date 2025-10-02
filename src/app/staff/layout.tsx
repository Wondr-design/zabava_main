"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useState } from "react";

const NAV_ITEMS = [{ href: "/staff/dashboard", label: "Dashboard" }];

function StaffNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 text-sm font-medium text-slate-300">
      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              "rounded-lg px-3 py-2 transition-colors " +
              (active
                ? "bg-emerald-500/15 text-white"
                : "hover:bg-slate-800/70 hover:text-white")
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function StaffLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <Link
            href="/staff/dashboard"
            className="text-lg font-semibold tracking-tight text-white"
          >
            Zabava Staff Console
          </Link>
          <div className="flex items-center gap-4">
            <StaffNav />
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 transition-colors hover:border-emerald-400/60 hover:bg-emerald-500/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">{children}</div>
      </main>
    </div>
  );
}
