"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
        <h3 className="text-sm font-semibold text-foreground">
          Create staff account
        </h3>
        <p className="text-xs text-muted-foreground">
          Provision a login immediately using a temporary password.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="create-email">
            Email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="create-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="staff@venue.cz"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="create-name">Name (optional)</Label>
          <Input
            id="create-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Full name"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="create-password">
          Temporary password <span className="text-destructive">*</span>
        </Label>
        <Input
          id="create-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
        />
        <p className="text-xs text-muted-foreground">
          Share this with the staff member; they&apos;ll reset it on first login.
        </p>
      </div>

      <Button type="submit" disabled={busy}>
        {busy ? "Creating…" : "Create account"}
      </Button>
    </form>
  );
}
