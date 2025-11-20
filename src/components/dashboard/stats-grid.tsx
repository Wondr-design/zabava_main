"use client";

import {
  StatusPill,
  SurfaceCard,
} from "@/components/design-system";
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
          <SurfaceCard
            key={item.label}
            className="group relative space-y-3 rounded-3xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-6 transition-all duration-200 hover:border-[color:var(--ds-primary)]/30 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-110 ${
                    item.tone === "primary"
                      ? "bg-[color:var(--ds-primary)]/10"
                      : item.tone === "success"
                        ? "bg-[color:var(--ds-success)]/10"
                        : item.tone === "warning"
                          ? "bg-[color:var(--ds-warning)]/10"
                          : "bg-[color:var(--ds-danger)]/10"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${
                      item.tone === "primary"
                        ? "text-[color:var(--ds-primary)]"
                        : item.tone === "success"
                          ? "text-[color:var(--ds-success)]"
                          : item.tone === "warning"
                            ? "text-[color:var(--ds-warning)]"
                            : "text-[color:var(--ds-danger)]"
                    }`}
                    aria-hidden
                  />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[color:var(--ds-text-subtle)]">
                    {item.label}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-[color:var(--ds-text-strong)] sm:text-3xl">
                    {item.value}
                  </p>
                </div>
              </div>
            </div>
            <div className="pt-1">
              <StatusPill tone={item.tone} size="sm" className="text-xs">
                {item.helper}
              </StatusPill>
            </div>
          </SurfaceCard>
        );
      })}
    </div>
  );
}
