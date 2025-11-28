import { z } from "zod";
import { getSupabaseAdmin } from "../supabase-admin";

function makeRandomId() {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

const DEFAULT_CONTRACT = {
  monthlyFee: 0,
  discountRate: 0,
  commissionRate: 0,
  commissionRateOriginal: 0,
  commissionRateDiscounted: 0,
  commissionBasis: "discounted" as const,
  bonusPointsPerCzk: 0,
  listingOnly: false,
};

const DEFAULT_TICKETING = {
  ticketTypes: [] as string[],
  familyRule: "",
  ticketDetails: [] as PartnerTicketDetail[],
  addons: [] as PartnerTicketAddon[],
  maxGuestsPerBooking: null as number | null,
};

const DEFAULT_ADDRESS = {
  city: "",
  addressLine: "",
  sameAsCompany: false,
  timeZone: "",
};

const DEFAULT_INFO = {
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  payments: [] as string[],
  facilities: [] as string[],
  website: "",
  googleMapUrl: "",
  googleMapEmbedUrl: "",
  companyName: "",
  businessName: "",
  shortDescription: "",
  vatRegistered: false,
  vatRate: 0,
  companyIdNumber: "",
  companyAddress: { ...DEFAULT_ADDRESS },
  businessAddress: { ...DEFAULT_ADDRESS, sameAsCompany: true },
  minAge: 0,
  openingHours: [] as PartnerOpeningHourEntry[],
  publicTransport: "",
  reservationRequired: false,
  cashCurrencies: [] as string[],
  hasToilet: false,
  wheelchairAccessible: false,
};

const DEFAULT_MEDIA = {
  logoUrl: "",
  heroImageUrl: "",
  contractAttachmentUrl: "",
  videoUrls: [] as string[],
  qrAccentColor: "",
  qrBadgeIconUrl: "",
};

export interface PartnerNoteEntry {
  id: string;
  body: string;
  createdAt: string;
  createdBy?: string | null;
}

export interface PartnerOpeningHourEntry {
  day: string;
  hours: string;
}

export interface PartnerTicketInclusions {
  adults?: number | null;
  children?: number | null;
  teens?: number | null;
}

export interface PartnerTicketDetail {
  id: string;
  ticketType: string | null;
  label: string | null;
  price: number | null;
  discountedPrice: number | null;
  description: string;
  inclusions?: PartnerTicketInclusions | null;
}

export interface PartnerTicketAddon {
  id: string;
  label: string;
  appliesToTicketType?: string | null;
  description?: string;
  guestType?: "adult" | "child" | "other" | null;
  price: number | null;
  discountedPrice: number | null;
  maxPerBooking?: number | null;
}

export const partnerStatusSchema = z.enum([
  "active",
  "pending",
  "inactive",
  "hidden",
]);

export const partnerTypeSchema = z.enum(["standard", "transport"]);

export const transportationTypeSchema = z.enum(["taxi", "bus", "limousine"]);

export const partnerRelationshipTypeSchema = z.enum(["transport"]);

const contractSchema = z
  .object({
    monthlyFee: z.coerce.number().min(0).optional(),
    discountRate: z.coerce.number().min(0).max(100).optional(),
    commissionRate: z.coerce.number().min(0).max(100).optional(),
    commissionRateOriginal: z.coerce.number().min(0).max(100).optional(),
    commissionRateDiscounted: z.coerce.number().min(0).max(100).optional(),
    commissionBasis: z.enum(["original", "discounted"]).optional(),
    bonusPointsPerCzk: z.coerce.number().min(0).optional(),
    listingOnly: z.boolean().optional(),
  })
  .partial();

const ticketInclusionsSchema = z
  .object({
    adults: z.coerce.number().min(0).optional().nullable(),
    children: z.coerce.number().min(0).optional().nullable(),
    teens: z.coerce.number().min(0).optional().nullable(),
  })
  .partial()
  .optional();

const ticketDetailSchema = z.object({
  id: z.string().optional(),
  ticketType: z.string().optional().nullable(),
  label: z.string().optional().nullable(),
  price: z.coerce.number().min(0).optional().nullable(),
  description: z.string().optional(),
  inclusions: ticketInclusionsSchema,
});

const ticketAddonSchema = z.object({
  id: z.string().optional(),
  label: z.string().optional(),
  appliesToTicketType: z.string().optional().nullable(),
  description: z.string().optional(),
  guestType: z.enum(["adult", "child", "other"]).optional().nullable(),
  price: z.coerce.number().min(0).optional().nullable(),
  maxPerBooking: z.coerce.number().min(0).optional().nullable(),
});

const ticketingSchema = z
  .object({
    ticketTypes: z.array(z.string()).optional(),
    familyRule: z.string().optional(),
    ticketDetails: z.array(ticketDetailSchema).optional(),
    addons: z.array(ticketAddonSchema).optional(),
    maxGuestsPerBooking: z.coerce.number().min(0).optional().nullable(),
  })
  .partial();

const openingHourSchema = z
  .object({
    day: z.string().optional(),
    hours: z.string().optional(),
  })
  .partial();

const addressSchema = z
  .object({
    city: z.string().optional(),
    addressLine: z.string().optional(),
    sameAsCompany: z.boolean().optional(),
    timeZone: z.string().optional(),
  })
  .partial();

const infoSchema = z
  .object({
    contactName: z.string().optional(),
    contactEmail: z.string().optional(),
    contactPhone: z.string().optional(),
    payments: z.array(z.string()).optional(),
    facilities: z.array(z.string()).optional(),
    website: z.string().optional(),
    googleMapUrl: z.string().optional(),
    googleMapEmbedUrl: z.string().optional(),
    companyName: z.string().optional(),
    businessName: z.string().optional(),
    shortDescription: z.string().optional(),
    vatRegistered: z.boolean().optional(),
    vatRate: z.coerce.number().min(0).max(100).optional(),
    companyIdNumber: z.string().optional(),
    companyAddress: addressSchema.optional(),
    businessAddress: addressSchema.optional(),
    minAge: z.coerce.number().min(0).optional(),
    openingHours: z.array(openingHourSchema).optional(),
    publicTransport: z.string().optional(),
    reservationRequired: z.boolean().optional(),
    cashCurrencies: z.array(z.string()).optional(),
    hasToilet: z.boolean().optional(),
    wheelchairAccessible: z.boolean().optional(),
  })
  .partial();

const mediaSchema = z
  .object({
    logoUrl: z.string().optional(),
    heroImageUrl: z.string().optional(),
    contractAttachmentUrl: z.string().optional(),
    videoUrls: z.array(z.string()).optional(),
    qrAccentColor: z.string().nullable().optional(),
    qrBadgeIconUrl: z.string().nullable().optional(),
  })
  .partial();

export const partnerNoteSchema = z.object({
  id: z.string().min(1),
  body: z.string().min(1),
  createdAt: z.string().min(1),
  createdBy: z.string().optional(),
});

export const partnerMetaUpdateSchema = z
  .object({
    displayName: z.string().optional(),
    status: partnerStatusSchema.optional(),
    type: partnerTypeSchema.optional(),
    transportationType: transportationTypeSchema
      .nullable()
      .optional(),
    listingTierKey: z
      .union([
        z
          .string()
          .trim()
          .max(120)
          .regex(/^[a-z0-9][a-z0-9-_]*$/i, {
            message:
              "Listing tier keys may only contain letters, numbers, hyphens, and underscores.",
          }),
        z.literal(null),
      ])
      .optional(),
    contract: contractSchema.optional(),
    ticketing: ticketingSchema.optional(),
    info: infoSchema.optional(),
    media: mediaSchema.optional(),
    bonusProgramEnabled: z.boolean().optional(),
    notes: z.array(partnerNoteSchema).optional(),
    tags: z.array(z.string()).optional(),
  })
  .partial();

export type PartnerMetaUpdateInput = z.infer<typeof partnerMetaUpdateSchema>;

export interface PartnerMetaContract {
  monthlyFee: number;
  discountRate: number;
  commissionRate: number;
  commissionRateOriginal: number;
  commissionRateDiscounted: number;
  commissionBasis: "original" | "discounted";
  bonusPointsPerCzk: number;
  listingOnly: boolean;
}

export interface PartnerMetaTicketing {
  ticketTypes: string[];
  familyRule: string;
  ticketDetails: PartnerTicketDetail[];
  addons: PartnerTicketAddon[];
  maxGuestsPerBooking: number | null;
}

export interface PartnerAddress {
  city: string;
  addressLine: string;
  sameAsCompany?: boolean;
  timeZone?: string | null;
}

export interface PartnerMetaInfo {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  payments: string[];
  facilities: string[];
  website: string;
  googleMapUrl: string;
  googleMapEmbedUrl?: string;
  companyName: string;
  businessName: string;
  shortDescription: string;
  vatRegistered: boolean;
  vatRate: number;
  companyIdNumber: string;
  companyAddress: PartnerAddress;
  businessAddress: PartnerAddress;
  minAge: number;
  openingHours: PartnerOpeningHourEntry[];
  publicTransport: string;
  reservationRequired: boolean;
  cashCurrencies: string[];
  hasToilet: boolean;
  wheelchairAccessible: boolean;
  timeZone?: string | null;
}

export interface PartnerMetaMedia {
  logoUrl: string;
  heroImageUrl: string;
  contractAttachmentUrl: string;
  videoUrls: string[];
  qrAccentColor?: string | null;
  qrBadgeIconUrl?: string | null;
}

export interface PartnerMeta {
  partnerId: string;
  displayName: string | null;
  status: "active" | "pending" | "hidden";
  type: z.infer<typeof partnerTypeSchema>;
  transportationType: z.infer<typeof transportationTypeSchema> | null;
  contract: PartnerMetaContract;
  ticketing: PartnerMetaTicketing;
  info: PartnerMetaInfo;
  media: PartnerMetaMedia;
  bonusProgramEnabled: boolean;
  notes: PartnerNoteEntry[];
  tags: string[];
  listingTierKey: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PartnerRow {
  id: string;
  display_name: string | null;
  status: string | null;
  type: string | null;
  transportation_type: string | null;
  contact_email: string | null;
  contact_name: string | null;
  tags: string[] | null;
  website: string | null;
  listing_tier_key: string | null;
  contract: Record<string, unknown> | null;
  ticketing: Record<string, unknown> | null;
  info: Record<string, unknown> | null;
  media: Record<string, unknown> | null;
  bonus_program_enabled: boolean | null;
  notes: unknown;
  created_at: string | null;
  updated_at: string | null;
}

function sanitizeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);
}

function cloneAddress(
  address: PartnerAddress | null | undefined
): PartnerAddress {
  return {
    city: address?.city ?? "",
    addressLine: address?.addressLine ?? "",
    sameAsCompany: address?.sameAsCompany ?? false,
    timeZone: address?.timeZone ?? "",
  };
}

function normalizeAddress(
  address: Partial<PartnerAddress> | null | undefined,
  fallback?: PartnerAddress
): PartnerAddress {
  const base = fallback
    ? cloneAddress(fallback)
    : { city: "", addressLine: "", sameAsCompany: false, timeZone: "" };
  if (!address) {
    return base;
  }
  return {
    city: typeof address.city === "string" ? address.city : base.city,
    addressLine:
      typeof address.addressLine === "string"
        ? address.addressLine
        : base.addressLine,
    sameAsCompany:
      typeof address.sameAsCompany === "boolean"
        ? address.sameAsCompany
        : base.sameAsCompany ?? false,
    timeZone:
      typeof address.timeZone === "string"
        ? address.timeZone
        : (base.timeZone ?? ""),
  };
}

function mergeAddress(
  current: PartnerAddress,
  updates?: Partial<PartnerAddress> | null
): PartnerAddress {
  if (!updates) {
    return cloneAddress(current);
  }
  return normalizeAddress({ ...current, ...updates }, current);
}

export function normalizePartnerId(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function normalizeStatusForDb(status: string | null | undefined) {
  const normalized = (status ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "hidden") return "inactive";
  if (["active", "pending", "inactive"].includes(normalized)) {
    return normalized;
  }
  return null;
}

function statusFromRow(
  value: string | null | undefined
): "active" | "pending" | "hidden" {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "pending") return "pending";
  if (normalized === "inactive") return "hidden";
  return "active";
}

function buildDefaultPartnerMeta(partnerId: string): PartnerMeta {
  const timestamp = new Date().toISOString();
  return {
    partnerId,
    displayName: partnerId,
    status: "active",
    type: "standard",
    transportationType: null,
    contract: { ...DEFAULT_CONTRACT },
    ticketing: {
      ...DEFAULT_TICKETING,
      ticketTypes: [...DEFAULT_TICKETING.ticketTypes],
      ticketDetails: [],
      addons: [],
    },
    info: {
      ...DEFAULT_INFO,
      payments: [...DEFAULT_INFO.payments],
      facilities: [...DEFAULT_INFO.facilities],
      companyAddress: cloneAddress(DEFAULT_INFO.companyAddress),
      businessAddress: cloneAddress(DEFAULT_INFO.businessAddress),
    },
    media: { ...DEFAULT_MEDIA },
    bonusProgramEnabled: false,
    notes: [],
    tags: [],
    listingTierKey: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function mergeArrays(existing: string[], updates?: string[]) {
  if (!updates) return existing;
  return sanitizeStringArray(updates);
}

export function sanitizeNotes(
  notes?: (PartnerNoteEntry | Record<string, unknown>)[] | null
): PartnerNoteEntry[] {
  if (!Array.isArray(notes)) return [];
  const mapped = notes.map((note) => {
    const raw = note ?? {};
    const body = typeof raw.body === "string" ? raw.body.trim() : "";
    if (!body) return null;
    const id =
      typeof raw.id === "string" && raw.id.trim()
        ? raw.id.trim()
        : makeRandomId();
    const createdAt =
      typeof raw.createdAt === "string" && raw.createdAt.trim()
        ? raw.createdAt
        : new Date().toISOString();
    const createdBy =
      typeof raw.createdBy === "string" ? raw.createdBy : undefined;
    return { id, body, createdAt, createdBy } as PartnerNoteEntry;
  });
  return mapped.filter((entry): entry is PartnerNoteEntry => Boolean(entry));
}

function sanitizeOpeningHours(input?: unknown): PartnerOpeningHourEntry[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const value = entry as Record<string, unknown>;
      const day = typeof value.day === "string" ? value.day.trim() : "";
      const hours = typeof value.hours === "string" ? value.hours.trim() : "";
      if (!day || !hours) return null;
      return { day, hours } satisfies PartnerOpeningHourEntry;
    })
    .filter((entry): entry is PartnerOpeningHourEntry => Boolean(entry));
}

function coerceNonNegativeNumber(input: unknown) {
  if (typeof input === "number" && Number.isFinite(input) && input >= 0) {
    return input;
  }
  if (typeof input === "string" && input.trim().length > 0) {
    const parsed = Number(input);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return null;
}

function sanitizeTicketInclusions(
  input?: unknown
): PartnerTicketInclusions | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  const adults = coerceNonNegativeNumber(value.adults);
  const children = coerceNonNegativeNumber(value.children);
  const teens = coerceNonNegativeNumber(value.teens);
  if (adults === null && children === null && teens === null) {
    return null;
  }
  return {
    adults,
    children,
    teens,
  };
}

function sanitizeTicketDetails(input?: unknown): PartnerTicketDetail[] {
  if (!Array.isArray(input)) return [];
  const mapped: Array<PartnerTicketDetail | null> = input.map((entry) => {
    if (!entry || typeof entry !== "object") return null;
    const value = entry as Record<string, unknown>;
    const description =
      typeof value.description === "string" ? value.description.trim() : "";
    const label =
      typeof value.label === "string" && value.label.trim().length > 0
        ? value.label.trim()
        : null;
    const ticketType =
      typeof value.ticketType === "string" &&
      value.ticketType.trim().length > 0
        ? value.ticketType.trim()
        : null;
    const price = coerceNonNegativeNumber(value.price);
    const inclusions = sanitizeTicketInclusions(value.inclusions);
    const id =
      typeof value.id === "string" && value.id.trim().length > 0
        ? value.id.trim()
        : makeRandomId();
    return {
      id,
      ticketType,
      label,
      price,
      discountedPrice: null,
      description,
      inclusions: inclusions ?? undefined,
    } satisfies PartnerTicketDetail;
  });
  return mapped.filter(
    (entry): entry is PartnerTicketDetail => entry !== null
  );
}

function sanitizeTicketAddons(input?: unknown): PartnerTicketAddon[] {
  if (!Array.isArray(input)) return [];
  const mapped: Array<PartnerTicketAddon | null> = input.map((entry) => {
    if (!entry || typeof entry !== "object") return null;
    const value = entry as Record<string, unknown>;
    const label =
      typeof value.label === "string" && value.label.trim().length > 0
        ? value.label.trim()
        : null;
    if (!label) return null;
    const id =
      typeof value.id === "string" && value.id.trim().length > 0
        ? value.id.trim()
        : makeRandomId();
    const appliesToTicketType =
      typeof value.appliesToTicketType === "string" &&
      value.appliesToTicketType.trim().length > 0
        ? value.appliesToTicketType.trim()
        : null;
    const guestType =
      value.guestType === "adult" ||
      value.guestType === "child" ||
      value.guestType === "other"
        ? value.guestType
        : null;
    const price = coerceNonNegativeNumber(value.price);
    const maxPerBooking = coerceNonNegativeNumber(value.maxPerBooking);
    const description =
      typeof value.description === "string" ? value.description.trim() : "";
    return {
      id,
      label,
      appliesToTicketType,
      guestType,
      price,
      discountedPrice: null,
      maxPerBooking,
      description,
    } satisfies PartnerTicketAddon;
  });
  return mapped.filter(
    (entry): entry is PartnerTicketAddon => entry !== null
  );
}

function applyDiscountToItems<
  T extends { price: number | null; discountedPrice: number | null }
>(items: T[], discountRate: number): T[] {
  const normalizedRate =
    typeof discountRate === "number" && Number.isFinite(discountRate)
      ? Math.min(Math.max(discountRate, 0), 100)
      : 0;
  const multiplier = 1 - normalizedRate / 100;
  return items.map((item) => {
    const basePrice =
      typeof item.price === "number" && Number.isFinite(item.price)
        ? item.price
        : null;
    const discountedPrice =
      basePrice !== null
        ? Number((basePrice * multiplier).toFixed(2))
        : null;
    return {
      ...item,
      discountedPrice,
    };
  });
}

type StoredTicketDetail = Omit<PartnerTicketDetail, "discountedPrice">;
type StoredTicketAddon = Omit<PartnerTicketAddon, "discountedPrice">;

function serializeTicketDetailsForSave(
  details: PartnerTicketDetail[]
): StoredTicketDetail[] {
  return details.map((detail) => {
    const { discountedPrice, ...rest } = detail;
    void discountedPrice;
    const serialized: StoredTicketDetail = { ...rest };
    if (
      serialized.inclusions &&
      Object.values(serialized.inclusions).every(
        (value) => value === null || value === undefined
      )
    ) {
      delete serialized.inclusions;
    }
    return serialized;
  });
}

function serializeTicketAddonsForSave(
  addons: PartnerTicketAddon[]
): StoredTicketAddon[] {
  return addons.map((addon) => {
    const { discountedPrice, ...rest } = addon;
    void discountedPrice;
    return rest;
  });
}

function mergePartnerMeta(
  base: PartnerMeta,
  updates: PartnerMetaUpdateInput
): PartnerMeta {
  const merged: PartnerMeta = {
    ...base,
    contract: { ...base.contract },
    ticketing: {
      ...base.ticketing,
      ticketTypes: [...base.ticketing.ticketTypes],
      ticketDetails: base.ticketing.ticketDetails.map((detail) => ({
        ...detail,
        inclusions: detail.inclusions ? { ...detail.inclusions } : undefined,
      })),
      addons: base.ticketing.addons.map((addon) => ({ ...addon })),
    },
    info: {
      ...base.info,
      payments: [...base.info.payments],
      facilities: [...base.info.facilities],
      companyAddress: cloneAddress(base.info.companyAddress),
      businessAddress: cloneAddress(base.info.businessAddress),
    },
    media: { ...base.media },
  };

  if (typeof updates.displayName === "string") {
    merged.displayName = updates.displayName || base.displayName;
  }

  if (updates.status) {
    const normalized = normalizeStatusForDb(updates.status);
    if (normalized === "pending") merged.status = "pending";
    else if (normalized === "inactive") merged.status = "hidden";
    else merged.status = "active";
  }

  if (updates.type) {
    const parsedType = partnerTypeSchema.safeParse(updates.type);
    if (parsedType.success) {
      merged.type = parsedType.data;
    }
  }

  if (updates.transportationType !== undefined) {
    if (
      updates.transportationType === null ||
      typeof updates.transportationType === "string"
    ) {
      const parsedTransportation = updates.transportationType === null
        ? { success: true, data: null }
        : transportationTypeSchema.safeParse(updates.transportationType);
      if (parsedTransportation.success) {
        merged.transportationType =
          parsedTransportation.data ?? merged.transportationType ?? null;
      }
    }
  }

  if (updates.listingTierKey !== undefined) {
    if (
      typeof updates.listingTierKey === "string" &&
      updates.listingTierKey.trim().length > 0
    ) {
      merged.listingTierKey = updates.listingTierKey.trim();
    } else {
      merged.listingTierKey = null;
    }
  }

  if (updates.contract) {
    merged.contract = {
      ...merged.contract,
      ...updates.contract,
    };
    if (updates.contract?.monthlyFee !== undefined) {
      merged.contract.monthlyFee = updates.contract.monthlyFee;
    }
    if (updates.contract?.discountRate !== undefined) {
      merged.contract.discountRate = updates.contract.discountRate;
    }
    if (updates.contract?.commissionRate !== undefined) {
      merged.contract.commissionRate = updates.contract.commissionRate;
    }
    if (updates.contract?.commissionRateOriginal !== undefined) {
      merged.contract.commissionRateOriginal =
        updates.contract.commissionRateOriginal;
    }
    if (updates.contract?.commissionRateDiscounted !== undefined) {
      merged.contract.commissionRateDiscounted =
        updates.contract.commissionRateDiscounted;
    }
    if (updates.contract?.commissionBasis) {
      merged.contract.commissionBasis = updates.contract.commissionBasis;
    }
    if (updates.contract?.bonusPointsPerCzk !== undefined) {
      merged.contract.bonusPointsPerCzk = updates.contract.bonusPointsPerCzk;
    }
    if (typeof updates.contract?.listingOnly === "boolean") {
      merged.contract.listingOnly = updates.contract.listingOnly;
    }
    const shouldSyncCommissionRate =
      updates.contract?.commissionBasis !== undefined ||
      updates.contract?.commissionRateOriginal !== undefined ||
      updates.contract?.commissionRateDiscounted !== undefined;
    if (shouldSyncCommissionRate) {
      const basis = merged.contract.commissionBasis ?? "discounted";
      const derivedRate =
        basis === "original"
          ? merged.contract.commissionRateOriginal
          : merged.contract.commissionRateDiscounted;
      if (
        typeof derivedRate === "number" &&
        Number.isFinite(derivedRate)
      ) {
        merged.contract.commissionRate = derivedRate;
      }
    }
  }

  if (updates.ticketing) {
    merged.ticketing = {
      ...merged.ticketing,
    };
    if (updates.ticketing?.ticketTypes) {
      merged.ticketing.ticketTypes = mergeArrays(
        merged.ticketing.ticketTypes,
        updates.ticketing.ticketTypes
      );
    }
    if (updates.ticketing?.familyRule !== undefined) {
      merged.ticketing.familyRule =
        typeof updates.ticketing.familyRule === "string"
          ? updates.ticketing.familyRule
          : merged.ticketing.familyRule;
    }
    if (updates.ticketing?.ticketDetails) {
      merged.ticketing.ticketDetails = sanitizeTicketDetails(
        updates.ticketing.ticketDetails
      );
    }
    if (updates.ticketing?.addons) {
      merged.ticketing.addons = sanitizeTicketAddons(
        updates.ticketing.addons
      );
    }
    if (updates.ticketing?.maxGuestsPerBooking !== undefined) {
      const value = updates.ticketing.maxGuestsPerBooking;
      if (value === null) {
        merged.ticketing.maxGuestsPerBooking = null;
      } else if (typeof value === "number" && value >= 0) {
        merged.ticketing.maxGuestsPerBooking = value;
      }
    }
  }

  if (updates.info) {
    if (updates.info.payments) {
      merged.info.payments = mergeArrays(
        merged.info.payments,
        updates.info.payments
      );
    }
    if (updates.info.facilities) {
      merged.info.facilities = mergeArrays(
        merged.info.facilities,
        updates.info.facilities
      );
    }
    if (typeof updates.info.contactName === "string") {
      merged.info.contactName = updates.info.contactName;
    }
    if (typeof updates.info.contactEmail === "string") {
      merged.info.contactEmail = updates.info.contactEmail;
    }
    if (typeof updates.info.contactPhone === "string") {
      merged.info.contactPhone = updates.info.contactPhone;
    }
    if (typeof updates.info.website === "string") {
      merged.info.website = updates.info.website;
    }
    if (typeof updates.info.googleMapUrl === "string") {
      merged.info.googleMapUrl = updates.info.googleMapUrl;
    }
    if (typeof updates.info.googleMapEmbedUrl === "string") {
      merged.info.googleMapEmbedUrl = updates.info.googleMapEmbedUrl;
    }
    if (typeof updates.info.companyName === "string") {
      merged.info.companyName = updates.info.companyName;
    }
    if (typeof updates.info.businessName === "string") {
      merged.info.businessName = updates.info.businessName;
    }
    if (typeof updates.info.shortDescription === "string") {
      merged.info.shortDescription = updates.info.shortDescription;
    }
    if (typeof updates.info.companyIdNumber === "string") {
      merged.info.companyIdNumber = updates.info.companyIdNumber;
    }
    if (typeof updates.info.vatRegistered === "boolean") {
      merged.info.vatRegistered = updates.info.vatRegistered;
    }
    if (updates.info.vatRate !== undefined) {
      merged.info.vatRate = updates.info.vatRate;
    }
    if (updates.info.companyAddress) {
      merged.info.companyAddress = mergeAddress(
        merged.info.companyAddress,
        updates.info.companyAddress
      );
    } else {
      merged.info.companyAddress = cloneAddress(merged.info.companyAddress);
    }
    if (updates.info.businessAddress) {
      merged.info.businessAddress = mergeAddress(
        merged.info.businessAddress,
        updates.info.businessAddress
      );
    } else {
      merged.info.businessAddress = cloneAddress(merged.info.businessAddress);
    }
    if (updates.info.minAge !== undefined) {
      merged.info.minAge = updates.info.minAge;
    }
    if (updates.info.openingHours) {
      merged.info.openingHours = sanitizeOpeningHours(
        updates.info.openingHours
      );
    } else if (!updates.info.openingHours) {
      merged.info.openingHours = [...merged.info.openingHours];
    }
    if (typeof updates.info.publicTransport === "string") {
      merged.info.publicTransport = updates.info.publicTransport;
    }
    if (typeof updates.info.reservationRequired === "boolean") {
      merged.info.reservationRequired = updates.info.reservationRequired;
    }
    if (updates.info.cashCurrencies) {
      merged.info.cashCurrencies = sanitizeStringArray(
        updates.info.cashCurrencies
      );
    }
    if (typeof updates.info.hasToilet === "boolean") {
      merged.info.hasToilet = updates.info.hasToilet;
    }
    if (typeof updates.info.wheelchairAccessible === "boolean") {
      merged.info.wheelchairAccessible = updates.info.wheelchairAccessible;
    }
  }

  if (updates.media) {
    merged.media = {
      ...merged.media,
      ...updates.media,
    };
    if (updates.media.videoUrls) {
      merged.media.videoUrls = sanitizeStringArray(updates.media.videoUrls);
    }
  }

  if (typeof updates.bonusProgramEnabled === "boolean") {
    merged.bonusProgramEnabled = updates.bonusProgramEnabled;
  }

  if (updates.notes) {
    merged.notes = sanitizeNotes(updates.notes);
  }

  if (updates.tags) {
    merged.tags = sanitizeStringArray(updates.tags);
  }

  if (merged.type !== "transport") {
    merged.transportationType = null;
  } else if (!merged.transportationType) {
    merged.transportationType = "taxi";
  }

  merged.updatedAt = new Date().toISOString();
  return merged;
}

function mapRowToMeta(
  row: PartnerRow | null,
  partnerIdFallback: string
): PartnerMeta {
  if (!row) {
    return buildDefaultPartnerMeta(partnerIdFallback);
  }

  const base = buildDefaultPartnerMeta(row.id || partnerIdFallback);

  const contract = {
    ...base.contract,
    ...(row.contract ?? {}),
  } as PartnerMetaContract;
  const normalizedCommissionRate =
    typeof contract.commissionRate === "number" && Number.isFinite(contract.commissionRate)
      ? contract.commissionRate
      : base.contract.commissionRate;
  contract.commissionRateOriginal =
    typeof contract.commissionRateOriginal === "number" && Number.isFinite(contract.commissionRateOriginal)
      ? contract.commissionRateOriginal
      : normalizedCommissionRate;
  contract.commissionRateDiscounted =
    typeof contract.commissionRateDiscounted === "number" &&
    Number.isFinite(contract.commissionRateDiscounted)
      ? contract.commissionRateDiscounted
      : normalizedCommissionRate;
  contract.commissionRate = Number.isFinite(normalizedCommissionRate)
    ? normalizedCommissionRate
    : contract.commissionBasis === "original"
    ? contract.commissionRateOriginal
    : contract.commissionRateDiscounted;
  contract.bonusPointsPerCzk =
    typeof contract.bonusPointsPerCzk === "number"
      ? contract.bonusPointsPerCzk
      : 0;
  contract.listingOnly = Boolean(contract.listingOnly);

  const ticketing = {
    ...base.ticketing,
    ...(row.ticketing ?? {}),
  } as PartnerMetaTicketing;
  ticketing.ticketTypes = sanitizeStringArray(ticketing.ticketTypes);
  ticketing.ticketDetails = sanitizeTicketDetails(ticketing.ticketDetails);
  ticketing.maxGuestsPerBooking =
    typeof ticketing.maxGuestsPerBooking === "number" &&
    Number.isFinite(ticketing.maxGuestsPerBooking)
      ? ticketing.maxGuestsPerBooking
      : null;
  ticketing.addons = sanitizeTicketAddons(ticketing.addons);
  const discountRate =
    typeof contract.discountRate === "number" &&
    Number.isFinite(contract.discountRate)
      ? contract.discountRate
      : 0;
  ticketing.ticketDetails = applyDiscountToItems(
    ticketing.ticketDetails,
    discountRate
  );
  ticketing.addons = applyDiscountToItems(ticketing.addons, discountRate);

  const info = {
    ...base.info,
    ...(row.info ?? {}),
  } as PartnerMetaInfo & {
    companyAddress?: Partial<PartnerAddress>;
    businessAddress?: Partial<PartnerAddress>;
  };
  info.payments = sanitizeStringArray(info.payments);
  info.facilities = sanitizeStringArray(info.facilities);
  if (row.contact_email) {
    info.contactEmail = row.contact_email;
  }
  if (row.contact_name) {
    info.contactName = row.contact_name;
  }
  if (row.website) {
    info.website = row.website;
  }
  info.contactPhone = info.contactPhone ?? "";
  info.googleMapUrl = info.googleMapUrl ?? "";
  info.googleMapEmbedUrl = info.googleMapEmbedUrl ?? "";
  info.companyName = info.companyName ?? "";
  info.businessName = info.businessName ?? "";
  info.shortDescription = info.shortDescription ?? "";
  info.companyIdNumber = info.companyIdNumber ?? "";
  info.vatRegistered = Boolean(info.vatRegistered);
  info.vatRate = info.vatRate ?? 0;
  info.companyAddress = normalizeAddress(
    info.companyAddress,
    base.info.companyAddress
  );
  info.businessAddress = normalizeAddress(
    info.businessAddress,
    base.info.businessAddress
  );
  info.openingHours = sanitizeOpeningHours(info.openingHours);
  info.cashCurrencies = sanitizeStringArray(info.cashCurrencies);
  info.minAge = typeof info.minAge === "number" ? info.minAge : 0;
  info.publicTransport = info.publicTransport ?? "";
  info.reservationRequired = Boolean(info.reservationRequired);
  info.hasToilet = Boolean(info.hasToilet);
  info.wheelchairAccessible = Boolean(info.wheelchairAccessible);

  const media = {
    ...base.media,
    ...(row.media ?? {}),
  } as PartnerMetaMedia;
  media.videoUrls = sanitizeStringArray(media.videoUrls);

  const rawNotes = (() => {
    if (Array.isArray(row.notes)) return row.notes;
    if (typeof row.notes === "string" && row.notes.trim().startsWith("[")) {
      try {
        const parsed = JSON.parse(row.notes);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return [];
      }
    }
    return [];
  })();
  const notes = sanitizeNotes(rawNotes as PartnerNoteEntry[]);

  const parsedType = partnerTypeSchema.safeParse(row.type);
  const partnerType = parsedType.success ? parsedType.data : base.type;
  const parsedTransportationType = transportationTypeSchema.safeParse(
    row.transportation_type ?? undefined
  );
  const transportationType =
    partnerType === "transport"
      ? parsedTransportationType.success
        ? parsedTransportationType.data
        : "taxi"
      : null;

  return {
    partnerId: row.id,
    displayName: row.display_name ?? row.id,
    status: statusFromRow(row.status),
    type: partnerType,
    transportationType,
    contract,
    ticketing,
    info,
    media,
    bonusProgramEnabled: Boolean(
      row.bonus_program_enabled ?? base.bonusProgramEnabled
    ),
    notes,
    tags: sanitizeStringArray(row.tags ?? base.tags),
    listingTierKey:
      typeof row.listing_tier_key === "string"
        ? row.listing_tier_key
        : base.listingTierKey ?? null,
    createdAt: row.created_at ?? base.createdAt,
    updatedAt: row.updated_at ?? base.updatedAt,
  };
}

function metaToRow(meta: PartnerMeta): Partial<PartnerRow> & { id: string } {
  const rowStatus = normalizeStatusForDb(meta.status) ?? "active";
  const timestamp = new Date().toISOString();

  return {
    id: meta.partnerId,
    display_name: meta.displayName ?? meta.partnerId,
    status: rowStatus,
    type: meta.type,
    transportation_type:
      meta.type === "transport" ? meta.transportationType ?? "taxi" : null,
    contact_email: meta.info.contactEmail || null,
    contact_name: meta.info.contactName || null,
    tags: meta.tags,
    website: meta.info.website || null,
    listing_tier_key: meta.listingTierKey || null,
    contract: {
      monthlyFee: meta.contract.monthlyFee,
      discountRate: meta.contract.discountRate,
      commissionRate: meta.contract.commissionRate,
      commissionRateOriginal: meta.contract.commissionRateOriginal,
      commissionRateDiscounted: meta.contract.commissionRateDiscounted,
      commissionBasis: meta.contract.commissionBasis,
      bonusPointsPerCzk: meta.contract.bonusPointsPerCzk,
      listingOnly: Boolean(meta.contract.listingOnly),
    },
    ticketing: {
      ticketTypes: meta.ticketing.ticketTypes,
      familyRule: meta.ticketing.familyRule,
      ticketDetails: serializeTicketDetailsForSave(
        meta.ticketing.ticketDetails
      ),
      addons: serializeTicketAddonsForSave(meta.ticketing.addons),
      maxGuestsPerBooking: meta.ticketing.maxGuestsPerBooking,
    },
    info: {
      contactName: meta.info.contactName,
      contactEmail: meta.info.contactEmail,
      contactPhone: meta.info.contactPhone,
      payments: meta.info.payments,
      facilities: meta.info.facilities,
      website: meta.info.website,
      googleMapUrl: meta.info.googleMapUrl,
      googleMapEmbedUrl: meta.info.googleMapEmbedUrl,
      companyName: meta.info.companyName,
      businessName: meta.info.businessName,
      shortDescription: meta.info.shortDescription,
      vatRegistered: meta.info.vatRegistered,
      vatRate: meta.info.vatRate,
      companyIdNumber: meta.info.companyIdNumber,
    companyAddress: meta.info.companyAddress,
    businessAddress: meta.info.businessAddress,
    minAge: meta.info.minAge,
      openingHours: meta.info.openingHours,
      publicTransport: meta.info.publicTransport,
      reservationRequired: meta.info.reservationRequired,
      cashCurrencies: meta.info.cashCurrencies,
      hasToilet: meta.info.hasToilet,
      wheelchairAccessible: meta.info.wheelchairAccessible,
    },
    media: {
      logoUrl: meta.media.logoUrl,
      heroImageUrl: meta.media.heroImageUrl,
      contractAttachmentUrl: meta.media.contractAttachmentUrl,
      videoUrls: meta.media.videoUrls,
      qrAccentColor: meta.media.qrAccentColor,
      qrBadgeIconUrl: meta.media.qrBadgeIconUrl,
    },
    bonus_program_enabled: meta.bonusProgramEnabled,
    notes: meta.notes,
    updated_at: timestamp,
  };
}

async function fetchPartnerRow(partnerId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("partners")
    .select("*")
    .eq("id", partnerId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load partner: ${error.message}`);
  }

  return data ? (data as PartnerRow) : null;
}

export async function loadPartnerMeta(partnerId: string) {
  const normalized = normalizePartnerId(partnerId);
  if (!normalized) {
    throw new Error("partnerId is required");
  }

  const row = await fetchPartnerRow(normalized);
  return mapRowToMeta(row, normalized);
}

export interface ListPartnerMetaOptions {
  status?: string | null;
  search?: string | null;
}

function matchesSearch(meta: PartnerMeta, searchTerm?: string | null) {
  if (!searchTerm) return true;
  const needle = searchTerm.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    meta.partnerId,
    meta.displayName ?? "",
    meta.info.contactEmail,
    meta.info.contactName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

export async function listPartnerMetas(options: ListPartnerMetaOptions = {}) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("partners")
    .select("*")
    .order("created_at", { ascending: false });

  const normalizedStatus = normalizeStatusForDb(options.status ?? "");
  if (normalizedStatus) {
    query = query.eq("status", normalizedStatus);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to list partners: ${error.message}`);
  }

  const rows = (data ?? []) as PartnerRow[];
  const metas = rows.map((row) => mapRowToMeta(row, row.id));
  const filtered = metas.filter((meta) => matchesSearch(meta, options.search));
  filtered.sort((a, b) => a.partnerId.localeCompare(b.partnerId));
  return filtered;
}

export async function savePartnerMeta(
  partnerId: string,
  updates: PartnerMetaUpdateInput
) {
  const normalized = normalizePartnerId(partnerId);
  if (!normalized) {
    throw new Error("partnerId is required");
  }

  const existingRow = await fetchPartnerRow(normalized);
  const baseMeta = mapRowToMeta(existingRow, normalized);
  const mergedMeta = mergePartnerMeta(baseMeta, updates);
  const supabase = getSupabaseAdmin();

  const payload = metaToRow(mergedMeta);
  payload.id = normalized;

  const { data, error } = await supabase
    .from("partners")
    .upsert(
      payload as unknown as never,
      { onConflict: "id", ignoreDuplicates: false } as unknown as never
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save partner meta: ${error.message}`);
  }

  return mapRowToMeta((data as PartnerRow) ?? null, normalized);
}

export async function partnerExists(partnerId: string) {
  const supabase = getSupabaseAdmin();
  const normalized = normalizePartnerId(partnerId);
  if (!normalized) return false;
  const { data, error } = await supabase
    .from("partners")
    .select("id")
    .eq("id", normalized)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to check partner: ${error.message}`);
  }
  return Boolean(data);
}

interface PartnerRelationshipRow {
  id: number;
  parent_partner_id: string;
  child_partner_id: string;
  relationship: string;
  created_at: string | null;
}

export interface PartnerRelationship {
  parentPartnerId: string;
  childPartnerId: string;
  relationship: z.infer<typeof partnerRelationshipTypeSchema>;
  createdAt: string;
}

function mapRelationshipRow(row: PartnerRelationshipRow): PartnerRelationship {
  const parsed = partnerRelationshipTypeSchema.safeParse(row.relationship);
  const relationship = parsed.success ? parsed.data : "transport";
  return {
    parentPartnerId: row.parent_partner_id,
    childPartnerId: row.child_partner_id,
    relationship,
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

function normalizePartnerIds(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => normalizePartnerId(value))
        .filter((value): value is string => Boolean(value))
    )
  );
}

export async function getPartnerRelationshipsForChild(childPartnerId: string) {
  const supabase = getSupabaseAdmin();
  const normalizedChild = normalizePartnerId(childPartnerId);
  if (!normalizedChild) return [];
  const { data, error } = await supabase
    .from("partner_relationships")
    .select("*")
    .eq("child_partner_id", normalizedChild);
  if (error) {
    throw new Error(`Failed to load partner relationships: ${error.message}`);
  }
  return ((data ?? []) as PartnerRelationshipRow[]).map(mapRelationshipRow);
}

export async function getPartnerRelationshipsForParent(
  parentPartnerId: string
) {
  const supabase = getSupabaseAdmin();
  const normalizedParent = normalizePartnerId(parentPartnerId);
  if (!normalizedParent) return [];
  const { data, error } = await supabase
    .from("partner_relationships")
    .select("*")
    .eq("parent_partner_id", normalizedParent);
  if (error) {
    throw new Error(`Failed to load partner relationships: ${error.message}`);
  }
  return ((data ?? []) as PartnerRelationshipRow[]).map(mapRelationshipRow);
}

export async function setPartnerParentRelationships(
  childPartnerId: string,
  relationship: z.infer<typeof partnerRelationshipTypeSchema>,
  parentPartnerIds: string[]
) {
  const supabase = getSupabaseAdmin();
  const normalizedChild = normalizePartnerId(childPartnerId);
  if (!normalizedChild) {
    throw new Error("childPartnerId is required");
  }
  const normalizedParents = normalizePartnerIds(parentPartnerIds);
  const { data, error } = await supabase
    .from("partner_relationships")
    .select("id, parent_partner_id")
    .eq("child_partner_id", normalizedChild)
    .eq("relationship", relationship);
  if (error) {
    throw new Error(`Failed to load partner relationships: ${error.message}`);
  }

  const existing = (data ?? []) as Array<
    Pick<PartnerRelationshipRow, "id" | "parent_partner_id">
  >;
  const existingParentIds = new Set(
    existing.map((row) => row.parent_partner_id)
  );

  const idsToRemove = existing
    .filter((row) => !normalizedParents.includes(row.parent_partner_id))
    .map((row) => row.id);

  if (idsToRemove.length > 0) {
    const { error: deleteError } = await supabase
      .from("partner_relationships")
      .delete()
      .in("id", idsToRemove as unknown as string[]);
    if (deleteError) {
      throw new Error(
        `Failed to remove partner relationships: ${deleteError.message}`
      );
    }
  }

  const parentsToInsert = normalizedParents.filter(
    (parentId) => !existingParentIds.has(parentId)
  );

  if (parentsToInsert.length > 0) {
    const rowsToInsert = parentsToInsert.map((parentId) => ({
      parent_partner_id: parentId,
      child_partner_id: normalizedChild,
      relationship,
    }));
    const { error: insertError } = await supabase
      .from("partner_relationships")
      .insert(rowsToInsert as unknown as never);
    if (insertError) {
      throw new Error(
        `Failed to upsert partner relationships: ${insertError.message}`
      );
    }
  }

  return getPartnerRelationshipsForChild(normalizedChild);
}
