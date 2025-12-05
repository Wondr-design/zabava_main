"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useLocalizedRouter } from "@/i18n/use-localized-router";
import { toast } from "sonner";
import { ArrowRight, IdCard, QrCode, Sparkles, LogIn } from "lucide-react";

import { StaffQrScanner } from "@/components/staff/qr-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
      <main className="theme-vercel flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="flex w-full max-w-sm flex-col items-center gap-3 p-6 text-center">
          <LogIn className="size-8 text-primary" />
          <p className="text-sm text-muted-foreground">
            Checking your staff session…
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="theme-vercel min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-6">
        <header className="space-y-2">
          <span className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Sparkles className="size-4" />
            Staff Console
          </span>
          <h1 className="text-2xl font-semibold text-foreground">{greeting}</h1>
          <p className="text-sm text-muted-foreground">
            Scan a guest's visit pass or enter their code manually to open and confirm the visit record.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle>Scan QR code</CardTitle>
                <CardDescription>
                  Launch the camera and align the QR pass. We'll take you straight to the visit record.
                </CardDescription>
              </div>
              <Button
                type="button"
                onClick={() => setScannerOpen(true)}
                size="sm"
                className="gap-2"
              >
                <QrCode className="size-4" />
                Start scanning
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3 rounded-lg border border-border bg-muted p-4">
                <QrCode className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <p className="text-sm text-muted-foreground">
                  Camera scanning works best on Chrome or Edge on mobile devices that support built-in QR detection.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader>
              <CardTitle>Enter visit ID</CardTitle>
              <CardDescription>
                Paste a visit link or code if the guest shared it verbally. We'll validate it before opening.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="visit-link">
                    Visit link or code <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="relative flex-1">
                      <IdCard className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="visit-link"
                        value={manualValue}
                        onChange={(event) => setManualValue(event.target.value)}
                        placeholder="Paste QR link or enter visit ID"
                        className="pl-10"
                        autoComplete="off"
                        inputMode="text"
                      />
                    </div>
                    <Button
                      type="submit"
                      size="sm"
                      className="w-full gap-2 sm:w-auto"
                    >
                      Continue
                      <ArrowRight className="size-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Example formats: <code>/staff/scan/1234abcd</code>, <code>?visitId=1234</code>, or just the raw visit ID.
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>
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
