import * as React from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const DesignSelect = Select;

export const DesignSelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectTrigger>,
  React.ComponentPropsWithoutRef<typeof SelectTrigger>
>(({ className, ...props }, ref) => (
  <SelectTrigger
    ref={ref}
    className={cn(
      "h-12 w-full rounded-[999px] border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] px-5 text-sm text-[color:var(--ds-text-strong)] placeholder:text-[color:var(--ds-text-subtle)] shadow-none transition-colors focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-focus-ring)] focus:ring-offset-2 focus:ring-offset-[color:var(--ds-surface-base)] data-[placeholder]:text-[color:var(--ds-text-subtle)]",
      className,
    )}
    {...props}
  />
));
DesignSelectTrigger.displayName = "DesignSelectTrigger";

export const DesignSelectContent = React.forwardRef<
  React.ElementRef<typeof SelectContent>,
  React.ComponentPropsWithoutRef<typeof SelectContent>
>(({ className, position = "popper", ...props }, ref) => (
  <SelectContent
    ref={ref}
    position={position}
    className={cn(
      "rounded-[28px] border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-popover)] shadow-[var(--ds-shadow-popover)]",
      className,
    )}
    {...props}
  />
));
DesignSelectContent.displayName = "DesignSelectContent";

export const DesignSelectItem = React.forwardRef<
  React.ElementRef<typeof SelectItem>,
  React.ComponentPropsWithoutRef<typeof SelectItem>
>(({ className, ...props }, ref) => (
  <SelectItem
    ref={ref}
    className={cn(
      "relative flex w-full cursor-pointer select-none items-center rounded-2xl px-4 py-2 text-sm font-medium text-[color:var(--ds-text-muted)] outline-none transition-colors focus:bg-[color:var(--ds-surface-muted)] focus:text-[color:var(--ds-text-strong)] data-[state=checked]:bg-[color:var(--ds-primary)]/12 data-[state=checked]:text-[color:var(--ds-text-strong)]",
      className,
    )}
    {...props}
  />
));
DesignSelectItem.displayName = "DesignSelectItem";

export const DesignSelectValue = SelectValue;
export const DesignSelectGroup = SelectGroup;
export const DesignSelectLabel = SelectLabel;
export const DesignSelectSeparator = SelectSeparator;
