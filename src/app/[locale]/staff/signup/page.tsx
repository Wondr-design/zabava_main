"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocalizedRouter } from "@/i18n/use-localized-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmailVerification } from "@/site/components/email-verification";

function StaffSignupInner() {
  const router = useLocalizedRouter();
  const params = useSearchParams();
  const presetEmail = useMemo(() => params.get("email") || "", [params]);
  const presetToken = useMemo(() => params.get("token") || "", [params]);
  const presetName = useMemo(() => params.get("name") || "", [params]);

  const [email, setEmail] = useState(presetEmail);
  const [name, setName] = useState(presetName);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [verificationKey, setVerificationKey] = useState(0);

  const emailVerified = Boolean(verifiedEmail);

  useEffect(() => {
    setEmail(presetEmail);
    // token is sourced from search params; no user editing required
    setName(presetName);
    setVerifiedEmail(null);
    setVerificationKey((key) => key + 1);
  }, [presetEmail, presetToken, presetName]);

  function handleEmailVerified(value: string) {
    const normalized = value.trim().toLowerCase();
    setEmail(normalized);
    setVerifiedEmail(normalized);
    setError("");
  }

  function handleResetVerification() {
    setVerifiedEmail(null);
    setEmail("");
    setError("");
    setVerificationKey((key) => key + 1);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const normalizedEmail = email.trim().toLowerCase();
    const pw = password.trim();
    const confirm = confirmPassword.trim();
    const inviteToken = presetToken.trim();
    if (!emailVerified || !verifiedEmail || normalizedEmail !== verifiedEmail) {
      setError("Verify your email before creating an account.");
      return;
    }
    if (!inviteToken) {
      setError("Invite token is required");
      return;
    }
    if (!normalizedEmail || !pw) {
      setError("Email and password are required");
      return;
    }
    if (pw.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (pw !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          password: pw,
          token: inviteToken,
          name: name.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Signup failed");
      router.replace("/staff/console");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Signup failed";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="space-y-6 rounded-lg p-6">
      <EmailVerification
        key={verificationKey}
        type="staff_signup"
        onVerified={handleEmailVerified}
        className="border border-white/10 bg-slate-950/40 text-white"
      />

      {presetToken ? (
        <div className="rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          Invite detected. Complete the steps below to activate your staff access.
        </div>
      ) : (
        <Alert variant="destructive">
          <AlertDescription>
            We couldn&apos;t find an invite token. Open the signup link directly from your invite email.
          </AlertDescription>
        </Alert>
      )}

      {emailVerified ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Verified email:{" "}
            <span className="font-semibold text-foreground">
              {verifiedEmail}
            </span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetVerification}
            className="self-start sm:self-auto"
          >
            Use a different email
          </Button>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
          Verify your email with a one-time code to continue.
        </p>
      )}

      <form onSubmit={onSubmit} className="space-y-5">
        <header className="space-y-2">
          <h1 className="text-xl font-semibold text-foreground">
            Create your staff account
          </h1>
          <p className="text-sm text-muted-foreground">
            Complete your invite by confirming the email and choosing a secure password.
          </p>
        </header>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">
            Email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            readOnly
            disabled={!emailVerified}
            autoComplete="email"
            placeholder="Verify your email above to continue"
          />
          <p className="text-xs text-muted-foreground">
            {emailVerified
              ? "Verified via the emailed code."
              : "Complete the verification step above to populate this field."}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="password">
              Password <span className="text-destructive">*</span>
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">
              Confirm password <span className="text-destructive">*</span>
            </Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Re-enter password"
            />
          </div>
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={submitting || !emailVerified}
        >
          {submitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </Card>
  );
}

export default function StaffSignupPage() {
  return (
    <Suspense
      fallback={
        <Card className="rounded-lg p-6 text-muted-foreground">
          Loading…
        </Card>
      }
    >
      <StaffSignupInner />
    </Suspense>
  );
}
