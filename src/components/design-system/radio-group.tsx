"use client";

import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { cn } from "@/lib/utils";

export interface DesignRadioGroupProps
  extends React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root> {
  orientation?: "vertical" | "horizontal";
}

export const DesignRadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  DesignRadioGroupProps
>(({ className, orientation = "vertical", ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Root
      ref={ref}
      className={cn(
        "flex gap-3",
        orientation === "vertical" ? "flex-col" : "flex-row",
        className,
      )}
      {...props}
    />
  );
});
DesignRadioGroup.displayName = "DesignRadioGroup";

export interface DesignRadioCardProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>,
    "title"
  > {
  title: React.ReactNode;
  description?: React.ReactNode;
}

export const DesignRadioCard = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  DesignRadioCardProps
>(({ className, title, description, children, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        "flex min-w-[200px] flex-1 cursor-pointer flex-col gap-2 rounded-3xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] p-4 text-left shadow-[var(--ds-shadow-soft)] transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ds-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--ds-surface-base)] data-[state=checked]:border-[color:var(--ds-primary)] data-[state=checked]:shadow-[0_18px_36px_rgba(123,119,85,0.18)]",
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-[color:var(--ds-border-strong)] bg-[color:var(--ds-surface-muted)] transition-colors data-[state=checked]:border-[color:var(--ds-primary)]">
          <RadioGroupPrimitive.Indicator className="relative flex size-5 items-center justify-center">
            <span className="absolute size-2.5 rounded-full bg-[color:var(--ds-primary)]" />
          </RadioGroupPrimitive.Indicator>
        </span>
        <div>
          <div className="text-sm font-semibold text-[color:var(--ds-text-strong)]">
            {title}
          </div>
          {description ? (
            <p className="text-xs text-[color:var(--ds-text-muted)]">{description}</p>
          ) : null}
        </div>
      </div>
      {children}
    </RadioGroupPrimitive.Item>
  );
});
DesignRadioCard.displayName = "DesignRadioCard";
