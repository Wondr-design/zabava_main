import { StatusPill, SurfaceCard } from "@/components/design-system";
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
          <h2 className="text-sm font-semibold text-[color:var(--ds-text-strong)]">
            {title}
          </h2>
          <span className="text-xs text-[color:var(--ds-text-muted)]">
            Showing {items.length.toLocaleString()} entr
            {items.length === 1 ? "y" : "ies"}
          </span>
        </div>
      ) : null}
      {items.length === 0 ? (
        <SurfaceCard className="rounded-2xl border-dashed border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] p-4 text-sm text-[color:var(--ds-text-muted)]">
          {emptyLabel}
        </SurfaceCard>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)]">
          <table className="min-w-full divide-y divide-[color:var(--ds-border-subtle)] text-sm text-[color:var(--ds-text-strong)]">
            <thead className="bg-[color:var(--ds-surface-muted)] text-xs uppercase tracking-[0.2em] text-[color:var(--ds-text-subtle)]">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Code</th>
                <th className="px-3 py-2 text-left font-semibold">Reward</th>
                <th className="px-3 py-2 text-left font-semibold">User</th>
                <th className="px-3 py-2 text-left font-semibold">Handled By</th>
                <th className="px-3 py-2 text-left font-semibold">Processed</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--ds-border-subtle)]">
              {items.map((item) => {
                const highlighted =
                  highlightStaffId &&
                  item.processedBy?.staffId &&
                  item.processedBy.staffId === highlightStaffId;
                return (
                  <tr
                    key={item.code}
                    className={cn(
                      "bg-[color:var(--ds-surface-card)]",
                      highlighted && "bg-[color:var(--ds-success)]/10",
                    )}
                  >
                    <td className="px-3 py-2 font-mono text-xs">
                      {item.code}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">
                        {item.rewardName || item.rewardId || "Unknown reward"}
                      </div>
                      <div className="text-xs text-[color:var(--ds-text-muted)]">
                        {typeof item.pointsCost === "number"
                          ? `${item.pointsCost.toLocaleString()} pts`
                          : "—"}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div>{item.email}</div>
                      <div className="text-xs text-[color:var(--ds-text-muted)]">
                        {item.partnerId || "—"}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span>{formatHandledBy(item)}</span>
                        {highlighted ? (
                          <StatusPill tone="success" size="sm">
                            You
                          </StatusPill>
                        ) : null}
                      </div>
                      {item.processedBy?.email &&
                      item.processedBy.email !== item.email ? (
                        <div className="text-xs text-[color:var(--ds-text-muted)]">
                          {item.processedBy.email}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-[color:var(--ds-text-muted)]">
                      {formatDate(item.processedAt)}
                    </td>
                    <td className="px-3 py-2">
                      <StatusPill
                        tone={
                          item.status === "used"
                            ? "success"
                            : item.status === "rejected"
                            ? "danger"
                            : "warning"
                        }
                        size="sm"
                      >
                        {item.status}
                      </StatusPill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
