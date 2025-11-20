"use client";

import { useMemo, useState } from "react";
import { Loader2, ShieldCheck, ShieldX } from "lucide-react";

import type { RedemptionRecord } from "@/lib/data/redemptions";
import type { VisitRegistrationRecord } from "@/lib/data/visits";
import { getCsrfToken } from "@/lib/web/csrf";
import { useLocalizedRouter } from "@/i18n/use-localized-router";
import {
  DesignButton,
  SectionCard,
  SurfaceCard,
  StatusPill,
} from "@/components/design-system";

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

  const statusTone: "success" | "danger" | "warning" =
    (redemption?.status ?? "").toLowerCase() === "used"
      ? "success"
      : (redemption?.status ?? "").toLowerCase() === "rejected"
      ? "danger"
      : "warning";

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
    <SectionCard
      title={rewardName}
      description="Review the submitted details and confirm the bonus QR if everything looks correct."
      actions={
        <StatusPill tone={statusTone} size="sm">
          {titleCase(redemption?.status ?? "Pending")}
        </StatusPill>
      }
    >
      <SurfaceCard className="space-y-3 rounded-2xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[color:var(--ds-text-muted)]">
          <span className="font-medium text-[color:var(--ds-text-subtle)]">
            Redemption code
          </span>
          <code className="rounded-full bg-[color:var(--ds-surface-card)] px-3 py-1 font-mono text-sm text-[color:var(--ds-text-strong)] shadow-[var(--ds-shadow-soft)]">
            {visit.redemption_code ?? "—"}
          </code>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[color:var(--ds-text-muted)]">
          <span className="font-medium text-[color:var(--ds-text-subtle)]">
            Member email
          </span>
          <span className="font-medium text-[color:var(--ds-text-strong)]">
            {visit.email}
          </span>
        </div>
      </SurfaceCard>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-[color:var(--ds-text-strong)]">
          Submitted details
        </h2>
        <SurfaceCard className="space-y-3 rounded-2xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-4">
          {orderedFields.length > 0 ? (
            orderedFields.map((field) => (
              <div
                key={field.key}
                className="grid grid-cols-1 gap-1 rounded-xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] px-3 py-2 text-sm text-[color:var(--ds-text-muted)] md:grid-cols-5"
              >
                <span className="font-medium text-[color:var(--ds-text-subtle)] md:col-span-2">
                  {field.label}
                </span>
                <span className="md:col-span-3 text-[color:var(--ds-text-strong)]">
                  {String(field.value ?? "—")}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-[color:var(--ds-text-subtle)]">
              No form values captured.
            </p>
          )}
        </SurfaceCard>
        {hiddenFieldEntries.length > 0 ? (
          <SurfaceCard className="rounded-2xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] p-4 text-xs text-[color:var(--ds-text-muted)]">
            <p className="font-semibold text-[color:var(--ds-text-strong)]">
              Hidden fields
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-[color:var(--ds-text-muted)]">
              {hiddenFieldEntries.map((entry) => (
                <span
                  key={entry.key}
                  className="rounded-full bg-[color:var(--ds-surface-card)] px-3 py-1 font-mono text-[color:var(--ds-text-strong)] shadow-sm"
                >
                  {entry.key}: {String(entry.value ?? "")}
                </span>
              ))}
            </div>
          </SurfaceCard>
        ) : null}
      </div>

      {actionState.error ? (
        <SurfaceCard className="rounded-2xl border border-[color:var(--ds-border-subtle)] bg-[color-mix(in srgb,var(--ds-danger) 15%,transparent)] p-4 text-sm text-[color:var(--ds-danger)]">
          {actionState.error}
        </SurfaceCard>
      ) : null}
      {actionState.message ? (
        <SurfaceCard className="rounded-2xl border border-[color:var(--ds-border-subtle)] bg-[color-mix(in srgb,var(--ds-success) 20%,transparent)] p-4 text-sm text-[color:var(--ds-success)]">
          {actionState.message}
        </SurfaceCard>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <p className="text-xs text-[color:var(--ds-text-subtle)]">
          Scanned by staff. Once marked, bonus commission will not be applied.
        </p>
        <div className="flex flex-wrap gap-2">
          <DesignButton
            type="button"
            variant="tonal"
            size="sm"
            onClick={() => router.replace("/staff/console")}
          >
            Back to console
          </DesignButton>
          <DesignButton
            type="button"
            variant="outline"
            size="sm"
            disabled={actionState.submitting === "reject" || !pending}
            onClick={() => handleAction("reject")}
            className="gap-2 text-[color:var(--ds-danger)]"
          >
            {actionState.submitting === "reject" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldX className="h-4 w-4" />
            )}
            Reject
          </DesignButton>
          <DesignButton
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
          </DesignButton>
        </div>
      </div>
    </SectionCard>
  );
}
