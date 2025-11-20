"use client";

/* eslint-disable @next/next/no-img-element */

import * as React from "react";
import { partnerApi, visitApi } from "@/lib/web/api-client";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/format/date";
import { formatCurrencyCZK } from "@/lib/format/currency";
import {
  extractVisitLinks,
  expandVisitPayload,
  formatUrlDisplay,
  getVisitQrExpiryStatus,
} from "@/lib/services/visit-links";
import {
  DashboardDataTable,
  type DashboardTableColumn,
} from "@/components/dashboard/table/dashboard-data-table";
import {
  DesignDialog,
  DesignDialogContent,
  DesignDialogHeader,
  DesignDialogTitle,
  DesignDialogDescription,
  DesignDialogBody,
  DesignDialogClose,
  DesignButton,
  StatusPill,
  SurfaceCard,
} from "@/components/design-system";
import {
  X,
  Copy,
  ExternalLink,
  Mail,
  Calendar,
  CheckCircle2,
  DollarSign,
  Users,
  Ticket,
  Gift,
  QrCode,
  AlertCircle,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type SubmissionItem = {
  id?: string;
  submissionId?: string | null;
  legacyKey?: string | null;
  email?: string;
  status?: string;
  createdAt?: string;
  visitedAt?: string | null;
  totalPrice?: number;
  estimatedPoints?: number;
  pointsAwarded?: number;
  ticket?: string;
  numPeople?: number;
  originalPayload?: Record<string, unknown>;
  checkedInByStaffId?: string | null;
  checkedInByStaff?: {
    id: string;
    name: string | null;
    email: string;
    status?: string;
  } | null;
};

type SubmissionRow = {
  submission: SubmissionItem;
  rowKey: string;
  emailDisplay: string;
  statusDisplay: string;
  statusTone: "success" | "warning" | "danger";
  createdDisplay: string;
  visitedDisplay: string;
  amountDisplay: string;
  pointsDisplay: string;
  handledNode: React.ReactNode;
  isPendingExpired: boolean;
  canMarkVisited: boolean;
  qrExpiryMessage: string | null;
};

const MASK_PLACEHOLDER = "Hidden";

const maskEmail = (email?: string | null) => {
  if (!email) return MASK_PLACEHOLDER;
  const [user, domain] = email.split("@");
  if (!domain) return MASK_PLACEHOLDER;
  const visiblePrefix = user.slice(0, 1);
  const visibleSuffix = user.length > 1 ? user.slice(-1) : "";
  const hiddenLength = Math.max(user.length - 2, 1);
  const maskedUser = `${visiblePrefix}${"*".repeat(Math.min(hiddenLength, 6))}${visibleSuffix}`;
  return `${maskedUser}@${domain}`;
};

export function SubmissionsTable(props: {
  items: SubmissionItem[];
  partnerId: string;
  onRefresh: () => void;
  viewerRole?: "partner" | "staff" | "admin";
  viewerStaffId?: string | null;
  privacyMode?: boolean;
}) {
  const {
    items,
    partnerId,
    onRefresh,
    viewerRole,
    viewerStaffId,
    privacyMode = false,
  } = props;
  const [openItem, setOpenItem] = React.useState<SubmissionItem | null>(null);
  const [actingId, setActingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (privacyMode) {
      setOpenItem(null);
    }
  }, [privacyMode]);

  const uniqueItems = React.useMemo(() => {
    const map = new Map<string, SubmissionItem>();
    const buildKey = (item: SubmissionItem) => {
      const submissionKey = item.submissionId?.trim().toLowerCase();
      if (submissionKey) return `submission:${submissionKey}`;
      const legacyKey = item.legacyKey?.trim().toLowerCase();
      if (legacyKey) return `legacy:${legacyKey}`;
      const createdKey = (() => {
        if (!item.createdAt) return "unknown";
        const parsed = Date.parse(item.createdAt);
        if (Number.isNaN(parsed)) return item.createdAt;
        const minuteBucket = Math.floor(parsed / (60 * 1000));
        return `m:${minuteBucket}`;
      })();
      const price = typeof item.totalPrice === "number" ? item.totalPrice : 0;
      const numPeople = typeof item.numPeople === "number" ? item.numPeople : 0;
      const ticket = (item.ticket ?? "").toLowerCase();
      return `email:${(
        item.email ?? ""
      ).toLowerCase()}|${createdKey}|price:${price}|people:${numPeople}|ticket:${ticket}`;
    };

    for (const item of items) {
      const key = buildKey(item);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, item);
        continue;
      }

      const existingVisited = Boolean(
        existing.visitedAt || existing.status === "visited"
      );
      const incomingVisited = Boolean(
        item.visitedAt || item.status === "visited"
      );

      if (incomingVisited && !existingVisited) {
        map.set(key, item);
        continue;
      }

      if (!existingVisited && !incomingVisited) {
        const existingCreated = existing.createdAt ?? "";
        const incomingCreated = item.createdAt ?? "";
        if (incomingCreated > existingCreated) {
          map.set(key, item);
        }
        continue;
      }

      if (incomingVisited && existingVisited) {
        const existingVisitedAt =
          existing.visitedAt ?? existing.createdAt ?? "";
        const incomingVisitedAt = item.visitedAt ?? item.createdAt ?? "";
        if (incomingVisitedAt > existingVisitedAt) {
          map.set(key, item);
        }
      }
    }

    const sorted = Array.from(map.values()).sort((a, b) => {
      const aCreated = a.createdAt ?? "";
      const bCreated = b.createdAt ?? "";
      return aCreated < bCreated ? 1 : aCreated > bCreated ? -1 : 0;
    });
    return sorted;
  }, [items]);

  const getRowKey = React.useCallback((submission: SubmissionItem) => {
    if (submission.submissionId) {
      return `submission:${submission.submissionId.trim().toLowerCase()}`;
    }
    if (submission.legacyKey) {
      return `legacy:${submission.legacyKey.trim().toLowerCase()}`;
    }
    const createdKey = (() => {
      if (!submission.createdAt) return "unknown";
      const parsed = Date.parse(submission.createdAt);
      if (Number.isNaN(parsed)) return submission.createdAt;
      const minuteBucket = Math.floor(parsed / (60 * 1000));
      return `m:${minuteBucket}`;
    })();
    const price =
      typeof submission.totalPrice === "number" ? submission.totalPrice : 0;
    const numPeople =
      typeof submission.numPeople === "number" ? submission.numPeople : 0;
    const ticket = (submission.ticket ?? "").toLowerCase();
    return `email:${(
      submission.email ?? ""
    ).toLowerCase()}|${createdKey}|price:${price}|people:${numPeople}|ticket:${ticket}`;
  }, []);

  const tableRows = React.useMemo<SubmissionRow[]>(() => {
    return uniqueItems.map((submission) => {
      const linkInfo = extractVisitLinks(derivePayload(submission));
      const expiryStatus = getVisitQrExpiryStatus(linkInfo);
      const qrExpiresAtIso = expiryStatus.expiresAt;
      const qrExpiresDisplay = qrExpiresAtIso
        ? formatDateTime(qrExpiresAtIso)
        : null;
      const statusLabel =
        submission.status || (submission.visitedAt ? "visited" : "pending");
      const isPendingExpired =
        expiryStatus.expired &&
        !submission.visitedAt &&
        statusLabel.toLowerCase() !== "visited";
      const statusDisplay = isPendingExpired
        ? `${statusLabel || "pending"} · expired`
        : statusLabel || (submission.visitedAt ? "visited" : "pending");
      const statusTone: "success" | "warning" | "danger" =
        statusDisplay.toLowerCase().includes("visited")
          ? "success"
          : isPendingExpired
          ? "danger"
          : "warning";
      const emailDisplay = privacyMode
        ? maskEmail(submission.email)
        : submission.email || "—";
      const pointsDisplay = isPendingExpired
        ? "—"
        : (submission.pointsAwarded ?? submission.estimatedPoints ?? 0).toLocaleString();
      const amountDisplay = formatCurrencyCZK(
        typeof submission.totalPrice === "number" ? submission.totalPrice : undefined,
      );
      const rowKey = getRowKey(submission);
      const handledNode = renderHandledBy({
        submission,
        viewerRole,
        viewerStaffId,
        privacyMode,
      });
      const canMarkVisited =
        !privacyMode &&
        !isPendingExpired &&
        submission.status !== "visited" &&
        !submission.visitedAt;

      return {
        submission,
        rowKey,
        emailDisplay,
        statusDisplay,
        statusTone,
        createdDisplay: formatDateTime(submission.createdAt),
        visitedDisplay: formatDateTime(submission.visitedAt),
        amountDisplay,
        pointsDisplay,
        handledNode,
        isPendingExpired,
        canMarkVisited,
        qrExpiryMessage: qrExpiresDisplay
          ? `${expiryStatus.expired ? "Expired" : "Expires"} ${qrExpiresDisplay}`
          : null,
      };
    });
  }, [getRowKey, privacyMode, uniqueItems, viewerRole, viewerStaffId]);

  const markVisited = React.useCallback(
    async (submission: SubmissionItem) => {
      if (!submission.email) return;
      const linkInfo = extractVisitLinks(derivePayload(submission));
      const expiryStatus = getVisitQrExpiryStatus(linkInfo);
      const statusLabel =
        submission.status || (submission.visitedAt ? "visited" : "pending");
      const isExpiredPending =
        expiryStatus.expired &&
        !submission.visitedAt &&
        statusLabel.toLowerCase() !== "visited";
      if (isExpiredPending) {
        const expiresDisplay = expiryStatus.expiresAt
          ? formatDateTime(expiryStatus.expiresAt)
          : null;
        toast.error(
          expiresDisplay
            ? `QR expired ${expiresDisplay}. Ask the guest to submit a new form.`
            : "This registration has expired and can no longer be checked in. Ask the guest to submit a new form."
        );
        return;
      }
      const key = getRowKey(submission);
      setActingId(key);
      try {
        await partnerApi.markVisited(
          { email: submission.email, partnerId, visitId: submission.id },
          {}
        );
        toast.success(`Marked visited: ${submission.email}`);
        onRefresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to mark visited";
        toast.error(message);
      } finally {
        setActingId(null);
      }
    },
    [getRowKey, onRefresh, partnerId]
  );

  const columns = React.useMemo<DashboardTableColumn<SubmissionRow>[]>(() => {
    return [
      {
        id: "email",
        header: "Email",
        accessor: (row) => (
          <div className="font-medium text-[color:var(--ds-text-strong)]">
            {row.emailDisplay}
          </div>
        ),
        width: "22%",
      },
      {
        id: "status",
        header: "Status",
        accessor: (row) => (
          <StatusPill size="sm" tone={row.statusTone}>
            {row.statusDisplay}
          </StatusPill>
        ),
        width: "12%",
      },
      {
        id: "registered",
        header: "Registered",
        accessor: (row) => row.createdDisplay,
        width: "14%",
      },
      {
        id: "visited",
        header: "Visited",
        accessor: (row) => row.visitedDisplay,
        width: "14%",
      },
      {
        id: "amount",
        header: "Amount",
        accessor: (row) => row.amountDisplay,
        width: "10%",
      },
      {
        id: "points",
        header: "Points",
        accessor: (row) => row.pointsDisplay,
        align: "right",
        width: "10%",
      },
      {
        id: "handled",
        header: "Handled by",
        accessor: (row) => row.handledNode,
        width: "12%",
      },
      {
        id: "actions",
        header: "",
        accessor: (row) =>
          row.isPendingExpired ? (
            <div className="flex flex-col text-xs text-rose-600">
              <span className="font-semibold uppercase tracking-wide">QR expired</span>
              {row.qrExpiryMessage ? (
                <span className="text-rose-500/90">{row.qrExpiryMessage}</span>
              ) : null}
            </div>
          ) : (
            <button
              onClick={(event) => {
                event.stopPropagation();
                markVisited(row.submission);
              }}
              disabled={!row.canMarkVisited || actingId === row.rowKey}
              className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-emerald-300/40 transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-500/50 disabled:text-emerald-100"
            >
              {actingId === row.rowKey ? "Saving…" : "Mark visited"}
            </button>
          ),
        align: "right",
        width: "16%",
      },
    ];
  }, [actingId, markVisited]);


  return (
    <div className="space-y-4">
      <DashboardDataTable
        title="Registrations"
        description="Latest submissions from your QR forms."
        rows={tableRows}
        rowId={(row) => row.rowKey}
        columns={columns}
        toolbar={
          <button
            className="rounded-full bg-[color:var(--ds-primary)] px-4 py-2 text-xs font-semibold text-[color:var(--ds-primary-foreground)] shadow-[0_8px_24px_rgba(98,86,58,0.18)] transition hover:bg-[color-mix(in srgb,var(--ds-primary) 92%,#000)]"
            onClick={() => {
              setActingId(null);
              onRefresh();
            }}
          >
            Refresh
          </button>
        }
        pageSizeOptions={[10, 25, 50, 100]}
        onRowClick={
          privacyMode ? undefined : (row) => setOpenItem(row.submission)
        }
        rowClassName={(row) =>
          row.isPendingExpired
            ? "border-[color:var(--ds-danger)]/40 bg-[color:var(--ds-danger)]/10"
            : undefined
        }
      />

      <SubmissionDialog
        item={openItem}
        onOpenChange={(v) => !v && setOpenItem(null)}
        viewerRole={viewerRole}
        viewerStaffId={viewerStaffId}
      />
    </div>
  );
}

function renderHandledBy({
  submission,
  viewerRole,
  viewerStaffId,
  privacyMode = false,
}: {
  submission: SubmissionItem;
  viewerRole?: "partner" | "staff" | "admin";
  viewerStaffId?: string | null;
  privacyMode?: boolean;
}) {
  if (privacyMode) {
    return (
      <span className="italic text-slate-400">
        Hidden in privacy mode
      </span>
    );
  }
  const descriptor = describeHandledBy(submission, viewerRole, viewerStaffId);
  if (descriptor.secondary) {
    return (
      <div className="flex flex-col text-xs text-slate-600">
        <span className="font-medium text-slate-900">{descriptor.primary}</span>
        <span>{descriptor.secondary}</span>
      </div>
    );
  }
  const className =
    descriptor.primary === "Awaiting check-in"
      ? "text-xs text-slate-400"
      : "text-xs font-medium text-slate-900";
  return <span className={className}>{descriptor.primary}</span>;
}

function SubmissionDialog(props: {
  item: SubmissionItem | null;
  onOpenChange: (open: boolean) => void;
  viewerRole?: "partner" | "staff" | "admin";
  viewerStaffId?: string | null;
}) {
  const { item, onOpenChange, viewerRole, viewerStaffId } = props;
  const linkInfo = item
    ? extractVisitLinks(derivePayload(item))
    : { qrUrl: null, verifyUrl: null, qrExpiresAt: null };
  const qrUrl = linkInfo.qrUrl;
  const qrDisplay = qrUrl ? formatUrlDisplay(qrUrl, 48) : null;
  const verifyUrl = linkInfo.verifyUrl;
  const verifyDisplay = verifyUrl ? formatUrlDisplay(verifyUrl, 64) : null;
  const expiryStatus = getVisitQrExpiryStatus(linkInfo);
  const qrExpiresAtIso = expiryStatus.expiresAt;
  const qrExpiresDisplay = qrExpiresAtIso ? formatDateTime(qrExpiresAtIso) : null;
  const isVisited = Boolean(item?.visitedAt) || item?.status === "visited";
  const qrExpired = expiryStatus.expired && !isVisited;
  const [qrPreviewUrl, setQrPreviewUrl] = React.useState<string | null>(qrUrl);
  const [qrPreviewLoading, setQrPreviewLoading] = React.useState(false);
  const [qrPreviewError, setQrPreviewError] = React.useState<string | null>(
    null
  );
  React.useEffect(() => {
    setQrPreviewUrl(qrUrl);
    setQrPreviewError(null);
  }, [qrUrl, item?.id]);
  React.useEffect(() => {
    let cancelled = false;
    if (!qrExpired || !item?.id || isVisited) {
      return () => {
        cancelled = true;
      };
    }
    setQrPreviewUrl(null);
    setQrPreviewError(null);
    setQrPreviewLoading(true);
    visitApi
      .qrPreview(item.id)
      .then((result) => {
        if (cancelled) return;
        setQrPreviewUrl(result?.url ?? null);
        setQrPreviewError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error
            ? err.message
            : "Unable to refresh QR preview.";
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
  }, [qrExpired, item?.id, isVisited]);
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
  const qrImageSrc = qrExpired
    ? qrPreviewUrl
    : qrPreviewUrl ?? qrUrl;
  const qrLinkHref = qrExpired
    ? qrPreviewUrl ?? undefined
    : qrPreviewUrl ?? qrUrl ?? undefined;
  
  const statusTone = item?.status === "visited"
    ? "success"
    : item?.status === "cancelled"
    ? "danger"
    : "warning";

  return (
    <DesignDialog open={!!item} onOpenChange={onOpenChange}>
      <DesignDialogContent className="max-h-[90vh] w-[min(800px,95vw)] overflow-hidden p-0">
        <DesignDialogHeader className="border-b border-[color:var(--ds-border-subtle)] pb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <DesignDialogTitle className="text-2xl">Visit Details</DesignDialogTitle>
              <DesignDialogDescription>
                Registration summary, visit metadata, and loyalty information
              </DesignDialogDescription>
            </div>
            <DesignDialogClose asChild>
              <DesignButton variant="ghost" size="icon" className="shrink-0">
                <X className="h-5 w-5" aria-hidden />
                <span className="sr-only">Close</span>
              </DesignButton>
            </DesignDialogClose>
          </div>
          
          {item && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <StatusPill tone={statusTone} size="sm">
                {item.status || (item.visitedAt ? "visited" : "pending")}
              </StatusPill>
            </div>
          )}
        </DesignDialogHeader>

        <DesignDialogBody className="max-h-[calc(90vh-200px)] overflow-y-auto py-6">
          {item ? (
            <div className="space-y-8">
              {/* Primary Information */}
              <Section title="Visit Information">
                <div className="grid gap-4 sm:grid-cols-2">
                  <InfoField
                    label="Email"
                    value={item.email || "—"}
                    icon={Mail}
                  />
                  <InfoField
                    label="Status"
                    value={item.status || (item.visitedAt ? "visited" : "pending")}
                  />
                  <InfoField
                    label="Submitted"
                    value={formatDateTime(item.createdAt)}
                    icon={Calendar}
                  />
                  <InfoField
                    label="Visited"
                    value={formatDateTime(item.visitedAt) || "—"}
                    icon={CheckCircle2}
                  />
                  <InfoField
                    label="Total Spend"
                    value={formatCurrencyCZK(
                      typeof item.totalPrice === "number"
                        ? item.totalPrice
                        : undefined
                    )}
                    icon={DollarSign}
                  />
                  <InfoField
                    label="Points"
                    value={`${item.pointsAwarded ?? 0} awarded • ${
                      item.estimatedPoints ?? 0
                    } estimated`}
                    icon={Gift}
                  />
                  <InfoField
                    label="Handled by"
                    value={(function () {
                      const descriptor = describeHandledBy(
                        item,
                        viewerRole,
                        viewerStaffId
                      );
                      if (descriptor.secondary) {
                        return `${descriptor.primary} (${descriptor.secondary})`;
                      }
                      return descriptor.primary;
                    })()}
                  />
                </div>
              </Section>

              {/* QR & Verification */}
              {(qrUrl || verifyUrl) && (
                <Section title="QR Code & Verification">
                  <div className="grid gap-6 lg:grid-cols-[280px,1fr]">
                    <div className="flex items-center justify-center rounded-2xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] p-6">
                      {qrImageSrc ? (
                        <img
                          src={qrImageSrc}
                          alt="QR code"
                          className="h-56 w-56 rounded-xl border border-[color:var(--ds-border-subtle)] bg-white p-3 shadow-sm"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-3 text-center">
                          <QrCode className="h-12 w-12 text-[color:var(--ds-text-subtle)]" aria-hidden />
                          <p className="text-xs text-[color:var(--ds-text-muted)]">
                            QR code not available yet.
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-4">
                      {qrUrl && (
                        <div className="space-y-2">
                          <label className="text-xs font-semibold uppercase tracking-[0.15em] text-[color:var(--ds-text-subtle)]">
                            QR Link
                          </label>
                          <div className="flex gap-2">
                            <a
                              href={qrLinkHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex flex-1 items-center gap-2 rounded-xl border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-4 py-3 text-sm text-[color:var(--ds-text-strong)] transition hover:bg-[color:var(--ds-surface-muted)]"
                              title={qrUrl}
                            >
                              <span className="truncate">{qrDisplay ?? qrUrl}</span>
                              <ExternalLink className="h-4 w-4 shrink-0 text-[color:var(--ds-text-muted)]" aria-hidden />
                            </a>
                            <DesignButton
                              variant="tonal"
                              size="sm"
                              onClick={() => {
                                if (!qrUrl || disableQrActions) return;
                                void navigator.clipboard.writeText(qrUrl);
                                toast.success("QR code link copied to clipboard");
                              }}
                              disabled={disableQrActions}
                              title={!qrUrl ? undefined : disableQrActions ? "QR expired — request a new registration" : "Copy QR link"}
                            >
                              <Copy className="h-4 w-4" aria-hidden />
                            </DesignButton>
                          </div>
                        </div>
                      )}
                      {verifyUrl && (
                        <div className="space-y-2">
                          <label className="text-xs font-semibold uppercase tracking-[0.15em] text-[color:var(--ds-text-subtle)]">
                            Verify Link
                          </label>
                          <div className="flex gap-2">
                            <a
                              href={verifyUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex flex-1 items-center gap-2 rounded-xl border border-[color:var(--ds-primary)]/30 bg-[color:var(--ds-primary)]/5 px-4 py-3 text-sm text-[color:var(--ds-primary)] transition hover:bg-[color:var(--ds-primary)]/10"
                              title={verifyUrl}
                            >
                              <span className="truncate">{verifyDisplay ?? verifyUrl}</span>
                              <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                            </a>
                            <DesignButton
                              variant="tonal"
                              size="sm"
                              onClick={() => {
                                if (!verifyUrl || disableQrActions) return;
                                void navigator.clipboard.writeText(verifyUrl);
                                toast.success("Verify link copied to clipboard");
                              }}
                              disabled={disableQrActions}
                              title={disableQrActions ? "QR expired — request a new registration" : "Copy verify link"}
                            >
                              <Copy className="h-4 w-4" aria-hidden />
                            </DesignButton>
                          </div>
                        </div>
                      )}
                      <SurfaceCard className={cn(
                        "p-3",
                        qrExpired ? "border-[color:var(--ds-danger)]/40 bg-[color:var(--ds-danger)]/10" : "border-[color:var(--ds-primary)]/40 bg-[color:var(--ds-primary)]/5"
                      )}>
                        <div className="flex items-start gap-2">
                          {qrExpired ? (
                            <AlertCircle className="h-4 w-4 shrink-0 text-[color:var(--ds-danger)] mt-0.5" aria-hidden />
                          ) : (
                            <Info className="h-4 w-4 shrink-0 text-[color:var(--ds-primary)] mt-0.5" aria-hidden />
                          )}
                          <p className={cn(
                            "text-xs",
                            qrExpired ? "text-[color:var(--ds-danger)]" : "text-[color:var(--ds-text-muted)]"
                          )}>
                            {qrExpiryMessage}
                          </p>
                        </div>
                      </SurfaceCard>
                      {qrPreviewLoading && (
                        <p className="text-xs text-[color:var(--ds-text-muted)]">Refreshing QR preview…</p>
                      )}
                      {qrPreviewError && (
                        <SurfaceCard className="border-[color:var(--ds-danger)]/40 bg-[color:var(--ds-danger)]/10 p-3">
                          <p className="text-xs text-[color:var(--ds-danger)]">{qrPreviewError}</p>
                        </SurfaceCard>
                      )}
                    </div>
                  </div>
                </Section>
              )}

              {/* Visit Selections */}
              <Section title="Visit Selections">
                <div className="grid gap-4 sm:grid-cols-2">
                  <InfoField
                    label="Ticket"
                    value={deriveTicket(item)}
                    icon={Ticket}
                  />
                  <InfoField
                    label="Guests"
                    value={String(deriveGuests(item))}
                    icon={Users}
                  />
                  <InfoField
                    label="Transport"
                    value={deriveTransport(item)}
                  />
                  <InfoField
                    label="Categories"
                    value={deriveCategories(item)}
                  />
                  <InfoField
                    label="Preferred date"
                    value={derivePayloadValue(item, [
                      "preferredDateTime",
                      "visitDate",
                    ]) || "—"}
                  />
                  <InfoField
                    label="Promo code"
                    value={derivePayloadValue(item, ["promo", "promoCode"]) || "—"}
                  />
                  <InfoField
                    label="Notes"
                    value={derivePayloadValue(item, ["notes", "extras"]) || "—"}
                  />
                </div>
              </Section>

              {/* Additional Information */}
              {(() => {
                const additions = deriveAdditionalSelections(item);
                if (additions.length === 0) return null;
                return (
                  <Section title="Additional Information">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {additions.map((entry) => (
                        <SurfaceCard key={entry.label} className="p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[color:var(--ds-text-subtle)] mb-2">
                            {entry.label}
                          </p>
                          {entry.isLink ? (
                            <a
                              href={entry.href ?? entry.value}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-sm text-[color:var(--ds-primary)] underline underline-offset-2 transition hover:text-[color:var(--ds-primary)]/80"
                            >
                              {entry.displayValue ?? entry.value}
                              <ExternalLink className="h-3 w-3" aria-hidden />
                            </a>
                          ) : (
                            <p className="text-sm text-[color:var(--ds-text-strong)]">{entry.value}</p>
                          )}
                        </SurfaceCard>
                      ))}
                    </div>
                  </Section>
                );
              })()}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Info className="h-12 w-12 text-[color:var(--ds-text-subtle)] mb-4" aria-hidden />
              <p className="text-sm text-[color:var(--ds-text-muted)]">Select a visit from the table to view details.</p>
            </div>
          )}
        </DesignDialogBody>
      </DesignDialogContent>
    </DesignDialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--ds-text-subtle)]">
        {title}
      </h3>
      {children}
    </div>
  );
}

function InfoField({ 
  label, 
  value, 
  icon: Icon 
}: { 
  label: string; 
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  if (value === undefined || value === null || value === "" || value === "—") {
    return null;
  }
  return (
    <SurfaceCard className="p-4">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[color:var(--ds-primary)]/10">
            <Icon className="h-4 w-4 text-[color:var(--ds-primary)]" aria-hidden />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[color:var(--ds-text-subtle)] mb-1">
            {label}
          </p>
          <p className="text-sm text-[color:var(--ds-text-strong)] break-words">
            {value}
          </p>
        </div>
      </div>
    </SurfaceCard>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <InfoField label={label} value={value} />
  );
}

function describeHandledBy(
  submission: SubmissionItem,
  viewerRole?: "partner" | "staff" | "admin",
  viewerStaffId?: string | null
) {
  const visited =
    (submission.status || "").toLowerCase() === "visited" ||
    Boolean(submission.visitedAt);

  if (submission.checkedInByStaff) {
    const isSelf =
      viewerRole === "staff" &&
      viewerStaffId &&
      submission.checkedInByStaffId === viewerStaffId;
    const primary = isSelf
      ? "You"
      : submission.checkedInByStaff.name ||
        submission.checkedInByStaff.email ||
        "Staff member";
    const secondary =
      submission.checkedInByStaff.email &&
      submission.checkedInByStaff.email !== primary
        ? submission.checkedInByStaff.email
        : undefined;
    return { primary, secondary };
  }

  if (visited) {
    const primary =
      viewerRole === "partner" || viewerRole === "admin"
        ? "Management"
        : "Management";
    return { primary };
  }

  return { primary: "Awaiting check-in" };
}

function derivePayload(item: SubmissionItem) {
  return expandVisitPayload({ payload: item.originalPayload ?? {} });
}

function deriveTicket(item: SubmissionItem) {
  if (item.ticket) return item.ticket;
  const merged = derivePayload(item);
  const candidates = ["ticket", "ticket_type", "Ticket"];
  for (const key of candidates) {
    const value = merged[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "—";
}

function deriveGuests(item: SubmissionItem) {
  if (item.numPeople) return item.numPeople;
  const merged = derivePayload(item);
  const candidates = ["numPeople", "people", "guests", "NumPeople"];
  for (const key of candidates) {
    const value = merged[key];
    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && asNumber > 0) return asNumber;
  }
  return "—";
}

function deriveTransport(item: SubmissionItem) {
  const merged = derivePayload(item);
  const candidates = ["transport", "Transport", "Bus_Rental", "selectedBus"];
  for (const key of candidates) {
    const value = merged[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "—";
}

function deriveCategories(item: SubmissionItem) {
  const merged = derivePayload(item);
  const candidates = ["categories", "Categories", "category", "segment"];
  for (const key of candidates) {
    const value = merged[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "—";
}

function derivePayloadValue(item: SubmissionItem, keys: string[]) {
  const merged = derivePayload(item);
  for (const key of keys) {
    const value = merged[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "—";
}

type AdditionalEntry = {
  label: string;
  value: string;
  isLink?: boolean;
  href?: string;
  displayValue?: string;
};

function deriveAdditionalSelections(item: SubmissionItem) {
  const merged = derivePayload(item);
  const excludedKeys = new Set([
    "ticket",
    "ticket_type",
    "Ticket",
    "numPeople",
    "NumPeople",
    "people",
    "guests",
    "transport",
    "Transport",
    "Bus_Rental",
    "selectedBus",
    "categories",
    "Categories",
    "category",
    "segment",
    "preferredDateTime",
    "visitDate",
    "promo",
    "promoCode",
    "notes",
    "extras",
    "email",
    "Email",
    "partnerId",
    "partner_id",
    "submissionId",
    "created_at",
    "updated_at",
    "visitId",
    "id",
    "data",
    "qrCodeUrl",
    "qrCode",
    "qr_code",
    "QRCodeUrl",
    "qrCodeURL",
    "qrUrl",
    "qr_url",
    "verifyUrl",
    "verify_url",
  ]);
  const additions: AdditionalEntry[] = [];
  for (const [key, value] of Object.entries(merged)) {
    if (excludedKeys.has(key)) continue;
    if (value === undefined || value === null) continue;

    const formatLabel = (label: string) => {
      const map: Record<string, string> = {
        rid: "RID",
        partner_id: "Partner ID",
        partnerId: "Partner ID",
        cityCode: "City code",
        attractionName: "Attraction",
        totalPrice: "Total price",
        estimatedPoints: "Estimated points",
        privacy: "Privacy",
        transportBus: "Transport bus",
      };
      return map[label] ?? label;
    };

    const pushValue = (
      label: string,
      raw: string,
      isLink?: boolean,
      href?: string,
      displayValue?: string
    ) => {
      additions.push({
        label: formatLabel(label),
        value: raw,
        isLink,
        href,
        displayValue,
      });
    };

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith("http")) {
        pushValue(key, trimmed, true, trimmed, formatUrlDisplay(trimmed));
      } else {
        pushValue(key, trimmed);
      }
    } else if (typeof value === "number" || typeof value === "boolean") {
      pushValue(key, String(value));
    } else if (Array.isArray(value)) {
      const serialized = value
        .map((entry) =>
          typeof entry === "object" ? JSON.stringify(entry) : String(entry)
        )
        .join(", ");
      if (serialized.trim()) pushValue(key, serialized);
    } else if (typeof value === "object") {
      try {
        const serialized = JSON.stringify(value);
        if (serialized) pushValue(key, serialized);
      } catch {
        // ignore serialization errors
      }
    }
  }
  return additions;
}
