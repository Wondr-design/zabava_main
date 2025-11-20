"use client";

import Image from "next/image";
import { format } from "date-fns";
import { QrCode } from "lucide-react";
import { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface QrPreviewCardProps {
  qrCodeUrl: string | null;
  qrCodeExpiresAt?: string | null;
  heading?: string;
  description?: string;
  downloadLabel?: string;
  className?: string;
  children?: ReactNode;
}

export function QrPreviewCard({
  qrCodeUrl,
  qrCodeExpiresAt,
  heading = "Your QR code is ready",
  description,
  downloadLabel = "Download QR",
  className,
  children,
}: QrPreviewCardProps) {
  return (
    <div
      className={cn(
        "space-y-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-white",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <QrCode className="h-5 w-5 text-indigo-300" />
        <div>
          <div className="font-medium text-white">{heading}</div>
          {qrCodeExpiresAt ? (
            <div className="text-xs text-slate-300">
              Expires {format(new Date(qrCodeExpiresAt), "PPPp")}
            </div>
          ) : null}
        </div>
      </div>
      {description ? (
        <p className="text-xs text-slate-200">{description}</p>
      ) : null}
      {children}
      {qrCodeUrl ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <Image
            src={qrCodeUrl}
            alt="Generated QR code"
            width={192}
            height={192}
            className="mx-auto h-auto w-48 max-w-full"
            unoptimized
          />
        </div>
      ) : null}
      {qrCodeUrl ? (
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <a href={qrCodeUrl} target="_blank" rel="noopener noreferrer">
              {downloadLabel}
            </a>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
