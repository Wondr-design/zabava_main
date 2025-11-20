import { useMemo, useState, type ReactNode } from "react";
import { CheckSquare, Square } from "lucide-react";

import { cn } from "@/lib/utils";
import { usePagination } from "@/hooks/use-pagination";
import { DashboardTableCard, DashboardTableFooter, DashboardTableToolbar } from "./dashboard-table";

export interface DashboardTableColumn<T> {
  id: string;
  header: ReactNode;
  accessor: (row: T) => React.ReactNode;
  align?: "left" | "center" | "right";
  width?: string;
  className?: string;
}

interface DashboardDataTableProps<T> {
  title: string;
  description?: React.ReactNode;
  rows: readonly T[];
  columns: DashboardTableColumn<T>[];
  rowId: (row: T) => string;
  loading?: boolean;
  emptyMessage?: React.ReactNode;
  actions?: React.ReactNode;
  toolbar?: React.ReactNode;
  selectable?: boolean;
  initialPageSize?: number;
  pageSizeOptions?: number[];
  onSelectionChange?: (ids: string[]) => void;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
}

export function DashboardDataTable<T>({
  title,
  description,
  rows,
  columns,
  rowId,
  loading,
  emptyMessage = "No data available.",
  actions,
  toolbar,
  selectable = false,
  initialPageSize = 10,
  pageSizeOptions,
  onSelectionChange,
  onRowClick,
  rowClassName,
}: DashboardDataTableProps<T>) {
  const pagination = usePagination(rows, { initialPageSize });
  const pageItems = pagination.currentItems;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const selectedCount = selectedIds.size;

  const pageIds = useMemo(
    () => pageItems.map((item) => rowId(item)),
    [pageItems, rowId],
  );
  const allSelected =
    selectable && pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      onSelectionChange?.(Array.from(next));
      return next;
    });
  }

  function togglePageSelection() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const everySelected = pageIds.every((id) => next.has(id));
      if (everySelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      onSelectionChange?.(Array.from(next));
      return next;
    });
  }

  return (
    <DashboardTableCard>
      <DashboardTableToolbar
        title={title}
        description={
          selectedCount > 0 ? `${selectedCount} selected` : description
        }
        actions={actions}
      >
        {toolbar}
      </DashboardTableToolbar>
      <div className="overflow-x-auto px-2 py-2">
        <table className="w-full border-collapse text-sm text-[color:var(--ds-text-strong)]">
          <thead>
            <tr className="text-xs uppercase tracking-[0.3em] text-[color:var(--ds-text-muted)]">
              {selectable ? (
                <th className="w-12 px-4 py-3 text-left">
                      <button
                        type="button"
                        aria-label="Select page"
                        className="inline-flex items-center text-[color:var(--ds-text-muted)]"
                        onClick={(event) => {
                          event.stopPropagation();
                          togglePageSelection();
                        }}
                      >
                    {allSelected ? (
                      <CheckSquare className="h-4 w-4" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                </th>
              ) : null}
              {columns.map((column) => (
                <th
                  key={column.id}
                  className={cn(
                    "px-4 py-3 text-left font-semibold",
                    column.align === "center" && "text-center",
                    column.align === "right" && "text-right",
                    column.className,
                  )}
                  style={{ width: column.width }}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <>
                {Array.from({ length: initialPageSize }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="animate-pulse">
                    {selectable && (
                      <td className="px-4 py-3">
                        <div className="h-4 w-4 rounded bg-[color:var(--ds-surface-muted)]" />
                      </td>
                    )}
                    {columns.map((_, colIndex) => (
                      <td key={colIndex} className="px-4 py-3">
                        <div
                          className={cn(
                            "h-4 rounded bg-[color:var(--ds-surface-muted)]",
                            colIndex === 0 ? "w-32" : colIndex === 1 ? "w-24" : "w-20"
                          )}
                        />
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right">
                      <div className="ml-auto h-8 w-16 rounded bg-[color:var(--ds-surface-muted)]" />
                    </td>
                  </tr>
                ))}
              </>
            ) : pageItems.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="px-4 py-10 text-center text-[color:var(--ds-text-muted)]"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pageItems.map((item) => {
                const id = rowId(item);
                const isSelected = selectable && selectedIds.has(id);
                const clickable = Boolean(onRowClick);
                const extraClass = rowClassName?.(item);
                return (
                  <tr
                    key={id}
                    className={cn(
                      "rounded-[26px] border border-transparent bg-[color:var(--ds-surface-muted)]/70 text-sm transition hover:border-[color:var(--ds-border-subtle)] hover:bg-[color:var(--ds-surface-muted)]",
                      isSelected &&
                        "border-[color:var(--ds-primary)] bg-[color:var(--ds-surface-card)]",
                      clickable && "cursor-pointer",
                      extraClass,
                    )}
                    onClick={() => onRowClick?.(item)}
                  >
                    {selectable ? (
                      <td className="w-12 px-4 py-4 align-middle">
                        <button
                          type="button"
                          aria-label="Select row"
                          className="inline-flex items-center text-[color:var(--ds-text-muted)]"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleRow(id);
                          }}
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                    ) : null}
                    {columns.map((column) => (
                      <td
                        key={`${id}-${column.id}`}
                        className={cn(
                          "px-4 py-4 align-middle text-[color:var(--ds-text-strong)]",
                          column.align === "center" && "text-center",
                          column.align === "right" && "text-right",
                          column.className,
                        )}
                      >
                        {column.accessor(item)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <DashboardTableFooter
        page={pagination.page}
        totalPages={pagination.totalPages}
        totalItems={pagination.totalItems}
        pageSize={pagination.pageSize}
        pageSizeOptions={pageSizeOptions}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
      />
    </DashboardTableCard>
  );
}
