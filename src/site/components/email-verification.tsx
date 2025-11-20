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

  return (
    <div className={cn("w-full space-y-6", className)}>
      <div className="space-y-6">
        <DesignFormField
          className="space-y-3"
          label={
            <span className="text-[0.7rem] font-bold uppercase tracking-[0.35em] text-violet-300">
              {t("emailLabel")}
            </span>
          }
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <DesignInput
              type="email"
              value={inputEmail}
              onChange={(event) => setInputEmail(event.target.value)}
              disabled={verification.requesting || emailVerified}
              placeholder={t("emailPlaceholder")}
              autoComplete="email"
              className="flex-1 bg-white/10 border-white/30 text-white placeholder:text-slate-400 focus:border-violet-400/60 focus:ring-violet-400/30 transition-all"
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
              className="sm:min-w-[120px] bg-gradient-to-r from-violet-500 via-indigo-500 to-purple-500 hover:from-violet-600 hover:via-indigo-600 hover:to-purple-600 text-white shadow-lg shadow-violet-500/40 transition-all font-medium"
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
            <span className="text-[0.7rem] font-bold uppercase tracking-[0.35em] text-violet-300">
              {t("codeLabel")}
            </span>
          }
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <DesignInput
              type="text"
              inputMode="numeric"
              value={inputCode}
              onChange={(event) => setInputCode(event.target.value)}
              disabled={verification.verifying || emailVerified}
              placeholder={t("codePlaceholder")}
              maxLength={8}
              className="flex-1 bg-white/10 border-white/30 text-white placeholder:text-slate-400 focus:border-violet-400/60 focus:ring-violet-400/30 transition-all"
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
              className="sm:min-w-[120px] bg-gradient-to-r from-violet-500 via-indigo-500 to-purple-500 hover:from-violet-600 hover:via-indigo-600 hover:to-purple-600 text-white shadow-lg shadow-violet-500/40 transition-all font-medium"
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
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-xs text-slate-400">
              {t("expires").replace(
                "{time}",
                new Date(verification.expiresAt).toLocaleTimeString(),
              )}
            </p>
          </div>
        ) : null}

        {verification.error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 backdrop-blur-sm">
            <p className="text-sm text-rose-300">{verification.error}</p>
          </div>
        ) : null}

        {emailVerified ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-300 shrink-0" />
              <p className="text-sm text-emerald-200">
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
