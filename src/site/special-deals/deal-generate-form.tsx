"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { QrPreviewCard } from "@/site/components/qr-preview-card";

interface DealGenerateFormProps {
  slug: string;
  partnerId: string;
  minVisitors: number;
  isActive: boolean;
  qrValiditySeconds: number;
  partnerName: string | null;
  title: string;
}

interface DealGenerationResult {
  visitId: string;
  verifyUrl: string | null;
  qrCodeUrl: string | null;
  qrCodeExpiresAt: string | null;
  staffScanUrl: string | null;
}

const secondsToDays = (seconds: number) =>
  Math.max(1, Math.round(seconds / (60 * 60 * 24)));

export function DealGenerateForm({
  slug,
  partnerId,
  minVisitors,
  isActive,
  qrValiditySeconds,
  partnerName,
  title,
}: DealGenerateFormProps) {
  const [email, setEmail] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [visitors, setVisitors] = useState<number>(minVisitors);
  const [consentMarketing, setConsentMarketing] = useState(true);
  const [metadataNote, setMetadataNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DealGenerationResult | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [requestingCode, setRequestingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);

  const qrValidityDays = secondsToDays(qrValiditySeconds);

  useEffect(() => {
    setEmailVerified(false);
    setVerificationCode("");
    setCodeRequested(false);
    setVerificationMessage(null);
    setResult(null);
  }, [email]);

  const canRequestCode = useMemo(() => {
    const trimmed = email.trim();
    return trimmed.length > 0 && /^[^@]+@[^@]+\.[^@]+$/.test(trimmed);
  }, [email]);

  const disableGenerate = submitting || !emailVerified;

  return (
    <div className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold text-white">Generate QR reservation</h2>
        <p className="text-sm text-slate-300">
          We email the QR pass and hold a slot with {partnerName ?? "the venue"}. QR codes expire
          {qrValidityDays === 1 ? " after 1 day" : ` after ${qrValidityDays} days`} and staff will
          decline entry if fewer than {minVisitors} visitors arrive.
        </p>
      </header>

      {!isActive ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          <p>
            This deal is not currently active. You can browse other specials or contact us at{" "}
            <a
              href="mailto:hello@zabava.cz"
              className="text-indigo-300 underline decoration-indigo-500/40 underline-offset-4 hover:text-indigo-200"
            >
              hello@zabava.cz
            </a>{" "}
            for concierge assistance.
          </p>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (disableGenerate) return;
            setError(null);
            setResult(null);
            setSubmitting(true);
            try {
              const response = await fetch(`/api/public/special-deals/${slug}/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  email,
                  visitors,
                  consentMarketing,
                  metadata: metadataNote ? { note: metadataNote } : undefined,
                }),
              });
              if (!response.ok) {
                let message = "Unable to generate QR code. Please try again.";
                try {
                  const data = (await response.json()) as { error?: string };
                  if (data?.error) message = data.error;
                } catch {
                  // ignore
                }
                setError(message);
                return;
              }
              const data = (await response.json()) as {
                visitId: string;
                verifyUrl: string | null;
                qrCodeUrl: string | null;
                qrCodeExpiresAt: string | null;
                staffScanUrl: string | null;
              };
              setResult({
                visitId: data.visitId,
                verifyUrl: data.verifyUrl,
                qrCodeUrl: data.qrCodeUrl,
                qrCodeExpiresAt: data.qrCodeExpiresAt,
                staffScanUrl: data.staffScanUrl,
              });
            } catch (err) {
              const message =
                err instanceof Error ? err.message : "Unable to generate QR code. Please try again.";
              setError(message);
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Contact email
              </span>
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="team@example.com"
                className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner focus:border-indigo-400 focus:outline-none"
              />
              <span className="text-[11px] text-slate-400">
                We&apos;ll send verification and QR links to this address.
              </span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Visitors
              </span>
              <input
                required
                type="number"
                min={minVisitors}
                value={visitors}
                onChange={(event) => setVisitors(Number(event.target.value))}
                className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner focus:border-indigo-400 focus:outline-none"
              />
              <span className="text-[11px] text-slate-400">
                Minimum {minVisitors} visitors required for {title}.
              </span>
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Special requests (optional)
            </span>
            <textarea
              value={metadataNote}
              onChange={(event) => setMetadataNote(event.target.value)}
              placeholder="Tell us about schedule preferences, accessibility, or transport needs."
              rows={3}
              className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner focus:border-indigo-400 focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
            <input
              type="checkbox"
              checked={consentMarketing}
              onChange={(event) => setConsentMarketing(event.target.checked)}
              className="h-4 w-4 rounded border border-white/30 bg-slate-900/80 text-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            Send me early access specials and concierge updates
          </label>

          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Email verification
                </h3>
                <p className="text-xs text-slate-300">
                  We need to verify your email before issuing the QR pass.
                </p>
              </div>
              {emailVerified ? (
                <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-100">
                  Verified
                </Badge>
              ) : null}
            </header>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={!canRequestCode || requestingCode}
                onClick={async () => {
                  if (!canRequestCode || requestingCode) return;
                  setRequestingCode(true);
                  setVerificationMessage(null);
                  try {
                    const response = await fetch("/api/auth/request-code", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        email,
                        type: "visit",
                        partnerId,
                      }),
                    });
                    if (!response.ok) {
                      const data = (await response.json().catch(() => null)) as { error?: string } | null;
                      throw new Error(data?.error ?? "Unable to send verification code.");
                    }
                    setCodeRequested(true);
                    setVerificationMessage("Verification code sent. Please check your email.");
                  } catch (err) {
                    const message =
                      err instanceof Error ? err.message : "Failed to send verification code.";
                    setVerificationMessage(message);
                  } finally {
                    setRequestingCode(false);
                  }
                }}
                className="inline-flex items-center justify-center rounded-full bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-slate-400"
              >
                {requestingCode ? "Sending…" : "Send verification code"}
              </button>
              {verificationMessage ? (
                <span className="text-[11px] text-slate-200">{verificationMessage}</span>
              ) : null}
            </div>

            {codeRequested ? (
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Verification code
                  </span>
                  <input
                    value={verificationCode}
                    onChange={(event) => setVerificationCode(event.target.value)}
                    placeholder="Enter the 6-digit code"
                    className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner focus:border-indigo-400 focus:outline-none"
                  />
                </label>
                <button
                  type="button"
                  disabled={!verificationCode || verifyingCode}
                  onClick={async () => {
                    if (!verificationCode || verifyingCode) return;
                    setVerifyingCode(true);
                    setVerificationMessage(null);
                    try {
                      const response = await fetch("/api/auth/verify-code", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          email,
                          code: verificationCode,
                          type: "visit",
                          partnerId,
                        }),
                      });
                      if (!response.ok) {
                        const data = (await response.json().catch(() => null)) as {
                          error?: string;
                        } | null;
                        throw new Error(data?.error ?? "Verification failed.");
                      }
                      setEmailVerified(true);
                      setVerificationMessage("Email verified. You can now generate the QR pass.");
                    } catch (err) {
                      const message =
                        err instanceof Error ? err.message : "Verification failed. Please try again.";
                      setVerificationMessage(message);
                      setEmailVerified(false);
                    } finally {
                      setVerifyingCode(false);
                    }
                  }}
                  className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/40"
                >
                  {verifyingCode ? "Verifying…" : "Verify code"}
                </button>
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-400/30 bg-rose-500/20 p-4 text-sm text-rose-100">
              {error}
            </div>
          ) : null}
          <button
            type="submit"
            disabled={disableGenerate}
            className="inline-flex items-center justify-center rounded-full bg-indigo-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-indigo-500/50"
          >
            {submitting ? "Generating…" : "Generate QR"}
          </button>
        </form>
      )}

      {result ? (
        <QrPreviewCard
          heading="QR reservation created"
          description={`We've emailed the verification link to ${email}. Please verify within ${
            qrValidityDays === 1 ? "1 day" : `${qrValidityDays} days`
          } to keep your slot.`}
          qrCodeUrl={result.qrCodeUrl}
          qrCodeExpiresAt={result.qrCodeExpiresAt}
          downloadLabel="Download QR"
          className="border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
        >
          <dl className="mt-3 space-y-2 text-xs text-indigo-200">
            <div className="flex items-center gap-2 text-emerald-200">
              <dt className="w-28 uppercase tracking-wide text-emerald-300">Visit ID</dt>
              <dd className="font-mono">{result.visitId}</dd>
            </div>
            {result.staffScanUrl ? (
              <div className="flex items-center gap-2 text-emerald-200">
                <dt className="w-28 uppercase tracking-wide text-emerald-300">Staff link</dt>
                <dd className="font-mono break-all text-emerald-100">{result.staffScanUrl}</dd>
              </div>
            ) : null}
          </dl>
        </QrPreviewCard>
      ) : null}
    </div>
  );
}
