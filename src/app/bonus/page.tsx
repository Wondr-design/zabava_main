"use client";

import { useCallback, useState } from "react";
import { format } from "date-fns";
import { bonusApi } from "@/lib/web/api-client";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";

interface BonusData {
  user?: { totalPoints?: number; availablePoints?: number };
  availableRewards?: Array<{
    id: string;
    name: string;
    pointsCost: number;
    canRedeem?: boolean;
  }>;
}

interface DebugData {
  pointsHistory?: Array<{
    id?: string;
    type?: string;
    points?: number;
    created_at?: string;
    partner_id?: string | null;
    partner_name?: string | null;
    visit_id?: string | null;
    meta?: Record<string, unknown>;
  }>;
  redemptions?: Array<{
    code?: string;
    status?: string;
    created_at?: string;
    used_at?: string | null;
    expires_at?: string | null;
    partner_id?: string | null;
    reward_id?: string;
  }>;
}

export default function BonusPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<BonusData | null>(null);
  const [debug, setDebug] = useState<DebugData | null>(null);
  const [success, setSuccess] = useState<string>("");

  const fetchPoints = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    setError("");
    setSuccess("");
    if (!silent) {
      setData(null);
      setDebug(null);
    }
    if (!email) {
      if (!silent) setError("Enter email");
      return;
    }
    if (!silent) setLoading(true);
    try {
      const lower = email.trim().toLowerCase();
      const [userPointsRes, debugRes] = await Promise.all([
        bonusApi.userPoints(lower) as Promise<BonusData>,
        bonusApi.debugUser(lower) as Promise<DebugData>,
      ]);
      setData(userPointsRes);
      setDebug(debugRes);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load";
      setError(message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [email]);

  async function redeem(rewardId: string) {
    if (!email) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = (await bonusApi.redeemReward(
        email.trim().toLowerCase(),
        rewardId
      )) as { message?: string };
      setSuccess(res?.message || "Redeemed");
      await fetchPoints({ silent: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Redeem failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const { refreshing: autoRefreshing } = useAutoRefresh(
    useCallback(async () => {
      await fetchPoints({ silent: true });
    }, [fetchPoints]),
    { enabled: Boolean(email) }
  );

  function fmtDate(iso?: string | null) {
    if (!iso) return "—";
    try {
      return format(new Date(iso), "yyyy-MM-dd HH:mm");
    } catch {
      return iso as string;
    }
  }

  const availablePoints = data?.user?.availablePoints ?? 0;
  const nextRewardCost = Math.min(
    ...(data?.availableRewards || [])
      .filter(
        (r) =>
          typeof r.pointsCost === "number" &&
          (r.canRedeem === false || availablePoints < (r.pointsCost || 0))
      )
      .map((r) => r.pointsCost || Infinity)
  );

  const needMore = Number.isFinite(nextRewardCost)
    ? Math.max(0, nextRewardCost - availablePoints)
    : 0;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Bonus Points</h1>

      <div className="space-y-2">
        <label className="block text-sm">Email</label>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded border px-3 py-2 bg-white/80 text-black"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
          />
          <button
            onClick={() => fetchPoints()}
            disabled={loading || autoRefreshing}
            className="rounded bg-blue-600 text-white px-4 py-2 disabled:opacity-60"
          >
            {loading || autoRefreshing ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {success && <p className="text-sm text-emerald-500">{success}</p>}

      {data && (
        <div className="space-y-4">
          <div className="border rounded-xl p-4 space-y-2">
            <p>
              Total Points:{" "}
              <strong>{(data.user?.totalPoints ?? 0).toLocaleString()}</strong>
            </p>
            <p>
              Available Points:{" "}
              <strong>{availablePoints.toLocaleString()}</strong>
            </p>
            {Number.isFinite(nextRewardCost) && nextRewardCost !== Infinity && (
              <div className="text-sm text-black/80">
                {needMore > 0 ? (
                  <span>
                    Need <strong>{needMore.toLocaleString()} pts</strong> to
                    reach the next reward ({nextRewardCost.toLocaleString()}{" "}
                    pts)
                  </span>
                ) : (
                  <span>You can redeem at least one reward</span>
                )}
              </div>
            )}
          </div>

          <div className="border rounded-xl p-4">
            <h2 className="font-semibold mb-2">Available Rewards</h2>
            <ul className="space-y-2">
              {(data.availableRewards ?? []).map((r) => {
                const can =
                  r.canRedeem !== false &&
                  availablePoints >= (r.pointsCost || 0);
                const diff = Math.max(0, (r.pointsCost || 0) - availablePoints);
                return (
                  <li
                    key={r.id}
                    className="flex items-center justify-between border rounded-lg p-3"
                  >
                    <div>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-sm text-black/70">
                        {r.pointsCost.toLocaleString()} pts
                      </div>
                      {!can && diff > 0 && (
                        <div className="text-xs text-black/60">
                          Need {diff.toLocaleString()} more pts
                        </div>
                      )}
                    </div>
                    <button
                      disabled={!can}
                      onClick={() => redeem(r.id)}
                      className="rounded bg-emerald-600 text-white px-3 py-1 disabled:opacity-50"
                    >
                      Redeem
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {debug && Array.isArray(debug.pointsHistory) && (
            <div className="border rounded-xl p-4">
              <h2 className="font-semibold mb-2">Points history</h2>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-black/5">
                    <tr>
                      <th className="text-left p-2">When</th>
                      <th className="text-left p-2">Type</th>
                      <th className="text-left p-2">Points</th>
                      <th className="text-left p-2">Partner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debug.pointsHistory!.map((p, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{fmtDate(p.created_at)}</td>
                        <td className="p-2">{p.type || "—"}</td>
                        <td className="p-2">
                          {(p.points ?? 0).toLocaleString()}
                        </td>
                        <td className="p-2">
                          {p.partner_name || p.partner_id || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {debug && Array.isArray(debug.redemptions) && (
            <div className="border rounded-xl p-4">
              <h2 className="font-semibold mb-2">Redemptions</h2>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-black/5">
                    <tr>
                      <th className="text-left p-2">Code</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Created</th>
                      <th className="text-left p-2">Used</th>
                      <th className="text-left p-2">Expires</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(debug.redemptions ?? []).map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{r.code || "—"}</td>
                        <td className="p-2">{r.status || "—"}</td>
                        <td className="p-2">{fmtDate(r.created_at)}</td>
                        <td className="p-2">{fmtDate(r.used_at)}</td>
                        <td className="p-2">{fmtDate(r.expires_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Visits preview if present */}
          {(data?.visits ?? []).length > 0 && (
            <div className="border rounded-xl p-4">
              <h2 className="font-semibold mb-2">Recent Visits</h2>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-black/5">
                    <tr>
                      <th className="text-left p-2">Partner</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Points</th>
                      <th className="text-left p-2">Created</th>
                      <th className="text-left p-2">Visited</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.visits ?? [])
                      .slice(0, 20)
                      .map((v: VisitSummary, i: number) => (
                        <tr key={i} className="border-t">
                          <td className="p-2">
                            {v.partnerId || v.partner || "—"}
                          </td>
                          <td className="p-2">{v.status || "—"}</td>
                          <td className="p-2">
                            {v.pointsEarned ?? v.estimatedPoints ?? 0}
                          </td>
                          <td className="p-2">
                            {v.visitDate || v.createdAt || "—"}
                          </td>
                          <td className="p-2">
                            {v.confirmedDate || v.visitedAt || "—"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
