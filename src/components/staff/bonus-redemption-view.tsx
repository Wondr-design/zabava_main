"use client";

import { useMemo, useState } from "react";
import { Loader2, ShieldCheck, ShieldX } from "lucide-react";

import type { RedemptionRecord } from "@/lib/data/redemptions";
import type { VisitRegistrationRecord } from "@/lib/data/visits";
import { getCsrfToken } from "@/lib/web/csrf";
import { useLocalizedRouter } from "@/i18n/use-localized-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface StaffBonusRedemptionViewProps {
  visit: VisitRegistrationRecord & {
    payload: Record<string, unknown> | null;
  };
  redemption: RedemptionRecord | null;
}

function titleCase(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function StaffBonusRedemptionView({
  visit,
  redemption,
}: StaffBonusRedemptionViewProps) {
  const router = useLocalizedRouter();
  const [actionState, setActionState] = useState<{
    submitting: "use" | "reject" | null;
    error: string;
    message: string;
  }>({ submitting: null, error: "", message: "" });

  const metadata = useMemo(
    () => (redemption?.metadata ?? {}) as Record<string, unknown>,
    [redemption?.metadata],
  );
  const formValues = useMemo(() => {
    const fromMetadata = metadata.formValues as
      | Record<string, unknown>
      | undefined;
    if (fromMetadata) return fromMetadata;
    const payloadForm = (visit.payload?.form ?? null) as
      | { values?: Record<string, unknown> }
      | null;
    return payloadForm?.values ?? {};
  }, [metadata, visit.payload]);

  const formLabels = useMemo(() => {
    const fromMetadata = metadata.formLabels as
      | Record<string, string>
      | undefined;
    if (fromMetadata) return fromMetadata;
    const payloadForm = (visit.payload?.form ?? null) as
      | { labels?: Record<string, string> }
      | null;
    return payloadForm?.labels ?? {};
  }, [metadata, visit.payload]);

  const hiddenFields = useMemo(() => {
    const hiddenFromMetadata = metadata.formHidden as
      | Record<string, unknown>
      | undefined;
    if (hiddenFromMetadata) return hiddenFromMetadata;
    const payloadForm = (visit.payload?.form ?? null) as
      | { hidden?: Record<string, unknown> }
      | null;
    return payloadForm?.hidden ?? {};
  }, [metadata, visit.payload]);

  const rewardName =
    (visit.payload?.rewardName as string | undefined) ??
    (metadata.rewardName as string | undefined) ??
    (redemption?.metadata?.rewardName as string | undefined) ??
    "Bonus reward";

  const pending =
    (redemption?.status ?? "").toLowerCase() !== "used" &&
    (redemption?.status ?? "").toLowerCase() !== "rejected";

  const statusVariant =
    (redemption?.status ?? "").toLowerCase() === "used"
      ? "default"
      : (redemption?.status ?? "").toLowerCase() === "rejected"
      ? "destructive"
      : "secondary";

  const statusClass =
    (redemption?.status ?? "").toLowerCase() === "used"
      ? "bg-green-500/20 text-green-600 border-green-500/30"
      : (redemption?.status ?? "").toLowerCase() === "rejected"
      ? ""
      : "bg-amber-500/20 text-amber-600 border-amber-500/30";

  async function handleAction(action: "use" | "reject") {
    if (!visit.redemption_code) {
      setActionState({
        submitting: null,
        error: "Missing redemption code",
        message: "",
      });
      return;
    }
    setActionState({ submitting: action, error: "", message: "" });
    try {
      const csrf = getCsrfToken();
      const response = await fetch(
        `/api/staff/redemptions/${encodeURIComponent(visit.redemption_code)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(csrf ? { "x-csrf-token": csrf } : {}),
          },
          body: JSON.stringify({ action }),
          credentials: "include",
        },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload?.error || "Unable to update redemption");
      }
      setActionState({
        submitting: null,
        error: "",
        message:
          action === "use"
            ? "Redemption marked as used."
            : "Redemption rejected.",
      });
      setTimeout(() => router.replace("/staff/console"), 1200);
    } catch (error) {
      setActionState({
        submitting: null,
        error:
          error instanceof Error ? error.message : "Unable to update redemption",
        message: "",
      });
    }
  }

  const orderedFields = useMemo(() => {
    const entries = Object.entries(formValues ?? {});
    return entries.map(([key, value]) => ({
      key,
      label: formLabels[key] ?? titleCase(key.replace(/[_-]+/g, " ")),
      value,
    }));
  }, [formValues, formLabels]);

  const hiddenFieldEntries = useMemo(() =>
    Object.entries(hiddenFields ?? {}).map(([key, value]) => ({ key, value })),
  [hiddenFields]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <CardTitle>{rewardName}</CardTitle>
          <CardDescription>
            Review the submitted details and confirm the bonus QR if everything looks correct.
          </CardDescription>
        </div>
        <Badge variant={statusVariant} className={statusClass}>
          {titleCase(redemption?.status ?? "Pending")}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <Card className="bg-muted/50">
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <span className="font-medium text-muted-foreground">
                Redemption code
              </span>
              <code className="rounded-full bg-card px-3 py-1 font-mono text-sm text-foreground border border-border">
                {visit.redemption_code ?? "—"}
              </code>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <span className="font-medium text-muted-foreground">
                Member email
              </span>
              <span className="font-medium text-foreground">
                {visit.email}
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            Submitted details
          </h2>
          <Card>
            <CardContent className="space-y-3 p-4">
              {orderedFields.length > 0 ? (
                orderedFields.map((field) => (
                  <div
                    key={field.key}
                    className="grid grid-cols-1 gap-1 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground md:grid-cols-5"
                  >
                    <span className="font-medium text-muted-foreground md:col-span-2">
                      {field.label}
                    </span>
                    <span className="md:col-span-3 text-foreground">
                      {String(field.value ?? "—")}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No form values captured.
                </p>
              )}
            </CardContent>
          </Card>
          {hiddenFieldEntries.length > 0 ? (
            <Card className="bg-muted/50">
              <CardContent className="p-4 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">
                  Hidden fields
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-muted-foreground">
                  {hiddenFieldEntries.map((entry) => (
                    <span
                      key={entry.key}
                      className="rounded-full bg-card px-3 py-1 font-mono text-foreground border border-border"
                    >
                      {entry.key}: {String(entry.value ?? "")}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        {actionState.error ? (
          <Alert variant="destructive">
            <AlertDescription>{actionState.error}</AlertDescription>
          </Alert>
        ) : null}
        {actionState.message ? (
          <Alert className="border-green-500/40 bg-green-500/10 text-green-600">
            <AlertDescription>{actionState.message}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <p className="text-xs text-muted-foreground">
            Scanned by staff. Once marked, bonus commission will not be applied.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => router.replace("/staff/console")}
            >
              Back to console
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={actionState.submitting === "reject" || !pending}
              onClick={() => handleAction("reject")}
              className="gap-2 text-destructive hover:text-destructive"
            >
              {actionState.submitting === "reject" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldX className="h-4 w-4" />
              )}
              Reject
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={actionState.submitting === "use" || !pending}
              onClick={() => handleAction("use")}
              className="gap-2"
            >
              {actionState.submitting === "use" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              Mark redeemed
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
