"use client";

import { useState } from "react";
import { partnerApi } from "@/lib/web/api-client";
import type { RedemptionCheckResponse } from "@/lib/data/redemptions";
import {
  DesignButton,
  DesignInput,
  StatusPill,
  SurfaceCard,
} from "@/components/design-system";

export function RedemptionProcessor({ partnerId: _partnerId }: { partnerId: string }) {
  void _partnerId;
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [data, setData] = useState<RedemptionCheckResponse | null>(null);

  async function check() {
    if (!code.trim()) { setError("Enter a code"); return; }
    setLoading(true); setError(""); setSuccess(""); setData(null);
    try {
      const res = await partnerApi.checkRedemption(code.trim(), {});
      setData(res);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to check code";
      setError(message);
    } finally { setLoading(false); }
  }

  async function act(action: 'process' | 'reject') {
    if (!code.trim()) return;
    setProcessing(true); setError(""); setSuccess("");
    try {
      await partnerApi.processRedemption(code.trim(), action, {});
      const message = action === 'process' ? `Processed ${code}` : `Rejected ${code}`;
      setSuccess(message);
      setData(null); setCode("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Action failed";
      setError(message);
    } finally { setProcessing(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <DesignInput
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Enter redemption code"
          className="sm:flex-1"
          autoComplete="off"
        />
        <DesignButton
          type="button"
          onClick={check}
          disabled={loading || !code.trim()}
          className="sm:w-auto"
        >
          {loading ? "Checking…" : "Check"}
        </DesignButton>
      </div>

      {error ? (
        <SurfaceCard className="rounded-2xl border border-[color:var(--ds-danger)]/40 bg-[color:var(--ds-danger)]/10 px-4 py-3 text-sm text-[color:var(--ds-danger)]">
          {error}
        </SurfaceCard>
      ) : null}
      {success ? (
        <SurfaceCard className="rounded-2xl border border-[color:var(--ds-success)]/40 bg-[color:var(--ds-success)]/15 px-4 py-3 text-sm text-[color:var(--ds-success)]">
          {success}
        </SurfaceCard>
      ) : null}

      {data ? (
        <SurfaceCard className="space-y-4 rounded-2xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[color:var(--ds-text-muted)]">
            <span className="font-medium text-[color:var(--ds-text-strong)]">
              {data.redemption?.code ?? code}
            </span>
            <StatusPill
              tone={
                data.redemption?.status === "used"
                  ? "success"
                  : data.redemption?.status === "rejected"
                  ? "danger"
                  : "warning"
              }
              size="sm"
            >
              {data.redemption?.status ?? "unknown"}
            </StatusPill>
          </div>

          <div className="space-y-3 text-sm text-[color:var(--ds-text-strong)]">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ds-text-subtle)]">
                Reward
              </p>
              <p className="font-medium">
                {data.reward?.name ||
                  data.redemption?.rewardName ||
                  "Unknown reward"}
                {typeof data.reward?.pointsCost === "number" ||
                typeof data.redemption?.pointsCost === "number" ? (
                  <span className="text-xs text-[color:var(--ds-text-muted)]">
                    {" "}
                    (
                    {(
                      data.reward?.pointsCost ??
                      data.redemption?.pointsCost ??
                      0
                    ).toLocaleString()}{" "}
                    pts)
                  </span>
                ) : null}
              </p>
            </div>

            {data.reward?.description ? (
              <SurfaceCard className="rounded-xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-3 text-xs text-[color:var(--ds-text-muted)]">
                <strong className="block text-[color:var(--ds-text-subtle)]">
                  Description
                </strong>
                <p className="mt-1 whitespace-pre-line">
                  {data.reward.description}
                </p>
              </SurfaceCard>
            ) : null}

            {data.reward?.instructions ? (
              <SurfaceCard className="rounded-xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-3 text-xs text-[color:var(--ds-text-muted)]">
                <strong className="block text-[color:var(--ds-text-subtle)]">
                  Partner instructions
                </strong>
                <p className="mt-1 whitespace-pre-line">
                  {data.reward.instructions}
                </p>
              </SurfaceCard>
            ) : null}

            <div className="space-y-1 text-sm text-[color:var(--ds-text-muted)]">
              <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--ds-text-subtle)]">
                Booking
              </p>
              <p className="font-medium text-[color:var(--ds-text-strong)]">
                {data.booking?.email ?? "—"}
              </p>
              <p>{data.booking?.ticketType ?? "—"}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <DesignButton
              type="button"
              variant="primary"
              size="sm"
              onClick={() => act("process")}
              disabled={!data.canProcess || processing}
            >
              Process
            </DesignButton>
            <DesignButton
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => act("reject")}
              disabled={processing}
            >
              Reject
            </DesignButton>
          </div>
        </SurfaceCard>
      ) : null}
    </div>
  );
}
