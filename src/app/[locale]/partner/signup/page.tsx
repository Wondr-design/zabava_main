"use client";

import { Suspense, useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useLocalizedRouter } from "@/i18n/use-localized-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmailVerification } from "@/site/components/email-verification";

function SignupInner() {
  const router = useLocalizedRouter();
  const params = useSearchParams();
  const presetEmail = useMemo(() => params.get("email") || "", [params]);
  const presetToken = useMemo(() => params.get("token") || "", [params]);
  const presetName = useMemo(() => params.get("name") || "", [params]);

  const [email, setEmail] = useState(presetEmail);
  const [name, setName] = useState(presetName);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [token, setToken] = useState(presetToken);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [verificationKey, setVerificationKey] = useState(0);

  const emailVerified = Boolean(verifiedEmail);
  const hasInviteToken = token.trim().length > 0;

  useEffect(() => {
    setEmail(presetEmail);
    setName(presetName);
    setToken(presetToken);
    setVerifiedEmail(null);
    setVerificationKey((key) => key + 1);
  }, [presetEmail, presetName, presetToken]);

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
    setError("");
    const normalizedEmail = email.trim().toLowerCase();
    const pw = password.trim();
    const tk = token.trim();
    if (!emailVerified || !verifiedEmail || normalizedEmail !== verifiedEmail) {
      setError("Verify your email before creating an account.");
      return;
    }
    if (!tk) { setError("Invite token is required"); return; }
    if (!normalizedEmail || !pw) { setError("Email and password are required"); return; }
    if (pw.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (pw !== confirmPassword.trim()) { setError("Passwords do not match"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password: pw, token: tk, name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Signup failed");
      router.replace("/partner/dashboard");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Signup failed";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-background px-6 py-12">
      <Card className="w-full max-w-xl space-y-6 rounded-lg p-8">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">
            Activate your partner account
          </h1>
          <p className="text-sm text-muted-foreground">
            Use the invite token from Zabava to finish setting up access for your venue.
          </p>
        </header>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <EmailVerification
          key={verificationKey}
          type="partner_signup"
          onVerified={handleEmailVerified}
          className="border border-white/10 bg-slate-950/40 text-white"
        />

        {hasInviteToken ? (
          <div className="rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
            Invitation detected. Complete the steps below to activate your partner account.
          </div>
        ) : (
          <Alert variant="destructive">
            <AlertDescription>
              We couldn&apos;t find an invite token. Open the signup link from your email invite or request a new one.
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
            Verify your work email with a one-time code to continue.
          </p>
        )}

        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="work-email">
                Work email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="work-email"
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
            <div className="space-y-2">
              <Label htmlFor="full-name">
                Full name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="full-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                placeholder="Your name"
              />
            </div>
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
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="Create a password"
              />
              <p className="text-xs text-muted-foreground">Minimum 8 characters.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">
                Confirm password <span className="text-destructive">*</span>
              </Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="Re-enter password"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={submitting || !emailVerified}
            className="w-full"
          >
            {submitting ? "Creating account…" : "Create account"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

export default function PartnerSignupPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <SignupInner />
    </Suspense>
  );
}
