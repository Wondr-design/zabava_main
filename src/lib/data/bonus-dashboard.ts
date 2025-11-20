import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getTotalPointsForEmail } from "@/lib/data/points";
import { getActivePointRatio } from "@/lib/data/point-settings";

export interface BonusVisitSummary {
  partnerId?: string | null;
  status?: string | null;
  pointsEarned?: number | null;
  ticketType?: string | null;
  numPeople?: number | null;
  transport?: string | null;
  totalPrice?: number | null;
  visitDate?: string | null;
  confirmedDate?: string | null;
}

export interface BonusRewardListItem {
  id: string;
  name: string;
  pointsCost: number;
  canRedeem?: boolean;
  limitStatus?: RewardLimitStatus;
  nextRedeemAt?: string | null;
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
  partnerConfigs?: Map<
    string,
    { formId: string | null; tickets: { key: string; label: string; points: number }[] }
  >;
}

export type RewardLimitStatus =
  | "available"
  | "daily_exhausted"
  | "monthly_exhausted"
  | "window_exhausted";

export interface BonusDashboardData {
  user: { totalPoints: number; availablePoints: number };
  visits: BonusVisitSummary[];
  statistics: {
    totalPartners: number;
    totalVisits: number;
    pendingVisits: number;
  };
  availableRewards: BonusRewardListItem[];
  pointRatioCzk: number;
}

interface VisitRow {
  partner_id: string | null;
  status?: string | null;
  points_awarded?: number | null;
  estimated_points?: number | null;
  ticket_type?: string | null;
  num_people?: number | null;
  transport?: string | null;
  total_price?: number | string | null;
  created_at?: string | null;
  visited_at?: string | null;
}

interface RewardRow {
  id: string;
  name: string;
  description?: string | null;
  points_cost?: number | null;
  category?: string | null;
  stock?: number | null;
  status?: string | null;
  image_url?: string | null;
  hero_images?: string[] | null;
  age_groups?: string[] | null;
  tags?: string[] | null;
  savings_value?: number | string | null;
  partner_logo_url?: string | null;
  redemption_instructions?: string | null;
  redemption_form_id?: string | null;
  ticket_type?: string | null;
  transport_included?: boolean | null;
  is_available?: boolean | null;
  valid_from?: string | null;
  valid_until?: string | null;
  show_availability_date?: boolean | null;
  ticket_points?: Array<{ value: string; label: string; points: number }> | null;
  monthly_redemption_limit?: number | null;
  daily_redemption_limit?: number | null;
  stock_window_days?: number | null;
}

interface PartnerVisibilityRow {
  reward_id: string;
  partner_id: string;
  form_id?: string | null;
  points_cost?: number | null;
  ticket_points?: { key: string; label: string; points: number }[] | null;
}

const ACTIVE_REDEMPTION_STATUSES = ["pending", "applied", "used"] as const;

function mapVisit(row: VisitRow): BonusVisitSummary {
  const status = row.status || "pending";
  const points = Number(row.points_awarded || row.estimated_points || 0) || 0;
  return {
    partnerId: row.partner_id,
    status,
    pointsEarned: points,
    ticketType: row.ticket_type || "Standard",
    numPeople: row.num_people || 1,
    transport: row.transport || null,
    totalPrice: Number(row.total_price || 0) || 0,
    visitDate: row.created_at || null,
    confirmedDate: row.visited_at || null,
  };
}

export async function loadBonusDashboard(email: string): Promise<BonusDashboardData> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error("Email is required");
  }

  const supabase = getSupabaseAdmin();

  const totalPoints = await getTotalPointsForEmail(normalizedEmail);
  const availablePoints = totalPoints;

  const visitsRes = await supabase
    .from("visit_registrations")
    .select(
      "partner_id,status,created_at,visited_at,points_awarded,estimated_points,total_price,num_people,ticket_type,transport",
    )
    .eq("email", normalizedEmail)
    .order("created_at", { ascending: false });
  if (visitsRes.error) {
    throw new Error(`Failed to load visits: ${visitsRes.error.message}`);
  }
  const visitRows: VisitRow[] = visitsRes.data ?? [];
  const visits = visitRows.map(mapVisit);

  const visitedPartnerIds = new Set<string>();
  visitRows.forEach((row) => {
    if (row.partner_id) visitedPartnerIds.add(row.partner_id);
  });

  const rewardsRes = await supabase.from("rewards").select("*").eq("status", "active");
  if (rewardsRes.error) {
    throw new Error(`Failed to load rewards: ${rewardsRes.error.message}`);
  }
  const rewardRows: RewardRow[] = rewardsRes.data ?? [];

  const visibilityMap = new Map<string, string[]>();
  const partnerConfigMap = new Map<
    string,
    Map<string, { formId: string | null; tickets: { key: string; label: string; points: number }[] }>
  >();
  
  if (rewardRows.length > 0) {
    const ids = rewardRows.map((reward) => reward.id);
    const visibilityRes = await supabase
      .from("reward_partner_visibility")
      .select("reward_id, partner_id, form_id, points_cost, ticket_points")
      .in("reward_id", ids);
    if (visibilityRes.error) {
      throw new Error(`Failed to load reward visibility: ${visibilityRes.error.message}`);
    }
    const rows = (visibilityRes.data ?? []) as PartnerVisibilityRow[];
    rows.forEach((row) => {
      // Build partner list
      const list = visibilityMap.get(row.reward_id) ?? [];
      if (!list.includes(row.partner_id)) {
        list.push(row.partner_id);
        visibilityMap.set(row.reward_id, list);
      }
      
      // Build partner config map
      let rewardConfigs = partnerConfigMap.get(row.reward_id);
      if (!rewardConfigs) {
        rewardConfigs = new Map();
        partnerConfigMap.set(row.reward_id, rewardConfigs);
      }
      rewardConfigs.set(row.partner_id, {
        formId: row.form_id ?? null,
        tickets: Array.isArray(row.ticket_points)
          ? row.ticket_points
              .map((entry) => {
                const key = typeof entry.key === "string" ? entry.key : null;
                if (!key) return null;
                const label =
                  typeof entry.label === "string" && entry.label.trim()
                    ? entry.label
                    : key;
                const points = Number(entry.points ?? 0) || 0;
                return { key, label, points };
              })
              .filter(
                (entry): entry is { key: string; label: string; points: number } =>
                  Boolean(entry)
              )
          : [],
      });
    });
  }

  // Fetch partner display names for all unique partners
  const allPartnerIds = new Set<string>();
  rewardRows.forEach((reward) => {
    const partners = visibilityMap.get(reward.id) ?? [];
    partners.forEach((id) => allPartnerIds.add(id));
  });
  
  const partnerNameMap = new Map<string, string | null>();
  if (allPartnerIds.size > 0) {
    const partnerIdsArray = Array.from(allPartnerIds);
    const partnersRes = await supabase
      .from("partners")
      .select("id, display_name")
      .in("id", partnerIdsArray);
    if (!partnersRes.error && partnersRes.data) {
      partnersRes.data.forEach((row: { id: string; display_name: string | null }) => {
        partnerNameMap.set(row.id, row.display_name);
      });
    }
  }

  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfNextDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  );
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startOfNextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const dailyUsage = new Map<string, number>();
  const monthlyUsage = new Map<string, number>();
  const stockUsage = new Map<
    string,
    { count: number; oldestInWindow: string | null; windowStartIso: string | null }
  >();

  const dailyLimitedIds = rewardRows
    .filter(
      (reward) =>
        typeof reward.daily_redemption_limit === "number" &&
        (reward.daily_redemption_limit ?? 0) > 0
    )
    .map((reward) => reward.id);
  if (dailyLimitedIds.length > 0) {
    const { data, error } = await supabase
      .from("redemptions")
      .select("reward_id")
      .in("reward_id", dailyLimitedIds)
      .gte("created_at", startOfDay.toISOString())
      .in("status", ACTIVE_REDEMPTION_STATUSES);
    if (error) {
      throw new Error(`Failed to load daily reward usage counts: ${error.message}`);
    }
    (data ?? []).forEach((row: { reward_id?: string | null }) => {
      if (!row?.reward_id) return;
      dailyUsage.set(row.reward_id, (dailyUsage.get(row.reward_id) ?? 0) + 1);
    });
  }

  const monthlyLimitedIds = rewardRows
    .filter(
      (reward) =>
        typeof reward.monthly_redemption_limit === "number" &&
        (reward.monthly_redemption_limit ?? 0) > 0
    )
    .map((reward) => reward.id);
  if (monthlyLimitedIds.length > 0) {
    const { data, error } = await supabase
      .from("redemptions")
      .select("reward_id")
      .in("reward_id", monthlyLimitedIds)
      .gte("created_at", startOfMonth.toISOString())
      .in("status", ACTIVE_REDEMPTION_STATUSES);
    if (error) {
      throw new Error(`Failed to load monthly reward usage counts: ${error.message}`);
    }
    (data ?? []).forEach((row: { reward_id?: string | null }) => {
      if (!row?.reward_id) return;
      monthlyUsage.set(row.reward_id, (monthlyUsage.get(row.reward_id) ?? 0) + 1);
    });
  }

  const stockLimitedRewards = rewardRows.filter(
    (reward) => typeof reward.stock === "number" && (reward.stock ?? 0) > 0
  );
  for (const reward of stockLimitedRewards) {
    let windowStartIso: string | null = null;
    if (reward.stock_window_days && reward.stock_window_days > 0) {
      const windowStart = new Date(now);
      windowStart.setUTCDate(windowStart.getUTCDate() - reward.stock_window_days);
      windowStart.setUTCHours(0, 0, 0, 0);
      windowStartIso = windowStart.toISOString();
    } else if (reward.valid_from) {
      windowStartIso = reward.valid_from;
    }

    const stockQuery = supabase
      .from("redemptions")
      .select("created_at", { count: "exact" })
      .eq("reward_id", reward.id)
      .in("status", ACTIVE_REDEMPTION_STATUSES)
      .order("created_at", { ascending: true })
      .limit(1);
    if (windowStartIso) {
      stockQuery.gte("created_at", windowStartIso);
    }
    const { data, error, count } = await stockQuery;
    if (error) {
      throw new Error(`Failed to load reward stock usage: ${error.message}`);
    }
    const oldestInWindow =
      Array.isArray(data) && data.length > 0 ? (data[0]?.created_at as string | null) : null;
    stockUsage.set(reward.id, {
      count: count ?? 0,
      oldestInWindow,
      windowStartIso,
    });
  }

  const limitMeta = new Map<string, { status: RewardLimitStatus; nextRedeemAt: string | null }>();

  rewardRows.forEach((reward) => {
    const dailyLimit =
      typeof reward.daily_redemption_limit === "number" && reward.daily_redemption_limit > 0
        ? reward.daily_redemption_limit
        : null;
    const monthlyLimit =
      typeof reward.monthly_redemption_limit === "number" && reward.monthly_redemption_limit > 0
        ? reward.monthly_redemption_limit
        : null;
    const stockLimit =
      typeof reward.stock === "number" && reward.stock > 0 ? reward.stock : null;

    const dailyUsed = dailyUsage.get(reward.id) ?? 0;
    const monthlyUsed = monthlyUsage.get(reward.id) ?? 0;
    const stockInfo = stockUsage.get(reward.id);
    const stockUsed = stockInfo?.count ?? 0;

    let status: RewardLimitStatus = "available";
    let nextRedeemAt: string | null = null;

    if (dailyLimit && dailyUsed >= dailyLimit) {
      status = "daily_exhausted";
      nextRedeemAt = startOfNextDay.toISOString();
    } else if (monthlyLimit && monthlyUsed >= monthlyLimit) {
      status = "monthly_exhausted";
      nextRedeemAt = startOfNextMonth.toISOString();
    } else if (stockLimit && stockUsed >= stockLimit) {
      status = "window_exhausted";
      if (
        reward.stock_window_days &&
        reward.stock_window_days > 0 &&
        stockInfo?.oldestInWindow
      ) {
        const nextWindow = new Date(stockInfo.oldestInWindow);
        if (!Number.isNaN(nextWindow.getTime())) {
          nextWindow.setUTCDate(nextWindow.getUTCDate() + reward.stock_window_days);
          nextWindow.setUTCHours(0, 0, 0, 0);
          nextRedeemAt = nextWindow.toISOString();
        }
      }
      if (reward.valid_until) {
        const expires = new Date(reward.valid_until);
        if (!Number.isNaN(expires.getTime())) {
          if (!nextRedeemAt || expires.getTime() < new Date(nextRedeemAt).getTime()) {
            nextRedeemAt = null;
          }
        }
      }
    }

    limitMeta.set(reward.id, { status, nextRedeemAt });
  });

  const availableRewards: BonusRewardListItem[] = rewardRows.map((reward) => {
    const partners = visibilityMap.get(reward.id) ?? [];
    const partnerConfigs = partnerConfigMap.get(reward.id) ?? new Map();

    const limits = limitMeta.get(reward.id) ?? { status: "available", nextRedeemAt: null };
    
    // Get partner display names
    const partnerNames = partners
      .map((partnerId) => {
        const displayName = partnerNameMap.get(partnerId);
        return displayName || partnerId;
      })
      .filter(Boolean) as string[];

    let minPointsCost = reward.points_cost ?? 0;

    // Partner ticket points
    partnerConfigs.forEach((config) => {
      if (Array.isArray(config.tickets) && config.tickets.length > 0) {
        const minTicket = Math.min(
          ...config.tickets.map((t: { points: number }) => t.points)
        );
        minPointsCost = minPointsCost
          ? Math.min(minPointsCost, minTicket)
          : minTicket;
      }
    });

    // Reward-level ticket points fallback
    let ticketPoints: Array<{ value: string; label: string; points: number }> | undefined;
    if (Array.isArray(reward.ticket_points)) {
      ticketPoints = reward.ticket_points
        .map((entry) => {
          const value = typeof entry?.value === "string" ? entry.value : "";
          const label = typeof entry?.label === "string" ? entry.label : value;
          const points = Number(entry?.points ?? 0) || 0;
          if (value && label && points > 0) {
            return { value, label, points };
          }
          return null;
        })
        .filter(
          (entry): entry is { value: string; label: string; points: number } =>
            Boolean(entry)
        );
      if (ticketPoints.length > 0) {
        const minTicketPoints = Math.min(...ticketPoints.map((tp) => tp.points));
        minPointsCost = minPointsCost
          ? Math.min(minPointsCost, minTicketPoints)
          : minTicketPoints;
      } else {
        ticketPoints = undefined;
      }
    }
    
    // Use minimum cost for canRedeem calculation (best case scenario for user)
    const basePointsCost = minPointsCost > 0 ? minPointsCost : (reward.points_cost ?? 0);
    
    const partnerQualified =
      partners.length === 0 || partners.some((partner) => visitedPartnerIds.has(partner));
    const isAvailable = reward.is_available !== false;
    const canRedeem =
      isAvailable && partnerQualified && availablePoints >= basePointsCost;
    const savings =
      typeof reward.savings_value === "number"
        ? reward.savings_value
        : Number(reward.savings_value ?? 0) || 0;
    
    return {
      id: reward.id,
      name: reward.name,
      description: reward.description ?? "",
      pointsCost: reward.points_cost ?? 0, // Default/base cost for display
      category: reward.category ?? null,
      canRedeem,
      stock: reward.stock ?? null,
      imageUrl: reward.image_url ?? null, // Primary image (set by admin)
      heroImages: Array.isArray(reward.hero_images)
        ? reward.hero_images.filter(Boolean)
        : [],
      partnerNames: partnerNames.length > 0 ? partnerNames : undefined,
      partnerLogoUrl: reward.partner_logo_url ?? null,
      savingsValue: savings,
      ageGroups: Array.isArray(reward.age_groups)
        ? reward.age_groups.filter(Boolean)
        : [],
      tags: Array.isArray(reward.tags) ? reward.tags.filter(Boolean) : [],
      redemptionInstructions: reward.redemption_instructions ?? null,
      redemptionFormId: reward.redemption_form_id ?? null,
      availableFor: partners,
      ticketType: reward.ticket_type ?? null,
      transportIncluded: Boolean(reward.transport_included),
      isAvailable,
      validFrom: reward.valid_from ?? null,
      validUntil: reward.valid_until ?? null,
      showAvailabilityDate: Boolean(reward.show_availability_date),
      ticketPoints,
      partnerConfigs: partnerConfigs.size > 0 ? partnerConfigs : undefined,
      limitStatus: limits.status,
      nextRedeemAt: limits.nextRedeemAt,
    };
  });

  const statistics = {
    totalPartners: visitedPartnerIds.size,
    totalVisits: visits.length,
    pendingVisits: visitRows.filter(
      (row) => (row.status || "").toLowerCase() === "pending",
    ).length,
  };

  const ratio = await getActivePointRatio();

  return {
    user: { totalPoints, availablePoints },
    visits,
    statistics,
    availableRewards,
    pointRatioCzk: ratio.ratioCzk,
  };
}
