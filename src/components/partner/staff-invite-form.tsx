"use client";

import { FormEvent, useState } from "react";

import {
  DesignButton,
  DesignFormField,
  DesignInput,
  SurfaceCard,
} from "@/components/design-system";

interface StaffInviteFormProps {
  onCreate: (payload: {
    email: string;
    name?: string;
    expiresInMinutes?: number;
  }) => Promise<void> | void;
}

export function StaffInviteForm({ onCreate }: StaffInviteFormProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [expires, setExpires] = useState(60);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email) {
      setError("Email is required");
      return;
    }
    try {
      setBusy(true);
      setError("");
      await onCreate({
        email,
        name: name || undefined,
        expiresInMinutes: expires,
      });
      setEmail("");
      setName("");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create invite";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-[color:var(--ds-text-strong)]">
          Invite staff member
        </h3>
        <p className="text-xs text-[color:var(--ds-text-muted)]">
          Send a one-use invite to onboard a teammate or contractor.
        </p>
      </div>

      {error ? (
        <SurfaceCard className="rounded-2xl border border-[color:var(--ds-danger)]/40 bg-[color:var(--ds-danger)]/10 px-4 py-3 text-xs text-[color:var(--ds-danger)]">
          {error}
        </SurfaceCard>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <DesignFormField label="Email" required>
          <DesignInput
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="staff@zabava.cz"
          />
        </DesignFormField>
        <DesignFormField label="Name (optional)">
          <DesignInput
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Full name"
          />
        </DesignFormField>
      </div>

      <DesignFormField
        label="Invite expires in"
        helper="Minimum 30 minutes. Increase for complex onboarding."
      >
        <DesignInput
          type="number"
          min={30}
          max={60 * 24 * 30}
          value={expires}
          onChange={(event) => setExpires(Number(event.target.value) || 60)}
          className="w-40"
        />
      </DesignFormField>

      <DesignButton type="submit" disabled={busy}>
        {busy ? "Sending…" : "Send invite"}
      </DesignButton>
    </form>
  );
}
