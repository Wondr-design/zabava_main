"use client";

import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const actionSchema = z.object({
  token: z.string().min(10),
  email: z.string().email(),
  partnerId: z.string().min(1),
  visitId: z.string().uuid().optional(),
  visitDate: z.string().optional(),
  notes: z.string().optional(),
});

export function PartnerVisitActions() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [visitId, setVisitId] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [checkResponse, setCheckResponse] =
    useState<Record<string, unknown> | null>(null);
  const [confirmation, setConfirmation] =
    useState<Record<string, unknown> | null>(null);

  async function callPartnerEndpoint(
    path: string,
    body: Record<string, unknown>,
  ) {
    const res = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      throw new Error(errorBody.error || "Request failed");
    }

    return (await res.json()) as Record<string, unknown>;
  }

  async function handleCheck() {
    try {
      const payload = actionSchema.pick({
        token: true,
        email: true,
        partnerId: true,
      }).parse({
        token,
        email,
        partnerId,
      });
      setIsChecking(true);
      setCheckResponse(null);

      const json = await callPartnerEndpoint("/api/partner/visit", {
        email: payload.email,
        partnerId: payload.partnerId,
      });
      setCheckResponse(json);
      toast.success("Visit status fetched");
    } catch (err) {
      console.error("partner visit check failed", err);
      toast.error(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setIsChecking(false);
    }
  }

  async function handleConfirm() {
    try {
      const payload = actionSchema.parse({
        token,
        email,
        partnerId,
        visitId,
        visitDate,
        notes,
      });
      setIsConfirming(true);
      setConfirmation(null);

      const json = await callPartnerEndpoint("/api/partner/mark-visited", {
        email: payload.email,
        partnerId: payload.partnerId,
        visitId: payload.visitId || undefined,
        visitDate: payload.visitDate || undefined,
        notes: payload.notes || undefined,
      });
      setConfirmation(json);
      toast.success("Visit marked as visited");
    } catch (err) {
      console.error("partner mark-visited failed", err);
      toast.error(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Partner visit actions</CardTitle>
        <CardDescription>Use a partner JWT to check or confirm visits associated with your partner ID.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="partner-jwt">Partner JWT</Label>
            <Textarea
              id="partner-jwt"
              rows={3}
              placeholder="Paste partner token"
              value={token}
              onChange={(event) => setToken(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">Paste the token generated with JWT_SECRET.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="guest-email">Guest email <span className="text-destructive">*</span></Label>
            <Input
              id="guest-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="partner-id">Partner ID <span className="text-destructive">*</span></Label>
            <Input
              id="partner-id"
              value={partnerId}
              onChange={(event) => setPartnerId(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="visit-id">Visit ID</Label>
            <Input
              id="visit-id"
              value={visitId}
              onChange={(event) => setVisitId(event.target.value)}
              placeholder="UUID from registration"
            />
            <p className="text-xs text-muted-foreground">Optional; provide to target a specific registration.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="visit-date">Visit date (ISO)</Label>
            <Input
              id="visit-date"
              value={visitDate}
              onChange={(event) => setVisitDate(event.target.value)}
              placeholder="2025-12-31T18:30:00.000Z"
            />
            <p className="text-xs text-muted-foreground">Optional</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Context, shift details, or clarifications."
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={handleCheck}
            disabled={isChecking || !token}
          >
            {isChecking ? "Checking…" : "Check visit"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleConfirm}
            disabled={isConfirming || !token}
          >
            {isConfirming ? "Submitting…" : "Mark as visited"}
          </Button>
        </div>

        {checkResponse ? (
          <Card className="space-y-2 rounded-lg bg-muted p-4 text-sm text-muted-foreground">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Check response
            </p>
            <pre className="whitespace-pre-wrap break-all font-mono text-xs text-foreground">
              {JSON.stringify(checkResponse, null, 2)}
            </pre>
          </Card>
        ) : null}

        {confirmation ? (
          <Card className="space-y-2 rounded-lg bg-muted p-4 text-sm text-muted-foreground">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Confirmation response
            </p>
            <pre className="whitespace-pre-wrap break-all font-mono text-xs text-foreground">
              {JSON.stringify(confirmation, null, 2)}
            </pre>
          </Card>
        ) : null}
      </CardContent>
    </Card>
  );
}
