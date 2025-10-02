"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend, BarChart, Bar } from "recharts";

export type OverviewMetrics = {
  totalCount: number;
  visitedCount: number;
  pendingCount: number;
  revenue: number;
  points: number;
};

export type SeriesPoint = { date: string; visits: number; points: number };

export function OverviewCards(props: { metrics: OverviewMetrics; series: SeriesPoint[] }) {
  const { metrics, series } = props;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card label="Total" value={metrics.totalCount} />
        <Card label="Visited" value={metrics.visitedCount} />
        <Card label="Pending" value={metrics.pendingCount} />
        <Card label="Points" value={metrics.points} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-slate-600">Visits over time</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} width={30} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="visits" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-slate-600">Points over time</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} width={30} />
                <Tooltip />
                <Legend />
                <Bar dataKey="points" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card(props: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{props.label}</div>
      <div className="text-2xl font-semibold text-slate-900">{props.value}</div>
    </div>
  );
}
