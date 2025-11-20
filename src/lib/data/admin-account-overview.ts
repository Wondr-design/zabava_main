import { buildLocalizedPath } from "@/i18n/routing";
import { defaultLocale, resolveLocale } from "@/i18n/config";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { listAdminInvites } from "@/lib/data/admin-invites";
import { listAdminUsers } from "@/lib/data/partner-users";
import {
  listPartnerMetas,
  normalizePartnerId,
} from "@/lib/data/partners";
import type { PartnerMeta } from "@/lib/data/partners";

type PartnerUserRow = {
  email: string;
  partner_id: string | null;
  name: string | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  verified_at: string | null;
  last_invited_at: string | null;
  invited_by: string | null;
  role: string | null;
};

type PartnerInviteRow = {
  token: string;
  email: string | null;
  partner_id: string | null;
  role: string | null;
  name: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  expires_at: string | null;
  used: boolean | null;
  used_at: string | null;
};

type PartnerStaffRow = {
  id: string;
  partner_id: string;
  email: string;
  name: string | null;
  status: "active" | "inactive" | "revoked";
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
};

type PartnerStaffInviteRow = {
  token: string;
  partner_id: string;
  email: string | null;
  name: string | null;
  status: "pending" | "used" | "revoked" | "expired";
  expires_at: string | null;
  created_at: string;
  created_by_email: string | null;
};

export interface AdminUserSummary {
  email: string;
  name: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  invitedBy: string | null;
  lastInvitedAt: string | null;
}

export interface AdminInviteSummary {
  id: string;
  email: string;
  inviterEmail: string | null;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  status: "pending" | "expired" | "accepted";
  inviteUrl: string | null;
}

export interface PartnerUserSummary {
  email: string;
  name: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  invitedBy: string | null;
  lastInvitedAt: string | null;
}

export interface PartnerInviteSummary {
  token: string;
  email: string | null;
  name: string | null;
  createdAt: string;
  expiresAt: string | null;
  status: "pending" | "expired" | "used";
  inviteUrl: string | null;
  locale: string;
}

export interface PartnerStaffSummary {
  id: string;
  email: string;
  name: string | null;
  status: "active" | "inactive" | "revoked";
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface PartnerStaffInviteSummary {
  token: string;
  email: string | null;
  name: string | null;
  status: "pending" | "used" | "revoked" | "expired";
  createdAt: string;
  expiresAt: string | null;
  createdBy: string | null;
}

export interface PartnerAccountSummary {
  partnerId: string;
  name: string | null;
  status: "active" | "pending" | "hidden";
  users: PartnerUserSummary[];
  invites: PartnerInviteSummary[];
  staff: PartnerStaffSummary[];
  staffInvites: PartnerStaffInviteSummary[];
}

export interface AdminAccountOverviewTotals {
  admins: number;
  adminInvites: number;
  partners: number;
  partnerUsers: number;
  staff: number;
  openInvites: number;
}

export interface AdminAccountOverview {
  admins: AdminUserSummary[];
  adminInvites: AdminInviteSummary[];
  partners: PartnerAccountSummary[];
  totals: AdminAccountOverviewTotals;
}

function resolvePartnerName(
  partnerId: string,
  metaMap: Map<string, PartnerMeta>,
): { name: string | null; status: "active" | "pending" | "hidden" } {
  const meta = metaMap.get(partnerId);
  if (meta) {
    return { name: meta.displayName ?? null, status: meta.status };
  }
  return { name: null, status: "active" };
}

function computeAdminInviteStatus(
  invite: AdminInviteSummary,
): "pending" | "expired" | "accepted" {
  if (invite.acceptedAt) return "accepted";
  const expiresAt = Date.parse(invite.expiresAt);
  if (!Number.isNaN(expiresAt) && expiresAt < Date.now()) {
    return "expired";
  }
  return "pending";
}

function computePartnerInviteStatus(
  used: boolean | null | undefined,
  expiresAt: string | null,
): "pending" | "expired" | "used" {
  if (used) return "used";
  if (expiresAt && Date.parse(expiresAt) < Date.now()) {
    return "expired";
  }
  return "pending";
}

function computeStaffInviteStatus(
  status: PartnerStaffInviteSummary["status"],
  expiresAt: string | null,
): PartnerStaffInviteSummary["status"] {
  if (status === "pending" && expiresAt && Date.parse(expiresAt) < Date.now()) {
    return "expired";
  }
  return status;
}

function buildPartnerInviteUrl(
  token: string,
  email: string | null,
  metadata: Record<string, unknown> | null,
) {
  const base =
    process.env.DASHBOARD_BASE_URL ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    "";
  if (!base) return null;
  const origin = base.replace(/\/$/, "");
  const localeValue =
    typeof metadata?.locale === "string" ? metadata.locale : undefined;
  const locale = resolveLocale(localeValue, defaultLocale);
  const path = buildLocalizedPath("/partner/signup", locale);
  const url = new URL(
    path,
    origin.startsWith("http") ? origin : `https://${origin}`,
  );
  url.searchParams.set("token", token);
  if (email) {
    url.searchParams.set("email", email);
  }
  return url.toString();
}

export async function loadAdminAccountOverview(): Promise<AdminAccountOverview> {
  const supabase = getSupabaseAdmin();

  const [
    adminUsers,
    adminInvitesRaw,
    partnerMetas,
    partnerUsersResult,
    partnerInvitesResult,
    partnerStaffResult,
    partnerStaffInvitesResult,
  ] = await Promise.all([
    listAdminUsers(),
    listAdminInvites(),
    listPartnerMetas(),
    supabase
      .from("partner_users")
      .select("*")
      .eq("role", "partner")
      .order("created_at", { ascending: false }),
    supabase
      .from("partner_invites")
      .select("*")
      .eq("role", "partner")
      .order("created_at", { ascending: false }),
    supabase
      .from("partner_staff")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("partner_staff_invites")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  if (partnerUsersResult.error) {
    throw new Error(
      `Failed to list partner users: ${partnerUsersResult.error.message}`,
    );
  }
  if (partnerInvitesResult.error) {
    throw new Error(
      `Failed to list partner invites: ${partnerInvitesResult.error.message}`,
    );
  }
  if (partnerStaffResult.error) {
    throw new Error(
      `Failed to list partner staff: ${partnerStaffResult.error.message}`,
    );
  }
  if (partnerStaffInvitesResult.error) {
    throw new Error(
      `Failed to list partner staff invites: ${partnerStaffInvitesResult.error.message}`,
    );
  }

  const adminSummaries: AdminUserSummary[] = adminUsers.map((user) => ({
    email: user.email,
    name: user.name ?? null,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    invitedBy: user.invitedBy,
    lastInvitedAt: user.lastInvitedAt,
  }));

  const adminInvites: AdminInviteSummary[] = adminInvitesRaw.map((invite) => {
    const summary: AdminInviteSummary = {
      id: invite.id,
      email: invite.email,
      inviterEmail: invite.inviter_email,
      createdAt: invite.created_at,
      expiresAt: invite.expires_at,
      acceptedAt: invite.accepted_at,
      status: "pending",
      inviteUrl: null,
    };
    summary.status = computeAdminInviteStatus(summary);
    return summary;
  });

  const metaMap = new Map<string, PartnerMeta>();
  for (const meta of partnerMetas) {
    metaMap.set(normalizePartnerId(meta.partnerId), meta);
  }

  const partnerMap = new Map<string, PartnerAccountSummary>();

  function ensurePartner(partnerIdRaw: string | null) {
    const partnerId = normalizePartnerId(partnerIdRaw ?? "");
    if (!partnerId) {
      return null;
    }
    if (!partnerMap.has(partnerId)) {
      const { name, status } = resolvePartnerName(partnerId, metaMap);
      partnerMap.set(partnerId, {
        partnerId,
        name,
        status,
        users: [],
        invites: [],
        staff: [],
        staffInvites: [],
      });
    }
    return partnerMap.get(partnerId)!;
  }

  for (const meta of partnerMetas) {
    ensurePartner(meta.partnerId);
  }

  const partnerUsersRows = (partnerUsersResult.data ??
    []) as PartnerUserRow[];
  for (const row of partnerUsersRows) {
    const entry = ensurePartner(row.partner_id);
    if (!entry) continue;
    entry.users.push({
      email: row.email.toLowerCase(),
      name: row.name,
      createdAt: row.created_at,
      lastLoginAt: row.last_login_at,
      invitedBy: row.invited_by,
      lastInvitedAt: row.last_invited_at,
    });
  }

  const partnerInvitesRows = (partnerInvitesResult.data ??
    []) as PartnerInviteRow[];
  for (const row of partnerInvitesRows) {
    const entry = ensurePartner(row.partner_id);
    if (!entry) continue;
    const metadata =
      (row.metadata as Record<string, unknown> | null | undefined) ?? null;
    const summary: PartnerInviteSummary = {
      token: row.token,
      email: row.email ? row.email.toLowerCase() : null,
      name: row.name ?? null,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      status: computePartnerInviteStatus(row.used ?? false, row.expires_at),
      inviteUrl: buildPartnerInviteUrl(row.token, row.email, metadata),
      locale:
        typeof metadata?.locale === "string"
          ? resolveLocale(metadata.locale, defaultLocale)
          : defaultLocale,
    };
    entry.invites.push(summary);
  }

  const partnerStaffRows = (partnerStaffResult.data ??
    []) as PartnerStaffRow[];
  for (const row of partnerStaffRows) {
    const entry = ensurePartner(row.partner_id);
    if (!entry) continue;
    entry.staff.push({
      id: row.id,
      email: row.email.toLowerCase(),
      name: row.name,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLoginAt: row.last_login_at,
    });
  }

  const partnerStaffInviteRows = (partnerStaffInvitesResult.data ??
    []) as PartnerStaffInviteRow[];
  for (const row of partnerStaffInviteRows) {
    const entry = ensurePartner(row.partner_id);
    if (!entry) continue;
    const computedStatus = computeStaffInviteStatus(row.status, row.expires_at);
    entry.staffInvites.push({
      token: row.token,
      email: row.email ? row.email.toLowerCase() : null,
      name: row.name ?? null,
      status: computedStatus,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      createdBy: row.created_by_email,
    });
  }

  const partners = Array.from(partnerMap.values()).sort((a, b) => {
    const nameA = a.name ?? a.partnerId;
    const nameB = b.name ?? b.partnerId;
    return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
  });

  const totals: AdminAccountOverviewTotals = {
    admins: adminSummaries.length,
    adminInvites: adminInvites.length,
    partners: partners.length,
    partnerUsers: partners.reduce((sum, partner) => sum + partner.users.length, 0),
    staff: partners.reduce((sum, partner) => sum + partner.staff.length, 0),
    openInvites:
      adminInvites.filter((invite) => invite.status === "pending").length +
      partners.reduce(
        (sum, partner) =>
          sum +
          partner.invites.filter((invite) => invite.status === "pending").length +
          partner.staffInvites.filter(
            (invite) => invite.status === "pending",
          ).length,
        0,
      ),
  };

  return {
    admins: adminSummaries,
    adminInvites,
    partners,
    totals,
  };
}
