import * as React from "react";

import { cn } from "@/lib/utils";
import { SurfaceCard } from "./surface";

export interface SectionCardProps
  extends Omit<React.ComponentPropsWithoutRef<"div">, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  bleed?: boolean;
}

export const SectionCard = React.forwardRef<HTMLDivElement, SectionCardProps>(
  (
    { className, title, description, actions, children, footer, bleed = false, ...props },
    ref,
  ) => {
    return (
      <SurfaceCard
        ref={ref}
        className={cn(
          "flex flex-col gap-6 rounded-lg border border-border bg-card p-6",
          bleed && "xl:p-6",
          className,
        )}
        {...props}
      >
        {(title || description || actions) && (
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              {title ? (
                <h2 className="text-lg font-semibold text-foreground">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p className="text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
            {actions ? (
              <div className="flex flex-wrap items-center gap-2">{actions}</div>
            ) : null}
          </header>
        )}

        <div className="flex-1 space-y-4">{children}</div>

        {footer ? (
          <footer className="pt-4 text-sm text-muted-foreground">
            {footer}
          </footer>
        ) : null}
      </SurfaceCard>
    );
  },
);
SectionCard.displayName = "SectionCard";
