import { z } from "zod";

export const cmsBlockTypes = [
  "hero",
  "rich_text",
  "feature_grid",
  "legal_section",
  "cta_banner",
  "reviews",
  "faq",
] as const;

export type CmsBlockType = (typeof cmsBlockTypes)[number];

const heroBlockSchema = z.object({
  eyebrow: z.string().max(80).optional(),
  title: z.string().min(1).max(160),
  body: z.string().max(2000).optional(),
  align: z.enum(["left", "center"]).default("left"),
  ctaLabel: z.string().max(80).optional(),
  ctaHref: z.string().url().optional(),
  backgroundImage: z.string().url().optional(),
  tone: z.enum(["brand", "muted", "contrast"]).default("brand"),
});

const richTextBlockSchema = z.object({
  title: z.string().max(160).optional(),
  body: z.string().min(1),
});

const featureGridSchema = z.object({
  title: z.string().max(160),
  columns: z.number().min(2).max(4).default(3),
  items: z
    .array(
      z.object({
        heading: z.string().min(1).max(120),
        icon: z.string().optional(),
        description: z.string().min(1).max(400),
      }),
    )
    .min(1),
});

const legalSectionSchema = z.object({
  heading: z.string().min(1).max(160),
  body: z.string().min(1),
});

const ctaBannerSchema = z.object({
  eyebrow: z.string().max(60).optional(),
  title: z.string().min(1).max(140),
  description: z.string().max(400).optional(),
  ctaLabel: z.string().max(80).optional(),
  ctaHref: z.string().url().optional(),
});

const reviewsBlockSchema = z.object({
  title: z.string().min(1).max(160),
  layout: z.enum(["grid", "carousel"]).default("grid"),
  items: z
    .array(
      z.object({
        quote: z.string().min(1),
        author: z.string().min(1),
        role: z.string().max(160).optional(),
      }),
    )
    .min(1),
});

const faqBlockSchema = z.object({
  title: z.string().min(1).max(160),
  items: z
    .array(
      z.object({
        question: z.string().min(1),
        answer: z.string().min(1),
      }),
    )
    .min(1),
});

export type CmsBlockDataMap = {
  hero: z.infer<typeof heroBlockSchema>;
  rich_text: z.infer<typeof richTextBlockSchema>;
  feature_grid: z.infer<typeof featureGridSchema>;
  legal_section: z.infer<typeof legalSectionSchema>;
  cta_banner: z.infer<typeof ctaBannerSchema>;
  reviews: z.infer<typeof reviewsBlockSchema>;
  faq: z.infer<typeof faqBlockSchema>;
};

export interface CmsBlockDefinition<
  TType extends CmsBlockType,
  TSchema extends z.ZodTypeAny,
> {
  type: TType;
  label: string;
  description: string;
  schema: TSchema;
  defaults: () => z.infer<TSchema>;
}

export const cmsBlockRegistry: Record<
  CmsBlockType,
  CmsBlockDefinition<CmsBlockType, z.ZodTypeAny>
> = {
  hero: {
    type: "hero",
    label: "Hero",
    description: "Large intro section with headline, body, and CTA.",
    schema: heroBlockSchema,
    defaults: () => ({
      eyebrow: "Zabava",
      title: "Tell your story",
      body: "Use the hero block to welcome visitors and highlight key actions.",
      align: "left",
      tone: "brand",
    }),
  },
  rich_text: {
    type: "rich_text",
    label: "Rich text",
    description: "Paragraphs of formatted content.",
    schema: richTextBlockSchema,
    defaults: () => ({
      title: "Section title",
      body: "Write the narrative for this section.",
    }),
  },
  feature_grid: {
    type: "feature_grid",
    label: "Feature grid",
    description: "Display multiple highlights in a grid layout.",
    schema: featureGridSchema,
    defaults: () => ({
      title: "Highlights",
      columns: 3,
      items: [
        {
          heading: "Fast onboarding",
          description: "Describe the key benefit for visitors.",
        },
        {
          heading: "Trusted partners",
          description: "Explain the value your partners provide.",
        },
        {
          heading: "Secure visits",
          description: "Reassure visitors about safety and compliance.",
        },
      ],
    }),
  },
  legal_section: {
    type: "legal_section",
    label: "Legal / policy text",
    description: "Structured legal paragraphs.",
    schema: legalSectionSchema,
    defaults: () => ({
      heading: "Policy heading",
      body: "Describe the policy details for this section.",
    }),
  },
  cta_banner: {
    type: "cta_banner",
    label: "CTA banner",
    description: "Compact call-to-action highlight.",
    schema: ctaBannerSchema,
    defaults: () => ({
      eyebrow: "Ready?",
      title: "Take the next step",
      description: "Guide visitors to the next action.",
      ctaLabel: "Contact us",
      ctaHref: "mailto:hello@zabava.com",
    }),
  },
  reviews: {
    type: "reviews",
    label: "Reviews",
    description: "Showcase testimonials with author + role.",
    schema: reviewsBlockSchema,
    defaults: () => ({
      title: "Loved by thousands",
      layout: "grid",
      items: [
        {
          quote: "Zabava made our guest onboarding effortless.",
          author: "Ivana Horak",
          role: "GM, City Escape",
        },
        {
          quote: "Ticket edits at the door are finally simple.",
          author: "Samuel O.",
          role: "Experience Lead",
        },
      ],
    }),
  },
  faq: {
    type: "faq",
    label: "FAQ",
    description: "Question + answer accordion content.",
    schema: faqBlockSchema,
    defaults: () => ({
      title: "Frequently asked questions",
      items: [
        {
          question: "How long are QR visits valid?",
          answer: "Each visit remains valid until staff marks it as completed or the expiry in your email passes.",
        },
        {
          question: "Can I edit ticket types later?",
          answer: "Yes, staff can adjust selections on arrival using the CMS-configured catalog.",
        },
      ],
    }),
  },
};

export function getBlockDefinition<TType extends CmsBlockType>(
  type: TType,
) {
  return cmsBlockRegistry[type];
}

export function getBlockDefaults<TType extends CmsBlockType>(
  type: TType,
) {
  return cmsBlockRegistry[type].defaults();
}

export function validateBlockData<TType extends CmsBlockType>(
  type: TType,
  data: unknown,
) {
  return cmsBlockRegistry[type].schema.parse(data);
}

