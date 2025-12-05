import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import {
  StaffVisitEditor,
  type TicketCatalogEntry,
} from "@/components/staff/staff-visit-editor";
import { StaffBonusRedemptionView } from "@/components/staff/bonus-redemption-view";
import { getVisitById } from "@/lib/data/visits";
import { getPartnerFormById, type PartnerFormConfig } from "@/lib/data/partner-forms";
import { loadPartnerMeta, type PartnerMeta } from "@/lib/data/partners";
import { verifyJwt } from "@/lib/auth/jwt";
import { getRedemptionByCode } from "@/lib/data/redemptions";
import { resolveLocale } from "@/i18n/config";
import { buildLocalizedPath } from "@/i18n/routing";

type StaffScanPageContext = {
  params: Promise<{ locale: string; visitId: string }>;
  searchParams: Promise<{ email?: string }>;
};

interface JwtPayload {
  role?: string;
  partnerId?: string;
  staffId?: string;
}

export default async function StaffScanPage({ params }: StaffScanPageContext) {
  const { visitId, locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  const loginPath = buildLocalizedPath("/staff/login", locale);
  const visit = await getVisitById(visitId);
  if (!visit) {
    notFound();
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("zabava_token")?.value ?? "";

  if (!token) {
    redirect(loginPath);
  }

  let payload: JwtPayload | null = null;
  try {
    payload = verifyJwt<JwtPayload>(token);
  } catch {
    redirect(loginPath);
  }

  if (!payload || (payload.role !== "staff" && payload.role !== "admin")) {
    redirect(loginPath);
  }

  if (
    payload.role === "staff" &&
    payload.partnerId &&
    visit.partner_id &&
    payload.partnerId.toLowerCase() !== visit.partner_id.toLowerCase()
  ) {
    notFound();
  }

  if (visit.status === "visited" || visit.visited_at) {
    notFound();
  }

  if ((visit as { qr_type?: string }).qr_type === "bonus") {
    const redemption = visit.redemption_code
      ? await getRedemptionByCode(visit.redemption_code).catch(() => null)
      : null;
    if (
      redemption &&
      ["used", "rejected"].includes((redemption.status ?? "").toLowerCase())
    ) {
      notFound();
    }
    return (
      <main className="theme-vercel min-h-screen bg-background px-4 pb-16 pt-10 text-foreground sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
          <section className="space-y-2">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Bonus redemption
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              {visit.email}
            </h1>
            <p className="text-sm text-muted-foreground">
              Review the bonus form submission and confirm the redemption below.
            </p>
          </section>

          <StaffBonusRedemptionView visit={visit} redemption={redemption} />
        </div>
      </main>
    );
  }

  let partnerMeta: PartnerMeta | null = null;
  if (visit.partner_id) {
    partnerMeta = await loadPartnerMeta(visit.partner_id).catch(() => null);
  }

  const options = await deriveStaffVisitOptions(visit.payload ?? {}, partnerMeta);

  return (
    <main className="theme-vercel min-h-screen bg-background px-4 pb-16 pt-10 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <section className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Visit scan
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {visit.email}
          </h1>
          <p className="text-sm text-muted-foreground">
            Review details, make adjustments, and confirm the visit. All updates
            are logged under your staff account.
          </p>
        </section>

        <StaffVisitEditor
          initialVisit={visit}
          partnerId={visit.partner_id ?? payload.partnerId ?? ""}
          formOptions={options}
        />
      </div>
    </main>
  );
}

async function deriveStaffVisitOptions(
  payload: Record<string, unknown>,
  partnerMeta: PartnerMeta | null,
) {
  const formId = typeof payload.formId === "string" ? payload.formId : null;
  let config: PartnerFormConfig | null = null;

  if (formId) {
    const formRecord = await getPartnerFormById(formId).catch(() => null);
    if (formRecord) {
      config = formRecord.config;
    }
  }

  const partnerTicketCatalog = buildPartnerTicketCatalog(partnerMeta);
  const formTicketCatalog = partnerTicketCatalog.length === 0 ? buildFormTicketCatalog(config) : [];

  const partnerCurrency =
    partnerMeta?.info?.cashCurrencies?.find(
      (value) => typeof value === "string" && value.trim().length > 0,
    ) ?? undefined;
  const currency = config?.pricing?.currency ?? partnerCurrency;

  if (
    partnerTicketCatalog.length === 0 &&
    formTicketCatalog.length === 0 &&
    !currency
  ) {
    return undefined;
  }

  return {
    ticketCatalog: partnerTicketCatalog.length > 0 ? partnerTicketCatalog : undefined,
    fallbackTicketTypeOptions:
      partnerTicketCatalog.length === 0 && formTicketCatalog.length > 0
        ? formTicketCatalog.map((entry) => ({
            value: entry.value,
            label: entry.label,
            price: entry.discountedPrice ?? entry.price ?? null,
          }))
        : undefined,
    currency,
  } as const;
}

function buildPartnerTicketCatalog(partnerMeta: PartnerMeta | null) {
  if (!partnerMeta) return [] as TicketCatalogEntry[];

  const detailEntries: TicketCatalogEntry[] = (partnerMeta.ticketing?.ticketDetails ?? [])
    .map((detail) => {
      const rawValue =
        typeof detail.ticketType === "string" && detail.ticketType.trim().length > 0
          ? detail.ticketType.trim()
          : detail.label?.trim() || detail.id;
      if (!rawValue) return null;
      return {
        value: rawValue,
        label: detail.label?.trim() || detail.ticketType || rawValue,
        price:
          typeof detail.price === "number" && Number.isFinite(detail.price)
            ? detail.price
            : null,
        discountedPrice:
          typeof detail.discountedPrice === "number" && Number.isFinite(detail.discountedPrice)
            ? detail.discountedPrice
            : typeof detail.price === "number" && Number.isFinite(detail.price)
            ? detail.price
            : null,
      } satisfies TicketCatalogEntry;
    })
    .filter((entry): entry is TicketCatalogEntry => Boolean(entry));
  return detailEntries;
}

function buildFormTicketCatalog(config: PartnerFormConfig | null) {
  if (!config?.pricing?.ticketPricing) return [] as TicketCatalogEntry[];
  return config.pricing.ticketPricing
    .map((option) => {
      const value = typeof option.value === "string" ? option.value.trim() : "";
      if (!value) return null;
      return {
        value,
        label: option.label ?? option.value,
        price:
          typeof option.price === "number" && Number.isFinite(option.price)
            ? option.price
            : null,
        discountedPrice:
          typeof option.price === "number" && Number.isFinite(option.price)
            ? option.price
            : null,
      } satisfies TicketCatalogEntry;
    })
    .filter((entry): entry is TicketCatalogEntry => Boolean(entry));
}

