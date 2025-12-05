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
        "flex min-w-[200px] flex-1 cursor-pointer flex-col gap-2 rounded-lg border border-border bg-card p-4 text-left transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=checked]:border-primary data-[state=checked]:bg-accent",
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-primary text-primary">
          <RadioGroupPrimitive.Indicator className="relative flex size-4 items-center justify-center">
            <span className="absolute size-2 rounded-full bg-current" />
          </RadioGroupPrimitive.Indicator>
        </span>
        <div>
          <div className="text-sm font-medium text-foreground">
            {title}
          </div>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {children}
    </RadioGroupPrimitive.Item>
  );
});
DesignRadioCard.displayName = "DesignRadioCard";
