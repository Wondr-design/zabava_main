"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Monitor, AlignLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { EmailTemplateRecord } from "@/lib/data/email-templates";
import type { EmailTemplateType } from "@/lib/email-template-constants";

export type TemplatePreviewFixture = {
  details?: Array<{ label: string; value: string | number | null | undefined }>;
  imageSrc?: string | null;
  ctaHref?: string | null;
  ctaLabel?: string | null;
  highlightedCode?: { label?: string; value?: string | null };
  attachmentsNote?: string | null;
  partnerLabel?: string | null;
  expiresInLabel?: string | null;
};

interface EmailTemplatePreviewProps {
  template: EmailTemplateRecord;
  fixture?: TemplatePreviewFixture;
}

type PreviewMode = "visual" | "text";

interface PreviewState {
  status: "idle" | "loading" | "ready" | "error";
  html: string | null;
  text: string | null;
  error?: string | null;
}

export function EmailTemplatePreviewPanel({
  template,
  fixture,
}: EmailTemplatePreviewProps) {
  const [mode, setMode] = useState<PreviewMode>("visual");
  const [refreshToken, setRefreshToken] = useState(0);
  const [state, setState] = useState<PreviewState>({
    status: "idle",
    html: null,
    text: null,
  });

  const payload = useMemo(
    () => ({
      templateType: template.templateType,
      subject: template.subject,
      body: template.body,
      ...(fixture ?? {}),
    }),
    [template.templateType, template.subject, template.body, fixture],
  );

  const payloadKey = useMemo(() => JSON.stringify(payload), [payload]);

  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setState((prev) => ({
        ...prev,
        status: "loading",
        error: null,
      }));
      fetch("/api/admin/email-templates/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
        .then(async (res) => {
          const json = (await res.json().catch(() => ({}))) as {
            html?: string;
            text?: string;
            error?: string;
          };
          if (disposed) return;
          if (!res.ok || !json.html) {
            setState({
              status: "error",
              html: null,
              text: null,
              error: json.error || "Unable to render preview.",
            });
            return;
          }
          setState({
            status: "ready",
            html: json.html,
            text: json.text ?? null,
          });
        })
        .catch((error) => {
          if (disposed || error.name === "AbortError") return;
          setState({
            status: "error",
            html: null,
            text: null,
            error:
              error instanceof Error
                ? error.message
                : "Unable to render preview.",
          });
        });
    }, 300);

    return () => {
      disposed = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [payloadKey, payload, refreshToken]);

  const isLoading = state.status === "loading";
  const isError = state.status === "error";

  return (
    <Card className="h-full rounded-3xl border border-border/80 bg-card shadow-lg">
      <CardHeader className="flex flex-col gap-3 border-b border-border/60 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Preview
            </p>
            <CardTitle className="text-lg font-semibold">
              {template.subject || "Preview email"}
            </CardTitle>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRefreshToken((token) => token + 1)}
            disabled={isLoading}
            className="inline-flex items-center gap-2"
          >
            <RefreshCw
              className={cn("h-4 w-4", isLoading && "animate-spin")}
            />
            Refresh
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "visual" ? "default" : "ghost"}
            onClick={() => setMode("visual")}
            className="inline-flex flex-1 items-center gap-2"
            disabled={!state.html}
          >
            <Monitor className="h-4 w-4" />
            Visual
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "text" ? "default" : "ghost"}
            onClick={() => setMode("text")}
            className="inline-flex flex-1 items-center gap-2"
            disabled={!state.text}
          >
            <AlignLeft className="h-4 w-4" />
            Plain text
          </Button>
        </div>
      </CardHeader>
      <CardContent className="h-full overflow-hidden p-0">
        <div className="relative min-h-[420px]">
          {isLoading ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p className="text-sm">Rendering preview…</p>
            </div>
          ) : isError ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-destructive">
              <p>{state.error ?? "Unable to render preview."}</p>
            </div>
          ) : mode === "text" && state.text ? (
            <pre className="h-full overflow-auto bg-muted/30 p-6 text-sm text-muted-foreground">
              {state.text}
            </pre>
          ) : state.html ? (
            <iframe
              title={`Preview ${template.templateType}`}
              className="h-[720px] w-full rounded-b-3xl border-0 bg-muted"
              srcDoc={state.html}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
              <p className="text-sm">No preview available.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function buildPreviewFixture(
  templateType: EmailTemplateType,
): TemplatePreviewFixture | undefined {
  const now = new Date();
  const isoDate = now.toISOString().split("T")[0];
  const baseDetails = [
    { label: "Visitor", value: "Alex Novak" },
    { label: "Partner", value: "Wonder Museum" },
    { label: "Date", value: `${isoDate} · 10:00` },
  ];

  switch (templateType) {
    case "qr_delivery":
      return {
        details: baseDetails,
        ctaHref: "https://app.zabava.cz/visits/demo",
        ctaLabel: "View visit",
        imageSrc:
          "https://dummyimage.com/320x320/f5f3ed/1f1f1f.png&text=QR+Code",
      };
    case "visit_confirmed":
      return {
        details: [
          ...baseDetails,
          { label: "Guests", value: "2 adults · 1 child" },
        ],
      };
    case "visit_updated":
      return {
        details: [
          ...baseDetails,
          { label: "Changes", value: "Updated ticket count" },
        ],
      };
    case "invite_partner":
    case "invite_staff":
      return {
        details: [
          { label: "Issued by", value: "team@zabava.cz" },
          { label: "Invitation code", value: "partner-8fd1" },
        ],
        ctaHref: "https://app.zabava.cz/invite/demo",
        ctaLabel: "Accept invitation",
      };
    case "verification_code":
      return {
        highlightedCode: { label: "Your code", value: "482 190" },
        partnerLabel: "Wondr Prague",
        expiresInLabel: "Valid for 10 minutes",
        ctaLabel: "Copy code",
        ctaHref: "https://app.zabava.cz/copy-code?code=482190",
      };
    case "billing_report":
      return {
        details: [
          { label: "Period", value: "Oct 2024" },
          { label: "Partners", value: "8 venues" },
          { label: "Transactions", value: "312" },
        ],
        attachmentsNote: "CSV and XLSX reports are attached to this email.",
      };
    default:
      return { details: baseDetails };
  }
}
