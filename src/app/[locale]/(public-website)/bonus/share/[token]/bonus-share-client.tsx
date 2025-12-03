"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { formatDate, formatDateTime } from "@/lib/format/date";
import {
  CalendarDays,
  Clock,
  Copy,
  Gift,
  Loader2,
  Search,
  Ticket,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { bonusApi } from "@/lib/web/api-client";
import type { PartnerFormRecord } from "@/lib/data/partner-forms";
import { RewardRedemptionRunner } from "@/site/forms/reward-redemption-runner";
import { QrPreviewCard } from "@/site/components/qr-preview-card";
import { GlassContentCard } from "@/site/components/glass-content-card";
import { SiteNav } from "@/site/components/site-nav";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/i18n/provider";

type RewardLimitStatus =
  | "available"
  | "daily_exhausted"
  | "monthly_exhausted"
  | "window_exhausted";

interface VisitSummary {
  partnerId?: string | null;
  partner?: string | null;
  status?: string | null;
  pointsEarned?: number | null;
  estimatedPoints?: number | null;
  visitDate?: string | null;
  createdAt?: string | null;
  confirmedDate?: string | null;
  visitedAt?: string | null;
}

interface BonusData {
  user?: { totalPoints?: number; availablePoints?: number };
  availableRewards?: RewardListItem[];
  visits?: VisitSummary[];
  pointRatioCzk?: number;
}

interface DebugData {
  pointsHistory?: Array<{
    id?: string;
    type?: string;
    points?: number;
    created_at?: string;
    partner_id?: string | null;
    partner_name?: string | null;
    visit_id?: string | null;
    meta?: Record<string, unknown>;
  }>;
  redemptions?: Array<{
    code?: string;
    status?: string;
    created_at?: string;
    used_at?: string | null;
    expires_at?: string | null;
    partner_id?: string | null;
    reward_id?: string;
    reward?: { name?: string | null; points_cost?: number | null } | null;
  }>;
}

interface RewardListItem {
  id: string;
  name: string;
  pointsCost: number;
  canRedeem?: boolean;
  description?: string | null;
  category?: string | null;
  stock?: number | null;
  imageUrl?: string | null;
  heroImages?: string[];
  partnerLogoUrl?: string | null;
  savingsValue?: number | null;
  ageGroups?: string[];
  tags?: string[];
  partnerNames?: string[];
  redemptionInstructions?: string | null;
  redemptionFormId?: string | null;
  availableFor?: string[];
  ticketType?: string | null;
  transportIncluded?: boolean;
  isAvailable?: boolean;
  validFrom?: string | null;
  validUntil?: string | null;
  showAvailabilityDate?: boolean;
  ticketPoints?: Array<{ value: string; label: string; points: number }>;
  limitStatus?: RewardLimitStatus;
  nextRedeemAt?: string | null;
  partnerConfigs?: Map<
    string,
    {
      formId: string | null;
      tickets?: { key: string; label: string; points: number }[];
    }
  >;
}

interface RewardDetail {
  reward: {
    id: string;
    name: string;
    description?: string | null;
    pointsCost: number;
    category?: string | null;
    imageUrl?: string | null;
    heroImages?: string[];
    partnerLogoUrl?: string | null;
    ageGroups?: string[];
    tags?: string[];
    savingsValue?: number | null;
    redemptionInstructions?: string | null;
    availableFor?: string[];
    redemptionFormId?: string | null;
    status: string;
    ticketType?: string;
    transportIncluded?: boolean;
    isAvailable?: boolean;
  };
  form: PartnerFormRecord;
}

interface RedemptionResult {
  code: string;
  rewardName: string;
  pointsSpent: number;
  partnerId: string | null;
  status: string;
  appliedAt: string | null;
  expiresAt: string | null;
  visitId: string;
  verifyUrl: string | null;
  qrCodeUrl: string | null;
  qrCodeExpiresAt: string | null;
  staffScanUrl: string | null;
  form: {
    values: Record<string, unknown>;
    labels: Record<string, string>;
  };
}

interface RedeemState {
  open: boolean;
  loading: boolean;
  submitting: boolean;
  reward: RewardDetail | null;
  error: string;
  submissionError: string;
  result: RedemptionResult | null;
}

export function BonusShareClient({ token }: { token: string }) {
  const tBonus = useTranslations("bonus");

  const [linkInfo, setLinkInfo] = useState<{
    email: string;
    expiresAt: string;
  } | null>(null);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [data, setData] = useState<BonusData | null>(null);
  const [debug, setDebug] = useState<DebugData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [highlightCode, setHighlightCode] = useState<string | null>(null);
  const [partnerQuery, setPartnerQuery] = useState("");
  const [ticketTypeFilter, setTicketTypeFilter] = useState<string>("all");
  const [redeemState, setRedeemState] = useState<RedeemState>({
    open: false,
    loading: false,
    submitting: false,
    reward: null,
    error: "",
    submissionError: "",
    result: null,
  });

  const fetchPoints = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!verifiedEmail) return;
      if (!silent) {
        setLoading(true);
        setError("");
      }
      try {
        const [points, debugInfo] = (await Promise.all([
          bonusApi.userPoints(verifiedEmail),
          bonusApi.debugUser(verifiedEmail),
        ])) as [BonusData, DebugData];
        setData(points);
        setDebug(debugInfo);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : tBonus("errors.loadFailed");
        setError(message);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [verifiedEmail, tBonus]
  );

  useEffect(() => {
    let cancelled = false;
    async function loadSecureLink() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/bonus/secure-links/${token}`);
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          link?: { email: string; expiresAt: string };
          data?: BonusData;
          pointsHistory?: DebugData["pointsHistory"];
          redemptions?: DebugData["redemptions"];
        };
        if (!response.ok || !payload.link || !payload.data) {
          const reason =
            payload.error ??
            (response.status === 409
              ? tBonus("secureLink.consumed")
              : response.status === 410
                ? tBonus("secureLink.expired")
                : tBonus("secureLink.loadError"));
          if (!cancelled) {
            setError(reason);
            setLoading(false);
          }
          return;
        }
        if (cancelled) return;
        setLinkInfo(payload.link);
        setVerifiedEmail(payload.link.email);
        setData(payload.data);
        setDebug({
          pointsHistory: payload.pointsHistory ?? [],
          redemptions: payload.redemptions ?? [],
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : tBonus("secureLink.loadError");
        if (!cancelled) {
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadSecureLink();
    return () => {
      cancelled = true;
    };
  }, [token, tBonus]);

  const rewards = useMemo(
    () => (Array.isArray(data?.availableRewards) ? data.availableRewards : []),
    [data?.availableRewards]
  );

  const openRedeem = useCallback(
    async (rewardId: string) => {
      if (!verifiedEmail) return;
      const rewardFromList = rewards.find((item) => item.id === rewardId);
      if (
        rewardFromList?.limitStatus &&
        rewardFromList.limitStatus !== "available"
      ) {
        toast.error(tBonus("errors.rewardUnavailable"));
        return;
      }
      setRedeemState((prev) => ({
        ...prev,
        open: true,
        loading: true,
        error: "",
        submissionError: "",
        result: null,
      }));
      try {
        const detail = (await bonusApi.rewardDetails(rewardId)) as RewardDetail;
        setRedeemState((prev) => ({
          ...prev,
          reward: detail,
          loading: false,
          error: "",
        }));
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : tBonus("errors.loadRewardFailed");
        setRedeemState((prev) => ({
          ...prev,
          loading: false,
          error: message,
        }));
      }
    },
    [verifiedEmail, tBonus, rewards]
  );

  const closeRedeem = useCallback(() => {
    setRedeemState({
      open: false,
      loading: false,
      submitting: false,
      reward: null,
      error: "",
      submissionError: "",
      result: null,
    });
  }, []);

  const handleRedeem = useCallback(
    async (payload: {
      values: Record<string, unknown>;
      hidden: Record<string, string>;
      labels: Record<string, string>;
    }) => {
      const activeReward = redeemState.reward;
      if (!verifiedEmail || !activeReward) {
        toast.error(tBonus("errors.rewardUnavailable"));
        return;
      }
      setRedeemState((prev) => ({
        ...prev,
        submitting: true,
        submissionError: "",
      }));
      try {
        type RedeemApiResponse = {
          redemption?: {
            code: string;
            rewardName?: string | null;
            pointsSpent?: number | null;
            partnerId?: string | null;
            status?: string | null;
            appliedAt?: string | null;
            expiresAt?: string | null;
            visitId?: string;
            verifyUrl?: string | null;
            qrCodeUrl?: string | null;
            qrCodeExpiresAt?: string | null;
            staffScanUrl?: string | null;
            form?: {
              values?: Record<string, unknown>;
              labels?: Record<string, string>;
            };
          };
        };
        const response = (await bonusApi.redeemReward({
          email: verifiedEmail,
          rewardId: activeReward.reward.id,
          form: {
            values: payload.values,
            hidden: payload.hidden,
            labels: payload.labels,
          },
          metadata: {
            requestedAt: new Date().toISOString(),
            rewardTicketType: activeReward.reward.ticketType,
            rewardTransportIncluded: activeReward.reward.transportIncluded,
          },
        })) as RedeemApiResponse;
        const redemption = response?.redemption;
        if (!redemption?.code || !redemption.visitId) {
          throw new Error(tBonus("errors.redeemFailed"));
        }
        const {
          code,
          rewardName: redeemedRewardName,
          pointsSpent: redeemedPoints,
          partnerId: redeemedPartnerId,
          status: redeemedStatus,
          appliedAt,
          expiresAt,
          visitId,
          verifyUrl: redeemedVerifyUrl,
          qrCodeUrl,
          qrCodeExpiresAt,
          staffScanUrl,
          form: redeemedForm,
        } = redemption;

        setRedeemState((prev) => ({
          ...prev,
          submitting: false,
          result: {
            code,
            rewardName: redeemedRewardName ?? activeReward.reward.name,
            pointsSpent: redeemedPoints ?? activeReward.reward.pointsCost,
            partnerId: redeemedPartnerId ?? null,
            status: redeemedStatus ?? "applied",
            appliedAt: appliedAt ?? null,
            expiresAt: expiresAt ?? null,
            visitId,
            verifyUrl: redeemedVerifyUrl ?? null,
            qrCodeUrl: qrCodeUrl ?? null,
            qrCodeExpiresAt: qrCodeExpiresAt ?? null,
            staffScanUrl: staffScanUrl ?? null,
            form: {
              values:
                redeemedForm?.values ??
                (payload.values as Record<string, unknown>),
              labels: redeemedForm?.labels ?? payload.labels,
            },
          },
        }));
        setHighlightCode(code);
        toast.success(tBonus("messages.redeemSuccess"));
        await fetchPoints({ silent: true });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : tBonus("errors.genericRedeemFailed");
        setRedeemState((prev) => ({
          ...prev,
          submitting: false,
          submissionError: message,
        }));
      }
    },
    [verifiedEmail, redeemState.reward, fetchPoints, tBonus]
  );

  const handleCopy = useCallback(
    async (code: string) => {
      try {
        await navigator.clipboard.writeText(code);
        toast.success(tBonus("messages.codeCopied"));
      } catch (err) {
        console.error(err);
        toast.error(tBonus("messages.copyFailed"));
      }
    },
    [tBonus]
  );

  useEffect(() => {
    if (!highlightCode) return;
    const timeout = setTimeout(() => setHighlightCode(null), 6000);
    return () => clearTimeout(timeout);
  }, [highlightCode]);

  const availablePoints = data?.user?.availablePoints ?? 0;
  const totalPoints = data?.user?.totalPoints ?? 0;

  // Fetch all available ticket types from the server
  const [allTicketTypes, setAllTicketTypes] = useState<
    Array<{ value: string; label: string }>
  >([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/public/ticket-types");
        if (!response.ok) throw new Error("Failed to fetch ticket types");
        const data = await response.json();
        if (!cancelled) {
          setAllTicketTypes(data.ticketTypes ?? []);
        }
      } catch (error) {
        console.error("Failed to load ticket types:", error);
        // Fallback to extracting from rewards if API fails
        if (!cancelled) {
          const set = new Set<string>();
          rewards.forEach((reward) => {
            const trimmed = reward.ticketType?.trim();
            if (trimmed) {
              set.add(trimmed);
            }
          });
          setAllTicketTypes(
            Array.from(set)
              .map((value) => ({ value, label: value }))
              .sort((a, b) => a.label.localeCompare(b.label))
          );
        }
      } finally {
        // no-op
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rewards]);

  // Use all ticket types from the API, but also include any from rewards that might not be in the list
  const ticketTypeOptions = useMemo(() => {
    const optionsMap = new Map<string, { value: string; label: string }>();

    // Add all ticket types from the API
    allTicketTypes.forEach((type) => {
      optionsMap.set(type.value.toLowerCase(), type);
    });

    // Also add any ticket types found in rewards (in case they're not in the global list)
    rewards.forEach((reward) => {
      const trimmed = reward.ticketType?.trim();
      if (trimmed && !optionsMap.has(trimmed.toLowerCase())) {
        optionsMap.set(trimmed.toLowerCase(), {
          value: trimmed,
          label: trimmed,
        });
      }
    });

    return Array.from(optionsMap.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, [allTicketTypes, rewards]);

  const filteredRewards = useMemo(() => {
    const partnerNeedle = partnerQuery.trim().toLowerCase();
    const ticketNeedle = ticketTypeFilter.trim().toLowerCase();
    return rewards.filter((reward) => {
      if (partnerNeedle) {
        const names = reward.partnerNames ?? [];
        const matched = names.some((name) =>
          name.toLowerCase().includes(partnerNeedle)
        );
        if (!matched) {
          return false;
        }
      }
      if (ticketTypeFilter !== "all") {
        const rewardType = reward.ticketType
          ? reward.ticketType.trim().toLowerCase()
          : "";
        if (rewardType !== ticketNeedle) {
          return false;
        }
      }
      return true;
    });
  }, [rewards, partnerQuery, ticketTypeFilter]);

  const nextRewardCost = useMemo(() => {
    const pending = rewards
      .filter((reward) => {
        const limitBlocked =
          reward.limitStatus && reward.limitStatus !== "available";
        if (limitBlocked) return false;
        // Calculate actual minimum cost for this reward
        let minCost = reward.pointsCost || 0;
        if (reward.partnerConfigs && reward.partnerConfigs.size > 0) {
          const costs: number[] = [];
          reward.partnerConfigs.forEach((config) => {
            const tickets = config.tickets ?? [];
            tickets.forEach((ticket) => {
              if (typeof ticket.points === "number" && ticket.points > 0) {
                costs.push(ticket.points);
              }
            });
          });
          if (costs.length > 0) {
            minCost = Math.min(...costs);
          }
        }
        if (reward.ticketPoints && reward.ticketPoints.length > 0) {
          const minTicketPoints = Math.min(
            ...reward.ticketPoints.map(
              (tp: { value: string; label: string; points: number }) =>
                tp.points
            )
          );
          minCost = Math.min(minCost || Infinity, minTicketPoints);
        }
        return (
          typeof reward.pointsCost === "number" &&
          (reward.canRedeem === false || availablePoints < minCost)
        );
      })
      .map((reward) => {
        // Calculate actual minimum cost for next reward calculation
        let minCost = reward.pointsCost || Infinity;
        if (reward.partnerConfigs && reward.partnerConfigs.size > 0) {
          const costs: number[] = [];
          reward.partnerConfigs.forEach((config) => {
            const tickets = config.tickets ?? [];
            tickets.forEach((ticket) => {
              if (typeof ticket.points === "number" && ticket.points > 0) {
                costs.push(ticket.points);
              }
            });
          });
          if (costs.length > 0) {
            minCost = Math.min(...costs);
          }
        }
        if (reward.ticketPoints && reward.ticketPoints.length > 0) {
          const minTicketPoints = Math.min(
            ...reward.ticketPoints.map(
              (tp: { value: string; label: string; points: number }) =>
                tp.points
            )
          );
          minCost = Math.min(minCost || Infinity, minTicketPoints);
        }
        return minCost;
      });
    if (pending.length === 0) return 0;
    return Math.min(...pending);
  }, [rewards, availablePoints]);

  const needMore = Number.isFinite(nextRewardCost)
    ? Math.max(0, nextRewardCost - availablePoints)
    : 0;
  const hasRewardTarget =
    Number.isFinite(nextRewardCost) && nextRewardCost !== Infinity;
  const linkExpiryParts = useMemo(() => {
    if (!linkInfo?.expiresAt) return null;
    try {
      const parsed = new Date(linkInfo.expiresAt);
      return {
        date: format(parsed, "PPP"),
        time: format(parsed, "HH:mm"),
      };
    } catch {
      return null;
    }
  }, [linkInfo]);

  if (error) {
    return (
      <main className="min-h-screen text-white">
        <section className="flex min-h-[60vh] items-center justify-center px-4">
          <div className="w-full max-w-2xl space-y-4 rounded-3xl border border-white/10 bg-slate-900/70 p-8 text-center shadow-2xl shadow-black/40">
            <h1 className="text-2xl font-semibold">
              {tBonus("secureLink.title")}
            </h1>
            <p className="text-sm text-slate-300">{error}</p>
            <Button asChild variant="secondary">
              <Link href="/bonus">{tBonus("secureLink.cta")}</Link>
            </Button>
          </div>
        </section>
      </main>
    );
  }

  if (loading || !data || !debug || !linkInfo) {
    return (
      <main className="min-h-screen text-white">
        <section className="flex min-h-[60vh] items-center justify-center px-4">
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-white/10 bg-slate-900/60 px-8 py-12 shadow-2xl shadow-black/40">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-300" />
            <p className="text-sm text-indigo-100">
              {tBonus("states.loadingRewards")}
            </p>
          </div>
        </section>
      </main>
    );
  }

  const visits = data.visits ?? [];
  const pointsHistory = debug.pointsHistory ?? [];
  const redemptions = debug.redemptions ?? [];

  function formatParts(iso?: string | null) {
    if (!iso) return { valid: false, date: "—", time: "" };
    try {
      const parsed = new Date(iso);
      return {
        valid: true,
        date: format(parsed, "yyyy-MM-dd"),
        time: format(parsed, "HH:mm"),
      };
    } catch {
      return { valid: false, date: iso as string, time: "" };
    }
  }

  function renderDateTime(iso?: string | null) {
    const { valid, date, time } = formatParts(iso);
    if (!valid) {
      return <span className="text-muted-foreground">—</span>;
    }
    return (
      <div className="flex flex-col gap-1 text-sm">
        <span className="flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
          {date}
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {time}
        </span>
      </div>
    );
  }

  function formatResultFieldValue(value: unknown) {
    if (value === null || value === undefined) return "";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (Array.isArray(value)) {
      return value
        .map((entry) =>
          typeof entry === "string" ? entry : JSON.stringify(entry)
        )
        .join(", ");
    }
    if (typeof value === "object") {
      const parts = Object.values(value as Record<string, unknown>)
        .map((entry) =>
          entry === null || entry === undefined ? "" : String(entry)
        )
        .filter(Boolean);
      return parts.join(", ");
    }
    return String(value);
  }

  function renderSummary() {
    if (!redeemState.result) return null;
    const result = redeemState.result;
    const formEntries = Object.entries(result.form.labels ?? {})
      .map(([key, label]) => {
        const rawValue = result.form.values?.[key];
        const formatted = formatResultFieldValue(rawValue);
        if (!formatted || !formatted.trim()) return null;
        return { key, label, value: formatted };
      })
      .filter(
        (entry): entry is { key: string; label: string; value: string } =>
          entry !== null
      );
    return (
      <div className="space-y-4 text-white">
        <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm">
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-[0.3em] text-indigo-200/70">
              {tBonus("dialog.fields.reward")}
            </span>
            <span className="text-sm font-semibold">{result.rewardName}</span>
          </div>
          <dl className="space-y-2 text-xs text-slate-300">
            <div className="flex items-center justify-between">
              <dt className="uppercase tracking-[0.3em] text-indigo-200/70">
                {tBonus("dialog.codeHeading")}
              </dt>
              <dd className="font-mono text-sm">{result.code}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="uppercase tracking-[0.3em] text-indigo-200/70">
                {tBonus("dialog.fields.pointsSpent")}
              </dt>
              <dd className="font-semibold">
                {result.pointsSpent.toLocaleString()} pts
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="uppercase tracking-[0.3em] text-indigo-200/70">
                {tBonus("dialog.fields.status")}
              </dt>
              <dd className="capitalize text-sm">{result.status}</dd>
            </div>
          </dl>
        </div>

        <QrPreviewCard
          heading={tBonus("dialog.scanHeading")}
          description={
            verifiedEmail
              ? `We’ve emailed the QR to ${verifiedEmail}. Present it to staff or download it now.`
              : "We’ve emailed the QR code to you. Present it to staff or download it now."
          }
          qrCodeUrl={result.qrCodeUrl}
          qrCodeExpiresAt={result.qrCodeExpiresAt}
          downloadLabel="Download QR"
        >
          {result.staffScanUrl ? (
            <p className="text-xs text-slate-300">
              Staff verification link:{" "}
              <span className="break-all font-mono">{result.staffScanUrl}</span>
            </p>
          ) : null}
        </QrPreviewCard>

        {formEntries.length > 0 ? (
          <div className="space-y-2 rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm">
            <h3 className="text-xs uppercase tracking-[0.3em] text-indigo-200/70">
              {tBonus("dialog.formResponses")}
            </h3>
            <div className="space-y-2">
              {formEntries.map((entry) => (
                <div
                  key={entry.key}
                  className="flex flex-col rounded-xl border border-white/5 bg-slate-950/60 px-3 py-2"
                >
                  <span className="text-xs uppercase tracking-[0.25em] text-indigo-200/70">
                    {entry.label}
                  </span>
                  <span className="text-sm">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <main className="space-y-10 text-white">
      <SiteNav />
      {/* Main background updated to bg-slate-950 as per design requirements */}
      <section className="relative isolate overflow-hidden border-b border-white/10 pt-[120px]">
        <div className="relative mx-auto flex max-w-[120rem] flex-col gap-6 px-4 py-20 lg:px-24">
          <div className="space-y-2 mb-12 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.25em] text-indigo-300 pl-1">
                Rewards
              </span>
              <h1 className="font-[family-name:var(--font-influencer)] text-[80px] uppercase tracking-wide text-white leading-[0.8]">
                {tBonus("hero.title")}
              </h1>
              <p className="text-lg text-slate-400 max-w-2xl mt-2">
                {tBonus("hero.description")}
              </p>
            </div>

            {/* Viewing Info - Top Right */}
            <div className="text-right">
              <p className="text-sm font-medium uppercase tracking-widest text-white mb-1">
                {tBonus("secureLink.viewing")}
              </p>
              <div className="text-3xl font-[family-name:var(--font-influencer)] uppercase text-amber-400 tracking-wide leading-none mb-2">
                {linkInfo.email}
              </div>
              {linkExpiryParts && (
                <p className="text-xs font-medium uppercase tracking-wider text-white/70">
                  {tBonus("secureLink.expires")
                    .replace("{date}", linkExpiryParts.date)
                    .replace("{time}", linkExpiryParts.time)}
                </p>
              )}
              <div className="mt-4 flex justify-end">
                <RefreshButton
                  onRefresh={() => fetchPoints({ silent: false })}
                  disabled={loading || !verifiedEmail}
                  className="bg-white/10 hover:bg-white/20 border-white/10 text-white"
                />
              </div>
            </div>
          </div>

          <div className="w-full">
            {/* Stats Card */}
            <div className="flex justify-start">
              <div className="w-auto h-auto rounded-[32px] bg-slate-950/50 backdrop-blur-md border border-white/10 shadow-lg">
                <div className="p-4">
                  <div className="flex gap-4">
                    {/* Total Points */}
                    <div className="flex flex-col justify-center gap-2 rounded-2xl border border-white/10 bg-slate-950/30 px-6 py-4 min-w-[200px]">
                      <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-indigo-200/70">
                        {tBonus("points.total")}
                      </span>
                      <span className="font-[family-name:var(--font-influencer)] text-5xl text-white leading-none tracking-tight">
                        {totalPoints.toLocaleString()}
                      </span>
                    </div>
                    {/* Available Points */}
                    <div className="flex flex-col justify-center gap-2 rounded-2xl border border-white/10 bg-slate-950/30 px-6 py-4 min-w-[200px]">
                      <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-indigo-200/70">
                        {tBonus("points.available")}
                      </span>
                      <span className="font-[family-name:var(--font-influencer)] text-5xl text-white leading-none tracking-tight">
                        {availablePoints.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-[120rem] flex-col gap-10 px-4 py-10 lg:px-24">
        <div className="space-y-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3 max-w-2xl">
              <h2 className="font-[family-name:var(--font-influencer)] text-[64px] uppercase tracking-wide text-white leading-none">
                {tBonus("rewards.title")}
              </h2>
              <p className="text-lg text-slate-300">
                {tBonus("rewards.description")}
                <span className="mx-1.5 inline-block font-semibold text-white bg-white/10 px-2 py-0.5 rounded-md">
                  {tBonus("rewards.onePoint")}
                </span>
                {tBonus("rewards.forEvery")}
                <span className="mx-1.5 inline-block font-semibold text-white bg-white/10 px-2 py-0.5 rounded-md">
                  {data.pointRatioCzk?.toLocaleString() ?? "—"} Kč
                </span>
                {tBonus("rewards.postfix")}
              </p>
            </div>
            <div className="flex items-center gap-3 bg-slate-900/50 px-4 py-2 rounded-full border border-white/10 backdrop-blur">
              <Gift className="h-5 w-5 text-amber-400" />
              <span className="text-sm font-medium text-white">
                {tBonus("rewards.shown")
                  .replace("{visible}", filteredRewards.length.toString())
                  .replace("{total}", rewards.length.toString())}
              </span>
            </div>
          </div>

          {rewards.length > 0 ? (
            <>
              <div className="w-full space-y-8">
                {/* Search Bar */}
                <div className="relative max-w-xl">
                  <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-white transition-colors" />
                    <input
                      type="text"
                      value={partnerQuery}
                      onChange={(e) => setPartnerQuery(e.target.value)}
                      placeholder={tBonus("filters.partnerPlaceholder")}
                      className="w-full h-14 pl-12 pr-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-slate-500 focus:outline-none focus:border-white/20 focus:bg-white/10 focus:ring-1 focus:ring-white/20 transition-all"
                    />
                  </div>
                </div>

                {/* Ticket Type Tabs */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setTicketTypeFilter("all")}
                    className={cn(
                      "relative px-5 py-2.5 rounded-full text-sm font-medium transition-colors",
                      ticketTypeFilter === "all"
                        ? "text-slate-950"
                        : "text-slate-300 hover:text-white hover:bg-white/5"
                    )}
                  >
                    {ticketTypeFilter === "all" && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-white rounded-full"
                        transition={{
                          type: "spring",
                          bounce: 0.2,
                          duration: 0.6,
                        }}
                      />
                    )}
                    <span className="relative z-10">
                      {tBonus("filters.allTicketTypes")}
                    </span>
                  </button>

                  {ticketTypeOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setTicketTypeFilter(option.value)}
                      className={cn(
                        "relative px-5 py-2.5 rounded-full text-sm font-medium transition-colors",
                        ticketTypeFilter === option.value
                          ? "text-slate-950"
                          : "text-slate-300 hover:text-white hover:bg-white/5"
                      )}
                    >
                      {ticketTypeFilter === option.value && (
                        <motion.div
                          layoutId="activeTab"
                          className="absolute inset-0 bg-white rounded-full"
                          transition={{
                            type: "spring",
                            bounce: 0.2,
                            duration: 0.6,
                          }}
                        />
                      )}
                      <span className="relative z-10">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {filteredRewards.length > 0 ? (
                <ul className="mt-10 grid gap-x-8 gap-y-12 md:grid-cols-2 xl:grid-cols-3">
                  {filteredRewards.map((reward) => {
                    // Calculate actual minimum cost (accounting for partner-specific costs and ticket points)
                    let displayCost = reward.pointsCost || 0;
                    let minCost = reward.pointsCost || 0;

                    if (
                      reward.partnerConfigs &&
                      reward.partnerConfigs.size > 0
                    ) {
                      const costs: number[] = [];
                      reward.partnerConfigs.forEach((config) => {
                        const tickets = config.tickets ?? [];
                        tickets.forEach((ticket) => {
                          if (
                            typeof ticket.points === "number" &&
                            ticket.points > 0
                          ) {
                            costs.push(ticket.points);
                          }
                        });
                      });
                      if (costs.length > 0) {
                        minCost = Math.min(...costs);
                      }
                    }

                    if (reward.ticketPoints && reward.ticketPoints.length > 0) {
                      const minTicketPoints = Math.min(
                        ...reward.ticketPoints.map((tp) => tp.points)
                      );
                      minCost = Math.min(minCost || Infinity, minTicketPoints);
                    }

                    // Use minimum cost for canRedeem check (best case for user)
                    displayCost =
                      minCost > 0 ? minCost : reward.pointsCost || 0;

                    const limitStatus = reward.limitStatus ?? "available";
                    const limitBlocked = limitStatus !== "available";
                    const rewardAvailableFlag =
                      reward.isAvailable !== false && !limitBlocked;
                    const canRedeem =
                      rewardAvailableFlag &&
                      reward.canRedeem !== false &&
                      availablePoints >= displayCost;
                    const partnerNames = reward.partnerNames ?? [];
                    const primaryPartner = partnerNames[0] ?? "—";

                    // Use primary image (imageUrl) first, then fall back to first hero image
                    const heroImageUrl =
                      reward.imageUrl ?? reward.heroImages?.[0] ?? null;

                    return (
                      <li key={reward.id}>
                        <GlassContentCard
                          reward={{
                            id: reward.id,
                            imageUrl: heroImageUrl,
                            pointsCost: displayCost,
                            partnerName: primaryPartner,
                            name: reward.name,
                            category: reward.category,
                            partnerLogoUrl: reward.partnerLogoUrl,
                            limitStatus: limitStatus,
                            canRedeem: canRedeem,
                            isAvailable: rewardAvailableFlag,
                            onRedeem: () => openRedeem(reward.id),
                            loading: loading,
                          }}
                        />
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="mt-10 flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-slate-950/30 p-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center mb-4">
                    <Search className="w-8 h-8 text-slate-500" />
                  </div>
                  <h3 className="text-lg font-medium text-white mb-2">
                    {tBonus("rewards.noMatches")}
                  </h3>
                  <p className="text-slate-400 max-w-xs">
                    Try adjusting your filters or search for a different
                    partner.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="mt-10 flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-slate-950/30 p-12 text-center">
              <p className="text-lg text-slate-300">
                {tBonus("rewards.noneAvailable")}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-12 pt-10 border-t border-white/10">
          {pointsHistory.length > 0 ? (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-8 w-1 bg-indigo-500 rounded-full"></div>
                <h2 className="text-2xl font-bold text-white">
                  {tBonus("history.pointsTitle")}
                </h2>
              </div>

              <div className="w-full rounded-3xl bg-slate-950/50 backdrop-blur-md border border-white/10 shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm text-left">
                    <thead className="text-xs text-indigo-200 uppercase bg-white/5 tracking-wider font-semibold">
                      <tr>
                        <th className="px-6 py-4 rounded-tl-3xl">
                          {tBonus("history.when")}
                        </th>
                        <th className="px-6 py-4">{tBonus("history.type")}</th>
                        <th className="px-6 py-4">
                          {tBonus("history.points")}
                        </th>
                        <th className="px-6 py-4 rounded-tr-3xl">
                          {tBonus("history.partner")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {pointsHistory.map((entry) => (
                        <tr
                          key={entry.id}
                          className="hover:bg-white/5 transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            {renderDateTime(entry.created_at)}
                          </td>
                          <td className="px-6 py-4 capitalize">
                            {entry.type || "—"}
                          </td>
                          <td className="px-6 py-4 font-medium text-white">
                            {(entry.points ?? 0).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-slate-300">
                            {entry.partner_name || entry.partner_id || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          {redemptions.length > 0 ? (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-8 w-1 bg-amber-500 rounded-full"></div>
                <h2 className="text-2xl font-bold text-white">
                  {tBonus("redemptions.title")}
                </h2>
              </div>

              <div className="w-full rounded-3xl bg-slate-950/50 backdrop-blur-md border border-white/10 shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm text-left">
                    <thead className="text-xs text-indigo-200 uppercase bg-white/5 tracking-wider font-semibold">
                      <tr>
                        <th className="px-6 py-4 rounded-tl-3xl">
                          {tBonus("redemptions.code")}
                        </th>
                        <th className="px-6 py-4">
                          {tBonus("redemptions.status")}
                        </th>
                        <th className="px-6 py-4">
                          {tBonus("redemptions.created")}
                        </th>
                        <th className="px-6 py-4">
                          {tBonus("redemptions.used")}
                        </th>
                        <th className="px-6 py-4">
                          {tBonus("redemptions.expires")}
                        </th>
                        <th className="px-6 py-4 rounded-tr-3xl">
                          {tBonus("redemptions.actions")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {redemptions.map((entry) => (
                        <tr
                          key={entry.code}
                          className="hover:bg-white/5 transition-colors"
                        >
                          <td className="px-6 py-4 font-mono text-xs text-amber-300">
                            {entry.code}
                          </td>
                          <td className="px-6 py-4 capitalize">
                            <span
                              className={cn(
                                "px-2 py-1 rounded-full text-xs font-medium",
                                entry.status === "applied"
                                  ? "bg-green-500/20 text-green-300"
                                  : "bg-slate-700/50 text-slate-300"
                              )}
                            >
                              {entry.status ?? "—"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {renderDateTime(entry.created_at)}
                          </td>
                          <td className="px-6 py-4">
                            {renderDateTime(entry.used_at)}
                          </td>
                          <td className="px-6 py-4">
                            {renderDateTime(entry.expires_at)}
                          </td>
                          <td className="px-6 py-4">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopy(entry.code ?? "")}
                              className="flex items-center gap-2 text-indigo-200 hover:text-white hover:bg-indigo-500/20"
                            >
                              <Copy className="h-4 w-4" />
                              {tBonus("actions.copy")}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          {visits.length > 0 ? (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-8 w-1 bg-fuchsia-500 rounded-full"></div>
                <h2 className="text-2xl font-bold text-white">
                  {tBonus("visits.title")}
                </h2>
              </div>

              <div className="w-full rounded-3xl bg-slate-950/50 backdrop-blur-md border border-white/10 shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm text-left">
                    <thead className="text-xs text-indigo-200 uppercase bg-white/5 tracking-wider font-semibold">
                      <tr>
                        <th className="px-6 py-4 rounded-tl-3xl">
                          {tBonus("visits.partner")}
                        </th>
                        <th className="px-6 py-4">{tBonus("visits.status")}</th>
                        <th className="px-6 py-4">{tBonus("visits.points")}</th>
                        <th className="px-6 py-4">
                          {tBonus("visits.created")}
                        </th>
                        <th className="px-6 py-4 rounded-tr-3xl">
                          {tBonus("visits.visited")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {visits.map((visit, index) => (
                        <tr
                          key={`${visit.partnerId}-${index}`}
                          className="hover:bg-white/5 transition-colors"
                        >
                          <td className="px-6 py-4 font-medium text-white">
                            {visit.partner ?? visit.partnerId ?? "—"}
                          </td>
                          <td className="px-6 py-4 capitalize text-slate-300">
                            {visit.status ?? "—"}
                          </td>
                          <td className="px-6 py-4 text-indigo-300 font-medium">
                            {(
                              visit.pointsEarned ??
                              visit.estimatedPoints ??
                              0
                            ).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-slate-400">
                            {renderDateTime(visit.createdAt)}
                          </td>
                          <td className="px-6 py-4 text-slate-400">
                            {renderDateTime(visit.visitedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <Dialog.Root
        open={redeemState.open}
        onOpenChange={(open) => !open && closeRedeem()}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-950/80 backdrop-blur z-50" />
          <Dialog.Content className="fixed inset-0 m-auto h-fit max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/40 z-50 outline-none">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  {redeemState.result
                    ? tBonus("dialog.successTitle")
                    : tBonus("dialog.title")}
                </h2>
                <p className="text-sm text-slate-300">
                  {redeemState.result
                    ? tBonus("dialog.successDescription")
                    : tBonus("dialog.description")}
                </p>
              </div>
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon" className="text-white">
                  ×
                </Button>
              </Dialog.Close>
            </div>
            <Separator className="my-4 border-white/10" />
            {redeemState.loading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-300" />
              </div>
            ) : redeemState.error ? (
              <p className="text-sm text-rose-300">{redeemState.error}</p>
            ) : redeemState.result ? (
              renderSummary()
            ) : redeemState.reward ? (
              <>
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-indigo-100 mb-4">
                  <p className="font-semibold text-white">
                    {redeemState.reward.reward.name}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {redeemState.reward.reward.ticketType ? (
                      <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.25em]">
                        Ticket: {redeemState.reward.reward.ticketType}
                      </span>
                    ) : null}
                    <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.25em]">
                      {redeemState.reward.reward.transportIncluded
                        ? "Transport included"
                        : "Transport not included"}
                    </span>
                  </div>
                </div>
                <RewardRedemptionRunner
                  form={redeemState.reward.form}
                  rewardName={redeemState.reward.reward.name}
                  prefillEmail={verifiedEmail}
                  submitting={redeemState.submitting}
                  submissionError={redeemState.submissionError}
                  onSubmit={handleRedeem}
                  onCancel={closeRedeem}
                />
              </>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </main>
  );
}
