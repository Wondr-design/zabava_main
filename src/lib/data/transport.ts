import { z } from "zod";

import { getSupabaseAdmin } from "../supabase-admin";
import { normalizePartnerId } from "./partners";

export const transportServiceTypeSchema = z.enum(["taxi", "bus", "limo"]);

const transportServiceRowSchema = z.object({
  id: z.string().uuid(),
  partner_id: z.string(),
  name: z.string(),
  service_type: transportServiceTypeSchema,
  qr_validity_days: z.number(),
  commission_per_ride: z.number(),
  notes: z.string().nullable(),
  enabled: z.boolean(),
  created_by: z.string().nullable(),
  updated_by: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

const transportServiceInsertSchema = z.object({
  partnerId: z.string(),
  name: z.string().min(1),
  serviceType: transportServiceTypeSchema,
  qrValidityDays: z.number().int().positive().default(3),
  commissionPerRide: z.number().min(0),
  notes: z.string().optional(),
  enabled: z.boolean().optional(),
  createdBy: z.string().optional(),
});

const transportServiceUpdateSchema = transportServiceInsertSchema
  .omit({ partnerId: true, createdBy: true })
  .extend({
    updatedBy: z.string().optional(),
  })
  .partial();

const transportRideRowSchema = z.object({
  id: z.string().uuid(),
  service_id: z.string().uuid(),
  visit_id: z.string().uuid().nullable(),
  fare_amount: z.number().nullable(),
  status: z.enum(["pending", "completed", "cancelled"]),
  metadata: z.record(z.string(), z.unknown()),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

const transportRideInsertSchema = z.object({
  serviceId: z.string().uuid(),
  visitId: z.string().uuid().optional(),
  fareAmount: z.number().min(0).optional(),
  status: z.enum(["pending", "completed", "cancelled"]).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});

export type TransportServiceType = z.infer<typeof transportServiceTypeSchema>;
export type TransportService = z.infer<typeof transportServiceRowSchema>;
export type TransportServiceInput = z.infer<typeof transportServiceInsertSchema>;
export type TransportServiceUpdate = z.infer<typeof transportServiceUpdateSchema>;
export type TransportRide = z.infer<typeof transportRideRowSchema>;
export type TransportRideInput = z.infer<typeof transportRideInsertSchema>;

export interface TransportRideSummary {
  id: string;
  serviceId: string;
  partnerId: string;
  serviceName: string;
  serviceType: TransportServiceType;
  createdAt: string;
  status: "pending" | "completed" | "cancelled";
  fareAmount: number | null;
  commissionPerRide: number;
}

function mapService(row: z.infer<typeof transportServiceRowSchema>): TransportService {
  return transportServiceRowSchema.parse(row);
}

function mapRide(row: z.infer<typeof transportRideRowSchema>): TransportRide {
  return transportRideRowSchema.parse(row);
}

export async function listTransportServices(params: {
  partnerId?: string;
  includeDisabled?: boolean;
} = {}): Promise<TransportService[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase.from("transport_services").select("*").order("created_at", { ascending: false });

  if (params.partnerId) {
    query = query.eq("partner_id", normalizePartnerId(params.partnerId));
  }
  if (!params.includeDisabled) {
    query = query.eq("enabled", true);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to list transport services: ${error.message}`);
  }
  return (data ?? []).map(mapService);
}

export async function getTransportService(id: string): Promise<TransportService | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("transport_services").select("*").eq("id", id).maybeSingle();
  if (error) {
    throw new Error(`Failed to load transport service: ${error.message}`);
  }
  return data ? mapService(data) : null;
}

export async function createTransportService(input: TransportServiceInput): Promise<TransportService> {
  const payload = transportServiceInsertSchema.parse(input);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("transport_services")
    .insert({
      partner_id: normalizePartnerId(payload.partnerId),
      name: payload.name,
      service_type: payload.serviceType,
      qr_validity_days: payload.qrValidityDays,
      commission_per_ride: payload.commissionPerRide,
      notes: payload.notes ?? null,
      enabled: payload.enabled ?? true,
      created_by: payload.createdBy ?? null,
      updated_by: payload.createdBy ?? null,
    })
    .select()
    .single();
  if (error) {
    throw new Error(`Failed to create transport service: ${error.message}`);
  }
  return mapService(data);
}

export async function updateTransportService(id: string, input: TransportServiceUpdate): Promise<TransportService> {
  const payload = transportServiceUpdateSchema.parse(input);
  if (!Object.keys(payload).length) {
    const existing = await getTransportService(id);
    if (!existing) throw new Error("Transport service not found");
    return existing;
  }

  const supabase = getSupabaseAdmin();
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (payload.name !== undefined) update.name = payload.name;
  if (payload.serviceType !== undefined) update.service_type = payload.serviceType;
  if (payload.qrValidityDays !== undefined) update.qr_validity_days = payload.qrValidityDays;
  if (payload.commissionPerRide !== undefined) update.commission_per_ride = payload.commissionPerRide;
  if (payload.notes !== undefined) update.notes = payload.notes ?? null;
  if (payload.enabled !== undefined) update.enabled = payload.enabled;
  if (payload.updatedBy !== undefined) update.updated_by = payload.updatedBy ?? null;

  const { data, error } = await supabase.from("transport_services").update(update).eq("id", id).select().single();
  if (error) {
    throw new Error(`Failed to update transport service: ${error.message}`);
  }
  return mapService(data);
}

export async function setTransportServiceEnabled(id: string, enabled: boolean, updatedBy?: string): Promise<TransportService> {
  return updateTransportService(id, { enabled, updatedBy });
}

export async function recordTransportRide(input: TransportRideInput): Promise<TransportRide> {
  const payload = transportRideInsertSchema.parse(input);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("transport_rides")
    .insert({
      service_id: payload.serviceId,
      visit_id: payload.visitId ?? null,
      fare_amount: payload.fareAmount ?? null,
      status: payload.status ?? "pending",
      metadata: payload.metadata ?? {},
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to record transport ride: ${error.message}`);
  }
  return mapRide(data);
}

export async function listTransportRides(params: {
  serviceId?: string;
  partnerId?: string;
  status?: "pending" | "completed" | "cancelled";
  from?: string;
  to?: string;
  limit?: number;
} = {}): Promise<TransportRide[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase.from("transport_rides").select("*, service:transport_services(partner_id)").order("created_at", {
    ascending: false,
  });

  if (params.serviceId) {
    query = query.eq("service_id", params.serviceId);
  }
  if (params.partnerId) {
    query = query.eq("service.partner_id", normalizePartnerId(params.partnerId));
  }
  if (params.status) {
    query = query.eq("status", params.status);
  }
  if (params.from) {
    query = query.gte("created_at", params.from);
  }
  if (params.to) {
    query = query.lte("created_at", params.to);
  }
  if (params.limit) {
    query = query.limit(params.limit);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to list transport rides: ${error.message}`);
  }

  return (data ?? []).map((row) =>
    mapRide({
      id: row.id,
      service_id: row.service_id,
      visit_id: row.visit_id,
      fare_amount: row.fare_amount,
      status: row.status,
      metadata: row.metadata ?? {},
      created_at: row.created_at,
      updated_at: row.updated_at,
    }),
  );
}

export async function listTransportRideSummaries(params: {
  serviceId?: string;
  partnerId?: string;
  status?: "pending" | "completed" | "cancelled";
  from?: string;
  to?: string;
  limit?: number;
} = {}): Promise<TransportRideSummary[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("transport_rides")
    .select(
      "id, service_id, fare_amount, status, created_at, service:transport_services(id, partner_id, name, service_type, commission_per_ride)",
    )
    .order("created_at", { ascending: false });

  if (params.serviceId) {
    query = query.eq("service_id", params.serviceId);
  }
  if (params.partnerId) {
    query = query.eq("service.partner_id", normalizePartnerId(params.partnerId));
  }
  if (params.status) {
    query = query.eq("status", params.status);
  }
  if (params.from) {
    query = query.gte("created_at", params.from);
  }
  if (params.to) {
    query = query.lte("created_at", params.to);
  }
  if (params.limit) {
    query = query.limit(params.limit);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to list transport ride summaries: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const serviceRaw = (row as { service?: unknown }).service;
    const service =
      serviceRaw && typeof serviceRaw === "object"
        ? (serviceRaw as {
            id?: string;
            name?: string | null;
            service_type?: string | null;
            commission_per_ride?: number | string | null;
            partner_id?: string | null;
          })
        : null;
    const serviceTypeResult = transportServiceTypeSchema.safeParse(service?.service_type);
    return {
      id: row.id,
      serviceId: row.service_id,
      partnerId: service?.partner_id ?? "unknown",
      serviceName: service?.name ?? "Service",
      serviceType: serviceTypeResult.success ? serviceTypeResult.data : "taxi",
      createdAt: row.created_at,
      status: row.status,
      fareAmount: row.fare_amount,
      commissionPerRide: Number(service?.commission_per_ride ?? 0),
    };
  });
}
