import * as React from "react";

import { cn } from "@/lib/utils";

export interface DesignTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  resize?: "none" | "vertical" | "both";
}

export const DesignTextarea = React.forwardRef<
  HTMLTextAreaElement,
  DesignTextareaProps
>(({ className, resize = "vertical", ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-[28px] border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] px-6 py-4 text-sm text-[color:var(--ds-text-strong)] placeholder:text-[color:var(--ds-text-subtle)] shadow-none transition-colors focus-visible:border-[color:var(--ds-focus-ring)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ds-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--ds-surface-base)] disabled:cursor-not-allowed disabled:opacity-50",
        resize === "none" && "resize-none",
        resize === "vertical" && "resize-y",
        resize === "both" && "resize",
        className,
      )}
      {...props}
    />
  );
});
DesignTextarea.displayName = "DesignTextarea";
