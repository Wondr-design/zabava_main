import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import type { PartnerAddress, PartnerTicketDetail } from "@/lib/data/partners";
import { getPartnerBySlug } from "@/lib/data/site-directory";
import { ensureExternalUrl, formatCategoryLabel } from "@/lib/utils/url";
import { LocalizedLink } from "@/components/ui/localized-link";
import { SiteNav } from "@/site/components/site-nav";
import { PartnerGallery } from "@/site/partners/partner-gallery";

type PartnerPageContext = {
  params: Promise<{ slug: string }>;
};

type ContentSection = {
  id: string;
  type: "heading" | "paragraph" | "image" | "list";
  value: string;
  subValue?: string;
};

const currencyFormatter = new Intl.NumberFormat("cs-CZ", {
  style: "currency",
  currency: "CZK",
  maximumFractionDigits: 0,
});

const paymentLabelMap: Record<string, string> = {
  cash: "Cash",
  cash_only: "Cash only",
  card: "Visa / MasterCard",
  visa_master: "Visa / MasterCard",
  qr: "QR payments",
};

const facilityLabelMap: Record<string, string> = {
  parking: "Parking",
  wifi: "Wi-Fi",
  cafe: "Cafe on site",
  locker: "Lockers",
  guide: "Guided tours",
};

function formatCurrency(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return null;
  }
  return currencyFormatter.format(value);
}

function parseContentSections(raw: unknown): ContentSection[] {
  if (!Array.isArray(raw)) return [];
  const sections: ContentSection[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const section = entry as Record<string, unknown>;
    const typeValue =
      typeof section.type === "string" ? section.type : "paragraph";
    const value = typeof section.value === "string" ? section.value.trim() : "";
    const subValue =
      typeof section.subValue === "string"
        ? section.subValue.trim()
        : undefined;
    if (!value) continue;
    const type: ContentSection["type"] = [
      "heading",
      "paragraph",
      "image",
      "list",
    ].includes(typeValue)
      ? (typeValue as ContentSection["type"])
      : "paragraph";
    sections.push({
      id:
        typeof section.id === "string" && section.id
          ? section.id
          : crypto.randomUUID(),
      type,
      value,
      subValue,
    });
  }
  return sections;
}

function resolveBusinessAddress(
  business?: PartnerAddress,
  company?: PartnerAddress
) {
  if (!business) return company ?? null;
  if (business.sameAsCompany && company) return company;
  const hasDetails =
    (business.addressLine && business.addressLine.trim().length > 0) ||
    (business.city && business.city.trim().length > 0);
  if (hasDetails) return business;
  return company ?? null;
}

function formatAddress(address?: PartnerAddress | null) {
  if (!address) return "";
  return [address.addressLine, address.city]
    .map((value) => (value ?? "").trim())
    .filter((value) => value.length > 0)
    .join(", ");
}

function formatTimeDisplay(value: string) {
  if (!value) return "";
  const trimmed = value.trim();
  if (/am|pm/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  const [hourStr, minute] = trimmed.split(":");
  const hours = Number(hourStr);
  if (Number.isNaN(hours)) return "";
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${minute} ${period}`;
}

function toTitleCase(value: string) {
  if (!value) return "";
  return value
    .split(/[\s_-]+/)
    .map(
      (segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase()
    )
    .join(" ");
}

function buildMapEmbedUrl(mapUrl?: string | null, fallback?: string | null) {
  if (mapUrl) {
    try {
      const parsed = new URL(mapUrl);
      if (!parsed.searchParams.get("output")) {
        parsed.searchParams.set("output", "embed");
      }
      return parsed.toString();
    } catch {
      // ignore invalid URLs and continue with fallback
    }
  }
  if (fallback) {
    return `https://www.google.com/maps?q=${encodeURIComponent(fallback)}&output=embed`;
  }
  return null;
}

function formatTicketInclusions(ticket: PartnerTicketDetail) {
  if (!ticket.inclusions) return "";
  const parts: string[] = [];
  const { adults, children, teens } = ticket.inclusions;
  if (typeof adults === "number" && adults > 0) {
    parts.push(`${adults} adult${adults > 1 ? "s" : ""}`);
  }
  if (typeof children === "number" && children > 0) {
    parts.push(`${children} child${children > 1 ? "ren" : ""}`);
  }
  if (typeof teens === "number" && teens > 0) {
    parts.push(`${teens} teen${teens > 1 ? "s" : ""}`);
  }
  return parts.join(", ");
}

function buildDiscountMessage(
  discountRate: number,
  tickets: PartnerTicketDetail[]
) {
  const explicitDiscount =
    typeof discountRate === "number" && discountRate > 0
      ? Math.round(discountRate)
      : 0;
  if (explicitDiscount > 0) {
    return `Save ${explicitDiscount}% when you book through Zabava.`;
  }
  const hasDiscountedTicket = tickets.some(
    (ticket) =>
      typeof ticket.price === "number" &&
      typeof ticket.discountedPrice === "number" &&
      ticket.discountedPrice < ticket.price
  );
  if (hasDiscountedTicket) {
    return "Exclusive online prices available for this partner.";
  }
  return "Online reservations unlock the best available price.";
}

function getTicketLabel(ticket: PartnerTicketDetail) {
  return (
    ticket.label?.trim() ??
    (ticket.ticketType ? toTitleCase(ticket.ticketType) : "Ticket")
  );
}

function getTicketDescription(ticket: PartnerTicketDetail) {
  const description = ticket.description?.trim();
  if (description) return description;
  return "Detailed information will be provided in your confirmation.";
}

function normalizeVideoUrl(url: string) {
  return typeof url === "string" ? url.trim() : "";
}

function getVideoEmbed(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host.includes("youtu.be")) {
      const id = parsed.pathname.replace("/", "");
      if (id) {
        return { type: "iframe" as const, url: `https://www.youtube.com/embed/${id}` };
      }
    }
    if (host.includes("youtube.com")) {
      const id =
        parsed.searchParams.get("v") ??
        parsed.pathname.split("/").filter(Boolean).pop();
      if (id) {
        return { type: "iframe" as const, url: `https://www.youtube.com/embed/${id}` };
      }
    }
    if (host.includes("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      if (id) {
        return { type: "iframe" as const, url: `https://player.vimeo.com/video/${id}` };
      }
    }
  } catch {
    // fall back to rendering as a standard video element
  }
  return { type: "video" as const, url };
}

export async function generateMetadata({
  params,
}: PartnerPageContext): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPartnerBySlug(slug);
  if (!result) return {};
  const { partner } = result;
  const description =
    partner.info.shortDescription ?? partner.description ?? undefined;
  return {
    title: `${partner.name} · Zabava`,
    description,
  };
}

export default async function PartnerPage({ params }: PartnerPageContext) {
  const { slug } = await params;
  const result = await getPartnerBySlug(slug);
  if (!result) {
    notFound();
  }

  const { partner } = result;
  const sections = parseContentSections(
    (partner.metadata as Record<string, unknown>)?.contentSections
  );

  const {
    info,
    contract,
    ticketDetails,
    ticketAddons = [],
    media,
    bonusProgramEnabled,
  } = partner;
  const description = info.shortDescription ?? partner.description;
  const businessAddress = resolveBusinessAddress(
    info.businessAddress,
    info.companyAddress
  );
  const fullAddress =
    formatAddress(businessAddress) || formatAddress(info.companyAddress) || "";
  const mapEmbedUrl =
    info.googleMapEmbedUrl && info.googleMapEmbedUrl.trim().length > 0
      ? info.googleMapEmbedUrl.trim()
      : buildMapEmbedUrl(info.googleMapUrl, fullAddress);
  const bookingCap = partner.ticketing?.maxGuestsPerBooking ?? null;
  const visitorRange = bookingCap
    ? `Up to ${bookingCap} guests`
    : "Flexible group sizes";
  const minAgeLabel = info.minAge > 0 ? `${info.minAge}+ years` : "All ages welcome";
  const vatLabel = info.vatRegistered
    ? info.vatRate > 0
      ? `Yes (${info.vatRate}%)`
      : "Yes"
    : "No";
  const paymentOptions = info.payments.length ? info.payments : ["cash_only"];
  const cashCurrencies = info.cashCurrencies.length
    ? info.cashCurrencies
    : ["CZK"];
  const facilities = info.facilities ?? [];
  const videoUrls = (media.videoUrls ?? [])
    .map(normalizeVideoUrl)
    .filter((url) => url.length > 0);
  const discountMessage = buildDiscountMessage(
    contract.discountRate,
    ticketDetails
  );

  const googleMapFallback =
    fullAddress
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          fullAddress
        )}`
      : null;
  const googleMapLink =
    ensureExternalUrl(info.googleMapUrl) || googleMapFallback;
  const rawWebsiteUrl = info.website || partner.detailUrl;
  const websiteHref = ensureExternalUrl(rawWebsiteUrl);

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 text-white">
      <SiteNav />
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(99,102,241,0.25),transparent_60%)]" />
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pb-20 pt-24 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-3 text-sm text-indigo-200">
            <LocalizedLink
              href="/"
              className="rounded-full border border-white/15 px-4 py-1 transition hover:border-indigo-300 hover:text-white"
            >
              ← Back to home
            </LocalizedLink>
            {partner.categories.map((category) => (
              <LocalizedLink
                key={category.id}
                href={`/categories/${category.slug}`}
                className="rounded-full border border-white/15 px-4 py-1 transition hover:border-indigo-300 hover:text-white"
              >
                {formatCategoryLabel(category.name)}
              </LocalizedLink>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[2fr,3fr] lg:items-center">
            <div className="space-y-6">
              <div className="flex flex-wrap gap-6">
                {media.logoUrl ? (
                  <div className="flex h-24 w-24 items-center justify-center rounded-3xl border border-white/15 bg-white/5 p-2 shadow-lg shadow-black/30">
                    <Image
                      src={media.logoUrl}
                      alt={`${partner.name} logo`}
                      width={96}
                      height={96}
                      className="h-full w-full rounded-2xl object-cover"
                      priority
                    />
                  </div>
                ) : null}
                <div className="flex-1 space-y-2">
                  {info.businessName ? (
                    <p className="text-sm uppercase tracking-widest text-indigo-200/80">
                      {info.businessName}
                    </p>
                  ) : null}
                  <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                    {partner.name}
                  </h1>
                  {description ? (
                    <p className="text-lg text-slate-200">{description}</p>
                  ) : null}
                </div>
              </div>

              {partner.highlights.length ? (
                <ul className="space-y-3">
                  {partner.highlights.map((highlight) => (
                    <li
                      key={highlight.id}
                      className="flex items-start gap-3 rounded-2xl bg-white/5 p-4"
                    >
                      <span className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-indigo-400 shadow-[0_0_0_6px_rgba(99,102,241,0.15)]" />
                      <div className="space-y-1 text-sm text-slate-200">
                        <h2 className="text-base font-semibold text-white">
                          {highlight.title}
                        </h2>
                        {highlight.description ? (
                          <p className="text-sm text-slate-300">
                            {highlight.description}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="grid grid-cols-1 gap-3 text-sm text-slate-200 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-indigo-200">
                    Full address
                  </p>
                  <p className="text-base text-white">
                    {fullAddress || "Shared in confirmation"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-indigo-200">
                    Visitors per booking
                  </p>
                  <p className="text-base text-white">{visitorRange}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-indigo-200">
                    Minimum age
                  </p>
                  <p className="text-base text-white">{minAgeLabel}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-indigo-200">
                    VAT included
                  </p>
                  <p className="text-base text-white">{vatLabel}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
                <LocalizedLink
                  href={`/partners/${partner.slug}/book`}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-400"
                >
                  <span>Reserve & unlock discount</span>
                </LocalizedLink>
                {websiteHref ? (
                  <a
                    href={websiteHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:border-indigo-300 hover:text-white"
                  >
                    <span>Visit partner website</span>
                  </a>
                ) : null}
              </div>
            </div>

            <PartnerGallery
              items={partner.gallery}
              fallbackImage={partner.heroImageUrl}
              fallbackAlt={partner.name}
            />
          </div>
        </div>
      </section>

      <section className="border-t border-white/5 bg-slate-950/90 py-16">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 sm:px-6 lg:px-8">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">
              Essential Information
            </h2>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-lg font-semibold text-white">About</h3>
                <dl className="mt-4 space-y-3 text-sm text-slate-200">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-indigo-200">
                      Attraction name
                    </dt>
                    <dd className="text-base text-white">{partner.name}</dd>
                  </div>
                  {fullAddress ? (
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-indigo-200">
                        Address
                      </dt>
                      <dd className="text-base text-white">{fullAddress}</dd>
                    </div>
                  ) : null}
                  {info.companyName ? (
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-indigo-200">
                        Company name
                      </dt>
                      <dd className="text-base text-white">
                        {info.companyName}
                      </dd>
                    </div>
                  ) : null}
                  {info.shortDescription ? (
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-indigo-200">
                        About the experience
                      </dt>
                      <dd className="text-base text-slate-200">
                        {info.shortDescription}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-lg font-semibold text-white">Working hours</h3>
                {info.openingHours.length ? (
                  <dl className="mt-4 space-y-2 text-sm text-slate-200">
                    {info.openingHours.map((entry) => (
                      <div
                        key={`${entry.day}-${entry.hours}`}
                        className="flex items-center justify-between rounded-2xl border border-white/5 bg-slate-950/30 px-3 py-2"
                      >
                        <dt className="font-medium text-white">{entry.day}</dt>
                        <dd>
                          {entry.hours
                            .split(/–|-/)
                            .map((token) => formatTimeDisplay(token.trim()))
                            .filter(Boolean)
                            .join(" – ")}
                        </dd>
                     </div>
                   ))}
                  </dl>
                ) : (
                  <p className="mt-3 text-sm text-slate-300">
                    Working hours will be shared in your confirmation.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">
              Pricing & Payments
            </h2>
            <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-lg font-semibold text-white">
                    Ticket types & prices
                  </h3>
                  <p className="text-sm text-indigo-200">{discountMessage}</p>
                </div>
                {ticketDetails.length ? (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
                    <table className="min-w-full divide-y divide-white/10 text-sm">
                      <thead className="bg-white/5 text-xs uppercase tracking-wide text-indigo-200">
                        <tr>
                          <th className="px-4 py-3 text-left">Ticket</th>
                          <th className="px-4 py-3 text-left">Description</th>
                          <th className="px-4 py-3 text-right">Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-slate-200">
                        {ticketDetails.map((ticket, index) => {
                          const label = getTicketLabel(ticket);
                          const descriptionText = getTicketDescription(ticket);
                          const inclusionText = formatTicketInclusions(ticket);
                          const basePrice = formatCurrency(ticket.price);
                          const discountedPrice = formatCurrency(
                            ticket.discountedPrice
                          );
                          const showDiscount =
                            basePrice &&
                            discountedPrice &&
                            discountedPrice !== basePrice;
                          return (
                            <tr key={`${label}-${index}`}>
                              <td className="px-4 py-3 font-semibold text-white">
                                {label}
                              </td>
                              <td className="px-4 py-3">
                                <p>{descriptionText}</p>
                                {inclusionText ? (
                                  <p className="mt-1 text-xs text-slate-400">
                                    Includes {inclusionText}
                                  </p>
                                ) : null}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {discountedPrice ? (
                                  <div className="flex flex-col items-end">
                                    <span className="text-base font-semibold text-white">
                                      {discountedPrice}
                                    </span>
                                    {showDiscount && basePrice ? (
                                      <span className="text-xs text-slate-400 line-through">
                                        {basePrice}
                                      </span>
                                    ) : null}
                                  </div>
                                ) : (
                                  <span className="text-sm text-slate-300">
                                    {basePrice ?? "Contact for price"}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <p className="border-t border-white/10 bg-slate-950/40 px-4 py-3 text-xs text-slate-300">
                      Prices shown are valid when booking via Zabava and include any
                      applicable online discounts.
                    </p>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-300">
                    Ticket pricing is tailored per booking. Request a reservation to
                    receive the latest offer.
                  </p>
                )}
                {ticketAddons.length ? (
                  <div className="mt-6 space-y-3">
                    <h3 className="text-base font-semibold text-white">
                      Add-ons & extras
                    </h3>
                    <ul className="space-y-2 text-sm text-slate-200">
                      {ticketAddons.map((addon) => {
                        const basePrice = formatCurrency(addon.price);
                        const discounted = formatCurrency(addon.discountedPrice);
                        const showDiscount =
                          basePrice &&
                          discounted &&
                          discounted !== basePrice;
                        return (
                          <li
                            key={addon.id}
                            className="rounded-2xl border border-white/10 bg-slate-950/30 px-3 py-2"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="font-semibold text-white">
                                  {addon.label}
                                </p>
                                {addon.description ? (
                                  <p className="text-xs text-slate-400">
                                    {addon.description}
                                  </p>
                                ) : null}
                              </div>
                              <div className="text-right">
                                {discounted ? (
                                  <>
                                    <p className="font-semibold text-white">
                                      {discounted}
                                    </p>
                                    {showDiscount && basePrice ? (
                                      <p className="text-xs text-slate-400 line-through">
                                        {basePrice}
                                      </p>
                                    ) : null}
                                  </>
                                ) : (
                                  <p className="text-sm text-slate-300">
                                    {basePrice ?? "Included"}
                                  </p>
                                )}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </div>
              <div className="space-y-6">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <h3 className="text-base font-semibold text-white">
                    Accepted payments
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {paymentOptions.map((method) => (
                      <span
                        key={method}
                        className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1 text-xs font-medium uppercase tracking-wide text-indigo-100"
                      >
                        {paymentLabelMap[method] ?? toTitleCase(method)}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-slate-200">
                    <p className="text-xs uppercase tracking-wide text-indigo-200">
                      Cash currencies
                    </p>
                    <p className="text-base text-white">
                      {cashCurrencies.map((currency) => currency.toUpperCase()).join(", ")}
                    </p>
                  </div>
                  <div className="mt-4 space-y-1 text-sm text-slate-200">
                    <p className="text-xs uppercase tracking-wide text-indigo-200">
                      VAT included
                    </p>
                    <p className="text-base text-white">{vatLabel}</p>
                  </div>
                  <div className="mt-4 space-y-1 text-sm text-slate-200">
                    <p className="text-xs uppercase tracking-wide text-indigo-200">
                      Bonus program
                    </p>
                    <p className="text-base text-white">
                      {bonusProgramEnabled
                        ? contract.bonusPointsPerCzk > 0
                          ? `Earn ${contract.bonusPointsPerCzk} pts / CZK spent`
                          : "Eligible for Zabava bonus points"
                        : "Not eligible"}
                    </p>
                  </div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <h3 className="text-base font-semibold text-white">
                    Booking preferences
                  </h3>
                  <dl className="mt-3 space-y-3 text-sm text-slate-200">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-indigo-200">
                        Reservation required?
                      </dt>
                      <dd className="text-base text-white">
                        {info.reservationRequired
                          ? "Yes, please reserve in advance"
                          : "Walk-ins welcome"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-indigo-200">
                        Family / group rules
                      </dt>
                      <dd className="text-base text-white">
                        {partner.ticketing.familyRule ||
                          "Family ticket details available on request."}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">
              Location, Access & Contact
            </h2>
            <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-lg font-semibold text-white">Map & access</h3>
                <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40">
                  {mapEmbedUrl ? (
                    <iframe
                      src={mapEmbedUrl}
                      title={`${partner.name} map`}
                      className="h-72 w-full"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      allowFullScreen
                    />
                  ) : (
                    <div className="flex h-72 w-full items-center justify-center text-sm text-slate-300">
                      Map preview will be available soon.
                    </div>
                  )}
                </div>
                <div className="mt-4 space-y-3 text-sm text-slate-200">
                  {googleMapLink ? (
                    <Link
                      href={googleMapLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-indigo-200 underline-offset-2 hover:text-white hover:underline"
                    >
                      Open in Google Maps →
                    </Link>
                  ) : null}
                  <div>
                    <p className="text-xs uppercase tracking-wide text-indigo-200">
                      Public transport
                    </p>
                    <p className="text-base text-white">
                      {info.publicTransport || "Details shared with your ticket."}
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <h3 className="text-base font-semibold text-white">Contact</h3>
                  <dl className="mt-3 space-y-3 text-sm text-slate-200">
                    {info.contactName ? (
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-indigo-200">
                          Contact person
                        </dt>
                        <dd className="text-base text-white">
                          {info.contactName}
                        </dd>
                      </div>
                    ) : null}
                    {info.contactPhone ? (
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-indigo-200">
                          Phone
                        </dt>
                        <dd className="text-base text-white">
                          <Link
                            href={`tel:${info.contactPhone}`}
                            className="hover:text-indigo-200"
                          >
                            {info.contactPhone}
                          </Link>
                        </dd>
                      </div>
                    ) : null}
                    {info.contactEmail ? (
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-indigo-200">
                          Email
                        </dt>
                        <dd className="text-base text-white">
                          <Link
                            href={`mailto:${info.contactEmail}`}
                            className="hover:text-indigo-200"
                          >
                            {info.contactEmail}
                          </Link>
                        </dd>
                      </div>
                    ) : null}
                    {websiteHref ? (
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-indigo-200">
                          Website
                        </dt>
                        <dd className="text-base text-white">
                          <Link
                            href={websiteHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-indigo-200"
                          >
                            {websiteHref.replace(/^[a-z]+:\/\/\/?/i, "")}
                          </Link>
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <h3 className="text-base font-semibold text-white">
                    Facilities & accessibility
                  </h3>
                  <div className="mt-3 space-y-3 text-sm text-slate-200">
                    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-2">
                      <span>WC available on site</span>
                      <span className="font-semibold text-white">
                        {info.hasToilet ? "Yes" : "No"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-2">
                      <span>Wheelchair accessible</span>
                      <span className="font-semibold text-white">
                        {info.wheelchairAccessible ? "Yes" : "No"}
                      </span>
                    </div>
                    {facilities.length ? (
                      <div>
                        <p className="text-xs uppercase tracking-wide text-indigo-200">
                          Additional facilities
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {facilities.map((facility) => (
                            <span
                              key={facility}
                              className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1 text-xs font-medium uppercase tracking-wide text-indigo-100"
                            >
                              {facilityLabelMap[facility] ?? toTitleCase(facility)}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">
              Media & Highlights
            </h2>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-lg font-semibold text-white">Images</h3>
                <p className="mt-2 text-sm text-slate-300">
                  The gallery above contains the latest photos supplied by the partner.
                  Images are automatically resized for optimal viewing.
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-lg font-semibold text-white">Videos</h3>
                {videoUrls.length ? (
                  <div className="mt-4 grid gap-4">
                    {videoUrls.map((url, index) => {
                      const embed = getVideoEmbed(url);
                      return (
                        <div
                          key={`${url}-${index}`}
                          className="overflow-hidden rounded-2xl border border-white/10 bg-black/40"
                        >
                          {embed.type === "iframe" ? (
                            <iframe
                              src={embed.url}
                              className="h-56 w-full"
                              title={`Video ${index + 1}`}
                              loading="lazy"
                              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          ) : (
                            <video
                              controls
                              src={embed.url}
                              className="h-56 w-full object-cover"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-300">
                    Videos will appear here as soon as the partner uploads them.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {sections.length > 0 ? (
        <section className="border-t border-white/8 bg-slate-950/80 py-16">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 sm:px-6 lg:px-8">
            {sections.map((section) => {
              switch (section.type) {
                case "heading":
                  return (
                    <h2
                      key={section.id}
                      className="text-3xl font-semibold text-white"
                    >
                      {section.value}
                    </h2>
                  );
                case "paragraph":
                  return (
                    <p
                      key={section.id}
                      className="text-base leading-relaxed text-slate-200"
                    >
                      {section.value}
                    </p>
                  );
                case "list":
                  return (
                    <ul
                      key={section.id}
                      className="list-disc space-y-2 pl-6 text-base text-slate-200"
                    >
                      {section.value
                        .split(/\r?\n/)
                        .map((line) => line.trim())
                        .filter(Boolean)
                        .map((line, idx) => (
                          <li key={`${section.id}-${idx}`}>{line}</li>
                        ))}
                    </ul>
                  );
                case "image":
                  return (
                    <figure
                      key={section.id}
                      className="overflow-hidden rounded-3xl border border-white/10"
                    >
                      <Image
                        src={section.value}
                        alt={section.subValue ?? partner.name}
                        width={1600}
                        height={900}
                        className="h-auto w-full object-cover"
                      />
                      {section.subValue ? (
                        <figcaption className="bg-slate-900/70 px-4 py-2 text-sm text-slate-300">
                          {section.subValue}
                        </figcaption>
                      ) : null}
                    </figure>
                  );
                default:
                  return null;
              }
            })}
          </div>
        </section>
      ) : null}

      {partner.ctaPrimaryUrl ? (
        <section className="border-t border-white/5 bg-slate-950/90 py-16">
          <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-2xl font-semibold text-white">
              {partner.ctaPrimaryLabel ?? "Ready to visit?"}
            </h2>
            <Link
              href={partner.ctaPrimaryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-indigo-300/70 px-5 py-2.5 text-sm font-medium text-indigo-100 transition hover:border-indigo-200 hover:text-white"
            >
              <span>Visit partner site</span>
            </Link>
          </div>
        </section>
      ) : null}
    </main>
  );
}
