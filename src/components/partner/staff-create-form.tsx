"use client";

import { FormEvent, useState } from "react";

import {
  DesignButton,
  DesignFormField,
  DesignInput,
  SurfaceCard,
} from "@/components/design-system";

interface StaffCreateFormProps {
  onCreate: (payload: {
    email: string;
    name?: string;
    password: string;
  }) => Promise<void> | void;
}

export function StaffCreateForm({ onCreate }: StaffCreateFormProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }

    try {
      setBusy(true);
      setError("");
      await onCreate({ email, name: name || undefined, password });
      setEmail("");
      setName("");
      setPassword("");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create staff account";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-[color:var(--ds-text-strong)]">
          Create staff account
        </h3>
        <p className="text-xs text-[color:var(--ds-text-muted)]">
          Provision a login immediately using a temporary password.
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
            autoComplete="email"
            placeholder="staff@venue.cz"
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
        label="Temporary password"
        helper="Share this with the staff member; they’ll reset it on first login."
        required
      >
        <DesignInput
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
        />
      </DesignFormField>

      <DesignButton type="submit" disabled={busy}>
        {busy ? "Creating…" : "Create account"}
      </DesignButton>
    </form>
  );
}
