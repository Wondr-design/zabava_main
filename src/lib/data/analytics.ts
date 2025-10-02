import { getSupabaseAdmin } from "../supabase-admin";
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
      "id,email,partner_id,status,created_at,visited_at,points_awarded,estimated_points,total_price,checked_in_by_staff_id"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as VisitRegistrationRecord[];
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
      "id,email,partner_id,status,created_at,visited_at,points_awarded,estimated_points,total_price,num_people,ticket_type,checked_in_by_staff_id"
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

  return (data ?? []) as VisitRegistrationRecord[];
}

export interface PartnerOverview {
  id: string;
  display_name: string | null;
  status: string;
  created_at: string;
  memberCount: number;
  visitCount: number;
  pendingCount: number;
}

export async function fetchPartnersOverview(): Promise<PartnerOverview[]> {
  const supabase = getSupabaseAdmin();

  const [partnersRes, membersRes, visitsRes] = await Promise.all([
    supabase
      .from("partners")
      .select("id,display_name,status,created_at")
      .order("created_at", { ascending: false }),
    supabase.from("partner_members").select("partner_id"),
    supabase.from("visit_registrations").select("partner_id,status"),
  ]);

  if (partnersRes.error) throw new Error(partnersRes.error.message);
  if (membersRes.error) throw new Error(membersRes.error.message);
  if (visitsRes.error) throw new Error(visitsRes.error.message);

  type MemberRow = { partner_id: string | null };
  type VisitStatusRow = { partner_id: string | null; status: string | null };
  type PartnerRow = {
    id: string;
    display_name: string | null;
    status: string;
    created_at: string;
  };

  const memberRows: MemberRow[] = membersRes.data ?? [];
  const visitStatusRows: VisitStatusRow[] = visitsRes.data ?? [];
  const partnerRows: PartnerRow[] = partnersRes.data ?? [];

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
    return {
      id: partner.id,
      display_name: partner.display_name ?? partner.id,
      status: partner.status,
      created_at: partner.created_at,
      memberCount: memberCounts.get(key) ?? 0,
      visitCount: visits.total,
      pendingCount: visits.pending,
    };
  });
}
