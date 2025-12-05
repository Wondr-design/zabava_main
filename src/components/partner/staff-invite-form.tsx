"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
        <h3 className="text-sm font-semibold text-foreground">
          Invite staff member
        </h3>
        <p className="text-xs text-muted-foreground">
          Send a one-use invite to onboard a teammate or contractor.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="invite-email">
            Email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="staff@zabava.cz"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-name">Name (optional)</Label>
          <Input
            id="invite-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Full name"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="invite-expires">Invite expires in (minutes)</Label>
        <Input
          id="invite-expires"
          type="number"
          min={30}
          max={60 * 24 * 30}
          value={expires}
          onChange={(event) => setExpires(Number(event.target.value) || 60)}
          className="w-40"
        />
        <p className="text-xs text-muted-foreground">
          Minimum 30 minutes. Increase for complex onboarding.
        </p>
      </div>

      <Button type="submit" disabled={busy}>
        {busy ? "Sending…" : "Send invite"}
      </Button>
    </form>
  );
}
