import { useEffect, useState } from "react";

import {
  DesignButton,
  DesignFormField,
  DesignInput,
  StatusPill,
} from "@/components/design-system";
import { EmailVerification } from "@/site/components/email-verification";
import { cn } from "@/lib/utils";

type ResetRole = "admin" | "partner" | "staff";

const RESET_VERIFICATION_TYPE: Record<
  ResetRole,
  "admin_password_reset" | "partner_password_reset" | "staff_password_reset"
> = {
  admin: "admin_password_reset",
  partner: "partner_password_reset",
  staff: "staff_password_reset",
};

interface ResetPasswordPanelProps {
  role: ResetRole;
  className?: string;
  onSuccess?: (email: string) => void;
}

export function ResetPasswordPanel(props: ResetPasswordPanelProps) {
  const { role, className, onSuccess } = props;

  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [verifiedCode, setVerifiedCode] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verificationKey, setVerificationKey] = useState(0);

  useEffect(() => {
    setError(null);
    setSuccess(null);
  }, [role]);

  function handleVerified(email: string, code: string) {
    setVerifiedEmail(email);
    setVerifiedCode(code);
    setError(null);
    setSuccess("Email verified. Choose a new password below.");
  }

  function resetFlow() {
    setVerifiedEmail(null);
    setVerifiedCode(null);
    setPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccess(null);
    setSubmitting(false);
    setVerificationKey((key) => key + 1);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!verifiedEmail || !verifiedCode) {
      setError("Verify your email before resetting the password.");
      return;
    }

    if (submitting) return;
    setError(null);
    setSuccess(null);

    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: verifiedEmail,
          role,
          code: verifiedCode,
          password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "Unable to reset password.",
        );
      }

      setSuccess("Password updated. You can now sign in with your new password.");
      setPassword("");
      setConfirmPassword("");
      if (onSuccess) {
        onSuccess(verifiedEmail);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to reset password.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className={cn(
        "space-y-4 rounded-2xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)]/80 p-4",
        className,
      )}
    >
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-[color:var(--ds-text-strong)]">
          Forgot your password?
        </h3>
        <p className="text-sm text-[color:var(--ds-text-muted)]">
          Verify your email to receive a reset code. Once verified, you can set a new password.
        </p>
      </div>

      {error ? (
        <StatusPill tone="danger">{error}</StatusPill>
      ) : null}
      {success ? (
        <StatusPill tone="success">{success}</StatusPill>
      ) : null}

      <EmailVerification
        key={verificationKey}
        type={RESET_VERIFICATION_TYPE[role]}
        onVerified={handleVerified}
      />

      {verifiedEmail ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <DesignFormField label="New password" required>
            <DesignInput
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimum 8 characters"
              autoComplete="new-password"
            />
          </DesignFormField>
          <DesignFormField label="Confirm password" required>
            <DesignInput
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Re-enter new password"
              autoComplete="new-password"
            />
          </DesignFormField>
          <div className="flex flex-wrap items-center gap-3">
            <DesignButton
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Updating…" : "Update password"}
            </DesignButton>
            <DesignButton
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetFlow}
            >
              Start over
            </DesignButton>
          </div>
        </form>
      ) : (
        <p className="rounded-xl border border-dashed border-[color:var(--ds-border-subtle)] px-3 py-2 text-sm text-[color:var(--ds-text-muted)]">
          After verifying your email, you will be prompted to choose a new password.
        </p>
      )}
    </div>
  );
}
