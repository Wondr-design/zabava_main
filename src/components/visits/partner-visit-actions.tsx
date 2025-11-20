"use client";

import { useState } from "react";
import { z } from "zod";
import {
  DesignButton,
  DesignFormField,
  DesignInput,
  DesignTextarea,
  SectionCard,
  SurfaceCard,
} from "@/components/design-system";
import { toast } from "sonner";

const actionSchema = z.object({
  token: z.string().min(10),
  email: z.string().email(),
  partnerId: z.string().min(1),
  visitId: z.string().uuid().optional(),
  visitDate: z.string().optional(),
  notes: z.string().optional(),
});

export function PartnerVisitActions() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [visitId, setVisitId] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [checkResponse, setCheckResponse] =
    useState<Record<string, unknown> | null>(null);
  const [confirmation, setConfirmation] =
    useState<Record<string, unknown> | null>(null);

  async function callPartnerEndpoint(
    path: string,
    body: Record<string, unknown>,
  ) {
    const res = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      throw new Error(errorBody.error || "Request failed");
    }

    return (await res.json()) as Record<string, unknown>;
  }

  async function handleCheck() {
    try {
      const payload = actionSchema.pick({
        token: true,
        email: true,
        partnerId: true,
      }).parse({
        token,
        email,
        partnerId,
      });
      setIsChecking(true);
      setCheckResponse(null);

      const json = await callPartnerEndpoint("/api/partner/visit", {
        email: payload.email,
        partnerId: payload.partnerId,
      });
      setCheckResponse(json);
      toast.success("Visit status fetched");
    } catch (err) {
      console.error("partner visit check failed", err);
      toast.error(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setIsChecking(false);
    }
  }

  async function handleConfirm() {
    try {
      const payload = actionSchema.parse({
        token,
        email,
        partnerId,
        visitId,
        visitDate,
        notes,
      });
      setIsConfirming(true);
      setConfirmation(null);

      const json = await callPartnerEndpoint("/api/partner/mark-visited", {
        email: payload.email,
        partnerId: payload.partnerId,
        visitId: payload.visitId || undefined,
        visitDate: payload.visitDate || undefined,
        notes: payload.notes || undefined,
      });
      setConfirmation(json);
      toast.success("Visit marked as visited");
    } catch (err) {
      console.error("partner mark-visited failed", err);
      toast.error(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <SectionCard
      title="Partner visit actions"
      description="Use a partner JWT to check or confirm visits associated with your partner ID."
      className="space-y-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <DesignFormField
          label="Partner JWT"
          description="Paste the token generated with JWT_SECRET."
          className="sm:col-span-2"
        >
          <DesignTextarea
            rows={3}
            placeholder="Paste partner token"
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
        </DesignFormField>

        <DesignFormField label="Guest email" required>
          <DesignInput
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
        </DesignFormField>

        <DesignFormField label="Partner ID" required>
          <DesignInput
            value={partnerId}
            onChange={(event) => setPartnerId(event.target.value)}
          />
        </DesignFormField>

        <DesignFormField
          label="Visit ID"
          description="Optional; provide to target a specific registration."
        >
          <DesignInput
            value={visitId}
            onChange={(event) => setVisitId(event.target.value)}
            placeholder="UUID from registration"
          />
        </DesignFormField>

        <DesignFormField label="Visit date (ISO)" description="Optional">
          <DesignInput
            value={visitDate}
            onChange={(event) => setVisitDate(event.target.value)}
            placeholder="2025-12-31T18:30:00.000Z"
          />
        </DesignFormField>

        <DesignFormField label="Notes">
          <DesignTextarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            placeholder="Context, shift details, or clarifications."
          />
        </DesignFormField>
      </div>

      <div className="flex flex-wrap gap-3">
        <DesignButton
          type="button"
          onClick={handleCheck}
          disabled={isChecking || !token}
        >
          {isChecking ? "Checking…" : "Check visit"}
        </DesignButton>
        <DesignButton
          type="button"
          variant="tonal"
          onClick={handleConfirm}
          disabled={isConfirming || !token}
        >
          {isConfirming ? "Submitting…" : "Mark as visited"}
        </DesignButton>
      </div>

      {checkResponse ? (
        <SurfaceCard className="space-y-2 rounded-2xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] p-4 text-sm text-[color:var(--ds-text-muted)]">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--ds-text-subtle)]">
            Check response
          </p>
          <pre className="whitespace-pre-wrap break-all font-mono text-xs text-[color:var(--ds-text-strong)]">
            {JSON.stringify(checkResponse, null, 2)}
          </pre>
        </SurfaceCard>
      ) : null}

      {confirmation ? (
        <SurfaceCard className="space-y-2 rounded-2xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] p-4 text-sm text-[color:var(--ds-text-muted)]">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--ds-text-subtle)]">
            Confirmation response
          </p>
          <pre className="whitespace-pre-wrap break-all font-mono text-xs text-[color:var(--ds-text-strong)]">
            {JSON.stringify(confirmation, null, 2)}
          </pre>
        </SurfaceCard>
      ) : null}
    </SectionCard>
  );
}
