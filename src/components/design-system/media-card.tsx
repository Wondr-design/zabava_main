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
          "group flex h-full flex-col gap-4 rounded-lg border border-border bg-card p-4 transition-colors duration-200 hover:bg-accent/50",
          className,
        )}
        {...props}
      >
        <div className="relative overflow-hidden rounded-md">
          {media}
          {overlay ? (
            <div className="absolute inset-0 flex items-end justify-between p-4 text-sm text-white">
              {overlay}
            </div>
          ) : null}
          {badge ? (
            <div className="absolute left-3 top-3 inline-flex items-center rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">
              {badge}
            </div>
          ) : null}
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">
            {title}
          </h3>
          {subtitle ? (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
          {meta ? <div className="text-xs text-muted-foreground">{meta}</div> : null}
        </div>
        {footer ? <div className="mt-auto pt-2 text-sm">{footer}</div> : null}
      </SurfaceCard>
    );
  },
);
MediaCard.displayName = "MediaCard";
