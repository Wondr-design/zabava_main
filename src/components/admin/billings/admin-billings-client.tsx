 "use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Loader2, Send, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { adminApi } from "@/lib/web/api-client";
import { getCsrfToken } from "@/lib/web/csrf";

type BillingItem = {
  partnerId: string;
  partnerName: string | null;
  billingEmail: string | null;
  autoSendEnabled: boolean;
  commissionBasis: string;
  listingFeeAmount: number;
  listingFeeCurrency: string;
  lastSentAt: string | null;
};

export function AdminBillingsClient({
  initialItems,
  locale,
}: {
  initialItems: BillingItem[];
  locale: string;
}) {
  const [items, setItems] = useState<BillingItem[]>(initialItems);
  const [sending, setSending] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [csrfToken] = useState(() => getCsrfToken());

  const sorted = useMemo(
    () => [...items].sort((a, b) => (a.partnerName || "").localeCompare(b.partnerName || "")),
    [items],
  );

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  async function handleSend(partnerId: string) {
    setSending(partnerId);
    try {
      await adminApi.billingSend(
        partnerId,
        {},
        { headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined },
      );
      toast.success("Billing statement sent");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send billing");
    } finally {
      setSending(null);
    }
  }

  async function handleSaveSettings(partnerId: string, payload: Partial<BillingItem>) {
    setSaving(partnerId);
    try {
      await adminApi.billingSettingsUpdate(
        partnerId,
        {
          billingEmail: payload.billingEmail,
          autoSendEnabled: payload.autoSendEnabled,
        },
        { headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined },
      );
      toast.success("Billing settings updated");
      setItems((prev) =>
        prev.map((item) =>
          item.partnerId === partnerId
            ? { ...item, billingEmail: payload.billingEmail ?? item.billingEmail, autoSendEnabled: payload.autoSendEnabled ?? item.autoSendEnabled }
            : item,
        ),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update settings");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Billings
        </p>
        <h1 className="text-2xl font-bold leading-tight">Partner statements</h1>
        <p className="text-sm text-muted-foreground">
          Review partner billing contacts, auto-send preferences, and trigger statements manually.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {sorted.map((item) => (
          <Card key={item.partnerId} className="border-muted/60">
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-lg">{item.partnerName ?? item.partnerId}</CardTitle>
                <p className="text-xs text-muted-foreground">{item.partnerId}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={sending === item.partnerId}
                onClick={() => handleSend(item.partnerId)}
              >
                {sending === item.partnerId ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span className="ml-2">Send</span>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Email</Label>
                <div className="flex gap-2">
                  <Input
                    defaultValue={item.billingEmail ?? ""}
                    onBlur={(e) =>
                      handleSaveSettings(item.partnerId, { billingEmail: e.target.value || null })
                    }
                    placeholder="billing@partner.com"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-muted px-3 py-2">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Auto-send monthly</p>
                  <p className="text-xs text-muted-foreground">
                    Sends on the configured day each month.
                  </p>
                </div>
                <Switch
                  checked={item.autoSendEnabled}
                  onCheckedChange={(checked) =>
                    handleSaveSettings(item.partnerId, { autoSendEnabled: checked })
                  }
                  disabled={saving === item.partnerId}
                />
              </div>
              <div className="text-xs text-muted-foreground">
                <p>Commission basis: {item.commissionBasis}</p>
                <p>
                  Listing fee: {item.listingFeeAmount.toLocaleString()} {item.listingFeeCurrency}
                </p>
                {item.lastSentAt ? (
                  <p>Last sent: {format(new Date(item.lastSentAt), "PP")}</p>
                ) : (
                  <p>Never sent</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-muted p-6 text-sm text-muted-foreground">
          No partners found.
        </div>
      ) : null}
    </div>
  );
}
