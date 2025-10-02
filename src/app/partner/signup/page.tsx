"use client";

import { Suspense, useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function SignupInner() {
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
    // If already authenticated via cookies, just go to dashboard (middleware would also protect)
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError("");
    const em = email.trim().toLowerCase();
    const pw = password.trim();
    const tk = token.trim();
    if (!tk) { setError("Invite token is required"); return; }
    if (!em || !pw) { setError("Email and password are required"); return; }
    if (pw.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (pw !== confirmPassword.trim()) { setError("Passwords do not match"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em, password: pw, token: tk, name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Signup failed");
      router.replace("/partner/dashboard");
    } catch (err: any) {
      setError(err.message || "Signup failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-md space-y-4 border rounded-xl p-6 bg-card">
        <h1 className="text-xl font-semibold">Partner Signup</h1>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <div className="space-y-2">
          <label className="block text-sm">Invite token</label>
          <input className="w-full rounded border border-input px-3 py-2 bg-background text-foreground" value={token} onChange={(e) => setToken(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <label className="block text-sm">Work email</label>
            <input className="w-full rounded border border-input px-3 py-2 bg-background text-foreground" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="block text-sm">Full name</label>
            <input className="w-full rounded border border-input px-3 py-2 bg-background text-foreground" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <label className="block text-sm">Password</label>
            <input className="w-full rounded border border-input px-3 py-2 bg-background text-foreground" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="block text-sm">Confirm</label>
            <input className="w-full rounded border border-input px-3 py-2 bg-background text-foreground" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
        </div>
        <button disabled={submitting} className="w-full rounded bg-primary text-primary-foreground py-2 disabled:opacity-60 hover:bg-primary/90">
          {submitting ? "Creating account..." : "Create account"}
        </button>
      </form>
    </div>
  );
}

export default function PartnerSignupPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <SignupInner />
    </Suspense>
  );
}
