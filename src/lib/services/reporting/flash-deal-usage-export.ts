import { Buffer } from "node:buffer";

import ExcelJS from "exceljs";
import { z } from "zod";

import { getSupabaseAdminTyped } from "@/lib/supabase-admin";
import { normalizePartnerId } from "@/lib/data/partners";
import { fetchPartnerDisplayNames } from "@/lib/data/flash-deals";

const usageRangeSchema = z.object({
  dateFrom: z.string().datetime(),
  dateTo: z.string().datetime(),
  partnerId: z.string().optional(),
});

interface FlashDealUsageRow {
  redemptionId: string;
  flashDealId: string;
  dealTitle: string;
  dealType: string;
  partnerId: string;
  partnerName: string | null;
  status: string;
  createdAt: string;
  updatedAt: string | null;
  visitId: string | null;
  visitorEmail: string | null;
  minVisitors: number | null;
  actualVisitors: number | null;
  staffId: string | null;
  rejectionReason: string | null;
  metadata: Record<string, unknown>;
}

interface FlashDealUsageSummary {
  total: number;
  used: number;
  rejected: number;
  pending: number;
}

type RawRedemptionRow = {
  id: string;
  flash_deal_id: string;
  visit_id: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
  metadata: Record<string, unknown> | null;
  flash_deal?: {
    id: string;
    title?: string | null;
    deal_type?: string | null;
    partner_id?: string | null;
    min_visitors?: number | null;
  } | null;
  visit_registrations?: {
    id: string;
    email: string | null;
    num_people: number | null;
    visited_at: string | null;
    status: string | null;
    created_at: string | null;
  } | null;
};

export interface FlashDealUsageReport {
  summary: FlashDealUsageSummary;
  rows: FlashDealUsageRow[];
  csvBuffer: Buffer;
  xlsxBuffer: Buffer;
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function buildCsv(rows: FlashDealUsageRow[]) {
  const header = [
    "Redemption ID",
    "Flash Deal ID",
    "Deal Title",
    "Deal Type",
    "Partner ID",
    "Partner Name",
    "Status",
    "Created",
    "Updated",
    "Visit ID",
    "Visitor Email",
    "Required visitors",
    "Actual visitors",
    "Staff ID",
    "Rejection reason",
    "Metadata JSON",
  ];

  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.redemptionId,
        row.flashDealId,
        row.dealTitle.replace(/,/g, ";"),
        row.dealType,
        row.partnerId,
        (row.partnerName ?? "").replace(/,/g, ";"),
        row.status,
        row.createdAt,
        row.updatedAt ?? "",
        row.visitId ?? "",
        row.visitorEmail ?? "",
        row.minVisitors ?? "",
        row.actualVisitors ?? "",
        row.staffId ?? "",
        row.rejectionReason ?? "",
        JSON.stringify(row.metadata ?? {}),
      ].join(","),
    );
  }
  return lines.join("\n");
}

export async function generateFlashDealUsageReport(params: {
  dateFrom: string;
  dateTo: string;
  partnerId?: string;
}): Promise<FlashDealUsageReport> {
  const { dateFrom, dateTo, partnerId } = usageRangeSchema.parse(params);
  const supabase = getSupabaseAdminTyped();

  const { data, error } = await supabase
    .from("flash_deal_redemptions")
    .select(
      `
        id,
        flash_deal_id,
        visit_id,
        status,
        created_at,
        updated_at,
        metadata,
        flash_deal:flash_deal_id (
          id,
          title,
          deal_type,
          partner_id,
          commission_percent,
          min_visitors
        ),
        visit_registrations:visit_id (
          id,
          email,
          num_people,
          status,
          visited_at,
          created_at
        )
      `,
    )
    .gte("created_at", dateFrom)
    .lte("created_at", dateTo)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load flash-deal usage: ${error.message}`);
  }

  const normalizedPartnerId = partnerId
    ? normalizePartnerId(partnerId)
    : null;

  const rows = ((data ?? []) as unknown as RawRedemptionRow[]).filter((row) => {
    if (!normalizedPartnerId) return true;
    const deal = row.flash_deal;
    const dealPartner = deal?.partner_id ? normalizePartnerId(deal.partner_id) : null;
    return dealPartner === normalizedPartnerId;
  });

  const partnerIds = Array.from(
    new Set(
      rows
        .map((row) => row.flash_deal?.partner_id ?? null)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const partnerNameMap = await fetchPartnerDisplayNames(partnerIds);

  const usageRows: FlashDealUsageRow[] = rows.map((redemption) => {
    const deal = redemption.flash_deal ?? ({} as NonNullable<RawRedemptionRow["flash_deal"]>);
    const visit = redemption.visit_registrations ?? null;
    const metadata = (redemption.metadata ?? {}) as Record<string, unknown>;
    const normalizedDealPartner = deal.partner_id
      ? normalizePartnerId(deal.partner_id)
      : "";

    const requiredVisitors =
      normalizeNumber(metadata.visitors) ??
      normalizeNumber(metadata.requiredVisitors) ??
      (typeof deal.min_visitors === "number" ? deal.min_visitors : null);
    const actualVisitors =
      normalizeNumber(metadata.actualVisitors) ??
      (typeof visit?.num_people === "number" ? visit.num_people : null);

    const rejectionReason =
      typeof metadata.reason === "string" ? metadata.reason : null;

    return {
      redemptionId: redemption.id,
      flashDealId: redemption.flash_deal_id,
      dealTitle: deal.title ?? "Flash deal",
      dealType: deal.deal_type ?? "",
      partnerId: normalizedDealPartner,
      partnerName: partnerNameMap[normalizedDealPartner] ?? null,
      status: redemption.status,
      createdAt: redemption.created_at,
      updatedAt: redemption.updated_at,
      visitId: redemption.visit_id,
      visitorEmail: visit?.email ?? null,
      minVisitors: requiredVisitors,
      actualVisitors,
      staffId:
        typeof metadata.staffId === "string" ? metadata.staffId : null,
      rejectionReason,
      metadata,
    };
  });

  const summary = usageRows.reduce<FlashDealUsageSummary>(
    (acc, row) => {
      acc.total += 1;
      const status = (row.status || "").toLowerCase();
      if (status === "used") acc.used += 1;
      else if (status === "rejected") acc.rejected += 1;
      else if (status === "pending") acc.pending += 1;
      return acc;
    },
    { total: 0, used: 0, rejected: 0, pending: 0 },
  );

  const csvBuffer = Buffer.from(buildCsv(usageRows), "utf-8");

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Zabava";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Flash deals");
  sheet.columns = [
    { header: "Redemption ID", key: "redemptionId", width: 24 },
    { header: "Deal ID", key: "flashDealId", width: 24 },
    { header: "Deal title", key: "dealTitle", width: 36 },
    { header: "Deal type", key: "dealType", width: 16 },
    { header: "Partner ID", key: "partnerId", width: 20 },
    { header: "Partner name", key: "partnerName", width: 24 },
    { header: "Status", key: "status", width: 14 },
    { header: "Created", key: "createdAt", width: 24 },
    { header: "Updated", key: "updatedAt", width: 24 },
    { header: "Visit ID", key: "visitId", width: 24 },
    { header: "Visitor email", key: "visitorEmail", width: 28 },
    { header: "Required visitors", key: "minVisitors", width: 16 },
    { header: "Actual visitors", key: "actualVisitors", width: 16 },
    { header: "Staff ID", key: "staffId", width: 18 },
    { header: "Rejection reason", key: "rejectionReason", width: 24 },
    { header: "Metadata JSON", key: "metadata", width: 50 },
  ];

  usageRows.forEach((row) => {
    sheet.addRow({
      redemptionId: row.redemptionId,
      flashDealId: row.flashDealId,
      dealTitle: row.dealTitle,
      dealType: row.dealType,
      partnerId: row.partnerId,
      partnerName: row.partnerName ?? "",
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt ?? "",
      visitId: row.visitId ?? "",
      visitorEmail: row.visitorEmail ?? "",
      minVisitors: row.minVisitors ?? "",
      actualVisitors: row.actualVisitors ?? "",
      staffId: row.staffId ?? "",
      rejectionReason: row.rejectionReason ?? "",
      metadata: JSON.stringify(row.metadata ?? {}),
    });
  });

  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.addRows([
    ["Total redemptions", summary.total],
    ["Used", summary.used],
    ["Rejected", summary.rejected],
    ["Pending", summary.pending],
    ["Date from", dateFrom],
    ["Date to", dateTo],
    ["Partner filter", partnerId ?? "—"],
  ]);

  const xlsxBuffer = await workbook.xlsx.writeBuffer();

  return {
    summary,
    rows: usageRows,
    csvBuffer: Buffer.from(csvBuffer),
    xlsxBuffer: Buffer.from(xlsxBuffer),
  };
}
