"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

export type DesignSwitchProps =
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>;

export const DesignSwitch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  DesignSwitchProps
>(({ className, ...props }, ref) => {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        "peer inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ds-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--ds-surface-base)] data-[state=checked]:bg-[color:var(--ds-primary)]",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block size-5 translate-x-[2px] rounded-full bg-[color:var(--ds-surface-card)] shadow-none transition-transform duration-200 ease-out data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=checked]:bg-[color:var(--ds-primary-foreground)]",
        )}
      />
    </SwitchPrimitive.Root>
  );
});
DesignSwitch.displayName = "DesignSwitch";
