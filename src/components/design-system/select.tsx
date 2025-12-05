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
      "h-10 w-full rounded-md border border-input bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background data-[placeholder]:text-muted-foreground",
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
      "rounded-md border border-border bg-popover text-popover-foreground shadow-md",
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
      "relative flex w-full cursor-pointer select-none items-center rounded-sm px-3 py-2 text-sm text-foreground outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground",
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
