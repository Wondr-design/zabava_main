import { Buffer } from "node:buffer";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import jwt from "jsonwebtoken";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getAuthFromRequest } from "@/lib/auth/request";
import { verifyCsrf } from "@/lib/http/csrf";
import { withCors, preflightResponse } from "@/lib/http/cors";
import { log, getCorrelationId } from "@/lib/logging";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const JWT_SECRET = process.env.JWT_SECRET || "";

const requestSchema = z
  .object({
    partnerId: z.string().optional(),
    serviceId: z.string().uuid().optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
  });

const CORS_CONFIG = {
  methods: "POST,OPTIONS",
  headers: "Content-Type, Authorization, x-admin-secret",
} as const;

export const runtime = "nodejs";

export function OPTIONS() {
  return preflightResponse(CORS_CONFIG);
}

function bufferToBase64(buffer: Buffer) {
  return buffer.toString("base64");
}

function isAuthorized(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (auth?.role === "admin") return true;

  const adminSecret = req.headers.get("x-admin-secret");
  if (ADMIN_SECRET && adminSecret === ADMIN_SECRET) return true;

  if (!JWT_SECRET) return false;

  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7).trim();
  if (!token) return false;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (typeof payload === "object" && payload && "role" in payload) {
      return (payload as { role?: string }).role === "admin";
    }
    return false;
  } catch (error) {
    log.warn("admin_transport_export_auth_failed", {
      error: error instanceof Error ? error.message : String(error),
      correlationId: getCorrelationId(req),
    });
    return false;
  }
}

function defaultRange() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 30);
  return {
    from: start.toISOString(),
    to: now.toISOString(),
  };
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return withCors(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      CORS_CONFIG
    );
  }
  if (!verifyCsrf(req)) {
    return withCors(
      NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 }),
      CORS_CONFIG
    );
  }

  const correlationId = getCorrelationId(req);

  try {
    const body = await req.json();
    const parsed = requestSchema.parse(body ?? {});

    const supabase = getSupabaseAdmin();
    const defaults = defaultRange();
    const dateFrom = parsed.dateFrom ?? defaults.from;
    const dateTo = parsed.dateTo ?? defaults.to;

    let query = supabase
      .from("transport_rides")
      .select(
        "*, service:transport_services(id, name, service_type, commission_per_ride, partner_id)"
      )
      .gte("created_at", dateFrom)
      .lte("created_at", dateTo)
      .order("created_at", { ascending: true });

    if (parsed.serviceId) {
      query = query.eq("service_id", parsed.serviceId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    type TransportRideSupabaseRow = {
      id: string;
      service_id: string;
      fare_amount: number | string | null;
      status: string;
      created_at: string;
      service?: {
        id: string;
        name: string | null;
        service_type: string | null;
        commission_per_ride: number | string | null;
        partner_id: string | null;
      } | null;
    };
    const typedData: TransportRideSupabaseRow[] = Array.isArray(data)
      ? (data as unknown as TransportRideSupabaseRow[])
      : [];

    const filtered =
      parsed.partnerId && typedData.length
        ? typedData.filter((row) => {
            const partnerId = row.service?.partner_id;
            return (
              typeof partnerId === "string" &&
              partnerId.toLowerCase() === parsed.partnerId!.toLowerCase()
            );
          })
        : typedData;

    const rows = filtered.map((row) => {
      const fare = row.fare_amount !== null ? Number(row.fare_amount) : null;
      const commission = Number(row.service?.commission_per_ride ?? 0);
      return {
        id: row.id,
        serviceId: row.service_id,
        serviceName: row.service?.name ?? "Service",
        serviceType: row.service?.service_type ?? "transport",
        createdAt: row.created_at,
        status: row.status,
        fareAmount: fare,
        commissionPerRide: commission,
      };
    });

    const totalFare = rows.reduce((sum, row) => sum + (row.fareAmount ?? 0), 0);
    const totalCommission = rows.reduce(
      (sum, row) => sum + row.commissionPerRide,
      0
    );

    const csvHeader =
      "Service,Type,Created At,Status,Fare (CZK),Commission (CZK)";
    const csvLines = rows.map((row) =>
      [
        row.serviceName,
        row.serviceType,
        new Date(row.createdAt).toISOString(),
        row.status,
        row.fareAmount !== null ? row.fareAmount.toFixed(2) : "",
        row.commissionPerRide.toFixed(2),
      ]
        .map((value) => {
          if (!value) return "";
          if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
          return value;
        })
        .join(",")
    );
    const csvContent = [csvHeader, ...csvLines].join("\n");
    const csvBuffer = Buffer.from(csvContent, "utf-8");

    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Zabava";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Transport rides");
    sheet.columns = [
      { header: "Ride ID", key: "rideId", width: 24 },
      { header: "Service ID", key: "serviceId", width: 24 },
      { header: "Service name", key: "serviceName", width: 28 },
      { header: "Service type", key: "serviceType", width: 12 },
      { header: "Created", key: "createdAt", width: 24 },
      { header: "Status", key: "status", width: 14 },
      { header: "Fare (CZK)", key: "fareAmount", width: 16 },
      { header: "Commission (CZK)", key: "commissionPerRide", width: 18 },
    ];

    rows.forEach((row) => {
      sheet.addRow({
        rideId: row.id,
        serviceId: row.serviceId,
        serviceName: row.serviceName,
        serviceType: row.serviceType,
        createdAt: row.createdAt,
        status: row.status,
        fareAmount: row.fareAmount !== null ? row.fareAmount : "",
        commissionPerRide: row.commissionPerRide,
      });
    });

    const summarySheet = workbook.addWorksheet("Summary");
    summarySheet.addRows([
      ["Partner ID", parsed.partnerId ?? "—"],
      ["Service ID", parsed.serviceId ?? "—"],
      ["Period start", dateFrom],
      ["Period end", dateTo],
      ["Ride count", rows.length],
      ["Total fare (CZK)", totalFare],
      ["Total commission (CZK)", totalCommission],
    ]);

    const xlsxArrayBuffer = await workbook.xlsx.writeBuffer();
    const xlsxBuffer = Buffer.from(xlsxArrayBuffer);

    const csvFilename = `transport-rides-${
      parsed.partnerId ?? parsed.serviceId ?? "all"
    }-${dateFrom.slice(0, 10)}-${dateTo.slice(0, 10)}.csv`;
    const xlsxFilename = csvFilename.replace(".csv", ".xlsx");

    return withCors(
      NextResponse.json({
        summary: {
          rideCount: rows.length,
          totalFare,
          totalCommission,
          dateFrom,
          dateTo,
        },
        files: {
          csv: {
            filename: csvFilename,
            contentType: "text/csv",
            base64: bufferToBase64(csvBuffer),
          },
          xlsx: {
            filename: xlsxFilename,
            contentType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            base64: bufferToBase64(xlsxBuffer),
          },
        },
      }),
      CORS_CONFIG
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withCors(
        NextResponse.json(
          { error: "ValidationError", issues: error.flatten() },
          { status: 400 }
        ),
        CORS_CONFIG
      );
    }

    log.error("admin_transport_export_error", error, {
      route: "admin/transport/rides/export",
      correlationId,
    });
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
      CORS_CONFIG
    );
  }
}
