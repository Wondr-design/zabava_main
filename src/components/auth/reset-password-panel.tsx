"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { KeyRound, RotateCcw, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmailVerification } from "@/site/components/email-verification";
import { cn } from "@/lib/utils";
import {
  AuthInput,
  AuthAlert,
  AuthVerificationStatus,
} from "@/components/auth/auth-form";

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

  const handleVerified = (email: string, code: string) => {
    setVerifiedEmail(email);
    setVerifiedCode(code);
    setError(null);
    setSuccess("Email verified. Choose a new password below.");
  };

  const resetFlow = () => {
    setVerifiedEmail(null);
    setVerifiedCode(null);
    setPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccess(null);
    setSubmitting(false);
    setVerificationKey((key) => key + 1);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
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
            : "Unable to reset password."
        );
      }

      setSuccess(
        "Password updated. You can now sign in with your new password."
      );
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
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-muted/30",
        className
      )}
    >
      <div className="p-5 space-y-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-foreground/10">
            <KeyRound className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Reset your password
            </h3>
            <p className="text-sm text-muted-foreground">
              Verify your email to receive a reset code, then set a new password.
            </p>
          </div>
        </div>

        {/* Alerts */}
        <AnimatePresence mode="wait">
          {error && <AuthAlert type="error" message={error} />}
          {success && <AuthAlert type="success" message={success} />}
        </AnimatePresence>

        {/* Email Verification */}
        <div className="space-y-4">
          <EmailVerification
            key={verificationKey}
            type={RESET_VERIFICATION_TYPE[role]}
            onVerified={handleVerified}
            className="rounded-lg border border-border bg-background p-4"
          />

          {verifiedEmail && (
            <AuthVerificationStatus
              verified={true}
              email={verifiedEmail}
              onReset={resetFlow}
            />
          )}
        </div>

        {/* Password Form */}
        <AnimatePresence mode="wait">
          {verifiedEmail ? (
            <motion.form
              key="password-form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <AuthInput
                  id="new-password"
                  label="New password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  placeholder="Minimum 8 characters"
                  required
                  autoComplete="new-password"
                  icon="password"
                />

                <AuthInput
                  id="confirm-new-password"
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

              <div className="flex items-center gap-3">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-10 px-5 font-medium bg-foreground text-background hover:bg-foreground/90"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Update password
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetFlow}
                  className="h-10 text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Start over
                </Button>
              </div>
            </motion.form>
          ) : (
            <motion.div
              key="prompt"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/50 px-4 py-3"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                <span className="text-sm font-medium text-muted-foreground">1</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Verify your email address to unlock the password reset form.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
