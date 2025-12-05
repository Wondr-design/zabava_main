import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const statusVariants = cva(
  "inline-flex items-center gap-2 rounded-md border px-3 py-1 text-xs font-medium transition-colors",
  {
    variants: {
      tone: {
        neutral:
          "border-border bg-muted text-muted-foreground",
        success:
          "border-transparent bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
        warning:
          "border-transparent bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
        danger:
          "border-transparent bg-destructive/15 text-destructive dark:bg-destructive/20",
        primary:
          "border-transparent bg-primary text-primary-foreground",
      },
      size: {
        sm: "text-[11px] px-2 py-0.5",
        md: "text-xs px-3 py-1",
      },
    },
    defaultVariants: {
      tone: "neutral",
      size: "md",
    },
  },
);

export interface StatusPillProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusVariants> {
  asChild?: boolean;
  icon?: React.ReactNode;
}

export const StatusPill = React.forwardRef<HTMLSpanElement, StatusPillProps>(
  ({ className, tone, size, asChild, icon, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "span";
    return (
      <Comp
        ref={ref}
        className={cn(statusVariants({ tone, size }), className)}
        {...props}
      >
        {icon ? <span className="[&>svg]:size-3.5">{icon}</span> : null}
        {children}
      </Comp>
    );
  },
);
StatusPill.displayName = "StatusPill";

export { statusVariants as statusPillVariants };
