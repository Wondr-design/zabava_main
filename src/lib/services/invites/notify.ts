import type { PartnerInviteDTO } from "@/lib/data/invites";
import type { StaffInviteDTO } from "@/lib/data/staff-invites";
import { log } from "@/lib/logging";
import { isEmailDeliveryConfigured, sendTemplatedEmail } from "@/lib/services/mailer";
import { EMAIL_TEMPLATE_DEFAULTS } from "@/lib/email-template-constants";

export async function notifyPartnerInvite(invite: PartnerInviteDTO) {
  if (!invite.email) return;
  try {
    if (!isEmailDeliveryConfigured()) {
      log.warn("partner_invite_email_not_configured", {
        token: invite.token,
        partnerId: invite.partnerId,
      });
      return;
    }
    const template = EMAIL_TEMPLATE_DEFAULTS.invite_partner;
    const link = invite.inviteUrl ?? "";
    await sendTemplatedEmail({
      to: invite.email,
      templateType: "invite_partner",
      locale: invite.locale ?? "en",
      subjectOverride: template.subject,
      bodyOverride: `${template.body}\n\nInvite link: ${link}`,
      details: [
        { label: "Partner", value: invite.partnerId },
        { label: "Role", value: invite.role },
        { label: "Invite link", value: link },
      ],
    });
  } catch (error) {
    log.error("partner_invite_resend_error", error, {
      token: invite.token,
      partnerId: invite.partnerId,
    });
  }
}

export async function notifyStaffInvite(invite: StaffInviteDTO) {
  if (!invite.email) return;
  try {
    if (!isEmailDeliveryConfigured()) {
      log.warn("staff_invite_email_not_configured", {
        token: invite.token,
        partnerId: invite.partner_id,
      });
      return;
    }
    const template = EMAIL_TEMPLATE_DEFAULTS.invite_staff;
    const link = invite.inviteUrl ?? "";
    await sendTemplatedEmail({
      to: invite.email,
      templateType: "invite_staff",
      locale: invite.locale ?? "en",
      subjectOverride: template.subject,
      bodyOverride: `${template.body}\n\nInvite link: ${link}`,
      details: [
        { label: "Partner", value: invite.partner_id },
        { label: "Invite link", value: link },
        { label: "Expires", value: invite.expires_at ?? undefined },
      ],
    });
  } catch (error) {
    log.error("staff_invite_resend_error", error, {
      token: invite.token,
      partnerId: invite.partner_id,
    });
  }
}
