import { z } from "zod";

// Available email template element types
export const emailTemplateElementTypes = [
  "greeting",
  "body_text",
  "qr_code",
  "details_table",
  "action_button",
  "footer",
  "verification_code",
  "invite_link",
] as const;

export type EmailTemplateElementType =
  (typeof emailTemplateElementTypes)[number];

// Element configuration schemas
const greetingElementSchema = z.object({
  type: z.literal("greeting"),
  visible: z.boolean().default(true),
  customText: z.string().optional(),
});

const bodyTextElementSchema = z.object({
  type: z.literal("body_text"),
  visible: z.boolean().default(true),
  content: z.string(),
});

const qrCodeElementSchema = z.object({
  type: z.literal("qr_code"),
  visible: z.boolean().default(true),
  label: z.string().optional(),
  caption: z.string().optional(),
});

const detailsTableElementSchema = z.object({
  type: z.literal("details_table"),
  visible: z.boolean().default(true),
  includeFields: z.array(z.string()).optional(), // Specific fields to include
});

const actionButtonElementSchema = z.object({
  type: z.literal("action_button"),
  visible: z.boolean().default(true),
  label: z.string().optional(),
  urlVariable: z.string().optional(), // Which variable to use for URL
});

const footerElementSchema = z.object({
  type: z.literal("footer"),
  visible: z.boolean().default(true),
  customText: z.string().optional(),
});

const verificationCodeElementSchema = z.object({
  type: z.literal("verification_code"),
  visible: z.boolean().default(true),
  label: z.string().optional(),
  format: z.enum(["plain", "highlighted"]).default("plain"),
});

const inviteLinkElementSchema = z.object({
  type: z.literal("invite_link"),
  visible: z.boolean().default(true),
  label: z.string().optional(),
  buttonStyle: z.boolean().default(false), // Button vs link
});

// Union type for all element configurations
export const emailTemplateElementSchema = z.discriminatedUnion("type", [
  greetingElementSchema,
  bodyTextElementSchema,
  qrCodeElementSchema,
  detailsTableElementSchema,
  actionButtonElementSchema,
  footerElementSchema,
  verificationCodeElementSchema,
  inviteLinkElementSchema,
]);

export type EmailTemplateElement = z.infer<typeof emailTemplateElementSchema>;

// Template structure schema
export const emailTemplateStructureSchema = z.object({
  elements: z.array(emailTemplateElementSchema).min(0),
});

export type EmailTemplateStructure = z.infer<
  typeof emailTemplateStructureSchema
>;

// Available elements per template type
export const AVAILABLE_ELEMENTS_BY_TYPE: Record<
  string,
  EmailTemplateElementType[]
> = {
  qr_delivery: ["greeting", "body_text", "qr_code", "details_table", "footer"],
  visit_confirmed: ["greeting", "body_text", "details_table", "footer"],
  visit_updated: ["greeting", "body_text", "details_table", "footer"],
  invite_partner: ["greeting", "body_text", "invite_link", "footer"],
  invite_staff: ["greeting", "body_text", "invite_link", "footer"],
  verification_code: ["greeting", "body_text", "verification_code", "footer"],
  billing_report: ["greeting", "body_text", "details_table", "footer"],
};

// Default structures for each template type
export function getDefaultStructure(
  templateType: string
): EmailTemplateStructure {
  const availableElements = AVAILABLE_ELEMENTS_BY_TYPE[templateType] || [];

  const defaultElements = availableElements.map(
    (type): EmailTemplateElement => {
      switch (type) {
        case "greeting":
          return { type: "greeting", visible: true };
        case "body_text":
          return { type: "body_text", visible: true, content: "" };
        case "qr_code":
          return { type: "qr_code", visible: true };
        case "details_table":
          return { type: "details_table", visible: true };
        case "footer":
          return { type: "footer", visible: true };
        case "verification_code":
          return {
            type: "verification_code",
            visible: true,
            format: "highlighted",
          };
        case "invite_link":
          return { type: "invite_link", visible: true, buttonStyle: true };
        default:
          return {
            type: "greeting",
            visible: true,
          };
      }
    }
  );

  return { elements: defaultElements };
}
