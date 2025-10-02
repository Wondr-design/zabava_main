"use client";

import { useState } from "react";
import { partnerApi } from "@/lib/web/api-client";

interface RedemptionData {
  redemption?: {
    code: string;
    email: string;
    status: string;
    redeemedAt?: string;
    appliedAt?: string | null;
    usedAt?: string | null;
    expiresAt?: string | null;
    partnerId?: string | null;
  };
  reward?: {
    name: string;
    description?: string | null;
    category?: string | null;
    pointsValue: number;
    instructions?: string | null;
  } | null;
  booking?: {
    email?: string;
    visitDate?: string;
    partnerId?: string | null;
    ticketType?: string | null;
    numPeople?: number | null;
    hasVisited?: boolean;
    visitedAt?: string | null;
  } | null;
  isValid: boolean;
  canProcess: boolean;
}

export function RedemptionProcessor({ partnerId }: { partnerId: string }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [data, setData] = useState<RedemptionData | null>(null);

  async function check() {
    if (!code.trim()) { setError("Enter a code"); return; }
    setLoading(true); setError(""); setSuccess(""); setData(null);
    try {
      const res = await partnerApi.checkRedemption(code.trim(), {});
      setData(res as any);
    } catch (e: any) {
      setError(e.message || "Failed to check code");
    } finally { setLoading(false); }
  }

  async function act(action: 'process' | 'reject') {
    if (!code.trim()) return;
    setProcessing(true); setError(""); setSuccess("");
    try {
      await partnerApi.processRedemption(code.trim(), action, {});
      setSuccess(action === 'process' ? `Processed ${code}` : `Rejected ${code}`);
      setData(null); setCode("");
    } catch (e: any) {
      setError(e.message || "Action failed");
    } finally { setProcessing(false); }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Process redemptions</h2>
      <div className="flex gap-2">
        <input className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter redemption code" />
        <button onClick={check} disabled={loading || !code.trim()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60">
          {loading ? "Checking..." : "Check"}
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {success && <p className="text-sm text-emerald-600">{success}</p>}
      {data && (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-sm text-slate-700">
            <div><strong>Status:</strong> {data.redemption?.status || 'unknown'}</div>
            <div><strong>Reward:</strong> {data.reward?.name} ({data.reward?.pointsValue ?? 0} pts)</div>
            <div><strong>Booking:</strong> {data.booking?.email || '—'} · {data.booking?.ticketType || '—'}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => act('process')} disabled={!data.canProcess || processing} className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60">Process</button>
            <button onClick={() => act('reject')} disabled={processing} className="rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white shadow-sm transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60">Reject</button>
          </div>
        </div>
      )}
    </div>
  );
}
