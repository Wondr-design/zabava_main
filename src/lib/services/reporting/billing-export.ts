import { Buffer } from "node:buffer";

import ExcelJS from "exceljs";
import { z } from "zod";

import { getSupabaseAdmin } from "../../supabase-admin";
import { normalizePartnerId } from "../../data/partners";

const exportRangeSchema = z.object({
  partnerId: z.string(),
  dateFrom: z.string().datetime(),
  dateTo: z.string().datetime(),
});

interface VisitRow {
  id: string;
  createdAt: string;
  visitedAt: string | null;
  qrType: string;
  totalPrice: number;
  originalTotalPrice: number;
  commissionRate: number;
  commissionAmount: number;
  notes: string | null;
}

interface FlashDealRow {
  redemptionId: string;
  flashDealId: string;
  title: string;
  status: string;
  createdAt: string;
  commissionPercent: number;
}

interface TransportRideRow {
  rideId: string;
  serviceId: string;
  serviceName: string;
  serviceType: string;
  createdAt: string;
  status: string;
  fareAmount: number | null;
  commissionPerRide: number;
}

type VisitRegistrationRow = {
  id: string;
  created_at: string;
  visited_at: string | null;
  qr_type: string | null;
  total_price: number | string | null;
  original_total_price?: number | string | null;
  visit_notes?: string | null;
};

type FlashDealRedemptionRowData = {
  id: string;
  flash_deal_id: string;
  status: string;
  created_at: string;
  flash_deal: {
    title: string | null;
    commission_percent: number | string | null;
    partner_id?: string | null;
  } | null;
};

type TransportRideRowData = {
  id: string;
  service_id: string;
  created_at: string;
  status: string;
  fare_amount: number | string | null;
  service: {
    name: string | null;
    service_type: string | null;
    commission_per_ride: number | string | null;
    partner_id?: string | null;
  } | null;
};

export interface PartnerBillingSummary {
  partnerId: string;
  periodStart: string;
  periodEnd: string;
  commissionRate: number;
  visitCount: number;
  visitCommissionTotal: number;
  flashDealCount: number;
  transportRideCount: number;
}

export interface PartnerBillingReport {
  csvBuffer: Buffer;
  xlsxBuffer: Buffer;
  summary: PartnerBillingSummary;
  visits: VisitRow[];
  flashDeals: FlashDealRow[];
  transportRides: TransportRideRow[];
}

function buildCsvLine(fields: (string | number | null | undefined)[]): string {
  return fields
    .map((value) => {
      if (value === null || value === undefined) return "";
      const str = typeof value === "number" ? value.toString() : value;
      if (/[",\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    })
    .join(",");
}

function buildCsvContent(
  visits: VisitRow[],
  flashDeals: FlashDealRow[],
  transportRides: TransportRideRow[],
): string {
  const parts: string[] = [];
  parts.push("Section,Record ID,Created At,Details...,Amount,Commission");

  for (const visit of visits) {
    parts.push(
      buildCsvLine([
        "Visit",
        visit.id,
        visit.createdAt,
        `Visited: ${visit.visitedAt ?? "-"} | QR: ${visit.qrType}`,
        visit.originalTotalPrice.toFixed(2),
        visit.commissionAmount.toFixed(2),
      ]),
    );
  }

  for (const flash of flashDeals) {
    parts.push(
      buildCsvLine([
        "Flash deal",
        flash.redemptionId,
        flash.createdAt,
        `Deal: ${flash.title} | Status: ${flash.status}`,
        "",
        flash.commissionPercent.toFixed(2),
      ]),
    );
  }

  for (const ride of transportRides) {
    parts.push(
      buildCsvLine([
        "Transport ride",
        ride.rideId,
        ride.createdAt,
        `Service: ${ride.serviceName} (${ride.serviceType}) | Status: ${ride.status}`,
        ride.fareAmount !== null ? ride.fareAmount.toFixed(2) : "",
        ride.commissionPerRide.toFixed(2),
      ]),
    );
  }

  return parts.join("\n");
}

function toVisitRow(row: VisitRegistrationRow, commissionRate: number): VisitRow {
  const originalTotal = Number(row.original_total_price ?? row.total_price ?? 0);
  const commissionAmount = Number(((originalTotal * commissionRate) / 100).toFixed(2));
  return {
    id: row.id,
    createdAt: row.created_at,
    visitedAt: row.visited_at,
    qrType: row.qr_type ?? "standard",
    totalPrice: Number(row.total_price ?? 0),
    originalTotalPrice: originalTotal,
    commissionRate,
    commissionAmount,
    notes: row.visit_notes ?? null,
  };
}

function toFlashRow(row: FlashDealRedemptionRowData): FlashDealRow {
  return {
    redemptionId: row.id,
    flashDealId: row.flash_deal_id,
    title: row.flash_deal?.title ?? "Flash deal",
    status: row.status,
    createdAt: row.created_at,
    commissionPercent: Number(row.flash_deal?.commission_percent ?? 0),
  };
}

function toTransportRow(row: TransportRideRowData): TransportRideRow {
  return {
    rideId: row.id,
    serviceId: row.service_id,
    serviceName: row.service?.name ?? "Service",
    serviceType: row.service?.service_type ?? "transport",
    createdAt: row.created_at,
    status: row.status,
    fareAmount: row.fare_amount !== null ? Number(row.fare_amount) : null,
    commissionPerRide: Number(row.service?.commission_per_ride ?? 0),
  };
}

export async function generatePartnerBillingReport(params: {
  partnerId: string;
  dateFrom: string;
  dateTo: string;
}): Promise<PartnerBillingReport> {
  const { partnerId, dateFrom, dateTo } = exportRangeSchema.parse(params);
  const supabase = getSupabaseAdmin();
  const normalizedPartnerId = normalizePartnerId(partnerId);

  // Partner commission rate
  const { data: partnerRow, error: partnerError } = await supabase
    .from("partners")
    .select("contract")
    .eq("id", normalizedPartnerId)
    .maybeSingle();
  if (partnerError) {
    throw new Error(`Failed to load partner contract: ${partnerError.message}`);
  }
  const commissionRate = Number(
    partnerRow?.contract?.commissionRate ?? partnerRow?.contract?.commission_rate ?? 0,
  );

  // Visits
  const { data: visitRows, error: visitError } = await supabase
    .from("visit_registrations")
    .select("*")
    .eq("partner_id", normalizedPartnerId)
    .gte("created_at", dateFrom)
    .lte("created_at", dateTo)
    .order("created_at", { ascending: true });
  if (visitError) {
    throw new Error(`Failed to load visits: ${visitError.message}`);
  }
  const visits = (visitRows ?? []).map((row) => toVisitRow(row as VisitRegistrationRow, commissionRate));

  // Flash deal redemptions
  const { data: flashRows, error: flashError } = await supabase
    .from("flash_deal_redemptions")
    .select("*, flash_deal:flash_deals(title, commission_percent, partner_id)")
    .gte("created_at", dateFrom)
    .lte("created_at", dateTo)
    .order("created_at", { ascending: true });
  if (flashError) {
    throw new Error(`Failed to load flash deal redemptions: ${flashError.message}`);
  }
  const flashDeals = (flashRows ?? [])
    .filter((row) => (row.flash_deal?.partner_id ?? "").toLowerCase() === normalizedPartnerId)
    .map((row) => toFlashRow(row as FlashDealRedemptionRowData));

  // Transport rides
  const { data: rideRows, error: rideError } = await supabase
    .from("transport_rides")
    .select("*, service:transport_services(name, service_type, commission_per_ride, partner_id)")
    .gte("created_at", dateFrom)
    .lte("created_at", dateTo)
    .order("created_at", { ascending: true });
  if (rideError) {
    throw new Error(`Failed to load transport rides: ${rideError.message}`);
  }
  const transportRides = (rideRows ?? [])
    .filter((row) => (row.service?.partner_id ?? "").toLowerCase() === normalizedPartnerId)
    .map((row) => toTransportRow(row as TransportRideRowData));

  const visitCommissionTotal = visits.reduce((sum, visit) => sum + visit.commissionAmount, 0);

  const summary: PartnerBillingSummary = {
    partnerId: normalizedPartnerId,
    periodStart: dateFrom,
    periodEnd: dateTo,
    commissionRate,
    visitCount: visits.length,
    visitCommissionTotal,
    flashDealCount: flashDeals.length,
    transportRideCount: transportRides.length,
  };

  const csvContent = buildCsvContent(visits, flashDeals, transportRides);
  const csvBuffer = Buffer.from(csvContent, "utf-8");

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Zabava";
  workbook.created = new Date();

  const visitsSheet = workbook.addWorksheet("Visits");
  visitsSheet.columns = [
    { header: "Visit ID", key: "id", width: 24 },
    { header: "Created", key: "createdAt", width: 24 },
    { header: "Visited", key: "visitedAt", width: 24 },
    { header: "QR type", key: "qrType", width: 12 },
    { header: "Original total (CZK)", key: "originalTotalPrice", width: 20 },
    { header: "Commission rate (%)", key: "commissionRate", width: 18 },
    { header: "Commission amount (CZK)", key: "commissionAmount", width: 22 },
    { header: "Notes", key: "notes", width: 40 },
  ];
  visits.forEach((visit) => {
    visitsSheet.addRow({
      id: visit.id,
      createdAt: visit.createdAt,
      visitedAt: visit.visitedAt,
      qrType: visit.qrType,
      originalTotalPrice: visit.originalTotalPrice,
      commissionRate: visit.commissionRate,
      commissionAmount: visit.commissionAmount,
      notes: visit.notes ?? "",
    });
  });

  const flashSheet = workbook.addWorksheet("Flash deals");
  flashSheet.columns = [
    { header: "Redemption ID", key: "redemptionId", width: 24 },
    { header: "Flash deal ID", key: "flashDealId", width: 24 },
    { header: "Title", key: "title", width: 32 },
    { header: "Status", key: "status", width: 14 },
    { header: "Created", key: "createdAt", width: 24 },
    { header: "Commission percent", key: "commissionPercent", width: 20 },
  ];
  flashDeals.forEach((flash) => {
    flashSheet.addRow({
      redemptionId: flash.redemptionId,
      flashDealId: flash.flashDealId,
      title: flash.title,
      status: flash.status,
      createdAt: flash.createdAt,
      commissionPercent: flash.commissionPercent,
    });
  });

  const transportSheet = workbook.addWorksheet("Transport rides");
  transportSheet.columns = [
    { header: "Ride ID", key: "rideId", width: 24 },
    { header: "Service ID", key: "serviceId", width: 24 },
    { header: "Service name", key: "serviceName", width: 28 },
    { header: "Service type", key: "serviceType", width: 12 },
    { header: "Created", key: "createdAt", width: 24 },
    { header: "Status", key: "status", width: 14 },
    { header: "Fare (CZK)", key: "fareAmount", width: 16 },
    { header: "Commission (CZK)", key: "commissionPerRide", width: 18 },
  ];
  transportRides.forEach((ride) => {
    transportSheet.addRow({
      rideId: ride.rideId,
      serviceId: ride.serviceId,
      serviceName: ride.serviceName,
      serviceType: ride.serviceType,
      createdAt: ride.createdAt,
      status: ride.status,
      fareAmount: ride.fareAmount ?? "",
      commissionPerRide: ride.commissionPerRide,
    });
  });

  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.addRows([
    ["Partner ID", summary.partnerId],
    ["Period start", summary.periodStart],
    ["Period end", summary.periodEnd],
    ["Commission rate (%)", summary.commissionRate],
    ["Visit count", summary.visitCount],
    ["Visit commission total (CZK)", summary.visitCommissionTotal],
    ["Flash deal redemptions", summary.flashDealCount],
    ["Transport rides", summary.transportRideCount],
  ]);

  const xlsxArrayBuffer = await workbook.xlsx.writeBuffer();
  const xlsxBuffer = Buffer.from(xlsxArrayBuffer);

  return {
    csvBuffer,
    xlsxBuffer,
    summary,
    visits,
    flashDeals,
    transportRides,
  };
}
