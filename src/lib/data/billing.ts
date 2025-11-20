import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { generatePartnerBillingReport } from "@/lib/services/reporting/billing-export";
import { EMAIL_TEMPLATE_DEFAULTS } from "@/lib/email-template-constants";

export type CommissionBasis = "discounted" | "original";

export interface PartnerBillingSettings {
  partnerId: string;
  billingEmail: string | null;
  autoSendEnabled: boolean;
  autoSendDay: number;
  listingFeeAmount: number;
  listingFeeCurrency: string;
  commissionBasis: CommissionBasis;
  lastSentAt: string | null;
  nextScheduledAt: string | null;
}

export interface PartnerBillingSummary {
  partnerId: string;
  partnerName: string | null;
  billingEmail: string | null;
  autoSendEnabled: boolean;
  lastSentAt: string | null;
  commissionBasis: CommissionBasis;
  listingFeeAmount: number;
  listingFeeCurrency: string;
}

const settingsSchema = z.object({
  billingEmail: z.string().email().optional().nullable(),
  autoSendEnabled: z.boolean().optional(),
  autoSendDay: z.number().int().min(1).max(28).optional(),
  listingFeeAmount: z.number().nonnegative().optional(),
  listingFeeCurrency: z.string().min(1).optional(),
  commissionBasis: z.enum(["discounted", "original"]).optional(),
});

export async function getPartnerBillingSettings(partnerId: string): Promise<PartnerBillingSettings> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("partner_billing_settings")
    .select("*")
    .eq("partner_id", partnerId)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load billing settings: ${error.message}`);
  }
  return {
    partnerId,
    billingEmail: (data?.billing_email as string | null) ?? null,
    autoSendEnabled: Boolean(data?.auto_send_enabled),
    autoSendDay: Number(data?.auto_send_day ?? 1),
    listingFeeAmount: Number(data?.listing_fee_amount ?? 0),
    listingFeeCurrency: (data?.listing_fee_currency as string) || "CZK",
    commissionBasis: (data?.commission_basis as CommissionBasis) || "discounted",
    lastSentAt: (data?.last_sent_at as string | null) ?? null,
    nextScheduledAt: (data?.next_scheduled_at as string | null) ?? null,
  };
}

export async function upsertPartnerBillingSettings(
  partnerId: string,
  payload: z.infer<typeof settingsSchema>,
) {
  const parsed = settingsSchema.parse(payload);
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { error } = await supabase.from("partner_billing_settings").upsert(
    {
      partner_id: partnerId,
      billing_email: parsed.billingEmail ?? null,
      auto_send_enabled:
        parsed.autoSendEnabled !== undefined ? parsed.autoSendEnabled : undefined,
      auto_send_day: parsed.autoSendDay ?? undefined,
      listing_fee_amount: parsed.listingFeeAmount ?? undefined,
      listing_fee_currency: parsed.listingFeeCurrency ?? undefined,
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
    .select("id, display_name, billing:partner_billing_settings(*)")
    .order("display_name", { ascending: true });
  if (error) {
    throw new Error(`Failed to load partners for billing: ${error.message}`);
  }
  return (data ?? []).map((row: any) => ({
    partnerId: row.id as string,
    partnerName: (row.display_name as string | null) ?? null,
    billingEmail: (row.billing?.billing_email as string | null) ?? null,
    autoSendEnabled: Boolean(row.billing?.auto_send_enabled),
    commissionBasis: (row.billing?.commission_basis as CommissionBasis) || "discounted",
    listingFeeAmount: Number(row.billing?.listing_fee_amount ?? 0),
    listingFeeCurrency: (row.billing?.listing_fee_currency as string) || "CZK",
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
  const report = await generatePartnerBillingReport({
    partnerId,
    dateFrom,
    dateTo,
  });
  return { report, dateFrom, dateTo, template: EMAIL_TEMPLATE_DEFAULTS.billing_report };
}
