"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PartnerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError("");
    if (!email || !password) {
      setError("Enter both email and password");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password, role: "partner" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Login failed");
      router.replace("/partner/dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 border rounded-xl p-6 bg-white/5">
        <h1 className="text-xl font-semibold">Partner Login</h1>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="space-y-2">
          <label className="block text-sm">Email</label>
          <input className="w-full rounded border px-3 py-2 bg-white/80 text-black" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="block text-sm">Password</label>
          <input className="w-full rounded border px-3 py-2 bg-white/80 text-black" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button disabled={submitting} className="w-full rounded bg-emerald-600 text-white py-2 disabled:opacity-60">
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
