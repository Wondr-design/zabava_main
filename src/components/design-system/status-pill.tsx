import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const statusVariants = cva(
  "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[11px] font-semibold shadow-sm transition-colors",
  {
    variants: {
      tone: {
        neutral:
          "border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] text-[color:var(--ds-text-muted)] shadow-none",
        success:
          "border-transparent bg-[color:var(--ds-success)] text-[color:var(--ds-text-strong)] shadow-none",
        warning:
          "border-transparent bg-[color:var(--ds-warning)] text-[color:var(--ds-text-strong)] shadow-none",
        danger:
          "border-transparent bg-[color:var(--ds-danger)] text-[color:var(--ds-text-inverse)] shadow-none",
        primary:
          "border-transparent bg-[color:var(--ds-primary)] text-[color:var(--ds-primary-foreground)] shadow-none",
      },
      size: {
        sm: "text-[11px] px-2.5 py-1",
        md: "text-xs px-3 py-1.5",
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
