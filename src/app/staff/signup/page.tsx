"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function StaffSignupInner() {
  const router = useRouter();
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

  useEffect(() => {
    setEmail(presetEmail);
    setToken(presetToken);
    setName(presetName);
  }, [presetEmail, presetToken, presetName]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const normalizedEmail = email.trim().toLowerCase();
    const pw = password.trim();
    const confirm = confirmPassword.trim();
    const inviteToken = token.trim();
    if (!inviteToken) {
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
    if (pw !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          password: pw,
          token: inviteToken,
          name: name.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Signup failed");
      router.replace("/staff/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Signup failed";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-slate-950 px-6 py-12">
      <form onSubmit={onSubmit} className="w-full max-w-md space-y-4 rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-xl">
        <h1 className="text-xl font-semibold text-white">Create your staff account</h1>
        <p className="text-sm text-slate-400">
          Complete your invite by confirming the email and choosing a secure password.
        </p>
        {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Invite token
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
              required
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Full name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
            />
          </label>
        </div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
            required
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
              required
              minLength={8}
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Confirm password
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
              required
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-400 disabled:opacity-60"
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>
    </div>
  );
}

export default function StaffSignupPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-300">Loading…</div>}>
      <StaffSignupInner />
    </Suspense>
  );
}
