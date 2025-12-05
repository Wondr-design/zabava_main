import * as React from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export type SegmentedControlProps = React.ComponentPropsWithoutRef<
  typeof ToggleGroup
> & {
  size?: "sm" | "md" | "lg";
};

const sizeMap = {
  sm: "min-h-9 text-xs",
  md: "min-h-10 text-sm",
  lg: "min-h-11 text-base",
};

export function SegmentedControl({
  className,
  children,
  size = "md",
  ...props
}: SegmentedControlProps) {
  return (
    <ToggleGroup
      className={cn(
        "inline-flex rounded-lg border border-border bg-muted p-1",
        className,
      )}
      {...props}
    >
      {React.Children.map(children, (child) =>
        React.isValidElement<SegmentedControlItemProps>(child)
          ? React.cloneElement(child, { size })
          : child,
      )}
    </ToggleGroup>
  );
}

export type SegmentedControlItemProps = React.ComponentPropsWithoutRef<
  typeof ToggleGroupItem
> & {
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
};

export const SegmentedControlItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupItem>,
  SegmentedControlItemProps
>(({ className, size = "md", icon, children, ...props }, ref) => {
  return (
    <ToggleGroupItem
      ref={ref}
      className={cn(
        "inline-flex flex-1 items-center justify-center gap-2 rounded-md px-3 font-medium text-muted-foreground transition-all data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        sizeMap[size],
        className,
      )}
      {...props}
    >
      {icon ? <span className="[&>svg]:size-4">{icon}</span> : null}
      {children}
    </ToggleGroupItem>
  );
});
SegmentedControlItem.displayName = "SegmentedControlItem";
