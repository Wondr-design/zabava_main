"use client";

import { FormEvent, useState } from 'react';

interface StaffInviteFormProps {
  onCreate: (payload: { email: string; name?: string; expiresInMinutes?: number }) => Promise<void> | void;
}

export function StaffInviteForm({ onCreate }: StaffInviteFormProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [expires, setExpires] = useState(60);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) {
      setError('Email is required');
      return;
    }
    try {
      setBusy(true);
      setError('');
      await onCreate({ email, name: name || undefined, expiresInMinutes: expires });
      setEmail('');
      setName('');
    } catch (err: any) {
      setError(err?.message || 'Failed to create invite');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Invite staff member</h3>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600">{error}</div>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none"
            required
          />
        </label>
        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Name (optional)
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none"
          />
        </label>
      </div>
      <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
        Expires in (minutes)
        <input
          type="number"
          min={30}
          max={60 * 24 * 30}
          value={expires}
          onChange={(e) => setExpires(Number(e.target.value) || 60)}
          className="mt-1 w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? 'Sending…' : 'Send invite'}
      </button>
    </form>
  );
}
