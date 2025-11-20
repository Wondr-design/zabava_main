import { getSupabaseAdmin } from "../supabase-admin";

export interface PointRatioSetting {
  id: number;
  ratioCzk: number;
  createdBy: string | null;
  createdAt: string;
}

const DEFAULT_RATIO_CZK = (() => {
  const env = process.env.POINT_RATIO_CZK || process.env.POINT_RATIO || "100";
  const parsed = Number(env);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
})();

export function getDefaultPointRatio() {
  return DEFAULT_RATIO_CZK;
}

function mapRow(row: Record<string, unknown>): PointRatioSetting {
  return {
    id: Number(row.id ?? 0),
    ratioCzk: Number(row.ratio_czk ?? DEFAULT_RATIO_CZK),
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
  };
}

export async function getPointRatioSettings(limit = 10) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("point_settings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load point settings: ${error.message}`);
  }

  return (data ?? []).map(mapRow);
}

export async function getActivePointRatio() {
  const settings = await getPointRatioSettings(1);
  if (settings.length === 0) {
    return {
      ratioCzk: DEFAULT_RATIO_CZK,
      source: "default" as const,
    };
  }
  return {
    ratioCzk: settings[0].ratioCzk,
    source: "database" as const,
    setting: settings[0],
  };
}

export async function setPointRatio(options: {
  ratioCzk: number;
  createdBy?: string | null;
}) {
  const ratio = Number(options.ratioCzk);
  if (!Number.isFinite(ratio) || ratio <= 0) {
    throw new Error("ratioCzk must be a positive number");
  }
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("point_settings")
    .insert({
      ratio_czk: ratio,
      created_by: options.createdBy ?? null,
    } as unknown as never)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to update point ratio: ${error?.message ?? "unknown error"}`
    );
  }

  return mapRow(data as Record<string, unknown>);
}
