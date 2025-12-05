import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const designButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md border text-sm font-medium transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground border-transparent hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/80",
        tonal:
          "bg-muted text-foreground border border-border hover:bg-accent",
        ghost:
          "border-transparent bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
        outline:
          "bg-background text-foreground border-border hover:bg-accent hover:text-accent-foreground",
        destructive:
          "bg-destructive text-destructive-foreground border-transparent hover:bg-destructive/90 focus-visible:ring-destructive/40",
      },
      size: {
        md: "h-10 px-5",
        sm: "h-9 px-4 text-xs",
        lg: "h-11 px-6 text-base",
        icon: "h-10 w-10 p-0",
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
