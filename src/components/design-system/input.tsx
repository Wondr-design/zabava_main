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
          <span className="pointer-events-none absolute left-4 text-muted-foreground [&>svg]:size-4">
            {leadingIcon}
          </span>
        ) : null}
        <input
          ref={ref}
          type={resolvedType}
          className={cn(
            "h-10 w-full rounded-md border border-input bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
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
            className="absolute right-3 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label={showPassword ? "Hide password" : "Show password"}
            title={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        ) : trailingIcon ? (
          <span className="absolute right-4 text-muted-foreground [&>svg]:size-4">
            {trailingIcon}
          </span>
        ) : null}
      </div>
    );
  },
);
DesignInput.displayName = "DesignInput";

