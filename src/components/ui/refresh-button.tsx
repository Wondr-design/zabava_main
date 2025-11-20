"use client";

import { RefreshCcw } from "lucide-react";
import { useState, useTransition } from "react";

import {
  DesignButton,
  type DesignButtonProps,
} from "@/components/design-system";
import { cn } from "@/lib/utils";
import { useLocalizedRouter } from "@/i18n/use-localized-router";

interface RefreshButtonProps
  extends Omit<DesignButtonProps, "children" | "onClick"> {
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
  variant = "tonal",
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
    <DesignButton
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
    </DesignButton>
  );
}
