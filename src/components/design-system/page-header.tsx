import * as React from "react";

import { cn } from "@/lib/utils";

export interface PageHeaderProps
  extends Omit<React.ComponentPropsWithoutRef<"div">, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  actions?: React.ReactNode;
  spacing?: "comfortable" | "compact";
}

export const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
  (
    {
      title,
      description,
      breadcrumbs,
      actions,
      spacing = "comfortable",
      className,
      ...props
    },
    ref,
  ) => {
    return (
      <section
        ref={ref}
        className={cn(
          "w-full",
          spacing === "comfortable" ? "space-y-4 py-4" : "space-y-2 py-2",
          className,
        )}
        {...props}
      >
        {breadcrumbs ? <div className="text-sm text-[color:var(--ds-text-subtle)]">{breadcrumbs}</div> : null}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold text-[color:var(--ds-text-strong)] sm:text-3xl">
              {title}
            </h1>
            {description ? (
              <p className="max-w-2xl text-sm text-[color:var(--ds-text-muted)]">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
      </section>
    );
  },
);
PageHeader.displayName = "PageHeader";
