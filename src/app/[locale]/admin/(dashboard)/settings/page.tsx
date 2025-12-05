"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Settings, Clock, History, Coins } from "lucide-react";

import { adminApi } from "@/lib/web/api-client";
import { getCsrfToken } from "@/lib/web/csrf";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { TimezoneSettingRecord } from "@/lib/data/timezone-settings";

interface PointRatioHistoryItem {
  id: number;
  ratioCzk: number;
  createdBy: string | null;
  createdAt: string;
}

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ratioInput, setRatioInput] = useState("");
  const [activeRatio, setActiveRatio] = useState<number | null>(null);
  const [history, setHistory] = useState<PointRatioHistoryItem[]>([]);
  const [source, setSource] = useState<"default" | "database">("default");
  const [timeZoneInput, setTimeZoneInput] = useState("Europe/Prague");
  const [timeZoneSource, setTimeZoneSource] = useState<"admin" | "partner">("admin");
  const [timezoneHistory, setTimezoneHistory] = useState<TimezoneSettingRecord[]>([]);
  const [timezoneLoading, setTimezoneLoading] = useState(true);
  const [timezoneSaving, setTimezoneSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const response = await adminApi.pointRatioGet({});
        if (cancelled) return;
        setActiveRatio(response.ratioCzk);
        setRatioInput(String(response.ratioCzk));
        setSource(response.source);
        setHistory(response.history ?? []);
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : "Failed to load settings."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setTimezoneLoading(true);
        const response = await adminApi.timezoneSettingGet({});
        if (cancelled) return;
        setTimeZoneInput(response.adminTimeZone);
        setTimeZoneSource(response.source);
        setTimezoneHistory(response.history ?? []);
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : "Failed to load timezone settings.",
          );
        }
      } finally {
        if (!cancelled) {
          setTimezoneLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const lastUpdated = useMemo(() => {
    if (history.length === 0) return null;
    const latest = history[0];
    try {
      return formatDistanceToNow(new Date(latest.createdAt), {
        addSuffix: true,
      });
    } catch {
      return null;
    }
  }, [history]);

  function formatTimezoneLabel(value: string) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: value,
        timeZoneName: "short",
      }).formatToParts(new Date());
      const namePart = parts.find((part) => part.type === "timeZoneName")?.value ?? value;
      const normalized = namePart.replace(/^GMT/, "UTC");
      return `${normalized} · ${value}`;
    } catch {
      return value;
    }
  }

  function isValidTimezone(value: string) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
      return true;
    } catch {
      return false;
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const numeric = Number(ratioInput);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      toast.error("Enter a positive amount of CZK per point.");
      return;
    }
    try {
      setSaving(true);
      const response = await adminApi.pointRatioUpdate(
        { ratioCzk: numeric },
        {
          headers: { "x-csrf-token": getCsrfToken() },
        }
      );
      setActiveRatio(response.ratioCzk);
      setSource("database");
      const refreshed = await adminApi.pointRatioGet({});
      setHistory(refreshed.history ?? []);
      toast.success("Point ratio updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTimezoneSave(event: React.FormEvent) {
    event.preventDefault();
    if (timezoneSaving) return;
    const normalizedZone = timeZoneInput.trim();
    if (!isValidTimezone(normalizedZone)) {
      toast.error("Enter a valid IANA timezone identifier.");
      return;
    }
    try {
      setTimezoneSaving(true);
      await adminApi.timezoneSettingUpdate(
        { adminTimeZone: normalizedZone, source: timeZoneSource },
        { headers: { "x-csrf-token": getCsrfToken() } },
      );
      const refreshed = await adminApi.timezoneSettingGet({});
      setTimeZoneInput(refreshed.adminTimeZone);
      setTimeZoneSource(refreshed.source);
      setTimezoneHistory(refreshed.history ?? []);
      toast.success("Timezone settings updated.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save timezone settings.",
      );
    } finally {
      setTimezoneSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-foreground/10">
            <Settings className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Platform Settings
            </h1>
            <p className="text-sm text-muted-foreground">
              Configure how Zabava awards points and manages timezones.
            </p>
          </div>
        </div>
      </div>

      {/* Point Ratio Card */}
      <Card className="overflow-hidden border-border bg-card">
        <CardHeader className="border-b border-border bg-muted/30 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-foreground/10">
                <Coins className="h-4 w-4 text-foreground" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-foreground">
                  Point Ratio
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Define how many Czech Crowns translate into one reward point.
                </CardDescription>
              </div>
            </div>
            <Badge
              variant="secondary"
              className="shrink-0 font-medium"
            >
              {source === "database" ? "Custom" : "Default"}
            </Badge>
          </div>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="p-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Input Section */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    CZK per point
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={ratioInput}
                    onChange={(event) => setRatioInput(event.target.value)}
                    disabled={loading || saving}
                    className="h-11 max-w-[200px] border-border bg-background"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Visitors earn one point for every <strong className="text-foreground">{ratioInput || "?"} CZK</strong> confirmed at check-in.
                </p>
              </div>

              {/* Info Panel */}
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    Current ratio
                  </span>
                  <span className="text-xl font-semibold text-foreground">
                    {activeRatio ? `${activeRatio.toLocaleString()} Kč` : "—"}
                  </span>
                </div>
                <Separator className="my-3 bg-border" />
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Updated {lastUpdated ?? "never"}
                  </p>
                  {history.length > 0 && (
                    <div className="space-y-1.5 pt-2">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <History className="h-3 w-3" />
                        Recent changes
                      </div>
                      <ul className="space-y-1">
                        {history.slice(0, 3).map((item) => (
                          <li key={item.id} className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>
                              {item.ratioCzk.toLocaleString()} Kč
                              <span className="ml-1.5 opacity-60">
                                by {item.createdBy ?? "system"}
                              </span>
                            </span>
                            <span className="opacity-60">
                              {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex items-center justify-between border-t border-border bg-muted/20 px-6 py-4">
            <p className="text-xs text-muted-foreground">
              Updates apply instantly for new QR confirmations.
            </p>
            <Button type="submit" disabled={saving || loading}>
              {saving ? "Saving…" : "Save ratio"}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Timezone Card */}
      <Card className="overflow-hidden border-border bg-card">
        <CardHeader className="border-b border-border bg-muted/30 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-foreground/10">
                <Clock className="h-4 w-4 text-foreground" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-foreground">
                  Default Timezone
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Choose which timezone drives deal validation and fallback behavior.
                </CardDescription>
              </div>
            </div>
            <Badge
              variant="secondary"
              className="shrink-0 font-medium"
            >
              {timezoneLoading
                ? "Loading…"
                : timeZoneSource === "partner"
                ? "Partner fallback"
                : "Admin timezone"}
            </Badge>
          </div>
        </CardHeader>
        <form onSubmit={handleTimezoneSave}>
          <CardContent className="space-y-6 p-6">
            {/* Timezone Input */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Admin timezone
              </Label>
              <Input
                value={timeZoneInput}
                onChange={(event) => setTimeZoneInput(event.target.value)}
                disabled={timezoneLoading || timezoneSaving}
                className="h-11 max-w-xs border-border bg-background"
              />
              <p className="text-sm text-muted-foreground">
                {formatTimezoneLabel(timeZoneInput)}
              </p>
            </div>

            {/* Partner Fallback Switch */}
            <div className="flex items-start gap-4 rounded-lg border border-border bg-muted/30 p-4">
              <Switch
                checked={timeZoneSource === "partner"}
                onCheckedChange={(checked) =>
                  setTimeZoneSource(checked ? "partner" : "admin")
                }
                disabled={timezoneLoading || timezoneSaving}
              />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Derive from partner address
                </p>
                <p className="text-xs text-muted-foreground">
                  When enabled, deals default to the partner&apos;s timezone (if available) and fall back to this admin timezone.
                </p>
              </div>
            </div>

            {/* History */}
            {timezoneHistory.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <History className="h-3 w-3" />
                  Recent timezone history
                </div>
                <ul className="mt-2 space-y-1">
                  {timezoneHistory.slice(0, 3).map((item) => (
                    <li key={item.id} className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {item.adminTimeZone} · {item.source === "partner" ? "partner" : "admin"}
                        <span className="ml-1.5 opacity-60">
                          by {item.createdBy ?? "system"}
                        </span>
                      </span>
                      <span className="opacity-60">
                        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex items-center justify-between border-t border-border bg-muted/20 px-6 py-4">
            <p className="text-xs text-muted-foreground">
              Updates apply instantly to deal cards and QR flows.
            </p>
            <Button type="submit" disabled={timezoneSaving || timezoneLoading}>
              {timezoneSaving ? "Saving…" : "Save timezone"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
