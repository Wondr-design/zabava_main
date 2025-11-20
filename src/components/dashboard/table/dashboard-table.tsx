import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export function DashboardTableCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[32px] border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface ToolbarProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}

export function DashboardTableToolbar({
  title,
  description,
  actions,
  children,
}: ToolbarProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-[color:var(--ds-border-subtle)] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-[color:var(--ds-text-strong)]">
          {title}
        </h2>
        {description ? (
          <p className="text-sm text-[color:var(--ds-text-muted)]">
            {description}
          </p>
        ) : null}
        {children ? <div className="pt-1">{children}</div> : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap gap-2 sm:justify-end">{actions}</div>
      ) : null}
    </div>
  );
}

interface FooterProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange(page: number): void;
  onPageSizeChange(size: number): void;
}

export function DashboardTableFooter({
  page,
  totalPages,
  totalItems,
  pageSize,
  pageSizeOptions = [10, 25, 50, 100],
  onPageChange,
  onPageSizeChange,
}: FooterProps) {
  const [pageInput, setPageInput] = useState(String(page));

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = Number(pageInput);
    if (Number.isNaN(parsed)) return;
    onPageChange(parsed);
  }

  return (
    <div className="flex flex-col gap-4 border-t border-[color:var(--ds-border-subtle)] px-6 py-4 text-sm text-[color:var(--ds-text-muted)] sm:flex-row sm:items-center sm:justify-between">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={handleSubmit}
      >
        <span>Go to page</span>
        <input
          type="number"
          min={1}
          max={totalPages}
          value={pageInput}
          onChange={(event) => setPageInput(event.target.value)}
          className="h-10 w-16 rounded-full border border-[color:var(--ds-border-subtle)] bg-transparent px-3 text-center text-[color:var(--ds-text-strong)] focus-visible:border-[color:var(--ds-focus-ring)] focus-visible:outline-none"
        />
        <span>
          of {String(totalPages).padStart(2, "0")} • {totalItems} entries
        </span>
      </form>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-[color:var(--ds-text-strong)]">
          <span className="text-sm text-[color:var(--ds-text-muted)]">
            Show entries
          </span>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-10 rounded-full border border-[color:var(--ds-border-subtle)] bg-transparent px-4 text-sm text-[color:var(--ds-text-strong)] focus-visible:border-[color:var(--ds-focus-ring)] focus-visible:outline-none"
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <DashboardPagination
          page={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      </div>
    </div>
  );
}

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange(page: number): void;
}

export function DashboardPagination({
  page,
  totalPages,
  onPageChange,
}: PaginationProps) {
  const range = useMemo(
    () => buildPaginationRange(page, totalPages),
    [page, totalPages],
  );

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center gap-1">
      <PaginationButton
        disabled={page === 1}
        aria-label="First page"
        onClick={() => onPageChange(1)}
      >
        «
      </PaginationButton>
      <PaginationButton
        disabled={page === 1}
        aria-label="Previous page"
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </PaginationButton>
      {range.map((item, index) =>
        item === "ellipsis" ? (
          <span
            key={`ellipsis-${index}`}
            className="px-2 text-base text-[color:var(--ds-text-muted)]"
          >
            …
          </span>
        ) : (
          <PaginationButton
            key={item}
            aria-label={`Page ${item}`}
            data-active={item === page}
            className={cn(
              "data-[active=true]:border-[color:var(--ds-primary)] data-[active=true]:bg-[color:var(--ds-primary)] data-[active=true]:text-[color:var(--ds-primary-foreground)]",
            )}
            onClick={() => onPageChange(item)}
          >
            {item}
          </PaginationButton>
        ),
      )}
      <PaginationButton
        disabled={page === totalPages}
        aria-label="Next page"
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </PaginationButton>
      <PaginationButton
        disabled={page === totalPages}
        aria-label="Last page"
        onClick={() => onPageChange(totalPages)}
      >
        »
      </PaginationButton>
    </div>
  );
}

function PaginationButton({
  className,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "inline-flex h-8 min-w-[32px] items-center justify-center rounded-full border border-[color:var(--ds-border-subtle)] bg-transparent px-2 text-sm font-medium text-[color:var(--ds-text-muted)] transition hover:border-[color:var(--ds-primary)] hover:text-[color:var(--ds-text-strong)] disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}

function buildPaginationRange(page: number, totalPages: number) {
  const MAX_LENGTH = 5;
  const range: Array<number | "ellipsis"> = [];

  if (totalPages <= MAX_LENGTH) {
    for (let i = 1; i <= totalPages; i += 1) {
      range.push(i);
    }
    return range;
  }

  const siblings = 1;
  const leftSibling = Math.max(page - siblings, 1);
  const rightSibling = Math.min(page + siblings, totalPages);

  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < totalPages - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    for (let i = 1; i <= 3 + siblings * 2; i += 1) {
      range.push(i);
    }
    range.push("ellipsis");
    range.push(totalPages);
    return range;
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    range.push(1);
    range.push("ellipsis");
    for (let i = totalPages - (2 + siblings * 2); i <= totalPages; i += 1) {
      range.push(i);
    }
    return range;
  }

  range.push(1);
  range.push("ellipsis");
  for (let i = leftSibling; i <= rightSibling; i += 1) {
    range.push(i);
  }
  range.push("ellipsis");
  range.push(totalPages);
  return range;
}
