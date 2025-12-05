"use client";

import { useEffect, useState } from "react";
import { useLocalizedRouter } from "@/i18n/use-localized-router";
import { LocalizedLink } from "@/components/ui/localized-link";
import { AuthLayout } from "@/components/auth/auth-layout";
import {
  AuthAlert,
  AuthInput,
  AuthSubmitButton,
  AuthVerificationStatus,
} from "@/components/auth/auth-form";
import { EmailVerification } from "@/site/components/email-verification";

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

  const handleEmailVerified = (value: string) => {
    const normalized = value.trim().toLowerCase();
    setEmail(normalized);
    setVerifiedEmail(normalized);
    setError(null);
  };

  const handleResetVerification = () => {
    setVerifiedEmail(null);
    setEmail("");
    setSuccess(null);
    setError(null);
    setVerificationKey((key) => key + 1);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
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
            : "Unable to create account. Please try again."
        );
      }
      setSuccess("Account created. Redirecting...");
      setTimeout(() => {
        router.replace("/admin/dashboard");
      }, 500);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create account.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      variant="admin"
      title="Create admin account"
      description="Provision a new administrator for the control centre."
      brandTitle="Join the Team"
      brandDescription="Create your administrator account to help manage the Zabava platform and support our partner network."
    >
      <div className="space-y-6">
        {error && <AuthAlert type="error" message={error} />}
        {success && <AuthAlert type="success" message={success} />}

        {/* Email Verification */}
        <div className="space-y-4">
          <EmailVerification
            key={verificationKey}
            type="admin_signup"
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
              Verify your email with a one-time code to unlock the form.
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <AuthInput
            id="name"
            label="Full name"
            value={name}
            onChange={setName}
            placeholder="Ada Lovelace"
            autoComplete="name"
            icon="user"
            hint="Optional"
          />

          <AuthInput
            id="email"
            label="Email"
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
                ? "Verified via the code sent to your inbox."
                : "Complete verification above to populate this field."
            }
          />

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
            disabled={!emailVerified}
          >
            Create account
          </AuthSubmitButton>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have access?{" "}
          <LocalizedLink
            href="/admin/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Sign in instead
          </LocalizedLink>
        </p>
      </div>
    </AuthLayout>
  );
}
