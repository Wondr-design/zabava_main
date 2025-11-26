import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { generatePartnerBillingReport } from "@/lib/services/reporting/billing-export";
import { EMAIL_TEMPLATE_DEFAULTS } from "@/lib/email-template-constants";
import type { Database } from "@/supabase/types";

export type CommissionBasis = "discounted" | "original";

export interface PartnerBillingSettings {
  partnerId: string;
  billingEmail: string | null;
  autoSendEnabled: boolean;
  autoSendDay: number;
  listingFeeAmount: number;
  listingFeeCurrency: string;
  commissionBasis: CommissionBasis;
  listingOnly: boolean;
  lastSentAt: string | null;
  nextScheduledAt: string | null;
}

export interface PartnerBillingSummary {
  partnerId: string;
  partnerName: string | null;
  billingEmail: string | null;
  contactEmail?: string | null;
  autoSendEnabled: boolean;
  autoSendDay?: number;
  lastSentAt: string | null;
  commissionBasis: CommissionBasis;
  listingFeeAmount: number;
  listingFeeCurrency: string;
  listingOnly: boolean;
}

const settingsSchema = z.object({
  billingEmail: z.string().email().optional().nullable(),
  autoSendEnabled: z.boolean().optional(),
  autoSendDay: z.number().int().min(1).max(28).optional(),
  commissionBasis: z.enum(["discounted", "original"]).optional(),
});

type PartnerWithBillingRow = Database["public"]["Tables"]["partners"]["Row"] & {
  billing?: Database["public"]["Tables"]["partner_billing_settings"]["Row"] | null;
};

export async function getPartnerBillingSettings(partnerId: string): Promise<PartnerBillingSettings> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("partners")
    .select("id, contract, contact_email, billing:partner_billing_settings(*)")
    .eq("id", partnerId)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load billing settings: ${error.message}`);
  }
const partner = data as PartnerWithBillingRow | null;
  const contract = (partner?.contract as Record<string, unknown>) ?? {};
  const listingFeeAmount = Number(contract.monthlyFee ?? 0);
  const listingOnly = Boolean(contract.listingOnly);
  const listingFeeCurrency = "CZK";
  const billing = partner?.billing ?? null;
  return {
    partnerId,
    billingEmail: (billing?.billing_email as string | null) ?? null,
    autoSendEnabled: Boolean(billing?.auto_send_enabled),
    autoSendDay: Number(billing?.auto_send_day ?? 1),
    listingFeeAmount,
    listingFeeCurrency,
    commissionBasis:
      (billing?.commission_basis as CommissionBasis) ||
      (contract.commissionBasis as CommissionBasis) ||
      "discounted",
    listingOnly,
    lastSentAt: (billing?.last_sent_at as string | null) ?? null,
    nextScheduledAt: (billing?.next_scheduled_at as string | null) ?? null,
  };
}

export async function upsertPartnerBillingSettings(
  partnerId: string,
  payload: Partial<PartnerBillingSettings>,
) {
  // settingsSchema already allows listingOnly
  const parsed = settingsSchema.parse(payload as unknown);
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { error } = await supabase.from("partner_billing_settings").upsert(
    {
      partner_id: partnerId,
      billing_email: parsed.billingEmail ?? null,
      auto_send_enabled:
        parsed.autoSendEnabled !== undefined ? parsed.autoSendEnabled : undefined,
      auto_send_day: parsed.autoSendDay ?? undefined,
      commission_basis: parsed.commissionBasis ?? undefined,
      updated_at: now,
    } as never,
    { onConflict: "partner_id" },
  );
  if (error) {
    throw new Error(`Failed to save billing settings: ${error.message}`);
  }
}

export async function listPartnerBillingSummaries(): Promise<PartnerBillingSummary[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("partners")
    .select("id, display_name, contact_email, contract, billing:partner_billing_settings(*)")
    .order("display_name", { ascending: true });
  if (error) {
    throw new Error(`Failed to load partners for billing: ${error.message}`);
  }
const rows = ((data ?? []) as unknown[]) as PartnerWithBillingRow[];
  return rows.map((row) => ({
    partnerId: row.id as string,
    partnerName: (row.display_name as string | null) ?? null,
    billingEmail: (row.billing?.billing_email as string | null) ?? null,
    contactEmail: (row.contact_email as string | null) ?? null,
    autoSendEnabled: Boolean(row.billing?.auto_send_enabled),
    autoSendDay: Number(row.billing?.auto_send_day ?? 1),
    commissionBasis:
        (row.billing?.commission_basis as CommissionBasis) ||
        ((row.contract as Record<string, unknown>)?.commissionBasis as CommissionBasis) ||
        "discounted",
      listingFeeAmount: Number((row.contract as Record<string, unknown>)?.monthlyFee ?? 0),
    listingFeeCurrency: "CZK",
    listingOnly: Boolean((row.contract as Record<string, unknown>)?.listingOnly),
    lastSentAt: (row.billing?.last_sent_at as string | null) ?? null,
  }));
}

function defaultRange(dateFrom?: string, dateTo?: string) {
  if (dateFrom && dateTo) return { dateFrom, dateTo };
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  return {
    dateFrom: dateFrom ?? start.toISOString(),
    dateTo: dateTo ?? now.toISOString(),
  };
}

export async function generatePartnerBilling(
  partnerId: string,
  opts: { dateFrom?: string; dateTo?: string },
) {
  const { dateFrom, dateTo } = defaultRange(opts.dateFrom, opts.dateTo);
  const settings = await getPartnerBillingSettings(partnerId);
  const report = await generatePartnerBillingReport({
    partnerId,
    dateFrom,
    dateTo,
    commissionBasis: settings.commissionBasis,
    listingOnly: settings.listingOnly,
    listingFeeAmount: settings.listingFeeAmount,
    listingFeeCurrency: settings.listingFeeCurrency,
  });
  return { report, dateFrom, dateTo, template: EMAIL_TEMPLATE_DEFAULTS.billing_report, settings };
}
