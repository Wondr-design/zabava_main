import { z } from "zod";

import type {
  PartnerTicketAddon,
  PartnerTicketDetail,
} from "./partners";
import { getSupabaseAdmin } from "../supabase-admin";
import { setRewardRedemptionForm } from "./rewards";

export const MAX_QR_EXPIRY_SECONDS = 60 * 60 * 24 * 7; // 7 days (Supabase signed URL limit)
const FALLBACK_QR_EXPIRY_SECONDS = 60 * 60 * 24 * 3; // 3 days default if env missing
const ENV_QR_EXPIRY_SECONDS = Number(process.env.QR_CODE_EXPIRES_IN);
export const DEFAULT_QR_EXPIRY_SECONDS = Math.min(
  Math.max(
    Number.isFinite(ENV_QR_EXPIRY_SECONDS) && ENV_QR_EXPIRY_SECONDS > 0
      ? Math.floor(ENV_QR_EXPIRY_SECONDS)
      : FALLBACK_QR_EXPIRY_SECONDS,
    60
  ),
  MAX_QR_EXPIRY_SECONDS
);

function generateFormId(prefix = "step") {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2)}`;
}

const formFieldOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
  helperText: z.string().optional(),
  price: z.number().nonnegative().optional(),
});

const formStepConditionSchema = z.object({
  fieldId: z.string(),
  operator: z.enum(["equals", "not_equals"]).default("equals"),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

const formStepLogicSchema = z.object({
  behavior: z.enum(["show", "hide"]).default("show"),
  conditions: z.array(formStepConditionSchema).default([]),
});

const pricingInclusionSchema = z
  .object({
    adults: z.number().nonnegative().nullable().optional(),
    children: z.number().nonnegative().nullable().optional(),
    teens: z.number().nonnegative().nullable().optional(),
  })
  .partial();

const pricingBundleSchema = z.object({
  id: z.string(),
  sourceId: z.string().optional(),
  ticketType: z.string().nullable().optional(),
  label: z.string(),
  description: z.string().optional(),
  price: z.number().nonnegative().nullable().optional(),
  discountedPrice: z.number().nonnegative().nullable().optional(),
  inclusions: pricingInclusionSchema.optional(),
});

const pricingAddonSchema = z.object({
  id: z.string(),
  sourceId: z.string().optional(),
  appliesToTicketType: z.string().nullable().optional(),
  label: z.string(),
  description: z.string().optional(),
  price: z.number().nonnegative().nullable().optional(),
  discountedPrice: z.number().nonnegative().nullable().optional(),
  maxPerBooking: z.number().nonnegative().nullable().optional(),
});

const pricingStepSchema = z.object({
  currency: z.string().default("CZK"),
  allowCustomTotals: z.boolean().default(true),
  bundles: z.array(pricingBundleSchema).default([]),
  addons: z.array(pricingAddonSchema).default([]),
  maxGuestsPerBooking: z.number().nonnegative().nullable().optional(),
});

const formFieldSchema = z.object({
  id: z.string(),
  kind: z
    .enum([
      "input",
      "textarea",
      "radio",
      "select",
      "checkbox",
      "counter",
      "transport",
    ])
    .default("input"),
  type: z.enum(["text", "email", "number"]).optional(),
  name: z.string(),
  label: z.string(),
  placeholder: z.string().optional(),
  required: z.boolean().optional(),
  helperText: z.string().optional(),
  options: z.array(formFieldOptionSchema).optional(),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  note: z.string().optional(),
  logic: formStepLogicSchema.optional(),
});

const formStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  nextLabel: z.string().optional(),
  previousLabel: z.string().optional(),
  fields: z.array(formFieldSchema).default([]),
  variant: z.enum(["fields", "pricing"]).default("fields"),
  pricing: pricingStepSchema.optional(),
  logic: formStepLogicSchema.optional(),
});

const hiddenFieldSchema = z.object({
  name: z.string(),
  value: z.string(),
});

const transportOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
});

const partnerFormDealIntegrationSchema = z
  .object({
    visitorsFieldId: z.string().min(1),
    consentFieldId: z.string().min(1).optional(),
    notesFieldId: z.string().min(1).optional(),
  })
  .optional();

const partnerFormConfigSchema = z.object({
  domId: z.string().min(3).default("partner-form"),
  title: z.string(),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  partner: z
    .object({
      id: z.string(),
      name: z.string().optional(),
      cityCode: z.string().optional(),
    })
    .optional(),
  proxyUrl: z.string().url().default("https://app.zabava.cz/api/public/visit"),
  qrRedirectUrl: z.string().url().default("https://app.zabava.cz/api/verify"),
  qrExpiresInSeconds: z
    .number()
    .int()
    .min(60)
    .max(MAX_QR_EXPIRY_SECONDS)
    .default(DEFAULT_QR_EXPIRY_SECONDS),
  steps: z.array(formStepSchema),
  hiddenFields: z.array(hiddenFieldSchema).default([]),
  summary: z
    .object({
      title: z.string().default("Review your selection"),
      note: z.string().optional(),
      confirmLabel: z.string().default("Confirm & Generate QR"),
      editLabel: z.string().default("Edit"),
      totalLabel: z.string().default("Total price"),
      pointsLabel: z.string().default("Estimated points"),
      busLabel: z.string().default("Bus partner"),
      navLabel: z.string().default("Review"),
      extraRows: z
        .array(
          z.object({
            name: z.string(),
            label: z.string(),
          })
        )
        .default([]),
    })
    .default({
      title: "Review your selection",
      confirmLabel: "Confirm & Generate QR",
      editLabel: "Edit",
      totalLabel: "Total price",
      pointsLabel: "Estimated points",
      busLabel: "Bus partner",
      navLabel: "Review",
      extraRows: [],
    }),
  styling: z
    .object({
      theme: z
        .object({
          background: z.string().default("#0b0f14"),
          card: z.string().default("#0f1720"),
          accent: z.string().default("#f59e0b"),
          muted: z.string().default("#9fb3c8"),
          text: z.string().default("#e6edf3"),
        })
        .default(() => ({
          background: "#0b0f14",
          card: "#0f1720",
          accent: "#f59e0b",
          muted: "#9fb3c8",
          text: "#e6edf3",
        })),
      fontFamily: z
        .string()
        .default('Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial'),
    })
    .default(() => ({
      theme: {
        background: "#0b0f14",
        card: "#0f1720",
        accent: "#f59e0b",
        muted: "#9fb3c8",
        text: "#e6edf3",
      },
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial',
    })),
  pricing: z
    .object({
      currency: z.string().default("CZK"),
      ticketFieldId: z.string(),
      peopleFieldId: z.string(),
      transportFieldId: z.string().optional(),
      transportYesValue: z.string().optional(),
      transportBusFieldId: z.string().optional(),
      transportFee: z.number().nonnegative().optional(),
      ticketPricing: z
        .array(
          z.object({
            value: z.string(),
            label: z.string(),
            price: z.number().nonnegative(),
          })
        )
        .default([]),
    })
    .optional(),
  transport: z
    .object({
      enabled: z.boolean().default(false),
      yesLabel: z.string().optional(),
      noLabel: z.string().optional(),
      yesValue: z.string().default("Yes"),
      noValue: z.string().default("No"),
      busFieldId: z.string().optional(),
      partners: z.array(transportOptionSchema).default([]),
      busFee: z.number().nonnegative().optional(),
    })
    .optional(),
  deal: partnerFormDealIntegrationSchema,
});

export type PartnerFormConfig = z.infer<typeof partnerFormConfigSchema>;
export type PartnerFormStep = z.infer<typeof formStepSchema>;
export type PartnerFormField = z.infer<typeof formFieldSchema>;
export type PartnerFormStepCondition = z.infer<typeof formStepConditionSchema>;
export type PartnerFormStepLogic = z.infer<typeof formStepLogicSchema>;

export const createPartnerFormInputSchema = z
  .object({
    partnerId: z.string().min(1),
    name: z.string().min(1),
    slug: z.string().min(1),
    status: z.enum(["draft", "published", "archived"]).default("draft"),
    description: z.string().optional(),
    config: partnerFormConfigSchema,
    createdBy: z.string().email().optional(),
    usageType: z.enum(["visit", "reward", "deal"]).default("visit"),
    rewardId: z.string().min(1).optional(),
    dealId: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.usageType === "reward" && !value.rewardId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "rewardId is required for reward forms",
        path: ["rewardId"],
      });
    }
    if (value.usageType === "deal" && !value.dealId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "dealId is required for deal forms",
        path: ["dealId"],
      });
    }
  });

export const updatePartnerFormInputSchema = z
  .object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  description: z.string().nullable().optional(),
  config: partnerFormConfigSchema.optional(),
  updatedBy: z.string().email().optional(),
    usageType: z.enum(["visit", "reward", "deal"]).optional(),
    rewardId: z.string().min(1).nullable().optional(),
    dealId: z.string().min(1).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.usageType === "reward" && value.rewardId === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "rewardId is required for reward forms",
        path: ["rewardId"],
      });
    }
    if (value.usageType === "deal" && !value.dealId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "dealId is required for deal forms",
        path: ["dealId"],
      });
    }
  });

type CreatePartnerFormInput = z.infer<typeof createPartnerFormInputSchema>;
type UpdatePartnerFormInput = z.infer<typeof updatePartnerFormInputSchema>;

interface PartnerFormRow {
  id: string;
  partner_id: string | null;
  name: string;
  slug: string;
  status: "draft" | "published" | "archived";
  description: string | null;
  embed_version: string;
  config: Record<string, unknown> | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  usage_type: "visit" | "reward" | "deal" | null;
  reward_id: string | null;
  deal_id: string | null;
}

export interface PartnerFormRecord {
  id: string;
  partnerId: string | null;
  name: string;
  slug: string;
  status: "draft" | "published" | "archived";
  description: string | null;
  embedVersion: string;
  config: PartnerFormConfig;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  usageType: "visit" | "reward" | "deal";
  rewardId: string | null;
  dealId: string | null;
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-")
      .slice(0, 80) || "form"
  );
}

function mapRow(row: PartnerFormRow): PartnerFormRecord {
  const config = (() => {
    try {
      return partnerFormConfigSchema.parse(row.config ?? {});
    } catch (error) {
      console.warn("Invalid partner form config, falling back to default", {
        id: row.id,
        error,
      });
      return createDefaultFormConfig(row.partner_id ?? "");
    }
  })();

  return {
    id: row.id,
    partnerId: row.partner_id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    description: row.description,
    embedVersion: row.embed_version,
    config,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    usageType: row.usage_type ?? "visit",
    rewardId: row.reward_id,
    dealId: row.deal_id,
  };
}

export type PartnerFormPricingBundle = z.infer<typeof pricingBundleSchema>;
export type PartnerFormPricingAddon = z.infer<typeof pricingAddonSchema>;

export function buildPricingStepFromTicketing(args: {
  partnerName?: string;
  currency?: string;
  ticketDetails?: PartnerTicketDetail[] | null;
  addons?: PartnerTicketAddon[] | null;
  stepId?: string;
  title?: string;
  description?: string;
  discountRate?: number | null;
  maxGuestsPerBooking?: number | null;
}) {
  const normalizedDiscountRate =
    typeof args.discountRate === "number" && Number.isFinite(args.discountRate)
      ? Math.min(Math.max(args.discountRate, 0), 100)
      : null;

  const applyDiscount = (
    base: number | null,
    fallback?: number | null
  ): number | null => {
    if (base === null || Number.isNaN(base)) {
      return fallback ?? null;
    }
    if (normalizedDiscountRate === null) {
      return typeof fallback === "number" ? fallback : base;
    }
    const discounted = Math.max(
      0,
      base - base * (normalizedDiscountRate / 100)
    );
    return Math.round(discounted * 100) / 100;
  };

  const bundles = (args.ticketDetails ?? []).map((detail) => ({
    id: detail.id ? `bundle-${detail.id}` : generateFormId("bundle"),
    sourceId: detail.id ?? undefined,
    ticketType: detail.ticketType ?? null,
    label: detail.label?.trim() || detail.ticketType || "Ticket bundle",
    description: detail.description ?? "",
    price: typeof detail.price === "number" ? detail.price : null,
    discountedPrice: applyDiscount(
      typeof detail.price === "number" ? detail.price : null,
      typeof detail.discountedPrice === "number"
        ? detail.discountedPrice
        : null
    ),
    inclusions: detail.inclusions ?? undefined,
  }));

  const addons = (args.addons ?? []).map((addon) => ({
    id: addon.id ? `addon-${addon.id}` : generateFormId("addon"),
    sourceId: addon.id ?? undefined,
    appliesToTicketType: addon.appliesToTicketType ?? null,
    label: addon.label?.trim() || "Add-on",
    description: addon.description ?? "",
    price: typeof addon.price === "number" ? addon.price : null,
    discountedPrice: applyDiscount(
      typeof addon.price === "number" ? addon.price : null,
      typeof addon.discountedPrice === "number"
        ? addon.discountedPrice
        : null
    ),
    maxPerBooking: addon.maxPerBooking ?? null,
  }));

  return {
    id: args.stepId ?? generateFormId("pricing"),
    title: args.title ?? "Pricing",
    description:
      args.description ??
      `Choose ticket bundles and optional add-ons for ${
        args.partnerName ?? "this experience"
      }.`,
    fields: [],
    variant: "pricing" as const,
    pricing: {
      currency: args.currency ?? "CZK",
      allowCustomTotals: true,
      bundles,
      addons,
      maxGuestsPerBooking: args.maxGuestsPerBooking ?? null,
    },
  };
}

const SAMPLE_TICKETING_DETAILS: PartnerTicketDetail[] = [
  {
    id: "default-adult",
    ticketType: "Adult",
    label: "Adult bundle",
    price: 220,
    discountedPrice: null,
    description: "Standard entry for adults.",
    inclusions: { adults: 1 },
  },
  {
    id: "default-child",
    ticketType: "Child",
    label: "Child bundle",
    price: 100,
    discountedPrice: null,
    description: "Standard entry for children.",
    inclusions: { children: 1 },
  },
];

const SAMPLE_TICKETING_ADDONS: PartnerTicketAddon[] = [
  {
    id: "default-addon-photo",
    label: "Photo package",
    description: "Professional photos from your visit.",
    price: 80,
    discountedPrice: null,
    appliesToTicketType: null,
  },
  {
    id: "default-addon-vip",
    label: "VIP upgrade",
    description: "Access to VIP lounge and concierge.",
    price: 150,
    discountedPrice: null,
    appliesToTicketType: "Adult",
  },
];

export function createDefaultFormConfig(
  partnerId: string,
  opts: { partnerName?: string; slug?: string } = {}
): PartnerFormConfig {
  const slug = opts.slug ? slugify(opts.slug) : "partner-form";
  const domId = `form-${slug}`;
  const partnerName = opts.partnerName ?? "Partner";
  const baseSteps = [
    {
      id: "ticket",
      title: "Ticket",
      fields: [
        {
          id: "ticketType",
          kind: "radio",
          name: "ticket",
          label: "Ticket type",
          required: true,
          options: [
            { id: "adult", label: "Adult", value: "Adult", price: 220 },
            { id: "child", label: "Child", value: "Child", price: 100 },
          ],
        },
      ],
    },
    {
      id: "people",
      title: "People",
      fields: [
        {
          id: "numPeople",
          kind: "counter",
          name: "numPeople",
          label: "Number of people",
          min: 1,
          defaultValue: 1,
        },
      ],
    },
    {
      id: "transport",
      title: "Transport",
      fields: [
        {
          id: "transport",
          kind: "transport",
          name: "Transport",
          label: "Do you need transport?",
          note: "If you choose “Yes”, select a bus partner below.",
          options: [
            { id: "transport-no", label: "No", value: "No" },
            { id: "transport-yes", label: "Yes", value: "Yes" },
          ],
        },
      ],
    },
    {
      id: "contact",
      title: "Email",
      fields: [
        {
          id: "email",
          kind: "input",
          type: "email",
          name: "email",
          label: "Email",
          required: true,
          placeholder: "you@example.com",
        },
        {
          id: "privacy",
          kind: "checkbox",
          name: "privacy",
          label: "I agree to the Privacy Policy (required)",
          required: true,
        },
        {
          id: "promo",
          kind: "checkbox",
          name: "promo",
          label: "Accept promos",
          defaultValue: true,
        },
      ],
    },
  ];
  const pricingStep = buildPricingStepFromTicketing({
    partnerName,
    currency: "CZK",
    ticketDetails: SAMPLE_TICKETING_DETAILS,
    addons: SAMPLE_TICKETING_ADDONS,
    maxGuestsPerBooking: null,
  });
  baseSteps.splice(1, 0, pricingStep);

  return partnerFormConfigSchema.parse({
    domId,
    title: `Event Registration – ${partnerName}`,
    subtitle:
      "Select ticket, set people, (optional) transport, then confirm to get your QR.",
    proxyUrl: "https://app.zabava.cz/api/public/visit",
    qrRedirectUrl: "https://app.zabava.cz/api/verify",
    qrExpiresInSeconds: DEFAULT_QR_EXPIRY_SECONDS,
    partner: {
      id: partnerId,
      name: partnerName,
    },
    hiddenFields: [
      { name: "partner_id", value: partnerId },
      { name: "attractionName", value: partnerName },
      { name: "cityCode", value: "CITY" },
    ],
    steps: baseSteps,
    summary: {
      navLabel: "Review",
      title: "Review your selection",
      note: "We’ll generate the QR and send it via email.",
      confirmLabel: "Confirm & Generate QR",
      editLabel: "Edit",
      totalLabel: "Total price",
      pointsLabel: "Estimated points",
      busLabel: "Bus partner",
      extraRows: [{ name: "cityCode", label: "City code" }],
    },
    styling: {
      theme: {
        background: "#0b0f14",
        card: "#0f1720",
        accent: "#f59e0b",
        muted: "#9fb3c8",
        text: "#e6edf3",
      },
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial',
    },
    pricing: {
      currency: "CZK",
      ticketFieldId: "ticketType",
      peopleFieldId: "numPeople",
      transportFieldId: "transport",
      transportYesValue: "Yes",
      transportBusFieldId: "selectedBus",
      transportFee: 500,
      ticketPricing: [
        { value: "Adult", label: "Adult", price: 220 },
        { value: "Child", label: "Child", price: 100 },
      ],
    },
    transport: {
      enabled: true,
      yesLabel: "Yes",
      noLabel: "No",
      yesValue: "Yes",
      noValue: "No",
      busFieldId: "selectedBus",
      busFee: 500,
      partners: [
        { id: "bus-a", label: "Bus A", value: "Bus A" },
        { id: "bus-b", label: "Bus B", value: "Bus B" },
        { id: "bus-c", label: "Bus C", value: "Bus C" },
        { id: "bus-d", label: "Bus D", value: "Bus D" },
      ],
    },
  });
}

export async function listPartnerForms(params: {
  partnerId?: string;
  status?: "draft" | "published" | "archived";
  usageType?: "visit" | "reward" | "deal";
  limit?: number;
}) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("partner_forms")
    .select("*")
    .order("updated_at", { ascending: false });

  if (params.partnerId) {
    query = query.eq("partner_id", params.partnerId);
  }
  if (params.status) {
    query = query.eq("status", params.status);
  }
  if (params.usageType) {
    query = query.eq("usage_type", params.usageType);
  }
  if (params.limit) {
    query = query.limit(params.limit);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to list partner forms: ${error.message}`);
  }
  const rows = (data ?? []) as PartnerFormRow[];
  return rows.map(mapRow);
}

export async function getPartnerFormById(id: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("partner_forms")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load partner form: ${error.message}`);
  }
  return data ? mapRow(data as PartnerFormRow) : null;
}

export async function getPartnerFormBySlug(partnerId: string, slug: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("partner_forms")
    .select("*")
    .eq("partner_id", partnerId)
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load partner form by slug: ${error.message}`);
  }
  return data ? mapRow(data as PartnerFormRow) : null;
}

export async function createPartnerForm(
  input: Partial<CreatePartnerFormInput>
) {
  const parsed = createPartnerFormInputSchema.parse({
    ...input,
    slug: input.slug ? slugify(input.slug) : slugify(input.name ?? "form"),
    config:
      input.config ??
      createDefaultFormConfig(input.partnerId ?? "", {
        partnerName: input.name,
        slug: input.slug ?? input.name ?? "form",
      }),
  });
  const baseSlug = parsed.slug;
  let uniqueSlug = baseSlug;
  if (parsed.partnerId) {
    let suffix = 2;
    while (await getPartnerFormBySlug(parsed.partnerId, uniqueSlug)) {
      uniqueSlug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }
  }

  const payload = {
    ...parsed,
    slug: uniqueSlug,
    rewardId: parsed.usageType === "reward" ? parsed.rewardId : undefined,
    dealId: parsed.usageType === "deal" ? parsed.dealId : undefined,
  };

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("partner_forms")
    .insert({
      partner_id: payload.partnerId,
      name: payload.name,
      slug: payload.slug,
      status: payload.status,
      description: payload.description ?? null,
      config: payload.config,
      created_by: payload.createdBy ?? null,
      updated_by: payload.createdBy ?? null,
      usage_type: payload.usageType,
      reward_id: payload.rewardId ?? null,
      deal_id: payload.dealId ?? null,
    } as unknown as never)
    .select()
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create partner form: ${error?.message ?? "unknown error"}`
    );
  }

  const createdRecord = mapRow(data as PartnerFormRow);

  if (createdRecord.usageType === "reward" && createdRecord.rewardId) {
    await setRewardRedemptionForm(createdRecord.rewardId, createdRecord.id);
  }

  return createdRecord;
}

export async function updatePartnerForm(
  id: string,
  input: UpdatePartnerFormInput
) {
  const existing = await getPartnerFormById(id);
  if (!existing) {
    return null;
  }
  const payload = updatePartnerFormInputSchema.parse(input);
  const updates: Record<string, unknown> = {};
  if (payload.name) updates.name = payload.name;
  if (payload.slug) updates.slug = slugify(payload.slug);
  if (payload.status) updates.status = payload.status;
  if (payload.description !== undefined) {
    updates.description = payload.description ?? null;
  }
  if (payload.config) {
    updates.config = payload.config;
  }
  if (payload.updatedBy) {
    updates.updated_by = payload.updatedBy;
  }
  if (payload.usageType) {
    updates.usage_type = payload.usageType;
    if (payload.usageType !== "reward") {
      updates.reward_id = null;
    }
    if (payload.usageType !== "deal") {
      updates.deal_id = null;
    }
  }
  if (payload.rewardId !== undefined) {
    updates.reward_id = payload.rewardId ?? null;
  }
  if (payload.dealId !== undefined) {
    updates.deal_id = payload.dealId ?? null;
  }

  if (Object.keys(updates).length === 0) {
    return getPartnerFormById(id);
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("partner_forms")
    .update(updates as unknown as never)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update partner form: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const updatedRecord = mapRow(data as PartnerFormRow);

  if (
    existing.rewardId &&
    (updatedRecord.usageType !== "reward" ||
      updatedRecord.rewardId !== existing.rewardId)
  ) {
    await setRewardRedemptionForm(existing.rewardId, null);
  }

  if (updatedRecord.usageType === "reward" && updatedRecord.rewardId) {
    await setRewardRedemptionForm(updatedRecord.rewardId, updatedRecord.id);
  }

  return updatedRecord;
}

export async function deletePartnerForm(id: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("partner_forms")
    .delete({ returning: "minimal" } as never)
    .eq("id", id);
  if (error) {
    throw new Error(`Failed to delete partner form: ${error.message}`);
  }
}
