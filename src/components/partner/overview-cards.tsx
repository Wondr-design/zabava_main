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
import { Card, CardContent } from "@/components/ui/card";

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
        <MetricCard label="Total" value={metrics.totalCount} />
        <MetricCard label="Visited" value={metrics.visitedCount} />
        <MetricCard label="Pending" value={metrics.pendingCount} />
        <MetricCard label="Revenue" value={formatCurrencyCZK(metrics.revenue)} />
        <MetricCard label="Points" value={metrics.points} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
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
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis allowDecimals={false} width={30} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="visits"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
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
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis allowDecimals={false} width={30} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="points" fill="hsl(var(--chart-2))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard(props: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {props.label}
        </div>
        <div className="text-2xl font-semibold text-foreground">
          {props.value}
        </div>
      </CardContent>
    </Card>
  );
}
