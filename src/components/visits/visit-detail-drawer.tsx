"use client";

/* eslint-disable @next/next/no-img-element */

import * as React from "react";
import { VisitRegistrationRecord } from "@/lib/data/visits";
import { PointsHistoryRecord } from "@/lib/data/points";
import { NormalizedVisitRecord } from "@/lib/services/visit-normalizer";
import { formatDateTime } from "@/lib/format/date";
import { formatCurrencyCZK } from "@/lib/format/currency";
import { toast } from "sonner";
import { AdminDrawerVisibilityContext } from "@/app/[locale]/admin/admin-shell";
import {
  extractVisitLinks,
  expandVisitPayload,
  formatUrlDisplay,
  getVisitQrExpiryStatus,
} from "@/lib/services/visit-links";
import { visitApi } from "@/lib/web/api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  X,
  Copy,
  ExternalLink,
  Mail,
  Calendar,
  DollarSign,
  Users,
  Ticket,
  Gift,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Info,
  BadgeCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface VisitDetailDrawerProps {
  visit: VisitRegistrationRecord | null;
  history: PointsHistoryRecord[];
  normalized: NormalizedVisitRecord | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

interface InfoRowItem {
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  href?: string;
}

export function VisitDetailDrawer({
  visit,
  history,
  normalized,
  open,
  onOpenChange,
}: VisitDetailDrawerProps) {
  const setAdminDrawerOpen = React.useContext(AdminDrawerVisibilityContext);

  React.useEffect(() => {
    if (setAdminDrawerOpen) {
      setAdminDrawerOpen(Boolean(open));
      return () => setAdminDrawerOpen(false);
    }
    return undefined;
  }, [open, setAdminDrawerOpen]);

  const linkInfo = visit
    ? extractVisitLinks(visit)
    : { qrUrl: null, verifyUrl: null, qrExpiresAt: null };
  const qrUrl = linkInfo.qrUrl;
  const qrDisplay = qrUrl ? formatUrlDisplay(qrUrl, 48) : null;
  const verifyUrl = linkInfo.verifyUrl;
  const verifyDisplay = verifyUrl ? formatUrlDisplay(verifyUrl, 64) : null;
  const expiryStatus = getVisitQrExpiryStatus(linkInfo);
  const qrExpiresAtIso = expiryStatus.expiresAt;
  const qrExpiresDisplay = qrExpiresAtIso
    ? formatDateTime(qrExpiresAtIso)
    : null;
  const isVisited = Boolean(visit?.status === "visited" || visit?.visited_at);
  const qrExpired = expiryStatus.expired && !isVisited;
  const payload = visit ? expandVisitPayload(visit) : {};
  const isFlashDeal =
    visit?.qr_type === "flash" ||
    (typeof payload.source === "string" &&
      payload.source === "special_flash_deal");
  const flashDealTitle =
    typeof payload.dealTitle === "string"
      ? (payload.dealTitle as string)
      : null;
  const flashDealSlug =
    typeof payload.dealSlug === "string" ? (payload.dealSlug as string) : null;
  const flashDealRequiredVisitors =
    typeof payload.visitors === "number"
      ? (payload.visitors as number)
      : typeof payload.minVisitors === "number"
        ? (payload.minVisitors as number)
        : null;
  const flashDealId =
    typeof payload.dealId === "string" ? (payload.dealId as string) : null;
  const flashActualVisitors =
    typeof visit?.num_people === "number" ? visit.num_people : null;

  const [qrPreviewUrl, setQrPreviewUrl] = React.useState<string | null>(qrUrl);
  const [qrPreviewLoading, setQrPreviewLoading] = React.useState(false);
  const [qrPreviewError, setQrPreviewError] = React.useState<string | null>(
    null
  );

  React.useEffect(() => {
    setQrPreviewUrl(qrUrl);
    setQrPreviewError(null);
  }, [qrUrl, visit?.id]);

  React.useEffect(() => {
    let cancelled = false;
    if (!qrExpired || !visit?.id || isVisited) {
      return () => {
        cancelled = true;
      };
    }
    setQrPreviewUrl(null);
    setQrPreviewError(null);
    setQrPreviewLoading(true);
    visitApi
      .qrPreview(visit.id)
      .then((result) => {
        if (cancelled) return;
        setQrPreviewUrl(result?.url ?? null);
        setQrPreviewError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Unable to refresh QR preview.";
        setQrPreviewError(message);
      })
      .finally(() => {
        if (!cancelled) {
          setQrPreviewLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [qrExpired, visit?.id, isVisited]);

  const qrExpiryMessage = (() => {
    if (qrExpiresDisplay) {
      if (expiryStatus.expired) {
        return isVisited
          ? `QR link expired ${qrExpiresDisplay}. Visit is already confirmed.`
          : `QR link expired ${qrExpiresDisplay}. Generate a new form to issue a fresh code.`;
      }
      return `QR link active until ${qrExpiresDisplay}.`;
    }
    if (qrUrl) {
      return "QR expiry timestamp is not available yet.";
    }
    return "QR expiry will be shown once the first QR is generated.";
  })();

  const disableQrActions = qrExpired && !isVisited;
  const qrImageSrc = qrExpired ? qrPreviewUrl : (qrPreviewUrl ?? qrUrl);
  const qrLinkHref = qrExpired
    ? (qrPreviewUrl ?? undefined)
    : (qrPreviewUrl ?? qrUrl ?? undefined);
  const additional = visit ? deriveVisitAdditional(visit) : [];

  const statusVariant =
    visit?.status === "visited"
      ? "default"
      : visit?.status === "cancelled"
        ? "destructive"
        : "secondary";

  const statusClassName =
    visit?.status === "visited"
      ? "bg-emerald-500 text-white"
      : visit?.status === "cancelled"
        ? ""
        : "bg-amber-500 text-white";

  const summaryEntries: InfoRowItem[] = [
    {
      label: "Partner",
      value: normalized?.partnerName ?? visit?.partner_id ?? "—",
    },
    { label: "Email", value: visit?.email ?? "—", icon: Mail },
    { label: "Visit ID", value: visit?.id ?? "—" },
    {
      label: "Registered",
      value: visit ? formatDateTime(visit.created_at) : "—",
      icon: Calendar,
    },
    {
      label: "Visited",
      value: visit?.visited_at ? formatDateTime(visit.visited_at) : "—",
      icon: CheckCircle2,
    },
    {
      label: "Status",
      value: visit?.status ?? "pending",
      icon: BadgeCheck,
    },
  ];

  const selectionEntries: InfoRowItem[] = [
    {
      label: "Ticket",
      value:
        normalized?.ticketType ??
        normalized?.ticket ??
        asDisplay(visit?.ticket_type),
      icon: Ticket,
    },
    { label: "Categories", value: normalized?.categories ?? "—" },
    {
      label: "Transport",
      value:
        normalized?.transport ??
        asDisplay(visit?.transport ?? payload?.transport),
    },
    {
      label: "Guests",
      value: String(visit?.num_people ?? 0),
      icon: Users,
    },
    {
      label: "Total Spend",
      value: formatCurrencyCZK(
        typeof visit?.total_price === "number" ? visit.total_price : undefined
      ),
      icon: DollarSign,
    },
  ];

  const loyaltyEntries: InfoRowItem[] = [
    {
      label: "Points Awarded",
      value: `${visit?.points_awarded ?? 0}`,
      icon: Gift,
    },
    {
      label: "Points Estimated",
      value: `${visit?.estimated_points ?? 0}`,
      icon: Info,
    },
  ];

  const flashEntries: InfoRowItem[] = [
    {
      label: "Deal",
      value: flashDealTitle ?? flashDealSlug ?? flashDealId ?? "Unknown",
    },
    {
      label: "Required Visitors",
      value: flashDealRequiredVisitors
        ? String(flashDealRequiredVisitors)
        : "—",
    },
    {
      label: "Recorded Visitors",
      value: flashActualVisitors ? String(flashActualVisitors) : "—",
    },
    flashDealId
      ? {
          label: "Deal ID",
          value: flashDealId,
        }
      : null,
  ].filter(Boolean) as InfoRowItem[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[90vh] w-[min(980px,95vw)] max-w-full overflow-hidden p-0 flex flex-col",
          "min-w-0"
        )}
      >
        <DialogHeader className="border-b border-border pb-6 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2 min-w-0">
              <DialogTitle className="text-2xl">Visit Details</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2 text-muted-foreground">
                <span className="truncate">
                  {normalized?.partnerName ?? visit?.partner_id ?? ""}
                </span>
                {visit?.created_at ? (
                  <span className="text-xs text-muted-foreground">
                    • {formatDateTime(visit.created_at)}
                  </span>
                ) : null}
              </DialogDescription>
              {visit && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Badge variant={statusVariant} className={statusClassName}>
                    {visit.status || "pending"}
                  </Badge>
                  {isFlashDeal && <Badge variant="default">Flash Deal</Badge>}
                  {visit.qr_type === "bonus" && (
                    <Badge variant="default">Reward</Badge>
                  )}
                </div>
              )}
            </div>
            <DialogClose asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <X className="h-5 w-5" aria-hidden />
                <span className="sr-only">Close</span>
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>

        <div className="max-h-[calc(90vh-200px)] overflow-y-auto py-6 overflow-x-hidden w-full">
          {visit ? (
            <div className="space-y-6 min-w-0 w-full">
              <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
                <QrPanel
                  qrImageSrc={qrImageSrc}
                  qrDisplay={qrDisplay ?? qrUrl ?? undefined}
                  verifyDisplay={verifyDisplay ?? verifyUrl ?? undefined}
                  qrLinkHref={qrLinkHref}
                  verifyUrl={verifyUrl ?? undefined}
                  disableQrActions={disableQrActions}
                  qrExpiryMessage={qrExpiryMessage}
                  qrExpired={qrExpired}
                  qrPreviewLoading={qrPreviewLoading}
                  qrPreviewError={qrPreviewError}
                  onCopyQr={() => {
                    if (!qrLinkHref || disableQrActions) return;
                    void navigator.clipboard.writeText(qrLinkHref);
                    toast.success("QR code link copied to clipboard");
                  }}
                  onCopyVerify={() => {
                    if (!verifyUrl || disableQrActions) return;
                    void navigator.clipboard.writeText(verifyUrl);
                    toast.success("Verify link copied to clipboard");
                  }}
                />

                <div className="space-y-4 min-w-0">
                  <DataGroup title="Visit summary">
                    <InfoGrid items={summaryEntries} />
                  </DataGroup>

                  <DataGroup title="Visit selections">
                    <InfoGrid items={selectionEntries} />
                  </DataGroup>

                  {visit.visit_notes ? (
                    <DataGroup title="Internal notes">
                      <Card className="rounded-2xl border border-border bg-card p-4">
                        <p className="text-sm text-foreground whitespace-pre-wrap">
                          {visit.visit_notes}
                        </p>
                      </Card>
                    </DataGroup>
                  ) : null}

                  {isFlashDeal && (
                    <DataGroup title="Flash deal">
                      <InfoGrid items={flashEntries} />
                      {flashDealRequiredVisitors &&
                        flashActualVisitors !== null &&
                        flashActualVisitors < flashDealRequiredVisitors && (
                          <Card className="mt-3 border-amber-500/40 bg-amber-500/10 p-3">
                            <div className="flex items-start gap-2">
                              <AlertCircle
                                className="h-4 w-4 shrink-0 text-amber-600 mt-0.5"
                                aria-hidden
                              />
                              <div className="flex-1 space-y-1">
                                <p className="text-sm font-semibold text-amber-600">
                                  Fewer visitors than required
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Staff should reject the QR if the full group
                                  is not present.
                                </p>
                              </div>
                            </div>
                          </Card>
                        )}
                    </DataGroup>
                  )}

                  <DataGroup title="Loyalty & history">
                    <InfoGrid items={loyaltyEntries} />
                    {history?.length ? (
                      <Card className="mt-3 space-y-2 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                          Recent point events
                        </p>
                        <div className="space-y-2">
                          {history.slice(0, 5).map((entry) => (
                            <div
                              key={entry.id}
                              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted px-3 py-2"
                            >
                              <div className="flex items-center gap-2">
                                <Gift
                                  className="h-4 w-4 text-primary"
                                  aria-hidden
                                />
                                <span className="text-sm font-medium capitalize text-foreground">
                                  {entry.type}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-sm">
                                <span className="font-semibold text-foreground">
                                  {entry.points > 0 ? "+" : ""}
                                  {entry.points}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {formatDateTime(entry.created_at)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </Card>
                    ) : null}
                  </DataGroup>

                  {additional.length > 0 && (
                    <DataGroup title="Additional data">
                      <div className="space-y-2">
                        {additional.map((entry) => (
                          <Card
                            key={`${entry.label}-${entry.value}`}
                            className="p-3"
                          >
                            <div className="flex items-start gap-3">
                              <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-1">
                                  {entry.label}
                                </p>
                                {entry.isLink && entry.href ? (
                                  <a
                                    href={entry.href}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-sm text-primary underline-offset-2 hover:underline break-words"
                                  >
                                    {entry.displayValue ?? entry.value}
                                  </a>
                                ) : (
                                  <p className="text-sm text-foreground break-words">
                                    {entry.value}
                                  </p>
                                )}
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </DataGroup>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Info
                className="h-12 w-12 text-muted-foreground mb-4"
                aria-hidden
              />
              <p className="text-sm text-muted-foreground">
                Select a visit from the table to view details.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DataGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

function InfoGrid({ items }: { items: InfoRowItem[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <InfoRow key={`${item.label}-${String(item.value)}`} {...item} />
      ))}
    </div>
  );
}

function InfoRow({ label, value, icon: Icon, href }: InfoRowItem) {
  const content = (
    <div className="flex items-start gap-3">
      {Icon && (
        <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
          <Icon className="h-4 w-4 text-primary" aria-hidden />
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-1">
          {label}
        </p>
        <div className="text-sm text-foreground break-words">{value}</div>
      </div>
    </div>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="rounded-xl border border-border bg-muted px-3 py-2 hover:border-primary/40 transition"
      >
        {content}
      </a>
    );
  }

  return <Card className="p-3">{content}</Card>;
}

function QrPanel({
  qrImageSrc,
  qrDisplay,
  verifyDisplay,
  qrLinkHref,
  verifyUrl,
  disableQrActions,
  qrExpiryMessage,
  qrExpired,
  qrPreviewLoading,
  qrPreviewError,
  onCopyQr,
  onCopyVerify,
}: {
  qrImageSrc: string | null;
  qrDisplay?: string;
  verifyDisplay?: string;
  qrLinkHref?: string;
  verifyUrl?: string;
  disableQrActions: boolean;
  qrExpiryMessage: string;
  qrExpired: boolean;
  qrPreviewLoading: boolean;
  qrPreviewError: string | null;
  onCopyQr: () => void;
  onCopyVerify: () => void;
}) {
  return (
    <Card className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-center rounded-xl border border-border bg-muted p-4">
        {qrImageSrc ? (
          <img
            src={qrImageSrc}
            alt="QR code"
            className="h-60 w-60 rounded-xl border border-border bg-white p-3 shadow-sm"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <QrCode className="h-12 w-12 text-muted-foreground" aria-hidden />
            <p className="text-xs text-muted-foreground">
              QR code not available yet. It will be generated once the visit is
              processed.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {qrLinkHref && (
          <ActionRow
            label="QR link"
            display={qrDisplay ?? qrLinkHref}
            href={qrLinkHref}
            disabled={disableQrActions}
            onCopy={onCopyQr}
          />
        )}
        {verifyUrl && (
          <ActionRow
            label="Verify link"
            display={verifyDisplay ?? verifyUrl}
            href={verifyUrl}
            disabled={disableQrActions}
            onCopy={onCopyVerify}
          />
        )}
      </div>

      <Card
        className={cn(
          "p-3",
          qrExpired
            ? "border-destructive/40 bg-destructive/10"
            : "border-primary/40 bg-primary/5"
        )}
      >
        <div className="flex items-start gap-2">
          {qrExpired ? (
            <AlertCircle
              className="h-4 w-4 shrink-0 text-destructive mt-0.5"
              aria-hidden
            />
          ) : (
            <Info
              className="h-4 w-4 shrink-0 text-primary mt-0.5"
              aria-hidden
            />
          )}
          <p
            className={cn(
              "text-xs",
              qrExpired ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {qrExpiryMessage}
          </p>
        </div>
      </Card>
      {qrPreviewLoading && (
        <p className="text-xs text-muted-foreground">Refreshing QR preview…</p>
      )}
      {qrPreviewError && (
        <Card className="border-destructive/40 bg-destructive/10 p-3">
          <p className="text-xs text-destructive">{qrPreviewError}</p>
        </Card>
      )}
    </Card>
  );
}

function ActionRow({
  label,
  display,
  href,
  disabled,
  onCopy,
}: {
  label: string;
  display: string;
  href: string;
  disabled: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </p>
      <div className="flex gap-2">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground transition hover:border-primary/40"
          title={href}
        >
          <span className="truncate">{display}</span>
          <ExternalLink
            className="h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        </a>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            if (disabled) return;
            onCopy();
          }}
          disabled={disabled}
          title={
            disabled
              ? "QR expired — request a new registration"
              : `Copy ${label.toLowerCase()}`
          }
        >
          <Copy className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

function asDisplay(value: unknown) {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number") return `${value}`;
  return "—";
}

type VisitAdditionalEntry = {
  label: string;
  value: string;
  isLink?: boolean;
  href?: string;
  displayValue?: string;
};

function deriveVisitAdditional(
  visit: VisitRegistrationRecord
): VisitAdditionalEntry[] {
  const merged = expandVisitPayload(visit);
  const entries: VisitAdditionalEntry[] = [];
  const excluded = new Set([
    "visitId",
    "qrCodeUrl",
    "qrCodeURL",
    "QRCodeUrl",
    "qr_code",
    "qrCode",
    "qrUrl",
    "qr_url",
    "verifyUrl",
    "verify_url",
    "partnerId",
    "data",
  ]);

  const orderedKeys = [
    ["preferredDateTime", "Preferred date"],
    ["promo", "Promo code"],
    ["promoCode", "Promo code"],
    ["privacy", "Privacy"],
    ["age", "Age"],
    ["cityCode", "City code"],
    ["attractionName", "Attraction"],
    ["verifyUrl", "Verify URL"],
    ["qrCodeExpiresAt", "QR code expires"],
    ["transportDetails", "Transport notes"],
    ["notes", "Notes"],
  ] as Array<[string, string]>;

  for (const [key, label] of orderedKeys) {
    const value = merged[key];
    if (typeof value === "string" && value.trim()) {
      const trimmed = value.trim();
      if (trimmed.startsWith("http")) {
        entries.push({
          label,
          value: trimmed,
          href: trimmed,
          displayValue: formatUrlDisplay(trimmed),
          isLink: true,
        });
      } else {
        entries.push({ label, value: trimmed });
      }
      excluded.add(key);
    }
  }

  Object.entries(merged).forEach(([key, value]) => {
    if (excluded.has(key)) return;
    if (value === null || value === undefined) return;
    if (typeof value === "object") return;
    const stringValue = String(value).trim();
    if (!stringValue) return;
    entries.push({ label: key, value: stringValue });
  });

  return entries;
}
