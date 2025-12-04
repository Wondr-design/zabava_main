import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const chipVariants = cva(
  "inline-flex items-center gap-2 rounded-full border px-5 py-2 text-xs font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ds-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--ds-surface-base)] disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      selected: {
        true: "bg-[color:var(--ds-primary)] text-[color:var(--ds-primary-foreground)] border-transparent shadow-none",
        false:
          "bg-[color:var(--ds-surface-muted)] text-[color:var(--ds-text-muted)] border-[color:var(--ds-border-subtle)] shadow-none hover:text-[color:var(--ds-text-strong)] hover:border-[color:var(--ds-border-strong)]",
      },
      size: {
        sm: "text-[11px] px-3 py-1.5",
        md: "text-xs px-5 py-2",
      },
    },
    defaultVariants: {
      selected: false,
      size: "md",
    },
  },
);

type ButtonAttributes = React.ButtonHTMLAttributes<HTMLButtonElement>;

export interface FilterChipProps
  extends ButtonAttributes,
    VariantProps<typeof chipVariants> {
  asChild?: boolean;
  leadingIcon?: React.ReactNode;
}

export const FilterChip = React.forwardRef<HTMLButtonElement, FilterChipProps>(
  ({ className, asChild, selected, size, leadingIcon, children, ...props }, ref) => {
    if (asChild) {
      const child = React.Children.only(children);
      if (!React.isValidElement(child)) {
        if (process.env.NODE_ENV !== "production") {
          console.error(
            "[FilterChip] `asChild` expects a single React element, but received:",
            children,
          );
        }
        return null;
      }

      type ChildProps = { className?: string; children?: React.ReactNode };
      const childElement = child as React.ReactElement<ChildProps>;

      const childClassName = childElement.props.className;
      const mergedClassName = cn(
        chipVariants({ selected, size }),
        className,
        childClassName,
      );

      const nextChildren =
        leadingIcon || childElement.props.children ? (
          <>
            {leadingIcon ? (
              <span className="flex items-center text-[color:var(--ds-text-subtle)] [&>svg]:size-3.5">
                {leadingIcon}
              </span>
            ) : null}
            {childElement.props.children}
          </>
        ) : undefined;

      return React.cloneElement(childElement, {
        ...props,
        className: mergedClassName,
        children: nextChildren ?? childElement.props.children,
      });
    }

    return (
      <button
        ref={ref}
        className={cn(chipVariants({ selected, size }), className)}
        {...props}
      >
        {leadingIcon ? (
          <span className="flex items-center text-[color:var(--ds-text-subtle)] [&>svg]:size-3.5">
            {leadingIcon}
          </span>
        ) : null}
        {children}
      </button>
    );
  },
);
FilterChip.displayName = "FilterChip";

export { chipVariants as filterChipVariants };
