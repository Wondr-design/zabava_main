"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { DashboardMetrics } from "@/lib/data/analytics";
import {
  TicketPercent,
  Clock,
  CheckCircle2,
  Calendar,
  HandshakeIcon,
  Star,
} from "lucide-react";

interface StatsGridProps {
  metrics: DashboardMetrics;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function StatsGrid({ metrics }: StatsGridProps) {
  const items = [
    {
      label: "Total visits",
      value: formatNumber(metrics.totalVisits),
      helper: "All-time registrations",
      tone: "primary" as const,
      icon: TicketPercent,
    },
    {
      label: "Pending visits",
      value: formatNumber(metrics.pendingVisits),
      helper: "Awaiting confirmation",
      tone: "warning" as const,
      icon: Clock,
    },
    {
      label: "Visited",
      value: formatNumber(metrics.visitedVisits),
      helper: "Marked as completed",
      tone: "success" as const,
      icon: CheckCircle2,
    },
    {
      label: "Today",
      value: formatNumber(metrics.todaysVisits),
      helper: "Registrations today",
      tone: "primary" as const,
      icon: Calendar,
    },
    {
      label: "Active partners",
      value: formatNumber(metrics.activePartners),
      helper: "Partner accounts with status active",
      tone: "success" as const,
      icon: HandshakeIcon,
    },
    {
      label: "Total points",
      value: formatNumber(metrics.totalPoints),
      helper: "Net loyalty points across users",
      tone: "primary" as const,
      icon: Star,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card
            key={item.label}
            className="group relative space-y-3 rounded-lg border border-border bg-card p-6 transition-all duration-200 hover:bg-accent/50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105 ${
                    item.tone === "primary"
                      ? "bg-primary/10"
                      : item.tone === "success"
                        ? "bg-emerald-500/10"
                        : item.tone === "warning"
                          ? "bg-amber-500/10"
                          : "bg-destructive/10"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${
                      item.tone === "primary"
                        ? "text-primary"
                        : item.tone === "success"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : item.tone === "warning"
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-destructive"
                    }`}
                    aria-hidden
                  />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                    {item.value}
                  </p>
                </div>
              </div>
            </div>
            <div className="pt-1">
              <Badge
                variant="secondary"
                className={
                  item.tone === "primary"
                    ? "bg-primary/10 text-primary border-primary/20"
                    : item.tone === "success"
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    : item.tone === "warning"
                    ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                    : "bg-destructive/10 text-destructive border-destructive/20"
                }
              >
                {item.helper}
              </Badge>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
