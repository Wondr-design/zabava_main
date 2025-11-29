"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useLocalizedRouter } from "@/i18n/use-localized-router";
import { toast } from "sonner";
import { ArrowRight, IdCard, QrCode, Sparkles, LogIn } from "lucide-react";

import { StaffQrScanner } from "@/components/staff/qr-scanner";
import {
  DesignButton,
  DesignFormField,
  DesignInput,
  PageHeader,
  SectionCard,
  SurfaceCard,
} from "@/components/design-system";

function readCookie(name: string) {
  if (typeof document === "undefined") return "";
  const entries = document.cookie.split(";");
  for (const entry of entries) {
    const [key, value] = entry.trim().split("=");
    if (key === name && value !== undefined) {
      return decodeURIComponent(value);
    }
  }
  return "";
}

function extractVisitId(raw: string) {
  const value = raw.trim();
  if (!value) return "";

  try {
    const url = new URL(value);
    const normalizedPath = url.pathname.replace(/^\/[a-z]{2}(?=\/)/i, "");
    if (normalizedPath.startsWith("/staff/scan/")) {
      return normalizedPath.replace("/staff/scan/", "");
    }
    const fromQuery = url.searchParams.get("visitId");
    if (fromQuery) return fromQuery;
  } catch {
    // ignore parse errors, fallback to manual extraction below
  }

  const normalized = value.replace(/^\/[a-z]{2}(?=\/)/i, "");

  if (normalized.startsWith("/staff/scan/")) {
    return normalized.replace("/staff/scan/", "").split("?")[0] ?? "";
  }

  const queryMatch = value.match(/visitId=([0-9a-f-]+)/i);
  if (queryMatch?.[1]) return queryMatch[1];

  if (/^[0-9a-f-]{32,}$/i.test(value)) {
    return value;
  }

  return "";
}

export default function StaffConsolePage() {
  const router = useLocalizedRouter();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [staffName, setStaffName] = useState("");

  useEffect(() => {
    const role = readCookie("zabava_role");
    const pid = readCookie("zabava_partner");
    const name = readCookie("zabava_staff_name");
    if (role !== "staff" || !pid) {
      router.replace("/staff/login");
      return;
    }
    setPartnerId(pid);
    if (name) {
      setStaffName(name);
    } else {
      const fallback = readCookie("zabava_staff_email");
      if (fallback) setStaffName(fallback);
    }
    document.title = "Staff Console – Zabava";
  }, [router]);

  const greeting = useMemo(() => {
    if (!staffName) return "Welcome back";
    const first = staffName.split(" ")[0];
    return `Welcome back, ${first}`;
  }, [staffName]);

  const openVisit = useCallback(
    (visitId: string) => {
      if (!visitId) {
        toast.error("Unable to recognize that code. Try again.");
        return;
      }
      toast.success("Opening visit record…");
      router.push(`/staff/scan/${visitId}`);
    },
    [router]
  );

  const handleScannerDetected = useCallback(
    (value: string) => {
      setScannerOpen(false);
      const visitId = extractVisitId(value);
      if (!visitId) {
        toast.error("Unrecognized QR code. Make sure it is a Zabava visit pass.");
        return;
      }
      openVisit(visitId);
    },
    [openVisit]
  );

  const handleManualSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const visitId = extractVisitId(manualValue);
      if (!visitId) {
        toast.error("Enter a valid visit link or ID.");
        return;
      }
      openVisit(visitId);
    },
    [manualValue, openVisit]
  );

  if (!partnerId) {
    return (
      <main className="theme-staff flex min-h-screen items-center justify-center bg-[color:var(--ds-surface-base)] px-4">
        <SurfaceCard className="flex w-full max-w-sm flex-col items-center gap-3 p-6 text-center">
          <LogIn className="size-8 text-[color:var(--ds-primary)]" />
          <p className="text-sm text-[color:var(--ds-text-muted)]">
            Checking your staff session…
          </p>
        </SurfaceCard>
      </main>
    );
  }

  return (
    <main className="theme-staff min-h-screen bg-[color:var(--ds-surface-base)]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <PageHeader
          breadcrumbs={
            <span className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-[color:var(--ds-text-subtle)]">
              <Sparkles className="size-4" />
              Staff Console
            </span>
          }
          title={greeting}
          description="Scan a guest's visit pass or enter their code manually to open and confirm the visit record."
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard
            title="Scan QR code"
            description="Launch the camera and align the QR pass. We'll take you straight to the visit record."
            actions={
              <DesignButton
                type="button"
                onClick={() => setScannerOpen(true)}
                size="sm"
                className="gap-2"
              >
                <QrCode className="size-4" />
                Start scanning
              </DesignButton>
            }
            className="h-full"
          >
            <div className="flex items-start gap-3 rounded-xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] p-4">
              <QrCode className="mt-0.5 size-5 shrink-0 text-[color:var(--ds-primary)]" aria-hidden />
              <p className="text-sm text-[color:var(--ds-text-muted)]">
                Camera scanning works best on Chrome or Edge on mobile devices that support built-in QR detection.
              </p>
            </div>
          </SectionCard>

          <SectionCard
            title="Enter visit ID"
            description="Paste a visit link or code if the guest shared it verbally. We'll validate it before opening."
            className="h-full"
          >
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <DesignFormField
                label="Visit link or code"
                helper={
                  <span className="text-xs text-[color:var(--ds-text-muted)]">
                    Example formats: <code>/staff/scan/1234abcd</code>, <code>?visitId=1234</code>, or just the raw visit ID.
                  </span>
                }
                required
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <DesignInput
                      value={manualValue}
                      onChange={(event) => setManualValue(event.target.value)}
                      placeholder="Paste QR link or enter visit ID"
                      leadingIcon={<IdCard className="size-4" />}
                      autoComplete="off"
                      inputMode="text"
                    />
                  </div>
                  <DesignButton
                    type="submit"
                    size="sm"
                    className="w-full gap-2 sm:w-auto"
                  >
                    Continue
                    <ArrowRight className="size-4" />
                  </DesignButton>
                </div>
              </DesignFormField>
            </form>
          </SectionCard>
        </div>
      </div>

      <StaffQrScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={handleScannerDetected}
      />
    </main>
  );
}
