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
  const [shareLink, setShareLink] = useState<{ url: string; expiresAt: string } | null>(null);
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
    [locale],
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
        const payload = (await response.json()) as { token: string; expiresAt: string };
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
    [verifiedEmail, buildShareLinkUrl, tBonus],
  );

  const handleVerifiedEmail = useCallback(
    (value: string) => {
      const normalized = value.trim().toLowerCase();
      setVerifiedEmail(normalized);
      void generateSecureLink(normalized);
    },
    [generateSecureLink],
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
    <main className="min-h-screen bg-gradient-to-br from-violet-950 via-indigo-950 to-purple-950 text-white">
      <SiteNav />
      <section className="relative isolate overflow-hidden min-h-[calc(100vh-80px)]">
        {/* Enhanced background gradients with vibrant colors */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute left-0 top-0 h-[600px] w-[600px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-violet-500/30 blur-3xl animate-pulse" />
          <div className="absolute right-0 bottom-0 h-[800px] w-[800px] translate-x-1/4 translate-y-1/4 rounded-full bg-fuchsia-500/25 blur-3xl animate-pulse delay-1000" />
          <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="absolute top-1/4 right-1/4 h-[400px] w-[400px] rounded-full bg-purple-500/15 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-[120rem] px-4 py-12 sm:py-16 md:py-20 lg:px-24 lg:py-24">
          <div className="grid gap-8 md:gap-12 lg:grid-cols-2 lg:gap-16 lg:items-center">
            {/* Left Content Section */}
            <div className="space-y-5 sm:space-y-6 lg:space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/40 bg-gradient-to-r from-violet-500/20 via-indigo-500/20 to-purple-500/20 px-4 py-2 backdrop-blur-md shadow-lg shadow-violet-500/20">
                <span className="text-xs font-bold uppercase tracking-[0.35em] text-violet-200">
                  Rewards
                </span>
              </div>
              <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl bg-gradient-to-r from-white via-violet-200 via-fuchsia-200 to-purple-200 bg-clip-text text-transparent leading-tight">
                {tBonus("hero.title")}
              </h1>
              <p className="text-base text-slate-200 leading-relaxed sm:text-lg md:text-xl max-w-xl">
                {tBonus("hero.description")}
              </p>
            </div>

            {/* Right Content Section - Verification Form */}
            <div className="space-y-5 sm:space-y-6 w-full">
              {/* Verification Card */}
              <div className="relative rounded-3xl border border-white/30 bg-gradient-to-br from-white/10 via-white/5 to-white/5 p-6 sm:p-8 shadow-2xl shadow-violet-900/30 backdrop-blur-xl overflow-hidden">
                {/* Decorative gradient overlay */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-violet-500/15 via-indigo-500/10 to-fuchsia-500/15 pointer-events-none" />
                {/* Animated glow effect */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_3s_infinite]" />
                
                <div className="relative space-y-5 sm:space-y-6">
                  {/* Header */}
                  <div className="space-y-2 sm:space-y-3">
                    <div className="inline-flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-[0.4em] text-violet-300">
                        {tBonus("verify.title")}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-200 sm:text-base">
                      {tBonus("verify.description")}
                    </p>
                  </div>

                  {/* Email Verification Form */}
                  <div className="rounded-2xl border border-white/20 bg-gradient-to-br from-white/10 to-white/5 p-4 sm:p-6 backdrop-blur-md">
                    <EmailVerification
                      type="bonus"
                      onVerified={handleVerifiedEmail}
                      className="max-w-none border-0 bg-transparent shadow-none p-0"
                    />
                  </div>

                  {/* Status Message */}
                  {verifiedEmail ? (
                    <div className="rounded-xl border border-emerald-400/40 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 px-4 py-3 backdrop-blur-sm shadow-lg shadow-emerald-500/10">
                      <p className="text-xs text-emerald-100 sm:text-sm">
                        {tBonus("verify.viewing")}{" "}
                        <span className="font-semibold text-emerald-50">{verifiedEmail}</span>
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 backdrop-blur-sm">
                      <p className="text-sm text-slate-300 sm:text-base">{tBonus("verify.hint")}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Secure Link Card - Only show when verified */}
              {verifiedEmail && (
                <div className="relative rounded-3xl border border-white/30 bg-gradient-to-br from-white/10 via-white/5 to-white/5 p-6 sm:p-8 shadow-2xl shadow-fuchsia-900/30 backdrop-blur-xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 overflow-hidden">
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-fuchsia-500/15 via-purple-500/10 to-indigo-500/15 pointer-events-none" />
                  
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
                    <div className="rounded-xl border border-white/20 bg-slate-950/70 px-4 py-3 font-mono text-xs sm:text-sm text-slate-200 break-all overflow-x-auto">
                      {shareLink?.url ??
                        (shareLinkLoading
                          ? tBonus("states.loadingRewards")
                          : tBonus("secureLink.waiting"))}
                    </div>

                    {/* Status Messages */}
                    {shareLinkError && (
                      <div className="rounded-xl border border-rose-400/40 bg-gradient-to-r from-rose-500/20 to-pink-500/20 px-4 py-3 backdrop-blur-sm shadow-lg shadow-rose-500/10">
                        <p className="text-sm text-rose-200">{shareLinkError}</p>
                      </div>
                    )}
                    {success && (
                      <div className="rounded-xl border border-emerald-400/40 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 px-4 py-3 backdrop-blur-sm shadow-lg shadow-emerald-500/10">
                        <p className="text-sm text-emerald-200">{success}</p>
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
