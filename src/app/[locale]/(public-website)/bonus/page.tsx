"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Loader2, RefreshCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { useTranslations, useLocale } from "@/i18n/provider";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import GlassSurface from "@/components/GlassSurface";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";
import { useEmailVerification } from "@/hooks/use-email-verification";
import { cn } from "@/lib/utils";

export default function BonusPage() {
  const tBonus = useTranslations("bonus");
  const tVerification = useTranslations("verification");
  const locale = useLocale();
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<{
    url: string;
    expiresAt: string;
  } | null>(null);
  const [shareLinkLoading, setShareLinkLoading] = useState(false);
  const [shareLinkError, setShareLinkError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [inputEmail, setInputEmail] = useState("");
  const [inputCode, setInputCode] = useState("");

  const verification = useEmailVerification({
    type: "bonus",
  });

  const buildShareLinkUrl = useCallback(
    (token: string) => {
      const basePath = `/${locale}/bonus/share/${token}`;
      if (typeof window === "undefined" || !window.location?.origin) {
        return basePath;
      }
      return `${window.location.origin}${basePath}`;
    },
    [locale]
  );

  const generateSecureLink = useCallback(
    async (address?: string) => {
      const targetEmail = (address ?? verifiedEmail)?.trim().toLowerCase();
      if (!targetEmail) return;
      setShareLinkLoading(true);
      setShareLinkError(null);
      setSuccess(null);
      try {
        const response = await fetch("/api/bonus/secure-links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: targetEmail }),
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(payload.error ?? tBonus("errors.loadFailed"));
        }
        const payload = (await response.json()) as {
          token: string;
          expiresAt: string;
        };
        setShareLink({
          url: buildShareLinkUrl(payload.token),
          expiresAt: payload.expiresAt,
        });
        setSuccess(tBonus("secureLink.generated"));
      } catch (err) {
        const message =
          err instanceof Error ? err.message : tBonus("errors.loadFailed");
        setShareLinkError(message);
        setShareLink(null);
      } finally {
        setShareLinkLoading(false);
      }
    },
    [verifiedEmail, buildShareLinkUrl, tBonus]
  );

  const handleVerifiedEmail = useCallback(
    (value: string) => {
      const normalized = value.trim().toLowerCase();
      setVerifiedEmail(normalized);
      void generateSecureLink(normalized);
    },
    [generateSecureLink]
  );

  const handleRequestCode = useCallback(async () => {
    if (!inputEmail.trim()) return;
    const normalized = inputEmail.trim().toLowerCase();
    await verification.requestCode(normalized);
  }, [inputEmail, verification]);

  const handleVerifyCode = useCallback(async () => {
    if (!inputCode.trim() || inputCode.length !== 6) return;
    const ok = await verification.verifyCode(inputCode.trim());
    if (ok) {
      handleVerifiedEmail(verification.email);
    }
  }, [inputCode, verification, handleVerifiedEmail]);

  useEffect(() => {
    if (verification.verifiedAt && verification.email) {
      handleVerifiedEmail(verification.email);
    }
  }, [verification.verifiedAt, verification.email, handleVerifiedEmail]);

  const handleCopyShareLink = useCallback(async () => {
    if (!shareLink?.url) return;
    try {
      await navigator.clipboard.writeText(shareLink.url);
      toast.success(tBonus("messages.linkCopied"));
    } catch (error) {
      console.error(error);
      toast.error(tBonus("messages.linkCopyFailed"));
    }
  }, [shareLink, tBonus]);

  useEffect(() => {
    if (!verifiedEmail) {
      setShareLink(null);
      setShareLinkError(null);
      setSuccess(null);
    }
  }, [verifiedEmail]);

  const shareLinkExpiry = useMemo(() => {
    if (!shareLink?.expiresAt) return null;
    try {
      const parsed = new Date(shareLink.expiresAt);
      return {
        date: parsed.toLocaleDateString(),
        time: parsed.toLocaleTimeString(),
      };
    } catch {
      return null;
    }
  }, [shareLink]);

  return (
    <main className="min-h-screen text-white">
      <section className="relative isolate overflow-hidden min-h-[calc(100vh-80px)] flex items-center justify-center">
        <div className="relative mx-auto max-w-[120rem] w-full px-4">
          <div className="max-w-5xl mx-auto space-y-5">
            {/* Header Section */}
            <div className="space-y-6 sm:space-y-8 text-center">
              <GlassSurface
                width="auto"
                height="auto"
                borderRadius={9999}
                className="inline-flex px-4 py-1.5 text-sm font-medium text-amber-400 items-center"
              >
                <Sparkles className="mr-3 h-3.5 w-3.5 text-amber-300" />
                Rewards
              </GlassSurface>
              <div className="space-y-1 pt-5">
                <h1 className="font-[family-name:var(--font-influencer)] text-[128px] uppercase tracking-wide text-white leading-[0.8] sm:leading-[64px]">
                  {tBonus("hero.title")}
                </h1>
                <p className="text-base text-slate-200 leading-relaxed sm:text-lg md:text-xl">
                  {tBonus("hero.description")}
                </p>
              </div>
            </div>

            {/* Verification & Secure Snapshot Section */}
            <div className="w-full pt-1 sm:pt-12 max-w-4xl mx-auto">
              <GlassSurface
                width="100%"
                height="auto"
                borderRadius={24}
                displace={15}
                distortionScale={-150}
                redOffset={5}
                greenOffset={15}
                blueOffset={25}
                brightness={60}
                opacity={0.8}
                mixBlendMode="screen"
                className="w-full"
              >
                <AnimatePresence mode="wait">
                  {!verifiedEmail ? (
                    <motion.div
                      key="verification"
                      initial={{ opacity: 0, y: 20, filter: "blur(0px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, y: -20, filter: "blur(10px)" }}
                      transition={{ duration: 0.4 }}
                      className="w-full p-5 sm:p-10"
                    >
                      {/* Header */}
                      <div className="space-y-3 mb-8">
                        <h2 className="text-xs font-bold uppercase tracking-[0.4em] text-white">
                          {tBonus("verify.title")}
                        </h2>
                        <p className="text-sm leading-relaxed text-slate-200 sm:text-base">
                          {tBonus("verify.description")}
                        </p>
                      </div>

                      {/* Email Input */}
                      <div className="space-y-6 mb-6">
                        <div className="space-y-3">
                          <label className="block text-[0.7rem] font-bold uppercase tracking-[0.35em] text-white">
                            {tVerification("emailLabel")}
                          </label>
                          <div className="flex flex-col sm:flex-row gap-3">
                            <input
                              type="email"
                              value={inputEmail}
                              onChange={(e) => setInputEmail(e.target.value)}
                              disabled={
                                verification.requesting ||
                                Boolean(verification.verifiedAt)
                              }
                              placeholder={tVerification("emailPlaceholder")}
                              autoComplete="email"
                              className="w-full sm:flex-1 h-12 bg-white/10 border border-white/20 rounded-xl px-4 text-white placeholder:text-slate-400 focus:border-white/40 focus:ring-2 focus:ring-white/20 focus:outline-none transition-all disabled:opacity-50"
                            />
                            <Button
                              type="button"
                              onClick={handleRequestCode}
                              disabled={
                                verification.requesting ||
                                !inputEmail.trim() ||
                                Boolean(verification.verifiedAt)
                              }
                              className="w-full sm:w-auto h-12 px-6 rounded-xl bg-white text-slate-950 hover:bg-slate-100 shadow-lg shadow-black/20 font-medium disabled:opacity-50"
                            >
                              {verification.requesting ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  {tVerification("sending")}
                                </>
                              ) : (
                                tVerification("send")
                              )}
                            </Button>
                          </div>
                        </div>
                        {verification.expiresAt && !verification.verifiedAt && (
                          <div className="rounded-lg px-3 py-2 border border-white/10 bg-white/5">
                            <p className="text-xs text-slate-400">
                              {tVerification("expires").replace(
                                "{time}",
                                new Date(
                                  verification.expiresAt
                                ).toLocaleTimeString()
                              )}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Verification Code Input */}
                      <div className="space-y-6">
                        <div className="space-y-3">
                          <label className="block text-[0.7rem] font-bold uppercase tracking-[0.35em] text-white">
                            {tVerification("codeLabel")}
                          </label>
                          <div className="flex flex-col gap-3">
                            <div className="flex justify-center items-center gap-2 w-full">
                              <InputOTP
                                maxLength={6}
                                value={inputCode}
                                onChange={setInputCode}
                                disabled={
                                  verification.verifying ||
                                  Boolean(verification.verifiedAt) ||
                                  !verification.email
                                }
                                containerClassName="gap-2 w-full justify-center"
                              >
                                <InputOTPGroup className="gap-2 sm:gap-2 flex-1 justify-end">
                                  {Array.from({ length: 3 }).map((_, i) => (
                                    <InputOTPSlot
                                      key={i}
                                      index={i}
                                      className={cn(
                                        "h-12 w-full max-w-[3.5rem] sm:h-16 sm:max-w-[3.5rem] text-white bg-white/10 rounded-xl flex-1",
                                        "data-[active=true]:bg-white/20 data-[active=true]:ring-2 data-[active=true]:ring-white/40",
                                        "!border-0 border-none"
                                      )}
                                    />
                                  ))}
                                </InputOTPGroup>
                                <InputOTPSeparator className="text-white text-xl mx-1 hidden sm:block" />
                                <InputOTPGroup className="gap-2 sm:gap-2 flex-1 justify-start">
                                  {Array.from({ length: 3 }).map((_, i) => (
                                    <InputOTPSlot
                                      key={i + 3}
                                      index={i + 3}
                                      className={cn(
                                        "h-12 w-full max-w-[3.5rem] sm:h-16 sm:max-w-[3.5rem] text-white bg-white/10 rounded-xl flex-1",
                                        "data-[active=true]:bg-white/20 data-[active=true]:ring-2 data-[active=true]:ring-white/40",
                                        "!border-0 border-none"
                                      )}
                                    />
                                  ))}
                                </InputOTPGroup>
                              </InputOTP>
                            </div>
                            <Button
                              type="button"
                              onClick={handleVerifyCode}
                              disabled={
                                verification.verifying ||
                                !inputCode.trim() ||
                                inputCode.length !== 6 ||
                                !verification.email ||
                                Boolean(verification.verifiedAt)
                              }
                              className="w-full h-12 rounded-xl bg-white text-slate-950 hover:bg-slate-100 shadow-lg shadow-black/20 font-medium disabled:opacity-50"
                            >
                              {verification.verifying ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  {tVerification("verifying")}
                                </>
                              ) : (
                                tVerification("verify")
                              )}
                            </Button>
                          </div>
                        </div>
                        {verification.error && (
                          <div className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 backdrop-blur-sm">
                            <p className="text-sm text-white">
                              {verification.error}
                            </p>
                          </div>
                        )}
                        {verification.verifiedAt && (
                          <div className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 backdrop-blur-sm">
                            <p className="text-sm text-white">
                              {tVerification("verified").replace(
                                "{time}",
                                new Date(
                                  verification.verifiedAt
                                ).toLocaleTimeString()
                              )}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Status Message */}
                      {!verifiedEmail && (
                        <div className="mt-6 rounded-xl border border-white/20 bg-white/5 px-4 py-3 backdrop-blur-sm">
                          <p className="text-sm text-slate-300 sm:text-base">
                            {tBonus("verify.hint")}
                          </p>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="secure-link"
                      initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, y: -20, filter: "blur(10px)" }}
                      transition={{ duration: 0.4 }}
                      className="w-full space-y-6 p-5 sm:p-10"
                    >
                      {/* Header with Actions */}
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2 flex-1 min-w-0">
                          <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-white">
                            {tBonus("secureLink.title")}
                          </h2>
                          <p className="text-sm leading-relaxed text-slate-200 sm:text-base break-words max-w-md">
                            {shareLinkExpiry
                              ? tBonus("secureLink.expires")
                                  .replace("{date}", shareLinkExpiry.date)
                                  .replace("{time}", shareLinkExpiry.time)
                              : tBonus("secureLink.helper")}
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={handleCopyShareLink}
                            disabled={!shareLink || shareLinkLoading}
                            className="h-10 w-10 rounded-xl border border-white/20 bg-white/10 text-white hover:bg-white/20 hover:border-white/30 transition-all shadow-lg"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => generateSecureLink()}
                            disabled={shareLinkLoading}
                            className="h-10 w-10 rounded-xl border border-white/20 bg-white/10 text-white hover:bg-white/20 hover:border-white/30 transition-all shadow-lg"
                          >
                            {shareLinkLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCcw className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Link Display */}
                      <div className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 font-mono text-xs sm:text-sm text-white break-all overflow-x-auto">
                        {shareLink?.url ??
                          (shareLinkLoading
                            ? tBonus("states.loadingRewards")
                            : tBonus("secureLink.waiting"))}
                      </div>

                      {/* Status Messages */}
                      {shareLinkError && (
                        <div className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 backdrop-blur-sm">
                          <p className="text-sm text-white">{shareLinkError}</p>
                        </div>
                      )}
                      {success && (
                        <div className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 backdrop-blur-sm">
                          <p className="text-sm text-white">{success}</p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassSurface>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
