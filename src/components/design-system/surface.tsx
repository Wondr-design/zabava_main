import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";

type SurfaceProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: "base" | "muted" | "card" | "elevated" | "popover";
  asChild?: boolean;
};

const surfaceClassMap: Record<NonNullable<SurfaceProps["variant"]>, string> = {
  base: "bg-[color:var(--ds-surface-base)] text-[color:var(--ds-text-strong)]",
  muted:
    "bg-[color:var(--ds-surface-muted)] text-[color:var(--ds-text-strong)] border border-[color:var(--ds-border-subtle)]",
  card: "bg-[color:var(--ds-surface-card)] text-[color:var(--ds-text-strong)] shadow-none border border-[color:var(--ds-border-subtle)]",
  elevated:
    "bg-[color:var(--ds-surface-elevated)] text-[color:var(--ds-text-strong)] shadow-none border border-[color:var(--ds-border-subtle)]",
  popover:
    "bg-[color:var(--ds-surface-popover)] text-[color:var(--ds-text-strong)] shadow-none border border-[color:var(--ds-border-subtle)]",
};

export const Surface = React.forwardRef<HTMLDivElement, SurfaceProps>(
  ({ className, variant = "base", asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "div";
    return (
      <Comp
        ref={ref}
        className={cn(
          "rounded-[32px] transition-shadow duration-200",
          surfaceClassMap[variant],
          className,
        )}
        {...props}
      />
    );
  },
);
Surface.displayName = "Surface";

export const SurfaceMuted = React.forwardRef<HTMLDivElement, SurfaceProps>(
  ({ className, ...props }, ref) => (
    <Surface ref={ref} variant="muted" className={className} {...props} />
  ),
);
SurfaceMuted.displayName = "SurfaceMuted";

export const SurfaceCard = React.forwardRef<HTMLDivElement, SurfaceProps>(
  ({ className, ...props }, ref) => (
    <Surface ref={ref} variant="card" className={className} {...props} />
  ),
);
SurfaceCard.displayName = "SurfaceCard";

export const SurfaceElevated = React.forwardRef<HTMLDivElement, SurfaceProps>(
  ({ className, ...props }, ref) => (
    <Surface ref={ref} variant="elevated" className={className} {...props} />
  ),
);
SurfaceElevated.displayName = "SurfaceElevated";

export const SurfacePopover = React.forwardRef<HTMLDivElement, SurfaceProps>(
  ({ className, ...props }, ref) => (
    <Surface ref={ref} variant="popover" className={className} {...props} />
  ),
);
SurfacePopover.displayName = "SurfacePopover";
