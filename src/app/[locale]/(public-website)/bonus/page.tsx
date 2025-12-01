"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Loader2, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmailVerification } from "@/site/components/email-verification";
import { SiteNav } from "@/site/components/site-nav";
import { useTranslations, useLocale } from "@/i18n/provider";
import { toast } from "sonner";

export default function BonusPage() {
  const tBonus = useTranslations("bonus");
  const locale = useLocale();
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<{
    url: string;
    expiresAt: string;
  } | null>(null);
  const [shareLinkLoading, setShareLinkLoading] = useState(false);
  const [shareLinkError, setShareLinkError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
      <SiteNav />
      <section className="relative isolate overflow-hidden min-h-[calc(100vh-80px)]">
        <div className="relative mx-auto max-w-[120rem] px-4 py-12 sm:py-16 md:py-20 lg:px-24 lg:py-24">
          <div className="grid gap-8 md:gap-12 lg:grid-cols-2 lg:gap-16 lg:items-center">
            {/* Left Content Section */}
            <div className="space-y-5 sm:space-y-6 lg:space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 backdrop-blur-md">
                <span className="text-xs font-bold uppercase tracking-[0.35em] text-white">
                  Rewards
                </span>
              </div>
              <h1 className="text-balance text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl leading-tight">
                {tBonus("hero.title")}
              </h1>
              <p className="text-base text-slate-200 leading-relaxed sm:text-lg md:text-xl max-w-xl">
                {tBonus("hero.description")}
              </p>
            </div>

            {/* Right Content Section - Verification Form */}
            <div className="space-y-5 sm:space-y-6 w-full">
              {/* Verification Card */}
              <div className="relative rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8 backdrop-blur-xl overflow-hidden">
                <div className="relative space-y-5 sm:space-y-6">
                  {/* Header */}
                  <div className="space-y-2 sm:space-y-3">
                    <div className="inline-flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-[0.4em] text-white">
                        {tBonus("verify.title")}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-200 sm:text-base">
                      {tBonus("verify.description")}
                    </p>
                  </div>

                  {/* Email Verification Form */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6 backdrop-blur-md">
                    <EmailVerification
                      type="bonus"
                      onVerified={handleVerifiedEmail}
                      className="max-w-none border-0 bg-transparent shadow-none p-0"
                    />
                  </div>

                  {/* Status Message */}
                  {verifiedEmail ? (
                    <div className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 backdrop-blur-sm">
                      <p className="text-xs text-white sm:text-sm">
                        {tBonus("verify.viewing")}{" "}
                        <span className="font-semibold text-white">
                          {verifiedEmail}
                        </span>
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 backdrop-blur-sm">
                      <p className="text-sm text-slate-300 sm:text-base">
                        {tBonus("verify.hint")}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Secure Link Card - Only show when verified */}
              {verifiedEmail && (
                <div className="relative rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8 backdrop-blur-xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 overflow-hidden">
                  <div className="relative space-y-4">
                    {/* Header with Actions */}
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="inline-flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-[0.3em] text-fuchsia-300">
                            {tBonus("secureLink.title")}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed text-slate-300 sm:text-sm break-words">
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
                          className="h-9 w-9 rounded-lg border border-white/20 bg-white/10 text-white hover:bg-white/20 hover:border-white/30 transition-all shadow-lg"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => generateSecureLink()}
                          disabled={shareLinkLoading}
                          className="h-9 w-9 rounded-lg border border-white/20 bg-white/10 text-white hover:bg-white/20 hover:border-white/30 transition-all shadow-lg"
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
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
