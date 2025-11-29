"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocalizedRouter } from "@/i18n/use-localized-router";
import {
  DesignButton,
  DesignFormField,
  DesignInput,
  SurfaceCard,
  StatusPill,
} from "@/components/design-system";
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
    <SurfaceCard className="space-y-6 rounded-3xl border border-[color:var(--ds-border-subtle)] p-6 shadow-[var(--ds-shadow-soft)]">
      <EmailVerification
        key={verificationKey}
        type="staff_signup"
        onVerified={handleEmailVerified}
        className="border border-white/10 bg-slate-950/40 text-white"
      />

      {presetToken ? (
        <div className="rounded-2xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] px-4 py-3 text-sm text-[color:var(--ds-text-muted)]">
          Invite detected. Complete the steps below to activate your staff access.
        </div>
      ) : (
        <div className="rounded-2xl border border-[color:var(--ds-danger)]/40 bg-[color:var(--ds-danger)]/10 px-4 py-3 text-sm text-[color:var(--ds-danger)]">
          We couldn’t find an invite token. Open the signup link directly from your invite email.
        </div>
      )}

      {emailVerified ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] px-4 py-3 text-sm text-[color:var(--ds-text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <span>
            Verified email:{" "}
            <span className="font-semibold text-[color:var(--ds-text-strong)]">
              {verifiedEmail}
            </span>
          </span>
          <DesignButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetVerification}
            className="self-start sm:self-auto"
          >
            Use a different email
          </DesignButton>
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)]/60 px-4 py-3 text-sm text-[color:var(--ds-text-muted)]">
          Verify your email with a one-time code to continue.
        </p>
      )}

      <form onSubmit={onSubmit} className="space-y-5">
        <header className="space-y-2">
          <h1 className="text-xl font-semibold text-[color:var(--ds-text-strong)]">
            Create your staff account
          </h1>
          <p className="text-sm text-[color:var(--ds-text-muted)]">
            Complete your invite by confirming the email and choosing a secure password.
          </p>
        </header>
        {error ? (
          <StatusPill tone="danger" className="w-full justify-center">
            {error}
          </StatusPill>
        ) : null}
        <DesignFormField label="Full name">
          <DesignInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
          />
        </DesignFormField>
        <DesignFormField
          label="Email"
          required
          helper={
            emailVerified
              ? "Verified via the emailed code."
              : "Complete the verification step above to populate this field."
          }
        >
          <DesignInput
            type="email"
            value={email}
            readOnly
            disabled={!emailVerified}
            autoComplete="email"
            placeholder="Verify your email above to continue"
          />
        </DesignFormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <DesignFormField label="Password" required className="sm:col-span-1">
            <DesignInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />
          </DesignFormField>
          <DesignFormField label="Confirm password" required className="sm:col-span-1">
            <DesignInput
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Re-enter password"
            />
          </DesignFormField>
        </div>
        <DesignButton
          type="submit"
          className="w-full"
          disabled={submitting || !emailVerified}
        >
          {submitting ? "Creating account…" : "Create account"}
        </DesignButton>
      </form>
    </SurfaceCard>
  );
}

export default function StaffSignupPage() {
  return (
    <Suspense
      fallback={
        <SurfaceCard className="rounded-3xl border border-[color:var(--ds-border-subtle)] p-6 text-[color:var(--ds-text-muted)]">
          Loading…
        </SurfaceCard>
      }
    >
      <StaffSignupInner />
    </Suspense>
  );
}
