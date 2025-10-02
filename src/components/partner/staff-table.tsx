"use client";

import { useState } from 'react';
import { format } from 'date-fns';

export interface StaffListItem {
  id: string;
  email: string;
  name: string | null;
  status: 'active' | 'inactive' | 'revoked';
  created_at: string;
  last_login_at: string | null;
}

interface StaffTableProps {
  items: StaffListItem[];
  onStatusChange: (staff: StaffListItem, nextStatus: 'active' | 'inactive') => Promise<void> | void;
  onDelete: (staff: StaffListItem) => Promise<void> | void;
  loading?: boolean;
}

export function StaffTable({ items, onStatusChange, onDelete, loading }: StaffTableProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function handleStatus(staff: StaffListItem) {
    const nextStatus = staff.status === 'active' ? 'inactive' : 'active';
    try {
      setBusyId(staff.id);
      setError('');
      await onStatusChange(staff, nextStatus);
    } catch (err: any) {
      setError(err?.message || 'Failed to update staff status');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(staff: StaffListItem) {
    if (!confirm(`Remove ${staff.email}?`)) return;
    try {
      setBusyId(staff.id);
      setError('');
      await onDelete(staff);
    } catch (err: any) {
      setError(err?.message || 'Failed to remove staff');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Team members</h2>
        {loading && <span className="text-sm text-slate-500">Refreshing…</span>}
      </div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm text-slate-700">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Last login</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-900">
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  No staff members yet.
                </td>
              </tr>
            )}
            {items.map((staff) => {
              const lastLogin = staff.last_login_at ? format(new Date(staff.last_login_at), 'PP p') : 'Never';
              const disabled = busyId === staff.id;
              const activateLabel = staff.status === 'active' ? 'Deactivate' : 'Activate';
              return (
                <tr key={staff.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{staff.name || '—'}</td>
                  <td className="px-4 py-3">{staff.email}</td>
                  <td className="px-4 py-3 capitalize">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        staff.status === 'active'
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          : staff.status === 'inactive'
                          ? 'bg-amber-100 text-amber-700 border border-amber-200'
                          : 'bg-red-100 text-red-700 border border-red-200'
                      }`}
                    >
                      {staff.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{lastLogin}</td>
                  <td className="space-x-2 px-4 py-3 text-right">
                    <button
                      onClick={() => handleStatus(staff)}
                      disabled={disabled}
                      className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-700 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {disabled ? 'Saving…' : activateLabel}
                    </button>
                    <button
                      onClick={() => handleDelete(staff)}
                      disabled={disabled}
                      className="rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 transition hover:border-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Remove
                    </button>
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
