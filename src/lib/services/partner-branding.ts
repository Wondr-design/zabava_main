import { getSupabaseAdmin } from "@/lib/supabase-admin";

const ACCENT_COLORS = [
  "#6366F1",
  "#8B5CF6",
  "#EC4899",
  "#F97316",
  "#14B8A6",
  "#22D3EE",
  "#F59E0B",
  "#10B981",
  "#3B82F6",
  "#EF4444",
];

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function derivePartnerInitial(
  source?: string,
  fallback?: string
): string | undefined {
  const raw = (source ?? fallback ?? "").trim();
  if (!raw) return undefined;
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length === 0) return undefined;
  const primary = words[0][0] ?? "";
  return primary ? primary.toUpperCase() : undefined;
}

export function derivePartnerAccent(partnerId: string) {
  if (!partnerId) return ACCENT_COLORS[0];
  const hash = hashString(partnerId.toLowerCase());
  return ACCENT_COLORS[hash % ACCENT_COLORS.length];
}

type SupabaseClient = ReturnType<typeof getSupabaseAdmin>;

export async function loadPartnerBranding(
  partnerId: string,
  supabaseClient?: SupabaseClient
) {
  const supabase = supabaseClient ?? getSupabaseAdmin();
  const { data } = await supabase
    .from("partners")
    .select("display_name, media, info")
    .eq("id", partnerId)
    .maybeSingle();
  const displayName =
    typeof data?.display_name === "string" && data.display_name.trim().length > 0
      ? data.display_name.trim()
      : partnerId;
  const media = (data?.media as Record<string, unknown> | null) ?? {};
  const info = (data?.info as Record<string, unknown> | null) ?? {};
  const configuredColor =
    readColor(media.qrAccentColor) ??
    readColor(info.qrAccentColor) ??
    readColor(media.qrBadgeColor) ??
    readColor(media.badgeColor) ??
    readColor(info.qrBadgeColor) ??
    readColor(info.badgeColor);
  const accentColor = configuredColor ?? derivePartnerAccent(partnerId);
  const logoUrl =
    readUrl(media.qrBadgeIconUrl) ??
    readUrl(info.qrBadgeIconUrl) ??
    readUrl(media.qrBadgeLogoUrl) ??
    readUrl(info.qrBadgeLogoUrl) ??
    readUrl(media.logoUrl) ??
    readUrl(info.logoUrl);
  return {
    displayName,
    initial: derivePartnerInitial(displayName, partnerId),
    accentColor,
    logoUrl: logoUrl ?? undefined,
  };
}

function readColor(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readUrl(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    // eslint-disable-next-line no-new
    new URL(trimmed);
    return trimmed;
  } catch {
    return trimmed;
  }
}
