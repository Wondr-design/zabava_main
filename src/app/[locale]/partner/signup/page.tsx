"use client";

import { Suspense, useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useLocalizedRouter } from "@/i18n/use-localized-router";
import { AuthLayout } from "@/components/auth/auth-layout";
import {
  AuthAlert,
  AuthInput,
  AuthSubmitButton,
  AuthVerificationStatus,
} from "@/components/auth/auth-form";
import { EmailVerification } from "@/site/components/email-verification";
import { AlertTriangle } from "lucide-react";

function PartnerSignupInner() {
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

  const handleEmailVerified = (value: string) => {
    const normalized = value.trim().toLowerCase();
    setEmail(normalized);
    setVerifiedEmail(normalized);
    setError("");
  };

  const handleResetVerification = () => {
    setVerifiedEmail(null);
    setEmail("");
    setError("");
    setVerificationKey((key) => key + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
    if (!tk) {
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
    if (pw !== confirmPassword.trim()) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          password: pw,
          token: tk,
          name: name.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Signup failed");
      router.replace("/partner/dashboard");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Signup failed";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      variant="partner"
      title="Activate your account"
      description="Complete your partner registration to access your venue dashboard."
      brandTitle="Welcome Aboard"
      brandDescription="Join our network of premium venues and start tracking customer visits, managing redemptions, and growing your business."
    >
      <div className="space-y-6">
        {error && <AuthAlert type="error" message={error} />}

        {/* Invite token status */}
        {hasInviteToken ? (
          <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-600">
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
            Invitation detected. Complete the steps below.
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              No invite token found. Open the signup link from your email invite
              or request a new one.
            </span>
          </div>
        )}

        {/* Email Verification */}
        <div className="space-y-4">
          <EmailVerification
            key={verificationKey}
            type="partner_signup"
            onVerified={handleEmailVerified}
            className="rounded-lg border border-border bg-muted/50 p-4"
          />

          {emailVerified ? (
            <AuthVerificationStatus
              verified={true}
              email={verifiedEmail}
              onReset={handleResetVerification}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              Verify your work email with a one-time code to continue.
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <AuthInput
              id="work-email"
              label="Work email"
              type="email"
              value={email}
              onChange={() => {}}
              placeholder="Verify your email above"
              required
              readOnly
              disabled={!emailVerified}
              autoComplete="email"
              icon="email"
              hint={
                emailVerified
                  ? "Verified via the emailed code."
                  : "Complete verification above."
              }
            />

            <AuthInput
              id="full-name"
              label="Full name"
              value={name}
              onChange={setName}
              placeholder="Your name"
              required
              autoComplete="name"
              icon="user"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <AuthInput
              id="password"
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="Create a password"
              required
              autoComplete="new-password"
              icon="password"
              hint="Minimum 8 characters"
            />

            <AuthInput
              id="confirm-password"
              label="Confirm password"
              type="password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Re-enter password"
              required
              autoComplete="new-password"
              icon="password"
            />
          </div>

          <AuthSubmitButton
            loading={submitting}
            loadingText="Creating account..."
            disabled={!emailVerified || !hasInviteToken}
          >
            Create account
          </AuthSubmitButton>
        </form>
      </div>
    </AuthLayout>
  );
}

export default function PartnerSignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <PartnerSignupInner />
    </Suspense>
  );
}
