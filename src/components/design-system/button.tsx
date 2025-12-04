import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const designButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full border text-sm font-semibold transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ds-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--ds-surface-card)] disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary:
          "bg-[color:var(--ds-primary)] text-[color:var(--ds-primary-foreground)] border-transparent shadow-none hover:bg-[color-mix(in srgb,var(--ds-primary) 94%,#000)]",
        secondary:
          "bg-[color:var(--ds-secondary)] text-[color:var(--ds-secondary-foreground)] border-transparent shadow-none hover:bg-[color-mix(in srgb,var(--ds-secondary) 95%,#000)]",
        tonal:
          "bg-[color:var(--ds-surface-muted)] text-[color:var(--ds-text-strong)] border border-[color:var(--ds-border-subtle)] shadow-none hover:bg-[color-mix(in srgb,var(--ds-surface-muted) 96%,#000)]",
        ghost:
          "border-transparent bg-transparent text-[color:var(--ds-text-muted)] hover:bg-[color:var(--ds-surface-muted)] hover:text-[color:var(--ds-text-strong)]",
        outline:
          "bg-transparent text-[color:var(--ds-text-strong)] border-[color:var(--ds-border-strong)] hover:border-[color-mix(in srgb,var(--ds-border-strong) 80%,#000)] hover:bg-[color:var(--ds-surface-muted)] shadow-none",
        destructive:
          "bg-[color:var(--ds-danger)] text-[color:var(--ds-text-inverse)] border-transparent shadow-none hover:bg-[color-mix(in srgb,var(--ds-danger) 90%,#000)] focus-visible:ring-[color:var(--ds-danger)]/40",
      },
      size: {
        md: "h-12 px-7",
        sm: "h-10 px-5 text-xs",
        lg: "h-14 px-9 text-base",
        icon: "h-12 w-12 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface DesignButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof designButtonVariants> {
  asChild?: boolean;
}

export const DesignButton = React.forwardRef<HTMLButtonElement, DesignButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(designButtonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
DesignButton.displayName = "DesignButton";

export { designButtonVariants };
