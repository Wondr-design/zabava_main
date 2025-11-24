import { getSupabaseAdmin } from "../supabase-admin";
import type { Database } from "@/supabase/types";

export type TimezoneSource = "admin" | "partner";

export interface TimezoneSettingRecord {
  id: number;
  adminTimeZone: string;
  source: TimezoneSource;
  createdBy: string | null;
  createdAt: string;
}

const DEFAULT_ADMIN_TIME_ZONE =
  process.env.ADMIN_TIME_ZONE || process.env.DEFAULT_TIME_ZONE || "Europe/Prague";

function mapRow(
  row: Database["public"]["Tables"]["timezone_settings"]["Row"],
): TimezoneSettingRecord {
  return {
    id: row.id,
    adminTimeZone: row.admin_time_zone,
    source: row.source,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export async function listTimezoneSettings(limit = 10) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("timezone_settings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load timezone settings: ${error.message}`);
  }

  return (data ?? []).map(mapRow);
}

export async function getActiveTimezoneSetting() {
  const settings = await listTimezoneSettings(1);
  if (settings.length === 0) {
    return {
      adminTimeZone: DEFAULT_ADMIN_TIME_ZONE,
      source: "admin" as const,
    };
  }
  const [latest] = settings;
  return {
    adminTimeZone: latest.adminTimeZone,
    source: latest.source,
    setting: latest,
  };
}

export async function setTimezoneSetting(options: {
  adminTimeZone: string;
  source: TimezoneSource;
  createdBy?: string | null;
}) {
  const supabase = getSupabaseAdmin();
  const payload = {
    admin_time_zone: options.adminTimeZone,
    source: options.source,
    created_by: options.createdBy ?? null,
  } satisfies Database["public"]["Tables"]["timezone_settings"]["Insert"];

  const { data, error } = await supabase
    .from("timezone_settings")
    .insert(payload)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to save timezone setting: ${error?.message ?? "unknown error"}`,
    );
  }

  return mapRow(data);
}
