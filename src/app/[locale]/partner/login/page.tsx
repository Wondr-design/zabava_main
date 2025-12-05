"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocalizedRouter } from "@/i18n/use-localized-router";
import { useEmailVerification } from "@/hooks/use-email-verification";
import { AuthLayout } from "@/components/auth/auth-layout";
import {
  AuthAlert,
  AuthInput,
  AuthSubmitButton,
  EmailVerificationSection,
} from "@/components/auth/auth-form";
import { ResetPasswordPanel } from "@/components/auth/reset-password-panel";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function PartnerLoginPage() {
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
  } = useEmailVerification({ type: "partner_login" });

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  const isEmailVerified =
    Boolean(verifiedAt) &&
    verifiedEmail?.toLowerCase() === normalizedEmail &&
    normalizedEmail.length > 0;

  useEffect(() => {
    if (verifiedEmail && verifiedEmail.toLowerCase() !== normalizedEmail) {
      resetVerification();
      setCodeInput("");
    }
  }, [normalizedEmail, verifiedEmail, resetVerification]);

  const handleRequestCode = async () => {
    if (!normalizedEmail) {
      setError("Enter your email before requesting a code.");
      return;
    }
    setError("");
    await requestCode(normalizedEmail);
    setNotice("Verification code sent. Check your inbox.");
  };

  const handleVerifyCode = async () => {
    if (!codeInput.trim()) {
      setError("Enter the verification code we emailed you.");
      return;
    }
    setError("");
    const ok = await verifyCode(codeInput.trim());
    if (ok) {
      setNotice("Email verified. Continue signing in.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setNotice(null);

    if (!email || !password) {
      setError("Enter both email and password");
      return;
    }
    if (!isEmailVerified) {
      setError("Verify the code we emailed you before signing in.");
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
          role: "partner",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Login failed");
      router.replace("/partner/dashboard");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetSuccess = (resetEmail: string) => {
    setShowReset(false);
    setNotice("Password updated. Sign in with your new password.");
    setEmail(resetEmail);
    setPassword("");
    setError("");
  };

  return (
    <AuthLayout
      variant="partner"
      title="Partner Sign In"
      description="Access your dashboard to manage visits, redemptions, and your venue."
      brandTitle="Partner Portal"
      brandDescription="Manage your venue, track customer visits, and grow your business with powerful analytics and tools."
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <AuthAlert type="error" message={error} />}
        {notice && <AuthAlert type="success" message={notice} />}

        <EmailVerificationSection
          email={email}
          onEmailChange={setEmail}
          codeInput={codeInput}
          onCodeChange={setCodeInput}
          isVerified={isEmailVerified}
          verifiedEmail={verifiedEmail}
          expiresAt={expiresAt}
          verificationError={verificationError}
          onRequestCode={handleRequestCode}
          onVerifyCode={handleVerifyCode}
          onReset={() => {
            resetVerification();
            setCodeInput("");
          }}
          codeRequesting={codeRequesting}
          codeVerifying={codeVerifying}
        />

        <AuthInput
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="Enter your password"
          required
          autoComplete="current-password"
          icon="password"
        />

        <AuthSubmitButton loading={submitting} loadingText="Signing in...">
          Sign in
        </AuthSubmitButton>
      </form>

      {/* Password reset toggle */}
      <div className="mt-6">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setShowReset((prev) => !prev);
            setError("");
          }}
          className="h-auto p-0 text-sm font-normal text-muted-foreground hover:text-foreground"
        >
          {showReset ? (
            <>
              Hide password reset <ChevronUp className="ml-1 h-3 w-3" />
            </>
          ) : (
            <>
              Forgot password? <ChevronDown className="ml-1 h-3 w-3" />
            </>
          )}
        </Button>

        {showReset && (
          <div className="mt-4">
            <ResetPasswordPanel role="partner" onSuccess={handleResetSuccess} />
          </div>
        )}
      </div>

      {/* Info text */}
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Need access? Contact your administrator for an invite.
      </p>
    </AuthLayout>
  );
}
