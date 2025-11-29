import { LocalizedLink } from "@/components/ui/localized-link";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function StaffScanNotFound() {
  return (
    <main className="theme-staff flex min-h-screen flex-col items-center justify-center gap-6 bg-[color:var(--ds-surface-base)] px-4 text-[color:var(--ds-text-strong)]">
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-10 text-center shadow-[var(--ds-shadow-soft)]">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--ds-danger)]/20 text-[color:var(--ds-danger)]">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-[color:var(--ds-text-strong)]">
            QR code can’t be used
          </h1>
          <p className="mx-auto max-w-sm text-sm text-[color:var(--ds-text-muted)]">
            The QR you scanned is either invalid or the visit has already been checked in. Ask the guest to generate a fresh pass before continuing.
          </p>
        </div>
        <LocalizedLink
          href="/staff/console"
          className="rounded-full bg-[color:var(--ds-primary)] px-6 py-2 text-sm font-medium text-[color:var(--ds-primary-foreground)] transition hover:bg-[color-mix(in srgb,var(--ds-primary) 90%,black)]"
        >
          <span>Back to console</span>
        </LocalizedLink>
        <Link
          href="https://app.zabava.cz/partners"
          className="text-sm text-[color:var(--ds-primary)] underline underline-offset-4 transition hover:text-[color-mix(in srgb,var(--ds-primary) 80%,black)]"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>Open Zabava to generate a new QR code</span>
        </Link>
      </div>
      <p className="text-xs text-[color:var(--ds-text-subtle)]">
        Need help? Reach the Zabava support team from the partner portal.
      </p>
    </main>
  );
}
