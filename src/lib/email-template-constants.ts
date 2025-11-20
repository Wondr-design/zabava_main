export const emailTemplateTypes = [
  "qr_delivery",
  "visit_confirmed",
  "visit_updated",
  "invite_partner",
  "invite_staff",
  "verification_code",
  "billing_report",
] as const;

export type EmailTemplateType = (typeof emailTemplateTypes)[number];

export const EMAIL_TEMPLATE_DEFAULTS: Record<
  EmailTemplateType,
  { subject: string; body: string; description?: string }
> = {
  qr_delivery: {
    subject: "Your QR code is ready",
    body:
      "Hi there,\n\nHere is your QR code. Please keep it handy for check-in. It includes your visit/reward details and any expiry information.\n\nThanks!",
    description: "Sent when a QR is generated (visits, rewards, flash deals).",
  },
  visit_confirmed: {
    subject: "Your visit is confirmed",
    body:
      "Your visit has been marked as confirmed. Show your QR on arrival and enjoy your experience.",
    description: "Sent after staff marks a visit as visited/confirmed.",
  },
  visit_updated: {
    subject: "Your visit details were updated",
    body:
      "We updated your visit details. Please review the changes and keep this email for your records.",
    description: "Sent when staff edits a visit (e.g., ticket counts, transport).",
  },
  invite_partner: {
    subject: "You’re invited to join as a partner",
    body:
      "You’ve been invited to join the partner portal. Use the invite link to finish setup and start managing your venue.",
    description: "Sent for partner invitations.",
  },
  invite_staff: {
    subject: "You’re invited to join the team",
    body:
      "You’ve been invited to join the team. Use the invite link to create your account and get started.",
    description: "Sent for staff invitations.",
  },
  verification_code: {
    subject: "Your verification code",
    body:
      "Use this code to verify your email address. It expires soon, so complete verification promptly.",
    description: "Sent for all verification-code flows.",
  },
  billing_report: {
    subject: "Your monthly billing report",
    body:
      "Attached is your latest billing report. Let us know if you have any questions about the numbers or payouts.",
    description: "Sent with monthly billing CSV/XLSX attachments.",
  },
};
