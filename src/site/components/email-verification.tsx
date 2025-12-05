"use client";

import { useState } from "react";
import { Loader2, ShieldCheck, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DesignButton,
  DesignFormField,
  DesignInput,
} from "@/components/design-system";
import { useEmailVerification } from "@/hooks/use-email-verification";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/i18n/provider";

interface EmailVerificationProps {
  type:
    | "visit"
    | "bonus"
    | "generic"
    | "admin_signup"
    | "partner_signup"
    | "staff_signup"
    | "admin_password_reset"
    | "partner_password_reset"
    | "staff_password_reset";
  partnerId?: string;
  onVerified?: (email: string, code: string) => void;
  className?: string;
  requestEndpoint?: string;
  verifyEndpoint?: string;
  /** Use "auth" variant for dashboard auth pages, "public" for public-facing pages */
  variant?: "public" | "auth";
}

export function EmailVerification(props: EmailVerificationProps) {
  const {
    type,
    partnerId,
    onVerified,
    className,
    requestEndpoint,
    verifyEndpoint,
    variant = "public",
  } = props;

  const verification = useEmailVerification({
    type,
    partnerId,
    requestEndpoint,
    verifyEndpoint,
  });

  const [inputEmail, setInputEmail] = useState("");
  const [inputCode, setInputCode] = useState("");
  const t = useTranslations("verification");

  const emailVerified = Boolean(verification.verifiedAt);

  async function handleRequestCode() {
    if (!inputEmail) return;
    await verification.requestCode(inputEmail.trim().toLowerCase());
  }

  async function handleVerify() {
    if (!inputCode) return;
    const codeValue = inputCode.trim();
    const ok = await verification.verifyCode(codeValue);
    if (ok && onVerified) {
      onVerified(verification.email, codeValue);
    }
  }

  // Determine if we should use the bonus page or auth variant styling
  const isBonusPage = type === "bonus";
  const isAuthVariant = variant === "auth" || 
    type.includes("signup") || 
    type.includes("password_reset") ||
    type === "admin_signup" ||
    type === "partner_signup" ||
    type === "staff_signup";

  // Auth variant - clean, minimal design for dashboard auth pages
  if (isAuthVariant && !isBonusPage) {
    return (
      <div className={cn("w-full space-y-4", className)}>
        {/* Email field */}
        <div className="space-y-2">
          <Label htmlFor="verify-email" className="text-sm font-medium text-foreground">
            Email <span className="text-destructive">*</span>
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <Mail className="h-4 w-4" />
              </div>
              <Input
                id="verify-email"
                type="email"
                value={inputEmail}
                onChange={(e) => setInputEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !verification.requesting && !emailVerified && inputEmail.trim().length > 0) {
                    e.preventDefault();
                    handleRequestCode();
                  }
                }}
                disabled={verification.requesting || emailVerified}
                placeholder={t("emailPlaceholder")}
                autoComplete="email"
                className="h-11 pl-10 border-border bg-background focus:border-foreground focus:ring-1 focus:ring-foreground/20"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={handleRequestCode}
              disabled={
                verification.requesting ||
                emailVerified ||
                inputEmail.trim().length === 0
              }
              className="h-11 px-4 font-medium"
            >
              {verification.requesting ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send code"
              )}
            </Button>
          </div>
        </div>

        {/* Verification code field */}
        <div className="space-y-2">
          <Label htmlFor="verify-code" className="text-sm font-medium text-foreground">
            Verification code <span className="text-destructive">*</span>
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <Input
                id="verify-code"
                type="text"
                inputMode="numeric"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !verification.verifying && !emailVerified && verification.email.length > 0 && inputCode.trim().length > 0) {
                    e.preventDefault();
                    handleVerify();
                  }
                }}
                disabled={verification.verifying || emailVerified}
                placeholder={t("codePlaceholder")}
                maxLength={8}
                className="h-11 pl-10 border-border bg-background focus:border-foreground focus:ring-1 focus:ring-foreground/20"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={handleVerify}
              disabled={
                verification.verifying ||
                emailVerified ||
                verification.email.length === 0 ||
                inputCode.trim().length === 0
              }
              className="h-11 px-4 font-medium"
            >
              {verification.verifying ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : emailVerified ? (
                "Verified"
              ) : (
                "Verify"
              )}
            </Button>
          </div>
        </div>

        {/* Expiry notice */}
        {verification.expiresAt && !emailVerified && (
          <p className="text-xs text-muted-foreground">
            Code expires at {new Date(verification.expiresAt).toLocaleTimeString()}
          </p>
        )}

        {/* Error message */}
        {verification.error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2.5">
            <p className="text-sm text-destructive">{verification.error}</p>
          </div>
        )}

        {/* Success message */}
        {emailVerified && (
          <div className="flex items-center gap-2 rounded-lg border border-green-500/50 bg-green-500/10 px-3 py-2.5">
            <ShieldCheck className="h-4 w-4 shrink-0 text-green-600" />
            <p className="text-sm text-green-600">
              Email verified at {new Date(verification.verifiedAt ?? Date.now()).toLocaleTimeString()}
            </p>
          </div>
        )}
      </div>
    );
  }

  // Original public variant - for bonus page and other public-facing pages
  return (
    <div className={cn("w-full space-y-6", className)}>
      <div className="space-y-6">
        <DesignFormField
          className="space-y-3"
          label={
            <span className={cn(
              "text-[0.7rem] font-bold uppercase tracking-[0.35em]",
              isBonusPage ? "text-white" : "text-violet-300"
            )}>
              {t("emailLabel")}
            </span>
          }
        >
          <div className={cn(
            "flex gap-3",
            isBonusPage ? "flex-col" : "flex-col sm:flex-row sm:items-center"
          )}>
            <DesignInput
              type="email"
              value={inputEmail}
              onChange={(event) => setInputEmail(event.target.value)}
              disabled={verification.requesting || emailVerified}
              placeholder={t("emailPlaceholder")}
              autoComplete="email"
              className={cn(
                "text-white placeholder:text-slate-400 transition-all",
                isBonusPage
                  ? "w-full h-12 bg-white/10 border border-white/20 rounded-xl px-4 focus:border-white/40 focus:ring-2 focus:ring-white/20"
                  : "flex-1 bg-white/10 border-white/30 focus:border-violet-400/60 focus:ring-violet-400/30"
              )}
            />
            <DesignButton
              type="button"
              size="sm"
              onClick={handleRequestCode}
              variant="primary"
              disabled={
                verification.requesting ||
                emailVerified ||
                inputEmail.trim().length === 0
              }
              className={cn(
                "text-white font-medium transition-all",
                isBonusPage
                  ? "w-full h-12 rounded-xl bg-white text-slate-950 hover:bg-slate-100 shadow-lg shadow-black/20"
                  : "sm:min-w-[120px] bg-gradient-to-r from-violet-500 via-indigo-500 to-purple-500 hover:from-violet-600 hover:via-indigo-600 hover:to-purple-600 shadow-lg shadow-violet-500/40"
              )}
            >
              {verification.requesting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("sending")}
                </>
              ) : (
                t("send")
              )}
            </DesignButton>
          </div>
        </DesignFormField>

        <DesignFormField
          className="space-y-3"
          label={
            <span className={cn(
              "text-[0.7rem] font-bold uppercase tracking-[0.35em]",
              isBonusPage ? "text-white" : "text-violet-300"
            )}>
              {t("codeLabel")}
            </span>
          }
        >
          <div className={cn(
            "flex gap-3",
            isBonusPage ? "flex-col" : "flex-col sm:flex-row sm:items-center"
          )}>
            <DesignInput
              type="text"
              inputMode="numeric"
              value={inputCode}
              onChange={(event) => setInputCode(event.target.value)}
              disabled={verification.verifying || emailVerified}
              placeholder={t("codePlaceholder")}
              maxLength={8}
              className={cn(
                "text-white placeholder:text-slate-400 transition-all",
                isBonusPage
                  ? "w-full h-12 bg-white/10 border border-white/20 rounded-xl px-4 focus:border-white/40 focus:ring-2 focus:ring-white/20"
                  : "flex-1 bg-white/10 border-white/30 focus:border-violet-400/60 focus:ring-violet-400/30"
              )}
            />
            <DesignButton
              type="button"
              size="sm"
              variant="primary"
              onClick={handleVerify}
              disabled={
                verification.verifying ||
                emailVerified ||
                verification.email.length === 0 ||
                inputCode.trim().length === 0
              }
              className={cn(
                "text-white font-medium transition-all",
                isBonusPage
                  ? "w-full h-12 rounded-xl bg-white text-slate-950 hover:bg-slate-100 shadow-lg shadow-black/20"
                  : "sm:min-w-[120px] bg-gradient-to-r from-violet-500 via-indigo-500 to-purple-500 hover:from-violet-600 hover:via-indigo-600 hover:to-purple-600 shadow-lg shadow-violet-500/40"
              )}
            >
              {verification.verifying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("verifying")}
                </>
              ) : (
                t("verify")
              )}
            </DesignButton>
          </div>
        </DesignFormField>

        {verification.expiresAt && !emailVerified ? (
          <div className={cn(
            "rounded-lg px-3 py-2",
            isBonusPage
              ? "border border-white/10 bg-white/5"
              : "border border-white/10 bg-white/5"
          )}>
            <p className="text-xs text-slate-400">
              {t("expires").replace(
                "{time}",
                new Date(verification.expiresAt).toLocaleTimeString(),
              )}
            </p>
          </div>
        ) : null}

        {verification.error ? (
          <div className={cn(
            "rounded-xl px-4 py-3 backdrop-blur-sm",
            isBonusPage
              ? "border border-white/20 bg-white/5"
              : "border border-rose-500/30 bg-rose-500/10"
          )}>
            <p className={cn(
              "text-sm",
              isBonusPage ? "text-white" : "text-rose-300"
            )}>
              {verification.error}
            </p>
          </div>
        ) : null}

        {emailVerified ? (
          <div className={cn(
            "rounded-xl px-4 py-3 backdrop-blur-sm",
            isBonusPage
              ? "border border-white/20 bg-white/5"
              : "border border-emerald-500/30 bg-emerald-500/10"
          )}>
            <div className="flex items-center gap-2">
              <ShieldCheck className={cn(
                "h-4 w-4 shrink-0",
                isBonusPage ? "text-white" : "text-emerald-300"
              )} />
              <p className={cn(
                "text-sm",
                isBonusPage ? "text-white" : "text-emerald-200"
              )}>
                {t("verified").replace(
                  "{time}",
                  new Date(
                    verification.verifiedAt ?? Date.now(),
                  ).toLocaleTimeString(),
                )}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
