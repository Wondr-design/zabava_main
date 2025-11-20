import { z } from "zod";

import { getSupabaseAdmin } from "../supabase-admin";

const fieldChangeSchema = z.record(
  z.string(),
  z.object({
    from: z.unknown(),
    to: z.unknown(),
  }),
);

const visitChangeRowSchema = z.object({
  id: z.string().uuid(),
  visit_id: z.string().uuid(),
  actor_id: z.string().nullable(),
  actor_role: z.enum(["admin", "staff", "partner"]),
  field_changes: fieldChangeSchema,
  reason: z.string().nullable(),
  created_at: z.string().datetime(),
});

export type VisitChangeLog = z.infer<typeof visitChangeRowSchema>;
export type VisitChangeFields = z.infer<typeof fieldChangeSchema>;
export type VisitActorRole = "admin" | "staff" | "partner";

export interface LogVisitChangeInput {
  visitId: string;
  actorId?: string | null;
  actorRole: VisitActorRole;
  changes: VisitChangeFields;
  reason?: string | null;
}

export async function logVisitChange(input: LogVisitChangeInput): Promise<void> {
  const supabase = getSupabaseAdmin();
  const payload = {
    visit_id: input.visitId,
    actor_id: input.actorId ?? null,
    actor_role: input.actorRole,
    field_changes: input.changes,
    reason: input.reason ?? null,
  };
  const { error } = await supabase.from("visit_change_log").insert(payload);
  if (error) {
    throw new Error(`Failed to record visit change: ${error.message}`);
  }
}

export async function listVisitChanges(visitId: string, limit = 50): Promise<VisitChangeLog[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("visit_change_log")
    .select("*")
    .eq("visit_id", visitId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    throw new Error(`Failed to load visit change log: ${error.message}`);
  }
  return (data ?? []).map((row) => visitChangeRowSchema.parse(row));
}

export async function listVisitChangesForPartner(partnerId: string, limit = 100): Promise<VisitChangeLog[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("visit_change_log")
    .select("*, visit:visit_registrations(partner_id)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    throw new Error(`Failed to load visit change logs: ${error.message}`);
  }

  return (data ?? [])
    .filter((row) => (row.visit?.partner_id ?? "").toLowerCase() === partnerId.toLowerCase())
    .map((row) =>
      visitChangeRowSchema.parse({
        id: row.id,
        visit_id: row.visit_id,
        actor_id: row.actor_id,
        actor_role: row.actor_role,
        field_changes: row.field_changes,
        reason: row.reason,
        created_at: row.created_at,
      }),
    );
}
