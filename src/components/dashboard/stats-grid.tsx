import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardMetrics } from '@/lib/data/analytics';

interface StatsGridProps {
  metrics: DashboardMetrics;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

export function StatsGrid({ metrics }: StatsGridProps) {
  const items = [
    {
      label: 'Total Visits',
      value: formatNumber(metrics.totalVisits),
      helper: 'All-time registrations',
    },
    {
      label: 'Pending Visits',
      value: formatNumber(metrics.pendingVisits),
      helper: 'Awaiting confirmation',
    },
    {
      label: 'Visited',
      value: formatNumber(metrics.visitedVisits),
      helper: 'Marked as completed',
    },
    {
      label: 'Today',
      value: formatNumber(metrics.todaysVisits),
      helper: 'Registrations today',
    },
    {
      label: 'Active Partners',
      value: formatNumber(metrics.activePartners),
      helper: 'Partner accounts with status active',
    },
    {
      label: 'Total Points',
      value: formatNumber(metrics.totalPoints),
      helper: 'Net loyalty points across users',
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <Card key={item.label} className="border border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-500">
              {item.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-3xl font-semibold text-slate-900">{item.value}</div>
            <p className="text-xs text-slate-500">{item.helper}</p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
