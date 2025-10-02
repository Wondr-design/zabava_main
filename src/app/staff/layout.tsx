"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useState } from "react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import "../../styles/theme-staff.css";

const NAV_ITEMS = [{ href: "/staff/dashboard", label: "Dashboard" }];

function StaffNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 text-sm font-medium text-muted-foreground">
      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              "rounded-lg px-3 py-2 transition-colors " +
              (active
                ? "bg-primary/10 text-foreground"
                : "hover:bg-muted hover:text-foreground")
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
    <div className="theme-staff min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <Link
            href="/staff/dashboard"
            className="text-lg font-semibold tracking-tight text-foreground"
          >
            Zabava Staff Console
          </Link>
          <div className="flex items-center gap-4">
            <StaffNav />
            <ThemeToggle />
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-70"
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
