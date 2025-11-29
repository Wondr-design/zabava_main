"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocalizedRouter } from "@/i18n/use-localized-router";
import {
  DesignButton,
  DesignFormField,
  DesignInput,
  SurfaceCard,
  StatusPill,
} from "@/components/design-system";
import { ResetPasswordPanel } from "@/components/auth/reset-password-panel";
import { useEmailVerification } from "@/hooks/use-email-verification";

export default function StaffLoginPage() {
  const router = useLocalizedRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showReset, setShowReset] = useState(false);
  const {
    email: verifiedEmail,
    requestCode,
    requesting: codeRequesting,
    verifyCode,
    verifying: codeVerifying,
    verifiedAt,
    expiresAt,
    error: verificationError,
    reset: resetVerification,
  } = useEmailVerification({ type: "staff_login" });

  const normalizedEmail = useMemo(
    () => email.trim().toLowerCase(),
    [email],
  );
  const isEmailVerified =
    Boolean(verifiedAt) &&
    verifiedEmail?.toLowerCase() === normalizedEmail &&
    normalizedEmail.length > 0;

  useEffect(() => {
    if (
      verifiedEmail &&
      verifiedEmail.toLowerCase() !== normalizedEmail
    ) {
      resetVerification();
      setCodeInput("");
    }
  }, [normalizedEmail, verifiedEmail, resetVerification]);

  async function handleRequestCode() {
    if (!normalizedEmail) {
      setError("Enter your email before requesting a code.");
      return;
    }
    setError("");
    await requestCode(normalizedEmail);
    setNotice("Verification code sent. Check your inbox.");
  }

  async function handleVerifyCode() {
    if (!codeInput.trim()) {
      setError("Enter the verification code we emailed you.");
      return;
    }
    setError("");
    const ok = await verifyCode(codeInput.trim());
    if (ok) {
      setNotice("Email verified. Continue signing in.");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!email || !password) {
      setError("Enter both email and password");
      return;
    }
    if (!isEmailVerified) {
      setError("Verify the code we emailed you before signing in.");
      return;
    }
    setSubmitting(true);
    setError("");
    setNotice(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          role: "staff",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Login failed");
      router.replace("/staff/console");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleResetSuccess(resetEmail: string) {
    setShowReset(false);
    setNotice("Password updated. Sign in with your new password.");
    setEmail(resetEmail);
    setPassword("");
    setError("");
  }

  return (
    <SurfaceCard className="w-full max-w-2xl rounded-3xl border border-[color:var(--ds-border-subtle)] p-6 shadow-[var(--ds-shadow-soft)]">
      <form onSubmit={onSubmit} className="space-y-5">
        <header className="space-y-2">
          <h1 className="text-xl font-semibold text-[color:var(--ds-text-strong)]">
            Staff login
          </h1>
          <p className="text-sm text-[color:var(--ds-text-muted)]">
            Use the email and password created during your invite onboarding.
          </p>
        </header>
        {error ? (
          <StatusPill tone="danger" className="w-full justify-center">
            {error}
          </StatusPill>
        ) : null}
        {notice ? (
          <StatusPill tone="success" className="w-full justify-center">
            {notice}
          </StatusPill>
        ) : null}
        <DesignFormField label="Email" required>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <DesignInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="name@example.com"
              disabled={codeRequesting}
            />
            <DesignButton
              type="button"
              variant="secondary"
              onClick={handleRequestCode}
              disabled={codeRequesting || !normalizedEmail.length}
            >
              {codeRequesting ? "Sending…" : "Send code"}
            </DesignButton>
          </div>
          {verificationError ? (
            <p className="text-xs text-[color:var(--ds-danger)] mt-2">
              {verificationError}
            </p>
          ) : null}
          {expiresAt && !isEmailVerified ? (
            <p className="text-xs text-[color:var(--ds-text-muted)] mt-1">
              Code expires at {new Date(expiresAt).toLocaleTimeString()}
            </p>
          ) : null}
          {isEmailVerified ? (
            <p className="text-xs text-[color:var(--ds-success)] mt-1">
              Email verified.
            </p>
          ) : null}
        </DesignFormField>
        <DesignFormField label="Verification code" required>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <DesignInput
              type="text"
              inputMode="numeric"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="Enter the code"
              maxLength={8}
              disabled={isEmailVerified}
            />
            <DesignButton
              type="button"
              variant="secondary"
              onClick={handleVerifyCode}
              disabled={
                isEmailVerified ||
                codeVerifying ||
                !codeInput.trim() ||
                !normalizedEmail.length
              }
            >
              {codeVerifying ? "Verifying…" : isEmailVerified ? "Verified" : "Verify"}
            </DesignButton>
          </div>
        </DesignFormField>
        <DesignFormField label="Password" required>
          <DesignInput
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="••••••••"
          />
        </DesignFormField>
        <DesignButton type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </DesignButton>
        <p className="text-xs text-[color:var(--ds-text-muted)]">
          Need access? Ask your partner admin for a new staff invite link.
        </p>
        <button
          type="button"
          onClick={() => {
            setShowReset((prev) => !prev);
            setError("");
          }}
          className="text-sm font-medium text-[color:var(--ds-primary)] underline-offset-4 hover:underline"
        >
          {showReset ? "Hide password reset" : "Forgot password?"}
        </button>
        {showReset ? (
          <ResetPasswordPanel
            role="staff"
            onSuccess={handleResetSuccess}
            className="mt-2"
          />
        ) : null}
      </form>
    </SurfaceCard>
  );
}
