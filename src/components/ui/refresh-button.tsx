"use client";

import { RefreshCcw } from "lucide-react";
import { useState, useTransition } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocalizedRouter } from "@/i18n/use-localized-router";

interface RefreshButtonProps
  extends Omit<ButtonProps, "children" | "onClick"> {
  onRefresh?: () => Promise<void> | void;
  label?: string;
  loading?: boolean;
}

export function RefreshButton({
  onRefresh,
  label = "Refresh",
  className,
  disabled = false,
  loading: loadingOverride,
  variant = "secondary",
  size = "sm",
  ...buttonProps
}: RefreshButtonProps) {
  const router = useLocalizedRouter();
  const [isPending, startPending] = useTransition();
  const [manualLoading, setManualLoading] = useState(false);
  const loading =
    typeof loadingOverride === "boolean"
      ? loadingOverride
      : isPending || manualLoading;

  async function handleClick() {
    if (disabled) return;
    if (onRefresh) {
      try {
        setManualLoading(true);
        await onRefresh();
      } finally {
        setManualLoading(false);
      }
      return;
    }

    startPending(() => {
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn("gap-2", className)}
      onClick={handleClick}
      disabled={disabled || loading}
      {...buttonProps}
    >
      <RefreshCcw
        className={cn("size-4", loading && "animate-spin")}
        aria-hidden
      />
      {loading ? "Refreshing…" : label}
    </Button>
  );
}
