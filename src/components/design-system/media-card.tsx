import * as React from "react";

import { cn } from "@/lib/utils";
import { SurfaceCard } from "./surface";

export interface MediaCardProps
  extends Omit<React.ComponentPropsWithoutRef<"div">, "title"> {
  media: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  meta?: React.ReactNode;
  footer?: React.ReactNode;
  overlay?: React.ReactNode;
}


export const MediaCard = React.forwardRef<HTMLDivElement, MediaCardProps>(
  (
    { className, media, title, subtitle, badge, meta, footer, overlay, ...props },
    ref,
  ) => {
    return (
      <SurfaceCard
        ref={ref}
        className={cn(
          "group flex h-full flex-col gap-4 rounded-[28px] border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-4 transition-shadow duration-200 hover:shadow-[0_18px_40px_rgba(47,46,40,0.15)]",
          className,
        )}
        {...props}
      >
        <div className="relative overflow-hidden rounded-3xl">
          {media}
          {overlay ? (
            <div className="absolute inset-0 flex items-end justify-between p-4 text-sm text-[color:var(--ds-text-inverse)]">
              {overlay}
            </div>
          ) : null}
          {badge ? (
            <div className="absolute left-4 top-4 inline-flex items-center rounded-full bg-[color:var(--ds-primary)]/90 px-3 py-1 text-xs font-semibold text-[color:var(--ds-primary-foreground)] shadow-sm">
              {badge}
            </div>
          ) : null}
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-[color:var(--ds-text-strong)]">
            {title}
          </h3>
          {subtitle ? (
            <p className="text-sm text-[color:var(--ds-text-muted)]">{subtitle}</p>
          ) : null}
          {meta ? <div className="text-xs text-[color:var(--ds-text-subtle)]">{meta}</div> : null}
        </div>
        {footer ? <div className="mt-auto pt-2 text-sm">{footer}</div> : null}
      </SurfaceCard>
    );
  },
);
MediaCard.displayName = "MediaCard";
