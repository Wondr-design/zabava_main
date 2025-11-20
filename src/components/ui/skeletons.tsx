"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Skeleton as BaseSkeleton } from "@/components/ui/skeleton";

// Re-export base Skeleton for convenience
export { BaseSkeleton as Skeleton };

// Table Skeleton Components
export function TableRowSkeleton({
  columns,
  showCheckbox = false,
  className,
}: {
  columns: number;
  showCheckbox?: boolean;
  className?: string;
}) {
  return (
    <tr className={cn("animate-pulse", className)}>
      {showCheckbox && (
        <td className="px-4 py-3">
          <BaseSkeleton className="h-4 w-4 rounded" />
        </td>
      )}
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <BaseSkeleton
            className={cn(
              "h-4 rounded",
              i === 0 ? "w-32" : i === 1 ? "w-24" : "w-20"
            )}
          />
        </td>
      ))}
      <td className="px-4 py-3 text-right">
        <BaseSkeleton className="ml-auto h-8 w-16 rounded" />
      </td>
    </tr>
  );
}

export function TableSkeleton({
  rows = 5,
  columns = 5,
  showCheckbox = false,
  showHeader = true,
}: {
  rows?: number;
  columns?: number;
  showCheckbox?: boolean;
  showHeader?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[color:var(--ds-border-subtle)] overflow-hidden">
      <table className="w-full">
        {showHeader && (
          <thead>
            <tr className="border-b border-[color:var(--ds-border-subtle)]">
              {showCheckbox && (
                <th className="px-4 py-3 text-left">
                  <BaseSkeleton className="h-4 w-4 rounded" />
                </th>
              )}
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="px-4 py-3 text-left">
                  <BaseSkeleton className="h-4 w-20 rounded" />
                </th>
              ))}
              <th className="px-4 py-3 text-right">
                <BaseSkeleton className="ml-auto h-4 w-16 rounded" />
              </th>
            </tr>
          </thead>
        )}
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <TableRowSkeleton
              key={rowIndex}
              columns={columns}
              showCheckbox={showCheckbox}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Card Skeleton Components
export function CardSkeleton({
  showHeader = true,
  showDescription = false,
  rows = 3,
  className,
}: {
  showHeader?: boolean;
  showDescription?: boolean;
  rows?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-6",
        className
      )}
    >
      {showHeader && (
        <div className="mb-4 space-y-2">
          <BaseSkeleton className="h-6 w-48 rounded" />
          {showDescription && <BaseSkeleton className="h-4 w-64 rounded" />}
        </div>
      )}
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <BaseSkeleton
            key={i}
            className={cn(
              "h-4 rounded",
              i === 0 ? "w-full" : i === 1 ? "w-5/6" : "w-4/6"
            )}
          />
        ))}
      </div>
    </div>
  );
}

// Stats Grid Skeleton
export function StatsGridSkeleton({
  count = 6,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-6"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <BaseSkeleton className="h-4 w-24 rounded" />
              <BaseSkeleton className="h-8 w-32 rounded" />
            </div>
            <BaseSkeleton className="h-12 w-12 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Form Field Skeleton
export function FormFieldSkeleton({
  showLabel = true,
  className,
}: {
  showLabel?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {showLabel && <BaseSkeleton className="h-4 w-24 rounded" />}
      <BaseSkeleton className="h-10 w-full rounded-lg" />
    </div>
  );
}

// Form Skeleton
export function FormSkeleton({
  fields = 4,
  showTitle = true,
  className,
}: {
  fields?: number;
  showTitle?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-6", className)}>
      {showTitle && (
        <div className="space-y-2">
          <BaseSkeleton className="h-8 w-48 rounded" />
          <BaseSkeleton className="h-4 w-64 rounded" />
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: fields }).map((_, i) => (
          <FormFieldSkeleton
            key={i}
            showLabel
            className={i >= fields - (fields % 2) ? "sm:col-span-2" : ""}
          />
        ))}
      </div>
      <div className="flex justify-end gap-3">
        <BaseSkeleton className="h-10 w-24 rounded-lg" />
        <BaseSkeleton className="h-10 w-24 rounded-lg" />
      </div>
    </div>
  );
}

// List Item Skeleton
export function ListItemSkeleton({
  showAvatar = false,
  showActions = false,
  className,
}: {
  showAvatar?: boolean;
  showActions?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-lg border border-[color:var(--ds-border-subtle)] p-4",
        className
      )}
    >
      {showAvatar && <BaseSkeleton className="h-10 w-10 rounded-full" />}
      <div className="flex-1 space-y-2">
        <BaseSkeleton className="h-4 w-48 rounded" />
        <BaseSkeleton className="h-3 w-32 rounded" />
      </div>
      {showActions && (
        <div className="flex gap-2">
          <BaseSkeleton className="h-8 w-8 rounded" />
          <BaseSkeleton className="h-8 w-8 rounded" />
        </div>
      )}
    </div>
  );
}

// List Skeleton
export function ListSkeleton({
  items = 5,
  showAvatar = false,
  showActions = false,
  className,
}: {
  items?: number;
  showAvatar?: boolean;
  showActions?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: items }).map((_, i) => (
        <ListItemSkeleton
          key={i}
          showAvatar={showAvatar}
          showActions={showActions}
        />
      ))}
    </div>
  );
}

// Badge Skeleton
export function BadgeSkeleton({
  width = "w-16",
  className,
}: {
  width?: string;
  className?: string;
}) {
  return <BaseSkeleton className={cn("h-6 rounded-full", width, className)} />;
}

// Page Header Skeleton
export function PageHeaderSkeleton({
  showActions = false,
  className,
}: {
  showActions?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <BaseSkeleton className="h-8 w-64 rounded" />
          <BaseSkeleton className="h-4 w-96 rounded" />
        </div>
        {showActions && (
          <div className="flex gap-2">
            <BaseSkeleton className="h-10 w-24 rounded-lg" />
            <BaseSkeleton className="h-10 w-24 rounded-lg" />
          </div>
        )}
      </div>
    </div>
  );
}

// Filter Bar Skeleton
export function FilterBarSkeleton({
  fields = 3,
  className,
}: {
  fields?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end gap-4 rounded-lg border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-4",
        className
      )}
    >
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="flex-1 min-w-[200px] space-y-2">
          <BaseSkeleton className="h-3 w-16 rounded" />
          <BaseSkeleton className="h-10 w-full rounded-lg" />
        </div>
      ))}
      <BaseSkeleton className="h-10 w-24 rounded-lg" />
    </div>
  );
}

