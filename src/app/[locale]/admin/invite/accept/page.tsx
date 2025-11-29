"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { useLocalizedRouter } from "@/i18n/use-localized-router";
import { useEmailVerification } from "@/hooks/use-email-verification";

type InviteStatus = "pending" | "expired" | "accepted";

interface InviteDetails {
  id: string;
  email: string;
  inviterEmail: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  status: InviteStatus;
}

export default function AdminInviteAcceptPage() {
  const router = useLocalizedRouter();
  const params = useSearchParams();
  const token = params?.get("token") ?? "";

  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const {
    email: verificationEmail,
    requestCode,
    requesting: codeRequesting,
    verifyCode,
    verifying: codeVerifying,
    verifiedAt,
    expiresAt,
    error: verificationError,
    reset: resetVerification,
  } = useEmailVerification({ type: "admin_signup" });

  const normalizedInviteEmail = invite?.email?.trim().toLowerCase() ?? "";
  const isEmailVerified =
    Boolean(verifiedAt) &&
    normalizedInviteEmail.length > 0 &&
    verificationEmail?.toLowerCase() === normalizedInviteEmail;

  useEffect(() => {
    resetVerification();
    setCodeInput("");
    setNotice(null);
  }, [normalizedInviteEmail, resetVerification]);

  useEffect(() => {
    async function loadInvite() {
      if (!token) {
        setError("Invite token missing.");
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/auth/admin/invite?token=${encodeURIComponent(token)}`);
        const body = await res.json();
        if (!res.ok) {
          throw new Error(body?.error || "Unable to load invite.");
        }
        setInvite(body.invite);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unable to load invite.";
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    void loadInvite();
  }, [token]);

  async function onAccept(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !invite) return;
    if (submitting) return;
    setError(null);
    setNotice(null);

    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!isEmailVerified) {
      setError("Verify the invite email before creating an account.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password,
          name: name.trim() || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error || "Unable to accept invite.");
      }
      setSuccess("Invite accepted. Redirecting…");
      setTimeout(() => {
        router.replace("/admin/dashboard");
      }, 500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unable to accept invite.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
          <h1 className="text-xl font-semibold text-foreground">Admin invite</h1>
          <p className="mt-3 text-sm text-destructive">Invite token is missing.</p>
        </div>
      </div>
    );
  }

  async function handleRequestCode() {
    if (!normalizedInviteEmail) {
      setError("Invite email missing. Contact your administrator.");
      return;
    }
    setError(null);
    setNotice(null);
    await requestCode(normalizedInviteEmail);
    setNotice("Verification code sent. Check your email.");
  }

  async function handleVerifyCode() {
    if (!normalizedInviteEmail) {
      setError("Invite email missing. Contact your administrator.");
      return;
    }
    if (!codeInput.trim()) {
      setError("Enter the verification code we emailed you.");
      return;
    }
    const ok = await verifyCode(codeInput.trim());
    if (ok) {
      setNotice("Email verified. Finish setting up your account.");
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-border bg-card p-6 shadow-xl">
        <h1 className="text-xl font-semibold text-foreground">Accept admin invite</h1>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading invite…</p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {invite ? (
          <div className="space-y-2 rounded-xl border border-border/80 bg-muted/40 p-3 text-sm">
            <p>
              <span className="text-muted-foreground">Invited email:</span>{" "}
              <span className="font-medium text-foreground">{invite.email}</span>
            </p>
            {invite.inviterEmail ? (
              <p>
                <span className="text-muted-foreground">Invited by:</span>{" "}
                <span className="font-medium text-foreground">{invite.inviterEmail}</span>
              </p>
            ) : null}
            <p>
              <span className="text-muted-foreground">Expires:</span>{" "}
              <span className="font-medium text-foreground">
                {new Date(invite.expiresAt).toLocaleString()}
              </span>
            </p>
            <p>
              <span className="text-muted-foreground">Status:</span>{" "}
              <span className="font-medium text-foreground capitalize">{invite.status}</span>
            </p>
          </div>
        ) : null}

        {success ? <p className="text-sm text-emerald-500">{success}</p> : null}

        {notice ? <p className="text-sm text-emerald-500">{notice}</p> : null}
        {verificationError ? (
          <p className="text-sm text-destructive">{verificationError}</p>
        ) : null}
        {invite && invite.status === "pending" ? (
          <form className="space-y-4" onSubmit={onAccept}>
            <div className="space-y-3 rounded-xl border border-border/80 bg-muted/40 p-3 text-sm">
              <p className="text-muted-foreground">
                Verify <span className="font-medium text-foreground">{invite.email}</span> with a
                one-time code to unlock this form.
              </p>
              <div className="space-y-2">
                <label className="block text-xs font-medium uppercase text-muted-foreground">
                  Invite email
                </label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    className="flex-1 rounded border border-input bg-background px-3 py-2 text-sm text-foreground"
                    value={invite.email}
                    readOnly
                  />
                  <button
                    type="button"
                    onClick={handleRequestCode}
                    disabled={codeRequesting || !normalizedInviteEmail.length || isEmailVerified}
                    className="rounded bg-muted px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted/80 disabled:opacity-60"
                  >
                    {codeRequesting ? "Sending…" : isEmailVerified ? "Code sent" : "Send code"}
                  </button>
                </div>
                {expiresAt && !isEmailVerified ? (
                  <p className="text-xs text-muted-foreground">
                    Code expires at {new Date(expiresAt).toLocaleTimeString()}.
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium uppercase text-muted-foreground">
                  Verification code
                </label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    className="flex-1 rounded border border-input bg-background px-3 py-2 text-sm text-foreground"
                    type="text"
                    inputMode="numeric"
                    placeholder="Enter the emailed code"
                    value={codeInput}
                    maxLength={8}
                    onChange={(event) => setCodeInput(event.target.value)}
                    disabled={isEmailVerified}
                  />
                  <button
                    type="button"
                    onClick={handleVerifyCode}
                    disabled={
                      isEmailVerified || codeVerifying || codeInput.trim().length === 0
                    }
                    className="rounded bg-muted px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted/80 disabled:opacity-60"
                  >
                    {codeVerifying ? "Verifying…" : isEmailVerified ? "Verified" : "Verify"}
                  </button>
                </div>
                {isEmailVerified ? (
                  <p className="text-xs font-medium text-emerald-500">
                    Email verified. Continue below.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Request and enter the code sent to {invite.email} to enable account creation.
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm text-muted-foreground" htmlFor="invite-name">
                Name (optional)
              </label>
              <input
                id="invite-name"
                className="w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm text-muted-foreground" htmlFor="invite-password">
                Password
              </label>
              <input
                id="invite-password"
                className="w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="space-y-2">
              <label
                className="block text-sm text-muted-foreground"
                htmlFor="invite-password-confirm"
              >
                Confirm password
              </label>
              <input
                id="invite-password-confirm"
                className="w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <button
              disabled={submitting || !isEmailVerified}
              className="w-full rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
            >
              {submitting ? "Creating account…" : "Create account"}
            </button>
          </form>
        ) : null}

        <div className="text-sm text-muted-foreground">
          <p>
            Need help? Contact the administrator who invited you or{" "}
            <Link className="font-medium text-primary hover:text-primary/80" href="/admin/login">
              <span>return to login</span>
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
