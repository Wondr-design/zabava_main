import * as React from "react";

import { cn } from "@/lib/utils";

export const DesignTableWrapper = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "overflow-hidden rounded-[36px] border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-4 shadow-[var(--ds-shadow-soft)]",
      className,
    )}
    {...props}
  />
));
DesignTableWrapper.displayName = "DesignTableWrapper";

export const DesignTable = React.forwardRef<
  HTMLTableElement,
  React.TableHTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <table
    ref={ref}
    className={cn(
      "w-full border-separate border-spacing-y-4 border-spacing-x-0 text-sm text-[color:var(--ds-text-strong)]",
      className,
    )}
    {...props}
  />
));
DesignTable.displayName = "DesignTable";

export const DesignTableHead = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      "rounded-[32px] bg-[color:var(--ds-surface-muted)] text-xs uppercase tracking-[0.3em] text-[color:var(--ds-text-subtle)]",
      className,
    )}
    {...props}
  />
));
DesignTableHead.displayName = "DesignTableHead";

export const DesignTableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("align-middle", className)} {...props} />
));
DesignTableBody.displayName = "DesignTableBody";

export const DesignTableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement> & { clickable?: boolean; selected?: boolean }
>(({ className, clickable, selected, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "rounded-[32px] border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-popover)] transition duration-200",
      clickable && "cursor-pointer hover:border-[color:var(--ds-border-strong)] hover:shadow-[0_18px_32px_rgba(111,102,75,0.18)]",
      selected && "border-[color:var(--ds-primary)] bg-[color:var(--ds-surface-card)] shadow-[0_18px_34px_rgba(111,102,75,0.2)]",
      className,
    )}
    {...props}
  />
));
DesignTableRow.displayName = "DesignTableRow";

export const DesignTableHeader = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.32em] text-[color:var(--ds-text-subtle)]",
      className,
    )}
    {...props}
  />
));
DesignTableHeader.displayName = "DesignTableHeader";

export const DesignTableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn("px-6 py-5 text-sm", className)} {...props} />
));
DesignTableCell.displayName = "DesignTableCell";

export const DesignTableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] text-xs text-[color:var(--ds-text-muted)]",
      className,
    )}
    {...props}
  />
));
DesignTableFooter.displayName = "DesignTableFooter";
