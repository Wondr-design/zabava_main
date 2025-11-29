"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";

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
    <div className="space-y-6 px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold text-foreground">Platform settings</h1>
        <p className="text-sm text-muted-foreground">
          Tune how Zabava awards points and keep track of recent configuration changes.
        </p>
      </div>

      <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Point ratio</CardTitle>
            <CardDescription>
              Define how many Czech Crowns customer spending translates into one reward point.
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className="border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          >
            {source === "database" ? "Custom" : "Default"}
          </Badge>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
              <div className="space-y-3">
                <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  CZK per point
                </Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={ratioInput}
                  onChange={(event) => setRatioInput(event.target.value)}
                  disabled={loading || saving}
                  className="max-w-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Visitors earn one point for every <strong>{ratioInput || "?"}</strong> CZK confirmed at check-in.
                  Adjust this to speed up or slow down how quickly customers reach rewards.
                </p>
              </div>
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm shadow-inner dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700 dark:text-slate-100">
                    Current ratio
                  </span>
                  <span className="text-lg font-semibold">
                    {activeRatio ? `${activeRatio.toLocaleString()} Kč` : "—"}
                  </span>
                </div>
                <Separator className="my-2 bg-slate-200 dark:bg-slate-700" />
                <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <p>
                    Updated {lastUpdated ?? "never"}. The latest change is tracked with author and timestamp for auditing.
                  </p>
                  {history.length > 0 ? (
                    <ul className="space-y-1 pt-2">
                      {history.map((item) => (
                        <li key={item.id} className="flex items-center justify-between gap-3">
                          <span>
                            {item.ratioCzk.toLocaleString()} Kč
                            <span className="ml-2 text-slate-400">
                              by {item.createdBy ?? "system"}
                            </span>
                          </span>
                          <span className="text-slate-400">
                            {formatDistanceToNow(new Date(item.createdAt), {
                              addSuffix: true,
                            })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/40">
            <p className="text-xs text-muted-foreground">
              Updates apply instantly for new QR confirmations. Existing point balances remain unchanged.
            </p>
            <Button type="submit" disabled={saving || loading}>
              {saving ? "Saving…" : "Save ratio"}
            </Button>
          </CardFooter>
        </form>
      </Card>
      <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Default timezone</CardTitle>
            <CardDescription>
              Choose which timezone drives deal validation and what to fall back to when partner data is absent.
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className="border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          >
            {timezoneLoading
              ? "Loading…"
              : timeZoneSource === "partner"
              ? "Partner fallback"
              : "Admin timezone"}
          </Badge>
        </CardHeader>
        <form onSubmit={handleTimezoneSave}>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                Admin timezone
              </Label>
              <Input
                value={timeZoneInput}
                onChange={(event) => setTimeZoneInput(event.target.value)}
                disabled={timezoneLoading || timezoneSaving}
                className="max-w-xs"
              />
              <p className="text-xs text-muted-foreground">
                {formatTimezoneLabel(timeZoneInput)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={timeZoneSource === "partner"}
                onCheckedChange={(checked) =>
                  setTimeZoneSource(checked ? "partner" : "admin")
                }
                disabled={timezoneLoading || timezoneSaving}
              />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  Derive from partner address
                </p>
                <p className="text-xs text-muted-foreground">
                  When enabled, deals default to the partner&apos;s timezone (if available) and fall back to this admin timezone.
                </p>
              </div>
            </div>
            {timezoneHistory.length ? (
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/40 p-4 text-xs text-slate-500">
                <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-400">
                  Recent timezone history
                </p>
                <ul className="space-y-1">
                  {timezoneHistory.map((item) => (
                    <li key={item.id} className="flex items-center justify-between text-[11px]">
                      <span>
                        {item.adminTimeZone} · {item.source === "partner" ? "partner" : "admin"}
                        <span className="ml-2 text-slate-400">
                          by {item.createdBy ?? "system"}
                        </span>
                      </span>
                      <span className="text-slate-400">
                        {formatDistanceToNow(new Date(item.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
          <CardFooter className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/40">
            <p className="text-xs text-muted-foreground">
              Updates apply instantly and show up on the public deal cards and QR flow.
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
