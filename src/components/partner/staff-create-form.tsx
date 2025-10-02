"use client";

import { FormEvent, useState } from 'react';

interface StaffCreateFormProps {
  onCreate: (payload: { email: string; name?: string; password: string }) => Promise<void> | void;
}

export function StaffCreateForm({ onCreate }: StaffCreateFormProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }

    try {
      setBusy(true);
      setError('');
      await onCreate({ email, name: name || undefined, password });
      setEmail('');
      setName('');
      setPassword('');
    } catch (err: any) {
      setError(err?.message || 'Failed to create staff account');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Create staff account</h3>
      <p className="text-xs text-slate-500">Creates a login immediately using the password you provide.</p>
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
        Temporary password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none"
          required
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? 'Creating…' : 'Create account'}
      </button>
    </form>
  );
}
