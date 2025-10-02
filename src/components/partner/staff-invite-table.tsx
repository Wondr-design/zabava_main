"use client";

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

export interface StaffInviteItem {
  token: string;
  email: string | null;
  name: string | null;
  status: 'pending' | 'used' | 'revoked' | 'expired';
  expires_at: string | null;
  created_at: string;
  used_at: string | null;
}

interface StaffInviteTableProps {
  items: StaffInviteItem[];
  onCopy: (invite: StaffInviteItem) => void;
  onRevoke: (invite: StaffInviteItem) => Promise<void> | void;
}

export function StaffInviteTable({ items, onCopy, onRevoke }: StaffInviteTableProps) {
  const [busyToken, setBusyToken] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function handleRevoke(invite: StaffInviteItem) {
    if (!confirm('Revoke this invite?')) return;
    try {
      setBusyToken(invite.token);
      setError('');
      await onRevoke(invite);
    } catch (err: any) {
      setError(err?.message || 'Failed to revoke invite');
    } finally {
      setBusyToken(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Pending invites</h3>
        <span className="text-xs text-slate-500">{items.length} active</span>
      </div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600">{error}</div>}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm text-slate-700">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Expires</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-900">
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  No pending invites.
                </td>
              </tr>
            )}
            {items.map((invite) => {
              const expiresLabel = invite.expires_at
                ? formatDistanceToNow(new Date(invite.expires_at), { addSuffix: true })
                : 'No expiry';
              const disabled = busyToken === invite.token;
              return (
                <tr key={invite.token} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{invite.email || '—'}</div>
                    {invite.name && <div className="text-xs text-slate-500">{invite.name}</div>}
                  </td>
                  <td className="px-4 py-3 capitalize">{invite.status}</td>
                  <td className="px-4 py-3 text-slate-500">{expiresLabel}</td>
                  <td className="space-x-2 px-4 py-3 text-right">
                    <button
                      onClick={() => onCopy(invite)}
                      className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                    >
                      Copy link
                    </button>
                    {invite.status === 'pending' && (
                      <button
                        onClick={() => handleRevoke(invite)}
                        disabled={disabled}
                        className="rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 transition hover:border-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {disabled ? 'Working…' : 'Revoke'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
