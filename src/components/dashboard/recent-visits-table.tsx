import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { VisitRegistrationRecord } from '@/lib/data/visits';
import { formatDateTime } from '@/lib/format/date';

interface RecentVisitsTableProps {
  visits: VisitRegistrationRecord[];
  onSelectVisit?: (visit: VisitRegistrationRecord) => void;
}

function formatStatus(status?: string | null) {
  switch (status) {
    case 'visited':
      return 'Visited';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Pending';
  }
}

export function RecentVisitsTable({ visits, onSelectVisit }: RecentVisitsTableProps) {
  const isSelectable = Boolean(onSelectVisit);
  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-base text-slate-900">Recent visits</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-slate-50 text-slate-500">
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Partner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Registered</TableHead>
              <TableHead>Visited</TableHead>
              <TableHead className="text-right">Points</TableHead>
              {isSelectable && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody className="text-slate-700">
            {visits.length === 0 && (
              <TableRow>
                <TableCell colSpan={isSelectable ? 7 : 6} className="text-center text-slate-500">
                  No visits recorded yet.
                </TableCell>
              </TableRow>
            )}
            {visits.map((visit) => (
              <TableRow key={visit.id}>
                <TableCell className="font-medium text-slate-900">{visit.email}</TableCell>
                <TableCell className="text-xs uppercase tracking-wide text-slate-500">{visit.partner_id ?? '—'}</TableCell>
                <TableCell>{formatStatus(visit.status)}</TableCell>
                <TableCell>{formatDateTime(visit.created_at)}</TableCell>
                <TableCell>{formatDateTime(visit.visited_at)}</TableCell>
                <TableCell className="text-right">
                  {visit.points_awarded ?? visit.estimated_points ?? 0}
                </TableCell>
                {isSelectable && (
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => onSelectVisit?.(visit)}>
                      View
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
