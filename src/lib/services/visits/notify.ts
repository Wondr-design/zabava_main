import type { VisitRegistrationRecord } from "@/lib/data/visits";
import { log } from "@/lib/logging";
import { isEmailDeliveryConfigured, sendTemplatedEmail } from "@/lib/services/mailer";
import { EMAIL_TEMPLATE_DEFAULTS } from "@/lib/email-template-constants";

interface VisitUpdateNotification {
  before: VisitRegistrationRecord;
  after: VisitRegistrationRecord;
  changes: Record<string, unknown>;
  actor?: {
    email?: string;
    staffId?: string | null;
    name?: string;
  } | null;
}

export async function notifyVisitUpdated(
  payload: VisitUpdateNotification
) {
  try {
    if (!isEmailDeliveryConfigured()) {
      log.warn("visit_update_email_not_configured", { visitId: payload.after.id });
      return;
    }
    const template = EMAIL_TEMPLATE_DEFAULTS.visit_updated;
    const changesText = Object.entries(payload.changes)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
    await sendTemplatedEmail({
      to: payload.after.email,
      templateType: "visit_updated",
      locale: "en",
      subjectOverride: template.subject,
      bodyOverride: `${template.body}\n\nUpdates:\n${changesText}`,
      details: [
        { label: "Visit ID", value: payload.after.id },
        { label: "Partner", value: payload.after.partner_id },
        { label: "Updated by", value: payload.actor?.email },
      ],
    });
  } catch (error) {
    log.error("visit_update_resend_error", error, {
      visitId: payload.after.id,
    });
  }
}
