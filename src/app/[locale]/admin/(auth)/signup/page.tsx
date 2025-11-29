"use client";

import { useEffect, useState } from "react";

import {
  DesignButton,
  DesignFormField,
  DesignInput,
  SurfaceCard,
} from "@/components/design-system";
import { EmailVerification } from "@/site/components/email-verification";
import { LocalizedLink } from "@/components/ui/localized-link";
import { useLocalizedRouter } from "@/i18n/use-localized-router";

export default function AdminSignupPage() {
  const router = useLocalizedRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [verificationKey, setVerificationKey] = useState(0);

  const emailVerified = Boolean(verifiedEmail);

  useEffect(() => {
    const roleCookie = document.cookie
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("zabava_role="));
    const role = roleCookie ? roleCookie.split("=")[1] : "";
    if (role === "admin") {
      router.replace("/admin/dashboard");
    }
  }, [router]);

  function handleEmailVerified(value: string) {
    const normalized = value.trim().toLowerCase();
    setEmail(normalized);
    setVerifiedEmail(normalized);
    setError(null);
  }

  function handleResetVerification() {
    setVerifiedEmail(null);
    setEmail("");
    setSuccess(null);
    setError(null);
    setVerificationKey((key) => key + 1);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSuccess(null);

    const normalizedEmail = email.trim().toLowerCase();

    if (!emailVerified || !verifiedEmail || normalizedEmail !== verifiedEmail) {
      setError("Verify your email before creating an account.");
      return;
    }

    if (!normalizedEmail || !password) {
      setError("Email and password are required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/admin/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          password,
          name: name.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "Unable to create account. Please try again.",
        );
      }
      setSuccess("Account created. Redirecting…");
      setTimeout(() => {
        router.replace("/admin/dashboard");
      }, 500);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to create account.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-[color:var(--ds-surface-base)] px-6 py-12">
      <SurfaceCard className="w-full max-w-xl space-y-6 rounded-3xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-8 shadow-[var(--ds-shadow-soft)]">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-[color:var(--ds-text-strong)]">
            Create admin account
          </h1>
          <p className="text-sm text-[color:var(--ds-text-muted)]">
            Use this form to provision a new administrator for the control centre.
          </p>
        </header>

        {error ? (
          <SurfaceCard className="rounded-2xl border border-[color:var(--ds-danger)]/40 bg-[color:var(--ds-danger)]/10 px-4 py-3 text-sm text-[color:var(--ds-danger)]">
            {error}
          </SurfaceCard>
        ) : null}

        {success ? (
          <SurfaceCard className="rounded-2xl border border-[color:var(--ds-success)]/40 bg-[color:var(--ds-success)]/10 px-4 py-3 text-sm text-[color:var(--ds-success)]">
            {success}
          </SurfaceCard>
        ) : null}

        <EmailVerification
          key={verificationKey}
          type="admin_signup"
          onVerified={handleEmailVerified}
          className="border border-white/10 bg-slate-950/40 text-white"
        />

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
            Verify your email with a one-time code to unlock the rest of the form.
          </p>
        )}

        <form onSubmit={onSubmit} className="space-y-5">
          <DesignFormField label="Name" helper="Optional">
            <DesignInput
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ada Lovelace"
              autoComplete="name"
            />
          </DesignFormField>

          <DesignFormField
            label="Email"
            required
            helper={
              emailVerified
                ? "Verified via the code sent to your inbox."
                : "Complete the verification step above to populate this field."
            }
          >
            <DesignInput
              type="email"
              value={email}
              readOnly
              disabled={!emailVerified}
              placeholder="Verify your email above to continue"
              autoComplete="email"
            />
          </DesignFormField>

          <DesignFormField label="Password" required helper="Minimum 8 characters.">
            <DesignInput
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
            />
          </DesignFormField>

          <DesignFormField label="Confirm password" required>
            <DesignInput
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
            />
          </DesignFormField>

          <DesignButton
            type="submit"
            disabled={submitting || !emailVerified}
            className="w-full"
          >
            {submitting ? "Creating account…" : "Create account"}
          </DesignButton>
        </form>

        <p className="text-sm text-[color:var(--ds-text-muted)]">
          Already have access?{" "}
          <LocalizedLink
            href="/admin/login"
            className="font-medium text-[color:var(--ds-primary)] underline-offset-4 hover:underline"
          >
            Sign in instead
          </LocalizedLink>
        </p>
      </SurfaceCard>
    </div>
  );
}
