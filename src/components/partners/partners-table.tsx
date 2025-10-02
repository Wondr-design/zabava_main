import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PartnerOverview } from '@/lib/data/analytics';
import { formatDate } from '@/lib/format/date';

interface PartnersTableProps {
  partners: PartnerOverview[];
}

function statusBadge(status: string) {
  const normalized = status.toLowerCase();
  switch (normalized) {
    case 'active':
      return <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Active</Badge>;
    case 'pending':
      return <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Pending</Badge>;
    default:
      return <Badge variant="outline" className="border-slate-200 bg-slate-100 text-slate-700">{status}</Badge>;
  }
}

export function PartnersTable({ partners }: PartnersTableProps) {
  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-base text-slate-900">Partners</CardTitle>
        <CardDescription className="text-xs text-slate-500">
          Member and visit counts calculated from Supabase data.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-slate-50 text-slate-500">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Visits</TableHead>
              <TableHead>Pending</TableHead>
              <TableHead>Onboarded</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="text-slate-700">
            {partners.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-slate-500">
                  No partners found.
                </TableCell>
              </TableRow>
            )}
            {partners.map((partner) => (
              <TableRow key={partner.id}>
                <TableCell className="font-medium text-slate-900">{partner.display_name}</TableCell>
                <TableCell>{statusBadge(partner.status)}</TableCell>
                <TableCell>{partner.memberCount}</TableCell>
                <TableCell>{partner.visitCount}</TableCell>
                <TableCell>{partner.pendingCount}</TableCell>
                <TableCell>{formatDate(partner.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
