import type { z } from "zod";

import { getSupabaseAdmin } from "../supabase-admin";
import { partnerTypeSchema } from "./partners";

type PartnerType = z.infer<typeof partnerTypeSchema>;
import { VisitRegistrationRecord } from "./visits";

export interface DashboardMetrics {
  totalVisits: number;
  pendingVisits: number;
  visitedVisits: number;
  todaysVisits: number;
  activePartners: number;
  totalPoints: number;
}

function hasSupabaseAdminEnv() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  if (!hasSupabaseAdminEnv()) {
    return {
      totalVisits: 0,
      pendingVisits: 0,
      visitedVisits: 0,
      todaysVisits: 0,
      activePartners: 0,
      totalPoints: 0,
    };
  }
  const supabase = getSupabaseAdmin();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [totalRes, pendingRes, visitedRes, todayRes, partnersRes, pointsRes] =
    await Promise.all([
      supabase
        .from("visit_registrations")
        .select("id", { head: true, count: "exact" }),
      supabase
        .from("visit_registrations")
        .select("id", { head: true, count: "exact" })
        .eq("status", "pending"),
      supabase
        .from("visit_registrations")
        .select("id", { head: true, count: "exact" })
        .eq("status", "visited"),
      supabase
        .from("visit_registrations")
        .select("id", { head: true, count: "exact" })
        .gte("created_at", startOfDay.toISOString()),
      supabase
        .from("partners")
        .select("id", { head: true, count: "exact" })
        .eq("status", "active"),
      supabase.from("points_history").select("points,type"),
    ]);

  for (const res of [totalRes, pendingRes, visitedRes, todayRes, partnersRes]) {
    if (res.error) {
      throw new Error(res.error.message);
    }
  }

  if (pointsRes.error) {
    throw new Error(pointsRes.error.message);
  }

  type PointsRow = { points: number | null; type: string | null };
  const pointsRows: PointsRow[] = pointsRes.data ?? [];
  const totalPoints = pointsRows.reduce((sum, entry) => {
    const points = entry.points ?? 0;
    switch (entry.type) {
      case "earned":
      case "adjustment":
        return sum + points;
      case "redemption":
        return sum - points;
      default:
        return sum;
    }
  }, 0);

  return {
    totalVisits: totalRes.count ?? 0,
    pendingVisits: pendingRes.count ?? 0,
    visitedVisits: visitedRes.count ?? 0,
    todaysVisits: todayRes.count ?? 0,
    activePartners: partnersRes.count ?? 0,
    totalPoints,
  };
}

export async function fetchRecentVisits(limit = 6) {
  if (!hasSupabaseAdminEnv()) return [] as VisitRegistrationRecord[];
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("visit_registrations")
    .select(
      "id,submission_id,email,partner_id,status,created_at,visited_at,points_awarded,estimated_points,total_price,checked_in_by_staff_id,legacy_qr_key,payload"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as (VisitRegistrationRecord & { legacy_qr_key?: string | null })[];
  return dedupeVisits(rows);
}

export interface VisitFilter {
  email?: string;
  partnerId?: string;
  status?: "pending" | "visited" | "cancelled";
  limit?: number;
}

export async function fetchVisits(filter: VisitFilter = {}, defaultLimit = 50) {
  const supabase = getSupabaseAdmin();
  let limit = filter.limit ?? defaultLimit;
  if (limit <= 0 || limit > 500) limit = defaultLimit;

  let query = supabase
    .from("visit_registrations")
    .select(
      "id,submission_id,email,partner_id,status,created_at,visited_at,points_awarded,estimated_points,total_price,num_people,ticket_type,checked_in_by_staff_id,legacy_qr_key,payload"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filter.email) {
    query = query.ilike("email", `${filter.email.toLowerCase()}%`);
  }

  if (filter.partnerId) {
    query = query.eq("partner_id", filter.partnerId.trim().toLowerCase());
  }

  if (filter.status) {
    query = query.eq("status", filter.status);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as (VisitRegistrationRecord & { legacy_qr_key?: string | null })[];

  const deduped = dedupeVisits(rows);
  return deduped;
}

function dedupeVisits(rows: (VisitRegistrationRecord & { legacy_qr_key?: string | null })[]) {
  const map = new Map<string, VisitRegistrationRecord & { legacy_qr_key?: string | null }>();

  const buildKey = (row: VisitRegistrationRecord & { legacy_qr_key?: string | null }) => {
    if (row.submission_id) {
      return `submission:${row.submission_id.trim().toLowerCase()}`;
    }
    if (row.legacy_qr_key) {
      return `legacy:${row.legacy_qr_key.trim().toLowerCase()}`;
    }
    const createdKey = (() => {
      if (!row.created_at) return 'unknown';
      const parsed = Date.parse(row.created_at);
      if (Number.isNaN(parsed)) return row.created_at;
      const minuteBucket = Math.floor(parsed / (60 * 1000));
      return `m:${minuteBucket}`;
    })();
    const price = Number(row.total_price) || 0;
    const numPeople = row.num_people || 0;
    const ticket = (row.ticket_type || '').toLowerCase();
    return `email:${(row.email || '').toLowerCase()}|${createdKey}|price:${price}|people:${numPeople}|ticket:${ticket}`;
  };

  for (const row of rows) {
    const key = buildKey(row);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, row);
      continue;
    }

    const existingVisited = existing.status === 'visited' || Boolean(existing.visited_at);
    const incomingVisited = row.status === 'visited' || Boolean(row.visited_at);

    if (incomingVisited && !existingVisited) {
      map.set(key, row);
      continue;
    }

    if (!incomingVisited && !existingVisited) {
      const existingCreated = existing.created_at || '';
      const incomingCreated = row.created_at || '';
      if (incomingCreated > existingCreated) {
        map.set(key, row);
      }
      continue;
    }

    if (incomingVisited && existingVisited) {
      const existingVisitedAt = existing.visited_at || existing.created_at || '';
      const incomingVisitedAt = row.visited_at || row.created_at || '';
      if (incomingVisitedAt > existingVisitedAt) {
        map.set(key, row);
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const aCreated = a.created_at || '';
    const bCreated = b.created_at || '';
    return aCreated < bCreated ? 1 : aCreated > bCreated ? -1 : 0;
  });
}

export interface PartnerOverview {
  id: string;
  display_name: string | null;
  status: string;
  type: PartnerType;
  created_at: string;
  memberCount: number;
  visitCount: number;
  pendingCount: number;
  listingTierKey: string | null;
  listingTierLabel: string | null;
  companyName: string;
  businessName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  website: string;
  monthlyFee: number | null;
  discountRate: number | null;
  commissionBasis: "original" | "discounted";
  commissionRate: number | null;
}

export async function fetchPartnersOverview(): Promise<PartnerOverview[]> {
  const supabase = getSupabaseAdmin();

  const [partnersRes, membersRes, visitsRes, tiersRes] = await Promise.all([
    supabase
      .from("partners")
      .select(
        "id,display_name,status,created_at,type,listing_tier_key,info,contract"
      )
      .order("created_at", { ascending: false }),
    supabase.from("partner_members").select("partner_id"),
    supabase.from("visit_registrations").select("partner_id,status"),
    supabase
      .from("global_values")
      .select("key,label")
      .eq("value_type", "listing_tier"),
  ]);

  if (partnersRes.error) throw new Error(partnersRes.error.message);
  if (membersRes.error) throw new Error(membersRes.error.message);
  if (visitsRes.error) throw new Error(visitsRes.error.message);
  if (tiersRes.error) throw new Error(tiersRes.error.message);

  type MemberRow = { partner_id: string | null };
  type VisitStatusRow = { partner_id: string | null; status: string | null };
  type PartnerRow = {
    id: string;
    display_name: string | null;
    status: string;
    created_at: string;
    type: string | null;
    listing_tier_key: string | null;
    info: Record<string, unknown> | null;
    contract: Record<string, unknown> | null;
  };
  type ListingTierRow = { key: string; label: string };

  const memberRows: MemberRow[] = membersRes.data ?? [];
  const visitStatusRows: VisitStatusRow[] = visitsRes.data ?? [];
  const partnerRows: PartnerRow[] = partnersRes.data ?? [];
  const listingTierRows: ListingTierRow[] = tiersRes.data ?? [];
  const listingTierLookup = new Map<string, string>();
  for (const tier of listingTierRows) {
    if (!tier?.key) continue;
    listingTierLookup.set(tier.key, tier.label ?? tier.key);
  }

  const memberCounts = new Map<string, number>();
  for (const row of memberRows) {
    const key = row.partner_id?.toLowerCase();
    if (!key) continue;
    memberCounts.set(key, (memberCounts.get(key) ?? 0) + 1);
  }

  const visitCounts = new Map<string, { total: number; pending: number }>();
  for (const row of visitStatusRows) {
    const key = row.partner_id?.toLowerCase();
    if (!key) continue;
    const bucket = visitCounts.get(key) ?? { total: 0, pending: 0 };
    bucket.total += 1;
    if ((row.status ?? "").toLowerCase() === "pending") {
      bucket.pending += 1;
    }
    visitCounts.set(key, bucket);
  }

  return partnerRows.map((partner) => {
    const key = partner.id?.toLowerCase() ?? "";
    const visits = visitCounts.get(key) ?? { total: 0, pending: 0 };
    const parsedType = partnerTypeSchema.safeParse(partner.type);
    const normalizedType: PartnerType = parsedType.success
      ? parsedType.data
      : "standard";
    const info = (partner.info ?? {}) as Record<string, unknown>;
    const contract = (partner.contract ?? {}) as Record<string, unknown>;
    const listingTierKey =
      typeof partner.listing_tier_key === "string"
        ? partner.listing_tier_key
        : null;
    const listingTierLabel = listingTierKey
      ? listingTierLookup.get(listingTierKey) ?? listingTierKey
      : null;
    const contactName =
      typeof info.contactName === "string" ? info.contactName : "";
    const contactEmail =
      typeof info.contactEmail === "string" ? info.contactEmail : "";
    const contactPhone =
      typeof info.contactPhone === "string" ? info.contactPhone : "";
    const companyName =
      typeof info.companyName === "string" ? info.companyName : "";
    const businessName =
      typeof info.businessName === "string" ? info.businessName : "";
    const website = typeof info.website === "string" ? info.website : "";
    const monthlyFee =
      typeof contract.monthlyFee === "number" ? contract.monthlyFee : null;
    const discountRate =
      typeof contract.discountRate === "number" ? contract.discountRate : null;
    const commissionBasis =
      contract.commissionBasis === "original" ? "original" : "discounted";
    const commissionRate =
      typeof contract.commissionRate === "number"
        ? contract.commissionRate
        : null;
    return {
      id: partner.id,
      display_name: partner.display_name ?? partner.id,
      status: partner.status,
      created_at: partner.created_at,
      type: normalizedType,
      memberCount: memberCounts.get(key) ?? 0,
      visitCount: visits.total,
      pendingCount: visits.pending,
      listingTierKey,
      listingTierLabel,
      companyName,
      businessName,
      contactName,
      contactEmail,
      contactPhone,
      website,
      monthlyFee,
      discountRate,
      commissionBasis,
      commissionRate,
    };
  });
}
