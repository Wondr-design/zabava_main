import { NextRequest, NextResponse } from "next/server";

import { withCors, preflightResponse } from "@/lib/http/cors";
import { isAdminRequestAuthorized } from "@/lib/api/admin-auth";
import { listPartnerBillingSummaries, generatePartnerBilling } from "@/lib/data/billing";
import { sendTemplatedEmail, isEmailDeliveryConfigured } from "@/lib/services/mailer";
import { loadPartnerMeta } from "@/lib/data/partners";

const BASE_CORS = {
  methods: "GET,OPTIONS",
  headers: "Content-Type, Authorization, x-admin-secret",
} as const;

function corsOptions(req: NextRequest) {
  return {
    ...BASE_CORS,
    origin: req.headers.get("origin") ?? "*",
    credentials: true,
  } as const;
}

function cors(req: NextRequest, res: NextResponse) {
  return withCors(res, corsOptions(req));
}

export function OPTIONS(req: NextRequest) {
  return preflightResponse(corsOptions(req));
}

export async function GET(req: NextRequest) {
  if (!isAdminRequestAuthorized(req)) {
    return cors(req, NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }
  if (!isEmailDeliveryConfigured()) {
    return cors(req, NextResponse.json({ error: "Email delivery not configured" }, { status: 503 }));
  }

  const summaries = await listPartnerBillingSummaries();
  const now = new Date();
  const today = now.getUTCDate();

  let sent = 0;
  for (const partner of summaries) {
    if (!partner.autoSendEnabled) continue;
    if (partner.autoSendDay !== undefined && partner.autoSendDay !== null && partner.autoSendDay !== today) continue;
    try {
      const { report, dateFrom, dateTo, template } = await generatePartnerBilling(partner.partnerId, {});
      const partnerMeta = await loadPartnerMeta(partner.partnerId);
      const recipient = partner.billingEmail || partnerMeta.info.contactEmail;
      if (!recipient) continue;
      const csvFilename = `partner-${partner.partnerId}-${dateFrom.slice(0, 10)}-${dateTo.slice(
        0,
        10,
      )}.csv`;
      const xlsxFilename = `partner-${partner.partnerId}-${dateFrom.slice(0, 10)}-${dateTo.slice(
        0,
        10,
      )}.xlsx`;

      await sendTemplatedEmail({
        to: recipient,
        templateType: "billing_report",
        locale: "en",
        subjectOverride: template.subject,
        bodyOverride: template.body,
        details: [
          { label: "Partner", value: partner.partnerId },
          { label: "Period start", value: dateFrom },
          { label: "Period end", value: dateTo },
          { label: "Visits", value: report.summary.visitCount.toString() },
          { label: "Flash deals", value: report.summary.flashDealCount.toString() },
          { label: "Transport rides", value: report.summary.transportRideCount.toString() },
        ],
        attachments: [
          { filename: csvFilename, content: report.csvBuffer, contentType: "text/csv" },
          {
            filename: xlsxFilename,
            content: report.xlsxBuffer,
            contentType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          },
        ],
      });
      sent += 1;
    } catch (error) {
      console.error("auto_send_billing_error", error);
      continue;
    }
  }

  return cors(req, NextResponse.json({ ok: true, sent }));
}
