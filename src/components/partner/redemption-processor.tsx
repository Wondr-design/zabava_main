"use client";

import { useState } from "react";
import { partnerApi } from "@/lib/web/api-client";
import type { RedemptionCheckResponse } from "@/lib/data/redemptions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
        <Input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Enter redemption code"
          className="sm:flex-1"
          autoComplete="off"
        />
        <Button
          type="button"
          onClick={check}
          disabled={loading || !code.trim()}
          className="sm:w-auto"
        >
          {loading ? "Checking…" : "Check"}
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {success ? (
        <Alert className="border-green-500/40 bg-green-500/10 text-green-600">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      ) : null}

      {data ? (
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {data.redemption?.code ?? code}
              </span>
              <Badge
                variant={
                  data.redemption?.status === "used"
                    ? "default"
                    : data.redemption?.status === "rejected"
                    ? "destructive"
                    : "secondary"
                }
                className={
                  data.redemption?.status === "used"
                    ? "bg-green-500/20 text-green-600 border-green-500/30"
                    : ""
                }
              >
                {data.redemption?.status ?? "unknown"}
              </Badge>
            </div>

            <div className="space-y-3 text-sm text-foreground">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  Reward
                </p>
                <p className="font-medium">
                  {data.reward?.name ||
                    data.redemption?.rewardName ||
                    "Unknown reward"}
                  {typeof data.reward?.pointsCost === "number" ||
                  typeof data.redemption?.pointsCost === "number" ? (
                    <span className="text-xs text-muted-foreground">
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
                <Card className="bg-muted/50">
                  <CardContent className="p-3 text-xs text-muted-foreground">
                    <strong className="block text-muted-foreground">
                      Description
                    </strong>
                    <p className="mt-1 whitespace-pre-line">
                      {data.reward.description}
                    </p>
                  </CardContent>
                </Card>
              ) : null}

              {data.reward?.instructions ? (
                <Card className="bg-muted/50">
                  <CardContent className="p-3 text-xs text-muted-foreground">
                    <strong className="block text-muted-foreground">
                      Partner instructions
                    </strong>
                    <p className="mt-1 whitespace-pre-line">
                      {data.reward.instructions}
                    </p>
                  </CardContent>
                </Card>
              ) : null}

              <div className="space-y-1 text-sm text-muted-foreground">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  Booking
                </p>
                <p className="font-medium text-foreground">
                  {data.booking?.email ?? "—"}
                </p>
                <p>{data.booking?.ticketType ?? "—"}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => act("process")}
                disabled={!data.canProcess || processing}
              >
                Process
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => act("reject")}
                disabled={processing}
              >
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
