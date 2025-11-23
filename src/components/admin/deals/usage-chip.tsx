"use client";

import { cn } from "@/lib/utils";

interface UsageChipProps {
  label: string;
  value: number | string;
  tone?: string;
}

export function UsageChip({ label, value, tone }: UsageChipProps) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border border-border/40 bg-card px-4 py-3 text-xs",
        tone,
      )}
    >
      <span className="font-semibold uppercase tracking-wide">{label}</span>
      <span className="text-lg font-bold">{value}</span>
    </div>
  );
}
