import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";

type SurfaceProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: "base" | "muted" | "card" | "elevated" | "popover";
  asChild?: boolean;
};

const surfaceClassMap: Record<NonNullable<SurfaceProps["variant"]>, string> = {
  base: "bg-background text-foreground",
  muted:
    "bg-muted text-foreground border border-border",
  card: "bg-card text-card-foreground border border-border",
  elevated:
    "bg-accent text-accent-foreground border border-border",
  popover:
    "bg-popover text-popover-foreground border border-border",
};

export const Surface = React.forwardRef<HTMLDivElement, SurfaceProps>(
  ({ className, variant = "base", asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "div";
    return (
      <Comp
        ref={ref}
        className={cn(
          "rounded-lg transition-shadow duration-200",
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
