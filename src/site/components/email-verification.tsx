"use client";
import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";

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
}

export function EmailVerification(props: EmailVerificationProps) {
  const {
    type,
    partnerId,
    onVerified,
    className,
    requestEndpoint,
    verifyEndpoint,
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

  const isBonusPage = type === "bonus";

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
