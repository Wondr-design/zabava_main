"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { formatCurrencyCZK } from "@/lib/format/currency";
import { SurfaceCard } from "@/components/design-system";

export type OverviewMetrics = {
  totalCount: number;
  visitedCount: number;
  pendingCount: number;
  revenue: number;
  points: number;
};

export type SeriesPoint = { date: string; visits: number; points: number };

export function OverviewCards(props: {
  metrics: OverviewMetrics;
  series: SeriesPoint[];
}) {
  const { metrics, series } = props;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Card label="Total" value={metrics.totalCount} />
        <Card label="Visited" value={metrics.visitedCount} />
        <Card label="Pending" value={metrics.pendingCount} />
        <Card label="Revenue" value={formatCurrencyCZK(metrics.revenue)} />
        <Card label="Points" value={metrics.points} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SurfaceCard className="rounded-2xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-4">
          <h3 className="mb-2 text-sm font-semibold text-[color:var(--ds-text-muted)]">
            Visits over time
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={series}
                margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="color-mix(in srgb, var(--ds-border-subtle) 60%, transparent)"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: "var(--ds-text-muted)" }}
                />
                <YAxis allowDecimals={false} width={30} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="visits"
                  stroke="var(--ds-chart-1)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SurfaceCard>
        <SurfaceCard className="rounded-2xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-4">
          <h3 className="mb-2 text-sm font-semibold text-[color:var(--ds-text-muted)]">
            Points over time
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={series}
                margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="color-mix(in srgb, var(--ds-border-subtle) 60%, transparent)"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: "var(--ds-text-muted)" }}
                />
                <YAxis allowDecimals={false} width={30} />
                <Tooltip />
                <Legend />
                <Bar dataKey="points" fill="var(--ds-chart-2)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}

function Card(props: { label: string; value: number | string }) {
  return (
    <SurfaceCard className="rounded-2xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--ds-text-subtle)]">
        {props.label}
      </div>
      <div className="text-2xl font-semibold text-[color:var(--ds-text-strong)]">
        {props.value}
      </div>
    </SurfaceCard>
  );
}
