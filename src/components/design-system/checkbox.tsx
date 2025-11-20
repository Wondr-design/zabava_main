"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type DesignCheckboxProps =
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>;

export const DesignCheckbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  DesignCheckboxProps
>(({ className, ...props }, ref) => {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "inline-flex size-5 items-center justify-center rounded-lg border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ds-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--ds-surface-base)] data-[state=checked]:border-[color:var(--ds-primary)] data-[state=checked]:bg-[color:var(--ds-primary)]",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="text-[color:var(--ds-primary-foreground)]">
        <CheckIcon className="size-3.5" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
DesignCheckbox.displayName = "DesignCheckbox";
