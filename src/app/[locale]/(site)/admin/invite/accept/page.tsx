"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { useLocalizedRouter } from "@/i18n/use-localized-router";

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

    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
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

        {invite && invite.status === "pending" ? (
          <form className="space-y-4" onSubmit={onAccept}>
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
              disabled={submitting}
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
