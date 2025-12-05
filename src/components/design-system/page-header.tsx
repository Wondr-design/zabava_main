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
        {breadcrumbs ? <div className="text-sm text-muted-foreground">{breadcrumbs}</div> : null}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            {description ? (
              <p className="max-w-2xl text-sm text-muted-foreground">
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
