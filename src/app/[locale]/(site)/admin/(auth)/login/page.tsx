"use client";

import { useEffect, useState } from "react";

import {
  DesignButton,
  DesignFormField,
  DesignInput,
  SurfaceCard,
} from "@/components/design-system";
import { ResetPasswordPanel } from "@/components/auth/reset-password-panel";
import { LocalizedLink } from "@/components/ui/localized-link";
import { useLocalizedRouter } from "@/i18n/use-localized-router";

export default function AdminLoginPage() {
  const router = useLocalizedRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showReset, setShowReset] = useState(false);

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

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setError("");
    setNotice(null);
    if (!email || !password) {
      setError("Enter both email and password");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          role: "admin",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Login failed");
      router.replace("/admin/dashboard");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Login failed";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleResetSuccess(resetEmail: string) {
    setShowReset(false);
    setNotice("Password updated. Please sign in with your new password.");
    setEmail(resetEmail);
    setPassword("");
    setError("");
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-[color:var(--ds-surface-base)] px-6 py-12">
      <SurfaceCard className="w-full max-w-2xl space-y-6 rounded-3xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-8 shadow-[var(--ds-shadow-soft)]">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-[color:var(--ds-text-strong)]">
            Admin login
          </h1>
          <p className="text-sm text-[color:var(--ds-text-muted)]">
            Sign in to the Zabava control centre.
          </p>
        </header>

        {error ? (
          <SurfaceCard className="rounded-2xl border border-[color:var(--ds-danger)]/40 bg-[color:var(--ds-danger)]/10 px-4 py-3 text-sm text-[color:var(--ds-danger)]">
            {error}
          </SurfaceCard>
        ) : null}

        {notice ? (
          <SurfaceCard className="rounded-2xl border border-[color:var(--ds-success)]/40 bg-[color:var(--ds-success)]/10 px-4 py-3 text-sm text-[color:var(--ds-success)]">
            {notice}
          </SurfaceCard>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-5">
          <DesignFormField label="Email" required>
            <DesignInput
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="admin@example.com"
            />
          </DesignFormField>

          <DesignFormField label="Password" required>
            <DesignInput
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Enter your password"
            />
          </DesignFormField>

          <DesignButton type="submit" disabled={submitting} className="w-full">
            {submitting ? "Signing in…" : "Sign in"}
          </DesignButton>
        </form>

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
            role="admin"
            onSuccess={handleResetSuccess}
            className="mt-2"
          />
        ) : null}

        <p className="text-sm text-[color:var(--ds-text-muted)]">
          Need an account?{" "}
          <LocalizedLink
            href="/admin/signup"
            className="font-medium text-[color:var(--ds-primary)] underline-offset-4 hover:underline"
          >
            Create one
          </LocalizedLink>
        </p>
      </SurfaceCard>
    </div>
  );
}
