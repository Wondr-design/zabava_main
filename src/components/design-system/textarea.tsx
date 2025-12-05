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
        "w-full min-h-[100px] rounded-md border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
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
