import { LocalizedLink } from "@/components/ui/localized-link";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function StaffScanNotFound() {
  return (
    <main className="theme-vercel flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-foreground">
      <Card className="flex flex-col items-center gap-4 rounded-lg p-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/20 text-destructive">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">
            QR code can&apos;t be used
          </h1>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            The QR you scanned is either invalid or the visit has already been checked in. Ask the guest to generate a fresh pass before continuing.
          </p>
        </div>
        <Button asChild>
          <LocalizedLink href="/staff/console">
            Back to console
          </LocalizedLink>
        </Button>
        <Link
          href="https://app.zabava.cz/partners"
          className="text-sm text-primary underline underline-offset-4 transition hover:text-primary/80"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open Zabava to generate a new QR code
        </Link>
      </Card>
      <p className="text-xs text-muted-foreground">
        Need help? Reach the Zabava support team from the partner portal.
      </p>
    </main>
  );
}
