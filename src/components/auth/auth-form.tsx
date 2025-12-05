"use client";

import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Loader2, Mail, Lock, User } from "lucide-react";

type AuthInputProps = {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  hint?: string;
  icon?: "email" | "password" | "user" | "code";
  readOnly?: boolean;
  maxLength?: number;
  inputMode?: "text" | "numeric" | "email";
  rightElement?: React.ReactNode;
};

function CodeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

const iconMap = {
  email: Mail,
  password: Lock,
  user: User,
  code: CodeIcon,
};

export function AuthInput({
  id,
  label,
  type = "text",
  value,
  onChange,
  onKeyDown,
  placeholder,
  required = false,
  disabled = false,
  autoComplete,
  hint,
  icon,
  readOnly = false,
  maxLength,
  inputMode,
  rightElement,
}: AuthInputProps) {
  const IconComponent = icon ? iconMap[icon] : null;

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      <div className="relative">
        {IconComponent && (
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <IconComponent className="h-4 w-4" />
          </div>
        )}
        <Input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          readOnly={readOnly}
          maxLength={maxLength}
          inputMode={inputMode}
          className={cn(
            "h-11 transition-all duration-200",
            "border-border bg-background",
            "focus:border-foreground focus:ring-1 focus:ring-foreground/20",
            IconComponent && "pl-10",
            rightElement && "pr-24",
            disabled && "opacity-60",
            readOnly && "cursor-not-allowed bg-muted"
          )}
        />
        {rightElement && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2">
            {rightElement}
          </div>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

type AuthInputWithButtonProps = AuthInputProps & {
  buttonText: string;
  buttonLoading?: boolean;
  buttonLoadingText?: string;
  buttonDisabled?: boolean;
  onButtonClick: () => void;
};

export function AuthInputWithButton({
  buttonText,
  buttonLoading = false,
  buttonLoadingText,
  buttonDisabled = false,
  onButtonClick,
  ...inputProps
}: AuthInputWithButtonProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !buttonDisabled && !buttonLoading) {
      e.preventDefault();
      onButtonClick();
    }
    // Also call the original onKeyDown if provided
    inputProps.onKeyDown?.(e);
  };

  return (
    <AuthInput
      {...inputProps}
      onKeyDown={handleKeyDown}
      rightElement={
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onButtonClick}
          disabled={buttonDisabled || buttonLoading}
          className="h-9 px-3 text-xs font-medium"
        >
          {buttonLoading ? (
            <>
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              {buttonLoadingText || "Loading..."}
            </>
          ) : (
            buttonText
          )}
        </Button>
      }
    />
  );
}

type AuthAlertProps = {
  type: "error" | "success" | "info";
  message: string;
  className?: string;
};

export function AuthAlert({ type, message, className }: AuthAlertProps) {
  const config = {
    error: {
      bg: "bg-red-50 dark:bg-red-950/30",
      border: "border-red-200 dark:border-red-900/50",
      icon: "bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400",
      text: "text-red-800 dark:text-red-200",
      subtext: "text-red-600 dark:text-red-400",
    },
    success: {
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      border: "border-emerald-200 dark:border-emerald-900/50",
      icon: "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400",
      text: "text-emerald-800 dark:text-emerald-200",
      subtext: "text-emerald-600 dark:text-emerald-400",
    },
    info: {
      bg: "bg-blue-50 dark:bg-blue-950/30",
      border: "border-blue-200 dark:border-blue-900/50",
      icon: "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400",
      text: "text-blue-800 dark:text-blue-200",
      subtext: "text-blue-600 dark:text-blue-400",
    },
  };

  const styles = config[type];

  const icons = {
    error: AlertCircle,
    success: CheckCircle2,
    info: () => (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" />
      </svg>
    ),
  };

  const Icon = icons[type];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={cn(
          "relative overflow-hidden rounded-lg border",
          styles.bg,
          styles.border,
          className
        )}
      >
        <div className="flex items-start gap-3 p-3">
          <div className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            styles.icon
          )}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 pt-1">
            <p className={cn("text-sm font-medium leading-relaxed", styles.text)}>
              {message}
            </p>
          </div>
        </div>
        {/* Subtle gradient accent */}
        <div className={cn(
          "absolute bottom-0 left-0 h-0.5 w-full",
          type === "error" && "bg-gradient-to-r from-red-500 via-red-400 to-red-500",
          type === "success" && "bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500",
          type === "info" && "bg-gradient-to-r from-blue-500 via-blue-400 to-blue-500"
        )} />
      </motion.div>
    </AnimatePresence>
  );
}

type AuthSubmitButtonProps = {
  loading?: boolean;
  loadingText?: string;
  disabled?: boolean;
  children: React.ReactNode;
};

export function AuthSubmitButton({
  loading = false,
  loadingText = "Please wait...",
  disabled = false,
  children,
}: AuthSubmitButtonProps) {
  return (
    <Button
      type="submit"
      disabled={disabled || loading}
      className={cn(
        "h-11 w-full font-medium",
        "bg-foreground text-background",
        "hover:bg-foreground/90",
        "transition-all duration-200"
      )}
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {loadingText}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

type AuthDividerProps = {
  text?: string;
};

export function AuthDivider({ text = "or" }: AuthDividerProps) {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-background px-2 text-muted-foreground">{text}</span>
      </div>
    </div>
  );
}

type AuthLinkProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
};

export function AuthLink({ href, children, className }: AuthLinkProps) {
  return (
    <a
      href={href}
      className={cn(
        "font-medium text-foreground underline-offset-4 hover:underline",
        "transition-colors duration-200",
        className
      )}
    >
      {children}
    </a>
  );
}

type AuthVerificationStatusProps = {
  verified: boolean;
  email?: string | null;
  expiresAt?: string | null;
  onReset?: () => void;
};

export function AuthVerificationStatus({
  verified,
  email,
  expiresAt,
  onReset,
}: AuthVerificationStatusProps) {
  if (verified && email) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center justify-between rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span className="text-sm text-green-600">
            Verified: <span className="font-medium">{email}</span>
          </span>
        </div>
        {onReset && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
          >
            Change
          </Button>
        )}
      </motion.div>
    );
  }

  if (expiresAt) {
    return (
      <p className="text-xs text-muted-foreground">
        Code expires at {new Date(expiresAt).toLocaleTimeString()}
      </p>
    );
  }

  return null;
}

type EmailVerificationSectionProps = {
  email: string;
  onEmailChange: (value: string) => void;
  codeInput: string;
  onCodeChange: (value: string) => void;
  isVerified: boolean;
  verifiedEmail?: string | null;
  expiresAt?: string | null;
  verificationError?: string | null;
  onRequestCode: () => void;
  onVerifyCode: () => void;
  onReset?: () => void;
  codeRequesting: boolean;
  codeVerifying: boolean;
};

export function EmailVerificationSection({
  email,
  onEmailChange,
  codeInput,
  onCodeChange,
  isVerified,
  verifiedEmail,
  expiresAt,
  verificationError,
  onRequestCode,
  onVerifyCode,
  onReset,
  codeRequesting,
  codeVerifying,
}: EmailVerificationSectionProps) {
  return (
    <div className="space-y-4">
      <AuthInputWithButton
        id="email"
        label="Email"
        type="email"
        value={email}
        onChange={onEmailChange}
        placeholder="you@example.com"
        required
        autoComplete="email"
        icon="email"
        disabled={codeRequesting || isVerified}
        buttonText="Send code"
        buttonLoading={codeRequesting}
        buttonLoadingText="Sending..."
        buttonDisabled={codeRequesting || !email.trim().length || isVerified}
        onButtonClick={onRequestCode}
      />

      {verificationError && (
        <p className="text-xs text-destructive">{verificationError}</p>
      )}

      <AuthVerificationStatus
        verified={isVerified}
        email={verifiedEmail}
        expiresAt={!isVerified ? expiresAt : null}
        onReset={onReset}
      />

      {!isVerified && (
        <AuthInputWithButton
          id="code"
          label="Verification code"
          type="text"
          inputMode="numeric"
          value={codeInput}
          onChange={onCodeChange}
          placeholder="Enter 6-digit code"
          required
          maxLength={8}
          icon="code"
          buttonText={isVerified ? "Verified" : "Verify"}
          buttonLoading={codeVerifying}
          buttonLoadingText="Verifying..."
          buttonDisabled={isVerified || codeVerifying || !codeInput.trim() || !email.trim().length}
          onButtonClick={onVerifyCode}
        />
      )}
    </div>
  );
}

