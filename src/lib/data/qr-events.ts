import { z } from "zod";

import { getSupabaseAdmin } from "../supabase-admin";

const qrEventTypeSchema = z.enum(["generated", "scanned", "expired", "redeemed", "rejected"]);
const qrTypeSchema = z.enum(["standard", "bonus", "flash", "transport"]);

const qrEventRowSchema = z.object({
  id: z.string().uuid(),
  visit_id: z.string().uuid().nullable(),
  reward_id: z.string().nullable(),
  flash_deal_id: z.string().uuid().nullable(),
  transport_service_id: z.string().uuid().nullable(),
  event_type: qrEventTypeSchema,
  qr_type: qrTypeSchema,
  source: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  occurred_at: z.string().datetime({ offset: true }),
});

export type QrEventType = z.infer<typeof qrEventTypeSchema>;
export type QrType = z.infer<typeof qrTypeSchema>;
export type QrEvent = z.infer<typeof qrEventRowSchema>;

export interface RecordQrEventInput {
  visitId?: string | null;
  rewardId?: string | null;
  flashDealId?: string | null;
  transportServiceId?: string | null;
  eventType: QrEventType;
  qrType: QrType;
  source?: string;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
}

export async function recordQrEvent(input: RecordQrEventInput): Promise<void> {
  const supabase = getSupabaseAdmin();
  const payload = qrEventRowSchema
    .omit({ id: true })
    .partial()
    .extend({
      event_type: qrEventTypeSchema,
      qr_type: qrTypeSchema,
      source: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
      occurred_at: z.string().datetime({ offset: true }).optional(),
    })
    .parse({
      visit_id: input.visitId ?? null,
      reward_id: input.rewardId ?? null,
      flash_deal_id: input.flashDealId ?? null,
      transport_service_id: input.transportServiceId ?? null,
      event_type: input.eventType,
      qr_type: input.qrType,
      source: input.source ?? "system",
      metadata: input.metadata ?? {},
      occurred_at: input.occurredAt ?? new Date().toISOString(),
    });

  const { error } = await supabase.from("qr_events").insert(payload);
  if (error) {
    throw new Error(`Failed to record QR event: ${error.message}`);
  }
}

export async function listQrEvents(params: {
  limit?: number;
  eventType?: QrEventType;
  qrType?: QrType;
  from?: string;
  to?: string;
  flashDealId?: string;
  transportServiceId?: string;
  rewardId?: string;
  visitId?: string;
} = {}): Promise<QrEvent[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase.from("qr_events").select("*").order("occurred_at", { ascending: false });

  if (params.limit) query = query.limit(params.limit);
  if (params.eventType) query = query.eq("event_type", params.eventType);
  if (params.qrType) query = query.eq("qr_type", params.qrType);
  if (params.from) query = query.gte("occurred_at", params.from);
  if (params.to) query = query.lte("occurred_at", params.to);
  if (params.flashDealId) query = query.eq("flash_deal_id", params.flashDealId);
  if (params.transportServiceId) query = query.eq("transport_service_id", params.transportServiceId);
  if (params.rewardId) query = query.eq("reward_id", params.rewardId);
  if (params.visitId) query = query.eq("visit_id", params.visitId);

  const { data, error } = await query;
  if (error) {
    if ((error as { code?: string }).code === "42P01") {
      // qr_events table not deployed in this environment yet; treat as no events.
      return [];
    }
    throw new Error(`Failed to list QR events: ${error.message}`);
  }
  return (data ?? []).map((row) => qrEventRowSchema.parse(row));
}

export interface QrEventStats {
  total: number;
  byType: Record<QrEventType, number>;
  byQrType: Record<QrType, number>;
}

export async function getQrEventStats(params: { from?: string; to?: string } = {}): Promise<QrEventStats> {
  const supabase = getSupabaseAdmin();
  const stats: QrEventStats = {
    total: 0,
    byType: {
      generated: 0,
      scanned: 0,
      expired: 0,
      redeemed: 0,
      rejected: 0,
    },
    byQrType: {
      standard: 0,
      bonus: 0,
      flash: 0,
      transport: 0,
    },
  };

  const makeBaseQuery = () => {
    let query = supabase.from("qr_events").select("id", { head: true, count: "exact" });
    if (params.from) {
      query = query.gte("occurred_at", params.from);
    }
    if (params.to) {
      query = query.lte("occurred_at", params.to);
    }
    return query;
  };

  {
    const { count, error } = await makeBaseQuery();
    if (error) {
      throw new Error(`Failed to load QR event totals: ${error.message}`);
    }
    stats.total = count ?? 0;
  }

  for (const eventType of qrEventTypeSchema.options) {
    const { count, error } = await makeBaseQuery().eq("event_type", eventType);
    if (error) {
      throw new Error(`Failed to load QR event counts: ${error.message}`);
    }
    stats.byType[eventType] = count ?? 0;
  }

  for (const qrType of qrTypeSchema.options) {
    const { count, error } = await makeBaseQuery().eq("qr_type", qrType);
    if (error) {
      throw new Error(`Failed to load QR type counts: ${error.message}`);
    }
    stats.byQrType[qrType] = count ?? 0;
  }

  return stats;
}
