"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

interface CopyCodeClientProps {
  code: string;
}

export function CopyCodeClient({ code }: CopyCodeClientProps) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCopy = useCallback(async () => {
    if (!code) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setError(null);
      } else {
        throw new Error("Clipboard unavailable");
      }
    } catch {
      setCopied(false);
      setError("Press and hold the code to copy it manually.");
    }
  }, [code]);

  useEffect(() => {
    if (!code) return;
    void handleCopy();
  }, [code, handleCopy]);

  if (!code) {
    return (
      <div className="w-full max-w-lg rounded-3xl border border-[#e4dfd1] bg-white p-10 text-center shadow-[0_24px_60px_rgba(47,46,40,0.12)]">
        <p className="text-sm text-[#8d8a7a]">
          This page needs a verification code. Please open the link directly from your email.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg rounded-3xl border border-[#e4dfd1] bg-white p-10 text-center shadow-[0_24px_60px_rgba(47,46,40,0.12)]">
      <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[#8d8a7a]">
        Verification code
      </p>
      <p className="mt-5 text-4xl font-semibold tracking-[0.4em] text-[#2f2e28]">
        {code}
      </p>
      <p className="mt-4 text-sm text-[#8d8a7a]">
        Tap the button below if the code did not copy automatically.
      </p>
      <button
        type="button"
        onClick={handleCopy}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#7b7755] px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-[#fdfcf7] transition hover:bg-[#69654a]"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4" aria-hidden />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" aria-hidden />
            Copy code
          </>
        )}
      </button>
      {error ? (
        <p className="mt-4 text-sm text-[#d99282]">{error}</p>
      ) : (
        <p className="mt-4 text-sm text-[#8d8a7a]">
          Need help? Paste the code directly in the verification field.
        </p>
      )}
    </div>
  );
}

