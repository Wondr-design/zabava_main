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
import { toast } from "sonner";

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
    </div>
  );
}
