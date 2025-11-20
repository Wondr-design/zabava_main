import { z } from "zod";

import { getSupabaseAdminTyped } from "../supabase-admin";
import type { Database, Json } from "@/supabase/types";

type GlobalValuesRow = Database["public"]["Tables"]["global_values"]["Row"];

export const globalValueTypeSchema = z.enum([
  "ticket_type",
  "category",
  "tag",
  "listing_tier",
  "cash_currency",
  "accepted_payment",
  "facility",
]);

export type GlobalValueType = z.infer<typeof globalValueTypeSchema>;

const baseGlobalValueSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9][a-z0-9-_]*$/i, {
      message:
        "Key may only contain letters, numbers, hyphens, and underscores and must start with an alphanumeric character.",
    })
    .optional(),
  label: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).optional(),
  metadata: z
    .record(z.string(), z.unknown())
    .optional()
    .default({}),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const createGlobalValueSchema = baseGlobalValueSchema.extend({
  type: globalValueTypeSchema,
});

export const updateGlobalValueSchema = baseGlobalValueSchema.partial();

export type CreateGlobalValueInput = z.infer<typeof createGlobalValueSchema>;
export type UpdateGlobalValueInput = z.infer<typeof updateGlobalValueSchema>;

export interface GlobalValueRecord {
  id: string;
  type: GlobalValueType;
  key: string;
  label: string;
  description: string | null;
  metadata: Record<string, unknown>;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function mapRow(row: GlobalValuesRow): GlobalValueRecord {
  return {
    id: row.id,
    type: row.value_type,
    key: row.key,
    label: row.label,
    description: row.description ?? null,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface ListGlobalValuesParams {
  type?: GlobalValueType;
  includeInactive?: boolean;
}

export async function listGlobalValues(
  params: ListGlobalValuesParams = {},
) {
  const supabase = getSupabaseAdminTyped();
  let query = supabase
    .from("global_values")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (params.type) {
    query = query.eq(
      "value_type",
      params.type as Database["public"]["Tables"]["global_values"]["Row"]["value_type"],
    );
  }
  if (!params.includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to list globals: ${error.message}`);
  }
  return (data ?? []).map(mapRow);
}

export async function getGlobalValueById(id: string) {
  const supabase = getSupabaseAdminTyped();
  const { data, error } = await supabase
    .from("global_values")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load global value: ${error.message}`);
  }
  return data ? mapRow(data) : null;
}

export async function createGlobalValue(input: CreateGlobalValueInput) {
  const payload = createGlobalValueSchema.parse(input);
  const supabase = getSupabaseAdminTyped();

  const key =
    payload.key?.trim() && payload.key.trim().length > 0
      ? slugify(payload.key)
      : slugify(payload.label);

  if (!key) {
    throw new Error("Unable to derive key for global value.");
  }

  const insertPayload = {
    value_type:
      payload.type as Database["public"]["Tables"]["global_values"]["Row"]["value_type"],
    key,
    label: payload.label.trim(),
    description: payload.description?.trim() || null,
    metadata: (payload.metadata ?? {}) as Json,
    sort_order: payload.sortOrder ?? 0,
    is_active: payload.isActive ?? true,
  } satisfies Database["public"]["Tables"]["global_values"]["Insert"];

  const { data, error } = await supabase
    .from("global_values")
    .insert(insertPayload)
    .select()
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      throw new Error(
        `A ${payload.type.replace("_", " ")} with this key already exists.`,
      );
    }
    throw new Error(
      `Failed to create global value: ${error?.message ?? "unknown error"}`,
    );
  }

  return mapRow(data);
}

export async function updateGlobalValue(
  id: string,
  input: UpdateGlobalValueInput,
) {
  const parsed = updateGlobalValueSchema.parse(input);
  if (Object.keys(parsed).length === 0) {
    return getGlobalValueById(id);
  }

  const supabase = getSupabaseAdminTyped();
  const updates: Database["public"]["Tables"]["global_values"]["Update"] = {};
  if (parsed.key !== undefined) {
    const normalized = parsed.key.trim();
    updates.key = normalized ? slugify(normalized) : undefined;
  }
  if (parsed.label !== undefined) {
    updates.label = parsed.label.trim();
  }
  if (parsed.description !== undefined) {
    updates.description =
      parsed.description && parsed.description.trim().length > 0
        ? parsed.description.trim()
        : null;
  }
  if (parsed.metadata !== undefined) {
    updates.metadata = (parsed.metadata ?? {}) as Json;
  }
  if (parsed.sortOrder !== undefined) {
    updates.sort_order = parsed.sortOrder;
  }
  if (parsed.isActive !== undefined) {
    updates.is_active = parsed.isActive;
  }

  const { data, error } = await supabase
    .from("global_values")
    .update(updates)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      throw new Error("A record with this key already exists.");
    }
    throw new Error(`Failed to update global value: ${error.message}`);
  }
  return data ? mapRow(data) : null;
}

export async function deleteGlobalValue(id: string) {
  const supabase = getSupabaseAdminTyped();
  const { error } = await supabase
    .from("global_values")
    .delete({ returning: "minimal" } as never)
    .eq("id", id);
  if (error) {
    throw new Error(`Failed to delete global value: ${error.message}`);
  }
}

export async function ensureGlobalValuesExist(
  type: GlobalValueType,
  keys: string[],
) {
  const normalized = Array.from(
    new Set(
      keys
        .map((key) => key.trim())
        .filter((key) => key.length > 0),
    ),
  );
  if (normalized.length === 0) {
    return [];
  }
  const supabase = getSupabaseAdminTyped();
  const { data, error } = await supabase
    .from("global_values")
    .select("*")
    .eq(
      "value_type",
      type as Database["public"]["Tables"]["global_values"]["Row"]["value_type"],
    )
    .in("key", normalized);

  if (error) {
    throw new Error(`Failed to validate ${type} values: ${error.message}`);
  }

  const found = data ?? [];
  const missing = normalized.filter(
    (key) => !found.some((row) => row.key === key),
  );
  if (missing.length > 0) {
    throw new Error(
      `Unknown ${type.replace("_", " ")} value${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`,
    );
  }

  return found.map(mapRow);
}

export async function ensureGlobalValueExists(
  type: GlobalValueType,
  key: string,
) {
  const normalized = key.trim();
  if (!normalized) {
    throw new Error(`${type.replace("_", " ")} key is required`);
  }
  const supabase = getSupabaseAdminTyped();
  const { data, error } = await supabase
    .from("global_values")
    .select("*")
    .eq(
      "value_type",
      type as Database["public"]["Tables"]["global_values"]["Row"]["value_type"],
    )
    .eq("key", normalized)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load ${type.replace("_", " ")}: ${error.message}`);
  }
  if (data) {
    return mapRow(data);
  }
  const label = normalized
    .split(/[-_]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
    .trim() || normalized;
  return createGlobalValue({
    type,
    key: normalized,
    label,
    metadata: {},
  });
}

export interface GlobalValueGroups {
  ticketTypes: GlobalValueRecord[];
  categories: GlobalValueRecord[];
  tags: GlobalValueRecord[];
  listingTiers: GlobalValueRecord[];
  cashCurrencies: GlobalValueRecord[];
  acceptedPayments: GlobalValueRecord[];
  facilities: GlobalValueRecord[];
}

export async function listGlobalValueGroups(params: {
  includeInactive?: boolean;
} = {}) {
  const includeInactive = params.includeInactive ?? false;
  const [
    ticketTypes,
    categories,
    tags,
    listingTiers,
    cashCurrencies,
    acceptedPayments,
    facilities,
  ] = await Promise.all([
    listGlobalValues({ type: "ticket_type", includeInactive }),
    listGlobalValues({ type: "category", includeInactive }),
    listGlobalValues({ type: "tag", includeInactive }),
    listGlobalValues({ type: "listing_tier", includeInactive }),
    listGlobalValues({ type: "cash_currency", includeInactive }),
    listGlobalValues({ type: "accepted_payment", includeInactive }),
    listGlobalValues({ type: "facility", includeInactive }),
  ]);
  return {
    ticketTypes,
    categories,
    tags,
    listingTiers,
    cashCurrencies,
    acceptedPayments,
    facilities,
  } satisfies GlobalValueGroups;
}
