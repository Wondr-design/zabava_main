"use client";

import * as React from "react";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

type Option = {
  value: string;
  label: string;
  description?: string;
};

interface MultiSelectProps {
  options: Option[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: MultiSelectProps) {
  const toggle = React.useCallback(
    (nextValue: string) => {
      if (value.includes(nextValue)) {
        onChange(value.filter((item) => item !== nextValue));
      } else {
        onChange([...value, nextValue]);
      }
    },
    [onChange, value]
  );

  if (options.length === 0) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300",
          className
        )}
      >
        {placeholder ?? "No options available."}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-3 rounded-lg border border-border bg-card p-4 text-sm text-foreground shadow-sm sm:grid-cols-2",
        className
      )}
    >
      {options.map((option) => {
        const active = value.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => toggle(option.value)}
            className={cn(
              "group relative flex w-full flex-col gap-2 rounded-2xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed",
              active
                ? "border-emerald-300/80 bg-emerald-50/70 text-emerald-900 shadow-[0_12px_40px_-24px_rgba(16,185,129,0.7)] dark:border-emerald-400/60 dark:bg-emerald-500/10 dark:text-emerald-100"
                : "border-border bg-muted/50 text-foreground hover:border-border hover:bg-muted",
              disabled ? "opacity-60" : ""
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium tracking-tight">
                {option.label}
              </span>
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full border text-xs transition",
                  active
                    ? "border-emerald-400 bg-emerald-500/15 text-emerald-500 dark:border-emerald-300 dark:text-emerald-200"
                    : "border-border bg-background text-transparent group-hover:text-muted-foreground"
                )}
              >
                <Check className="h-3.5 w-3.5" />
              </span>
            </div>
            {option.description ? (
              <p
                className={cn(
                  "text-xs leading-relaxed",
                  active
                    ? "text-emerald-600 dark:text-emerald-200/80"
                    : "text-slate-500 dark:text-slate-400"
                )}
              >
                {option.description}
              </p>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
