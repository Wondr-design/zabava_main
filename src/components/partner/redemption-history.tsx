import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RedemptionHistoryItem } from "@/lib/data/redemptions";
import { cn } from "@/lib/utils";

interface RedemptionHistoryProps {
  items: RedemptionHistoryItem[];
  title?: string;
  emptyLabel?: string;
  highlightStaffId?: string | null;
  className?: string;
  showHeader?: boolean;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatHandledBy(item: RedemptionHistoryItem) {
  const actor = item.processedBy;
  if (!actor) return "—";
  if (actor.role === "staff") {
    if (actor.name && actor.name.trim().length > 0) return actor.name;
    if (actor.email && actor.email.trim().length > 0) return actor.email;
    if (actor.staffId && actor.staffId.trim().length > 0) {
      return `Staff ${actor.staffId}`;
    }
    return "Team member";
  }
  return "Management";
}

export function RedemptionHistoryCard({
  items,
  title = "Recent redemptions",
  emptyLabel = "No redemptions processed yet.",
  highlightStaffId = null,
  className,
  showHeader = true,
}: RedemptionHistoryProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {showHeader ? (
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            {title}
          </h2>
          <span className="text-xs text-muted-foreground">
            Showing {items.length.toLocaleString()} entr
            {items.length === 1 ? "y" : "ies"}
          </span>
        </div>
      ) : null}
      {items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-4 text-sm text-muted-foreground">
            {emptyLabel}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted">
                <TableHead className="text-xs uppercase tracking-widest font-semibold">Code</TableHead>
                <TableHead className="text-xs uppercase tracking-widest font-semibold">Reward</TableHead>
                <TableHead className="text-xs uppercase tracking-widest font-semibold">User</TableHead>
                <TableHead className="text-xs uppercase tracking-widest font-semibold">Handled By</TableHead>
                <TableHead className="text-xs uppercase tracking-widest font-semibold">Processed</TableHead>
                <TableHead className="text-xs uppercase tracking-widest font-semibold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const highlighted =
                  highlightStaffId &&
                  item.processedBy?.staffId &&
                  item.processedBy.staffId === highlightStaffId;
                return (
                  <TableRow
                    key={item.code}
                    className={cn(
                      highlighted && "bg-green-500/10",
                    )}
                  >
                    <TableCell className="font-mono text-xs">
                      {item.code}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {item.rewardName || item.rewardId || "Unknown reward"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {typeof item.pointsCost === "number"
                          ? `${item.pointsCost.toLocaleString()} pts`
                          : "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{item.email}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.partnerId || "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{formatHandledBy(item)}</span>
                        {highlighted ? (
                          <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
                            You
                          </Badge>
                        ) : null}
                      </div>
                      {item.processedBy?.email &&
                      item.processedBy.email !== item.email ? (
                        <div className="text-xs text-muted-foreground">
                          {item.processedBy.email}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(item.processedAt)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.status === "used"
                            ? "default"
                            : item.status === "rejected"
                            ? "destructive"
                            : "secondary"
                        }
                        className={
                          item.status === "used"
                            ? "bg-green-500/20 text-green-600 border-green-500/30"
                            : item.status === "rejected"
                            ? ""
                            : "bg-amber-500/20 text-amber-600 border-amber-500/30"
                        }
                      >
                        {item.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
