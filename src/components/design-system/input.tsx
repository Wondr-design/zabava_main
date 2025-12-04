import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";

export interface DesignInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  /**
   * Force-enable or disable the password toggle. Defaults to enabling
   * automatically when `type="password"` and no `trailingIcon` is provided.
   */
  passwordToggle?: boolean;
}

export const DesignInput = React.forwardRef<HTMLInputElement, DesignInputProps>(
  (
    {
      className,
      leadingIcon,
      trailingIcon,
      type = "text",
      passwordToggle,
      ...props
    },
    ref,
  ) => {
    const [showPassword, setShowPassword] = React.useState(false);

    const isPasswordType = type === "password";
    const shouldToggle =
      (passwordToggle ?? (isPasswordType && !trailingIcon)) && isPasswordType;

    React.useEffect(() => {
      if (!isPasswordType) {
        setShowPassword(false);
      }
    }, [isPasswordType]);

    const resolvedType =
      shouldToggle && showPassword ? "text" : shouldToggle ? "password" : type;

    return (
      <div className="relative flex items-center">
        {leadingIcon ? (
          <span className="pointer-events-none absolute left-4 text-[color:var(--ds-text-muted)] [&>svg]:size-4">
            {leadingIcon}
          </span>
        ) : null}
        <input
          ref={ref}
          type={resolvedType}
          className={cn(
            "h-12 w-full rounded-[999px] border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] px-5 text-sm text-[color:var(--ds-text-strong)] placeholder:text-[color:var(--ds-text-subtle)] shadow-none transition-colors focus-visible:border-[color:var(--ds-focus-ring)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ds-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--ds-surface-base)] disabled:cursor-not-allowed disabled:opacity-50",
            leadingIcon && "pl-11",
            (trailingIcon || shouldToggle) && "pr-11",
            className,
          )}
          {...props}
        />
        {shouldToggle ? (
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 inline-flex size-8 items-center justify-center rounded-full text-[color:var(--ds-text-muted)] transition-colors hover:text-[color:var(--ds-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ds-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--ds-surface-base)]"
            aria-label={showPassword ? "Hide password" : "Show password"}
            title={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        ) : trailingIcon ? (
          <span className="absolute right-4 text-[color:var(--ds-text-muted)] [&>svg]:size-4">
            {trailingIcon}
          </span>
        ) : null}
      </div>
    );
  },
);
DesignInput.displayName = "DesignInput";

