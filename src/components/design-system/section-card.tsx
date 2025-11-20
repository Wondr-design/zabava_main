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
          "flex flex-col gap-7 rounded-[36px] border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-8 shadow-[var(--ds-shadow-soft)]",
          bleed && "xl:p-8",
          className,
        )}
        {...props}
      >
        {(title || description || actions) && (
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              {title ? (
                <h2 className="text-lg font-semibold text-[color:var(--ds-text-strong)] sm:text-xl">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p className="text-sm text-[color:var(--ds-text-muted)]">{description}</p>
              ) : null}
            </div>
            {actions ? (
              <div className="flex flex-wrap items-center gap-2">{actions}</div>
            ) : null}
          </header>
        )}

        <div className="flex-1 space-y-5">{children}</div>

        {footer ? (
          <footer className="pt-4 text-sm text-[color:var(--ds-text-muted)]">
            {footer}
          </footer>
        ) : null}
      </SurfaceCard>
    );
  },
);
SectionCard.displayName = "SectionCard";
