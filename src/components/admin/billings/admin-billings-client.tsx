 "use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { adminApi } from "@/lib/web/api-client";
import { getCsrfToken } from "@/lib/web/csrf";
import { downloadBase64File } from "@/lib/web/download-base64";

type BillingItem = {
  partnerId: string;
  partnerName: string | null;
  billingEmail: string | null;
  contactEmail?: string | null;
  autoSendEnabled: boolean;
  autoSendDay?: number;
  commissionBasis: string;
  listingFeeAmount: number;
  listingFeeCurrency: string;
  listingOnly?: boolean;
  lastSentAt: string | null;
};

type BillingSummary = {
  visitGrossOriginal: number;
  visitGrossDiscounted: number;
  commissionBaseTotal: number;
  visitCommissionTotal: number;
  listingFeeAmount: number;
  listingFeeCurrency: string;
  commissionBasis: string;
  listingOnly: boolean;
  visitCount: number;
  flashDealCount: number;
  transportRideCount: number;
};

type BillingDetailState = {
  loading: boolean;
  dateFrom: string;
  dateTo: string;
  summary: BillingSummary | null;
  visits: Array<Record<string, unknown>>;
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
  const [details, setDetails] = useState<Record<string, BillingDetailState>>({});

  const sorted = useMemo(
    () => [...items].sort((a, b) => (a.partnerName || "").localeCompare(b.partnerName || "")),
    [items],
  );

  // Lazy-load items from API on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await adminApi.billingList();
        if (!cancelled) setItems(res.items as BillingItem[]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load billing list");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  function ensureDetail(partnerId: string): BillingDetailState {
    const existing = details[partnerId];
    if (existing) return existing;
    const today = new Date();
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    return {
      loading: false,
      dateFrom: start.toISOString().slice(0, 10),
      dateTo: today.toISOString().slice(0, 10),
      summary: null,
      visits: [],
    };
  }

  function toIsoRange(dateStr?: string | null, endOfDay = false) {
    if (!dateStr) return undefined;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return endOfDay ? `${dateStr}T23:59:59.999Z` : `${dateStr}T00:00:00.000Z`;
    }
    return dateStr;
  }

  async function handleLoadDetails(partnerId: string) {
    const state = ensureDetail(partnerId);
    setDetails((prev) => ({ ...prev, [partnerId]: { ...state, loading: true } }));
    try {
      const res = await adminApi.billingSettingsGet(
        partnerId,
        {
          summary: true,
          dateFrom: toIsoRange(state.dateFrom),
          dateTo: toIsoRange(state.dateTo, true),
        },
        { headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined },
      );
      setDetails((prev) => ({
        ...prev,
        [partnerId]: {
          ...state,
          loading: false,
          summary: (res.summary as BillingSummary) ?? null,
          visits: (res.visits as Array<Record<string, unknown>>) ?? [],
        },
      }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load details");
      setDetails((prev) => ({ ...prev, [partnerId]: { ...state, loading: false } }));
    }
  }

  async function handleSend(partnerId: string) {
    const target = items.find((i) => i.partnerId === partnerId);
    const resolvedEmail = target?.billingEmail || target?.contactEmail;
    if (!resolvedEmail) {
      toast.error("Add a billing or contact email before sending.");
      return;
    }
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
          autoSendDay: payload.autoSendDay,
          commissionBasis: payload.commissionBasis,
        },
        { headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined },
      );
      toast.success("Billing settings updated");
      setItems((prev) =>
        prev.map((item) =>
          item.partnerId === partnerId
            ? {
                ...item,
                billingEmail: payload.billingEmail ?? item.billingEmail,
                autoSendEnabled: payload.autoSendEnabled ?? item.autoSendEnabled,
                autoSendDay: payload.autoSendDay ?? item.autoSendDay,
                commissionBasis: payload.commissionBasis ?? item.commissionBasis,
              }
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
                    defaultValue={item.billingEmail ?? item.contactEmail ?? ""}
                    onBlur={(e) =>
                      handleSaveSettings(item.partnerId, { billingEmail: e.target.value || null })
                    }
                    placeholder="billing@partner.com"
                  />
                  {!item.billingEmail && item.contactEmail ? (
                    <span className="text-xs text-muted-foreground">
                      Using contact email: {item.contactEmail}
                    </span>
                  ) : null}
                </div>
                {!item.billingEmail && !item.contactEmail ? (
                  <p className="text-xs text-amber-600">
                    No contact email found. Please add one before sending.
                  </p>
                ) : null}
              </div>
              <div className="grid gap-3 rounded-lg border border-muted px-3 py-2">
                <div className="flex items-center justify-between">
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
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Day</Label>
                  <Input
                    type="number"
                    min={1}
                    max={28}
                    defaultValue={item.autoSendDay ?? 1}
                    onBlur={(e) =>
                      handleSaveSettings(item.partnerId, {
                        autoSendDay: Number(e.target.value) || 1,
                      })
                    }
                    className="w-24"
                  />
                </div>
              </div>
              <div className="grid gap-3 rounded-lg border border-muted px-3 py-2">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold text-foreground">Commission basis</p>
                  <select
                    defaultValue={item.commissionBasis}
                    onChange={(e) =>
                      handleSaveSettings(item.partnerId, {
                        commissionBasis: e.target.value as string,
                      })
                    }
                    className="w-full rounded-md border border-muted bg-transparent px-2 py-1 text-sm"
                    disabled={saving === item.partnerId}
                  >
                    <option value="discounted">Discounted</option>
                    <option value="original">Original</option>
                  </select>
                </div>
                <div className="rounded-lg border border-dashed border-muted bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  <p>
                    Listing only: <strong>{item.listingOnly ? "Yes" : "No"}</strong>
                  </p>
                  <p>
                    Listing fee: {item.listingFeeAmount.toLocaleString()} {item.listingFeeCurrency}
                  </p>
                  <p>Edit listing-only status and fee in Partner → Financials.</p>
                </div>
                <div className="text-xs text-muted-foreground">
                  <p>Commission basis: {item.commissionBasis}</p>
                  {item.lastSentAt ? (
                    <p>Last sent: {format(new Date(item.lastSentAt), "PP")}</p>
                  ) : (
                    <p>Never sent</p>
                  )}
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-muted px-3 py-2">
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Date from</Label>
                    <Input
                      type="date"
                      defaultValue={ensureDetail(item.partnerId).dateFrom}
                      onChange={(e) =>
                        setDetails((prev) => ({
                          ...prev,
                          [item.partnerId]: {
                            ...ensureDetail(item.partnerId),
                            ...(prev[item.partnerId] ?? {}),
                            dateFrom: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Date to</Label>
                    <Input
                      type="date"
                      defaultValue={ensureDetail(item.partnerId).dateTo}
                      onChange={(e) =>
                        setDetails((prev) => ({
                          ...prev,
                          [item.partnerId]: {
                            ...ensureDetail(item.partnerId),
                            ...(prev[item.partnerId] ?? {}),
                            dateTo: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleLoadDetails(item.partnerId)}
                  disabled={details[item.partnerId]?.loading}
                  className="inline-flex items-center gap-2"
                >
                  {details[item.partnerId]?.loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Load details
                </Button>
                {details[item.partnerId]?.summary ? (
                  <div className="rounded-lg border border-muted p-3 text-sm space-y-1">
                    <p>
                      Gross (original):{" "}
                      {details[item.partnerId]!.summary!.visitGrossOriginal.toLocaleString()}{" "}
                      {details[item.partnerId]!.summary!.listingFeeCurrency}
                    </p>
                    <p>
                      Gross (discounted):{" "}
                      {details[item.partnerId]!.summary!.visitGrossDiscounted.toLocaleString()}{" "}
                      {details[item.partnerId]!.summary!.listingFeeCurrency}
                    </p>
                    <p>
                      Commission base:{" "}
                      {details[item.partnerId]!.summary!.commissionBaseTotal.toLocaleString()}{" "}
                      {details[item.partnerId]!.summary!.listingFeeCurrency}
                    </p>
                    <p>
                      Commission:{" "}
                      {details[item.partnerId]!.summary!.visitCommissionTotal.toLocaleString()}{" "}
                      {details[item.partnerId]!.summary!.listingFeeCurrency}
                    </p>
                    <p>
                      Listing fee: {details[item.partnerId]!.summary!.listingFeeAmount.toLocaleString()}{" "}
                      {details[item.partnerId]!.summary!.listingFeeCurrency}
                    </p>
                    <p>
                      Visits: {details[item.partnerId]!.summary!.visitCount} · Flash deals:{" "}
                      {details[item.partnerId]!.summary!.flashDealCount} · Transport rides:{" "}
                      {details[item.partnerId]!.summary!.transportRideCount}
                    </p>
                    <p>
                      Commission basis: {details[item.partnerId]!.summary!.commissionBasis} · Listing
                      only: {details[item.partnerId]!.summary!.listingOnly ? "Yes" : "No"}
                    </p>
                  </div>
                ) : null}
                {details[item.partnerId]?.visits?.length ? (
                  <div className="max-h-64 overflow-auto rounded-lg border border-muted">
                    <table className="min-w-full text-xs">
                      <thead className="bg-muted/30">
                        <tr>
                          <th className="px-2 py-1 text-left">Visit</th>
                          <th className="px-2 py-1 text-left">Visited</th>
                          <th className="px-2 py-1 text-left">Original</th>
                          <th className="px-2 py-1 text-left">Discounted</th>
                          <th className="px-2 py-1 text-left">Commission</th>
                        </tr>
                      </thead>
                      <tbody>
                        {details[item.partnerId]!.visits!.map((v, idx) => (
                          <tr key={idx} className="border-b border-muted/40">
                            <td className="px-2 py-1">{String(v.id ?? "—")}</td>
                            <td className="px-2 py-1 text-muted-foreground">
                              {v.visitedAt ? String(v.visitedAt).slice(0, 10) : "—"}
                            </td>
                            <td className="px-2 py-1">
                              {v.originalTotalPrice !== undefined ? Number(v.originalTotalPrice).toLocaleString() : "—"}
                            </td>
                            <td className="px-2 py-1">
                              {v.totalPrice !== undefined ? Number(v.totalPrice).toLocaleString() : "—"}
                            </td>
                            <td className="px-2 py-1">
                              {v.commissionAmount !== undefined ? Number(v.commissionAmount).toLocaleString() : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={details[item.partnerId]?.loading}
                    onClick={async () => {
                      const state = details[item.partnerId];
                      if (!state) return;
                      try {
                        const res = await adminApi.billingDownload(
                          item.partnerId,
                          {
                            dateFrom: toIsoRange(state.dateFrom),
                            dateTo: toIsoRange(state.dateTo, true),
                          },
                          { headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined },
                        );
                        downloadBase64File(
                          res.files.csv.base64,
                          res.files.csv.filename,
                          res.files.csv.contentType,
                        );
                        downloadBase64File(
                          res.files.xlsx.base64,
                          res.files.xlsx.filename,
                          res.files.xlsx.contentType,
                        );
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Download failed");
                      }
                    }}
                    className="text-xs"
                  >
                    Download CSV/XLSX
                  </Button>
                </div>
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
