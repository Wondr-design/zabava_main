"use client";

import { useCallback, useState } from "react";

type VerificationType =
  | "visit"
  | "bonus"
  | "generic"
  | "admin_signup"
  | "partner_signup"
  | "staff_signup"
  | "admin_password_reset"
  | "partner_password_reset"
  | "staff_password_reset";

interface UseEmailVerificationOptions {
  type: VerificationType;
  partnerId?: string;
  requestEndpoint?: string;
  verifyEndpoint?: string;
}

export function useEmailVerification(options: UseEmailVerificationOptions) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestCode = useCallback(
    async (nextEmail: string) => {
      if (!nextEmail) return;
      setRequesting(true);
      setError(null);
      try {
        const res = await fetch(options.requestEndpoint ?? "/api/auth/request-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: nextEmail,
            type: options.type,
            partnerId: options.partnerId,
          }),
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as {
            message?: string;
            error?: string;
          };
          throw new Error(
            payload?.message || payload?.error || "Unable to send code."
          );
        }
        const json = (await res.json()) as { expiresAt?: string };
        setEmail(nextEmail);
        setExpiresAt(json.expiresAt ?? null);
        setCode("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to send code.");
      } finally {
        setRequesting(false);
      }
    },
    [options.partnerId, options.type, options.requestEndpoint]
  );

  const verifyCode = useCallback(
    async (value: string) => {
      if (!email || !value) return false;
      setVerifying(true);
      setError(null);
      try {
        const res = await fetch(options.verifyEndpoint ?? "/api/auth/verify-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            code: value,
            type: options.type,
            partnerId: options.partnerId,
          }),
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as {
            reason?: string;
            error?: string;
          };
          const reason = payload?.reason ?? payload?.error ?? "Invalid code.";
          throw new Error(
            reason === "mismatch"
              ? "Invalid code. Check the email we sent you."
              : reason === "expired"
              ? "Code expired. Request a new one."
              : reason === "too_many_attempts"
              ? "Too many attempts. Request a new code."
              : reason
          );
        }
        const json = (await res.json()) as {
          verifiedAt?: string | null;
          alreadyVerified?: boolean;
        };
        setCode(value);
        setVerifiedAt(json.verifiedAt ?? new Date().toISOString());
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to verify code.");
        return false;
      } finally {
        setVerifying(false);
      }
    },
    [email, options.partnerId, options.type, options.verifyEndpoint]
  );

  const reset = useCallback(() => {
    setEmail("");
    setCode("");
    setExpiresAt(null);
    setVerifiedAt(null);
    setError(null);
  }, []);

  return {
    email,
    setEmail,
    code,
    setCode,
    requesting,
    verifying,
    expiresAt,
    verifiedAt,
    error,
    requestCode,
    verifyCode,
    reset,
  };
}
