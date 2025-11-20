"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { DesignButton, SurfaceCard } from "@/components/design-system";

type QrScannerProps = {
  open: boolean;
  onClose: () => void;
  onDetected: (value: string) => void;
};

type DetectedBarcode = {
  rawValue: string;
};

type BarcodeDetectorOptions = {
  formats?: string[];
};

interface BarcodeDetector {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>;
}

type BarcodeDetectorConstructor = new (
  options?: BarcodeDetectorOptions
) => BarcodeDetector;

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

function supportsBarcodeDetector() {
  return (
    typeof window !== "undefined" &&
    typeof window.BarcodeDetector === "function"
  );
}

export function StaffQrScanner(props: QrScannerProps) {
  const { open, onClose, onDetected } = props;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestingCamera, setRequestingCamera] = useState(false);

  const canScan = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return Boolean(navigator.mediaDevices?.getUserMedia);
  }, []);

  const stopStream = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!open) {
      stopStream();
      setError(null);
      return;
    }
    if (!canScan) {
      setError("Camera access is not supported on this device.");
      return;
    }

    let cancelled = false;

    async function start() {
      setRequestingCamera(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        if (!supportsBarcodeDetector()) {
          setError(
            "QR scanning is not supported in this browser. Use Chrome or Edge on a compatible device."
          );
          return;
        }

        const DetectorCtor = window.BarcodeDetector;
        if (!DetectorCtor) {
          setError("Barcode detection is unavailable in this browser.");
          return;
        }

        const detector = new DetectorCtor({ formats: ["qr_code"] });

        const scan = async () => {
          if (!videoRef.current || cancelled) return;
          try {
            const results = await detector.detect(videoRef.current);
            if (results.length > 0) {
              const value = results[0].rawValue;
              stopStream();
              onDetected(value);
              return;
            }
          } catch (err) {
            console.error("Barcode detection failed", err);
            setError("Unable to read QR code. Try again.");
          }
          rafRef.current = requestAnimationFrame(scan);
        };
        rafRef.current = requestAnimationFrame(scan);
      } catch (err) {
        console.error("Camera error", err);
        setError(
          err instanceof Error
            ? err.message
            : "Unable to access camera. Check browser permissions."
        );
      } finally {
        setRequestingCamera(false);
      }
    }

    void start();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [open, canScan, onDetected, stopStream]);

  if (!open) return null;

  return (
    <div className="theme-staff fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--ds-overlay)] px-4 py-8 backdrop-blur-sm">
      <SurfaceCard className="relative w-full max-w-xl space-y-4 p-6">
        <DesignButton
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4"
          aria-label="Close scanner"
          onClick={() => {
            stopStream();
            onClose();
          }}
        >
          <X className="size-4" />
        </DesignButton>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-[color:var(--ds-text-strong)]">
            Scan visitor QR code
          </h2>
          <p className="text-sm text-[color:var(--ds-text-muted)]">
            Align the QR code inside the frame. When detected, you&apos;ll jump straight to the visit check-in screen.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] shadow-[var(--ds-shadow-soft)]">
          <video
            ref={videoRef}
            playsInline
            autoPlay
            muted
            className="h-72 w-full bg-black object-cover"
          />
        </div>

        {requestingCamera ? (
          <p className="text-sm text-[color:var(--ds-text-muted)]">
            Requesting camera permission…
          </p>
        ) : null}

        {error ? (
          <p className="text-sm text-[color:var(--ds-danger)]">{error}</p>
        ) : null}

        <div className="flex items-center justify-end gap-3">
          <DesignButton
            type="button"
            variant="tonal"
            size="sm"
            onClick={() => {
              stopStream();
              onClose();
            }}
          >
            Cancel
          </DesignButton>
        </div>
      </SurfaceCard>
    </div>
  );
}
