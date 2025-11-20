import * as React from "react";

import { cn } from "@/lib/utils";

export interface DesignFormFieldProps
  extends React.HTMLAttributes<HTMLDivElement> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  helper?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  layout?: "vertical" | "horizontal";
}

export const DesignFormField = React.forwardRef<
  HTMLDivElement,
  DesignFormFieldProps
>(
  (
    {
      className,
      label,
      description,
      helper,
      error,
      required,
      layout = "vertical",
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          "space-y-2 text-sm text-[color:var(--ds-text-strong)]",
          layout === "horizontal" && "flex items-center gap-6",
          className,
        )}
        {...props}
      >
        <div className={cn("space-y-1", layout === "horizontal" && "w-48 shrink-0")}> 
          {label ? (
            <label className="flex items-center gap-1 text-sm font-medium text-[color:var(--ds-text-strong)]">
              <span>{label}</span>
              {required ? <span className="text-[color:var(--ds-danger)]">*</span> : null}
            </label>
          ) : null}
          {description ? (
            <p className="text-xs text-[color:var(--ds-text-muted)]">{description}</p>
          ) : null}
        </div>
        <div className={cn("space-y-1", layout === "horizontal" && "flex-1")}> 
          {children}
          {helper && !error ? (
            <p className="text-xs text-[color:var(--ds-text-muted)]">{helper}</p>
          ) : null}
          {error ? (
            <p className="text-xs font-medium text-[color:var(--ds-danger)]">{error}</p>
          ) : null}
        </div>
      </div>
    );
  },
);
DesignFormField.displayName = "DesignFormField";
