import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { LocalizedLink } from "@/components/ui/localized-link";
import {
  listPublicDeals,
  type DealType,
  type PublicDealSummary,
} from "@/lib/data/flash-deals";
import { CmsRenderer } from "@/components/cms/cms-renderer";
import { getPublishedCmsPage } from "@/lib/data/cms";
import { getDefaultCmsPage } from "@/lib/cms-defaults";
import type { CmsRenderableBlock } from "@/lib/data/cms";
import { resolveLocale, type Locale } from "@/i18n/config";

const DEAL_TYPE_LABELS: Record<DealType, string> = {
  flash: "Flash deal",
  weekly_promo: "Weekly promo",
  group: "Group deal",
};

const DEAL_TYPES: DealType[] = ["flash", "weekly_promo", "group"];

type SearchParams = Record<string, string | string[] | undefined>;

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<SearchParams>;
};

function getSingleParam(
  value: string | string[] | undefined
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value ?? undefined;
}

function formatDealTypeLabel(dealType: DealType) {
  return DEAL_TYPE_LABELS[dealType] ?? dealType.replace("_", " ");
}

function formatValidity(validFrom: string | null, validTo: string | null) {
  const format = (value: string | null) => {
    if (!value) return null;
    try {
      return new Date(value).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return value;
    }
  };
  const from = format(validFrom);
  const to = format(validTo);
  if (from && to) return `${from} → ${to}`;
  if (to) return `Valid until ${to}`;
  if (from) return `Available from ${from}`;
  return "Flexible schedule";
}

function buildDetailHref(deal: PublicDealSummary) {
  if (deal.slug) return `/special-flash-deals/${deal.slug}`;
  return `/special-flash-deals?deal=${deal.id}`;
}

export default async function SpecialFlashDealsPage({
  params,
  searchParams,
}: PageProps) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  const query = (await searchParams) ?? {};

  const rawCity = getSingleParam(query.city);
  const rawTag = getSingleParam(query.tag);
  const rawAudience = getSingleParam(query.audience);
  const rawType = getSingleParam(query.type);
  const rawOnlyActive = getSingleParam(query.onlyActive ?? query.active);

  const dealType =
    rawType && DEAL_TYPES.includes(rawType as DealType)
      ? (rawType as DealType)
      : undefined;

  const onlyActive = rawOnlyActive === "true";

  const [result, cmsBlocks] = await Promise.all([
    listPublicDeals({
      city: rawCity,
      tag: rawTag,
      audience: rawAudience,
      dealType: dealType ?? null,
      onlyActive: onlyActive ? true : undefined,
    }),
    getSpecialDealsCms(locale),
  ]);

  const { items, facets } = result;
  const activeCount = items.filter((deal) => deal.isActive).length;
  const upcomingCount = items.filter(
    (deal) => deal.isUpcoming && !deal.isActive
  ).length;

  return (
    <main className="flex min-h-screen flex-col text-white">
      <section className="mx-auto flex w-full max-w-[120rem] flex-1 flex-col gap-8 px-4 py-12 sm:gap-10 lg:px-24 lg:py-24">
        <header className="space-y-3 sm:space-y-4">
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-violet-300">
            Special & Flash Deals
          </p>
          <h1 className="text-balance text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-violet-200 to-purple-200 bg-clip-text text-transparent sm:text-4xl md:text-5xl lg:text-6xl">
            Limited-time experiences with exclusive pricing and concierge
            support
          </h1>
          <p className="text-base text-slate-200 leading-relaxed sm:text-lg md:text-xl max-w-3xl">
            Curated offers from our partner network. Each deal enforces minimum
            visitor counts and one-time QR passes so your team or family can
            unlock concierge-level perks.
          </p>
        </header>

        <section className="grid gap-4 rounded-3xl border border-white/20 bg-gradient-to-br from-white/10 via-white/5 to-white/5 p-5 sm:p-6 text-sm text-slate-200 md:grid-cols-2 backdrop-blur-sm shadow-lg shadow-black/20">
          <article className="space-y-2 rounded-2xl border border-white/5 bg-white/5 p-5">
            <h2 className="text-lg font-semibold text-white">
              What&apos;s included
            </h2>
            <ul className="list-disc space-y-1 pl-5 text-slate-300">
              <li>
                Dynamic QR passes with 10-day validity and concierge support
              </li>
              <li>Minimum visitor counts clearly enforced at scan-in</li>
              <li>Group-focused pricing with optional transport add-ons</li>
            </ul>
          </article>
          <article className="space-y-2 rounded-2xl border border-white/5 bg-white/5 p-5">
            <h2 className="text-lg font-semibold text-white">
              Need a bespoke package?
            </h2>
            <p className="text-slate-200 leading-relaxed">
              Share your group size, preferred dates, and the city you&apos;re
              visiting. Our concierge desk will match you to upcoming specials
              or craft a custom itinerary.
            </p>
            <div className="flex flex-wrap gap-3">
              <LocalizedLink
                href="/partners"
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-purple-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/40 transition hover:from-violet-600 hover:via-indigo-600 hover:to-purple-600 min-h-[44px] touch-manipulation"
              >
                Explore partners
              </LocalizedLink>
              <LocalizedLink
                href="mailto:hello@zabava.cz"
                className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/90 transition hover:border-violet-400/60 hover:bg-white/10 hover:text-white backdrop-blur-sm min-h-[44px] touch-manipulation"
              >
                Contact concierge
              </LocalizedLink>
            </div>
          </article>
        </section>

        <form
          className="space-y-5 sm:space-y-6 rounded-3xl border border-white/20 bg-gradient-to-br from-white/10 via-white/5 to-white/5 p-5 sm:p-6 text-sm text-slate-200 backdrop-blur-sm shadow-lg shadow-black/20"
          method="get"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-violet-300">
                Deal type
              </span>
              <select
                name="type"
                defaultValue={dealType ?? ""}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white shadow-inner focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/30 focus:outline-none transition-all min-h-[44px] touch-manipulation"
              >
                <option value="">All deals</option>
                {facets.dealTypes.map((type) => (
                  <option key={type} value={type}>
                    {formatDealTypeLabel(type)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-violet-300">
                City
              </span>
              <select
                name="city"
                defaultValue={rawCity ?? ""}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white shadow-inner focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/30 focus:outline-none transition-all min-h-[44px] touch-manipulation"
              >
                <option value="">All cities</option>
                {facets.cities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-violet-300">
                Audience
              </span>
              <select
                name="audience"
                defaultValue={rawAudience ?? ""}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white shadow-inner focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/30 focus:outline-none transition-all min-h-[44px] touch-manipulation"
              >
                <option value="">All audiences</option>
                {facets.audiences.map((aud) => (
                  <option key={aud} value={aud}>
                    {aud}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-violet-300">
                Highlight tag
              </span>
              <select
                name="tag"
                defaultValue={rawTag ?? ""}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white shadow-inner focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/30 focus:outline-none transition-all min-h-[44px] touch-manipulation"
              >
                <option value="">All tags</option>
                {facets.tags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-3 text-xs font-bold uppercase tracking-wide text-slate-200 cursor-pointer min-h-[44px] touch-manipulation">
              <input
                type="checkbox"
                name="onlyActive"
                value="true"
                defaultChecked={onlyActive}
                className="h-5 w-5 rounded border border-white/30 bg-white/10 text-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-400/50 transition-all cursor-pointer"
              />
              Show active deals only
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-purple-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/40 transition hover:from-violet-600 hover:via-indigo-600 hover:to-purple-600 min-h-[44px] touch-manipulation"
              >
                Apply filters
              </button>
              <LocalizedLink
                href="/special-flash-deals"
                className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/5 px-6 py-3 text-sm font-semibold text-white/90 transition hover:border-violet-400/60 hover:bg-white/10 hover:text-white backdrop-blur-sm min-h-[44px] touch-manipulation"
              >
                Reset
              </LocalizedLink>
            </div>
          </div>
        </form>

        <section className="space-y-4">
          <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Available packages
              </h2>
              <p className="text-sm text-slate-300">
                Showing {items.length} deal{items.length === 1 ? "" : "s"} ·{" "}
                {activeCount} active · {upcomingCount} upcoming
              </p>
            </div>
            <p className="text-xs text-slate-400">
              Updated {new Date(result.generatedAt).toLocaleString()}
            </p>
          </header>
          {items.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-10 text-center text-slate-300">
              <p className="text-sm">
                No specials match the filters yet. Try broadening your search or{" "}
                <a
                  href="mailto:hello@zabava.cz"
                  className="text-violet-300 underline decoration-violet-500/40 underline-offset-4 hover:text-violet-200 transition-colors"
                >
                  contact us
                </a>{" "}
                for a bespoke group offer.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              {items.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          )}
        </section>
        {cmsBlocks.length ? (
          <section className="space-y-6 rounded-3xl border border-white/15 bg-white/5 p-6 text-slate-200 backdrop-blur-sm shadow-lg shadow-black/30">
            <CmsRenderer blocks={cmsBlocks} />
          </section>
        ) : null}
      </section>
    </main>
  );
}

function DealCard({ deal }: { deal: PublicDealSummary }) {
  const detailHref = buildDetailHref(deal);
  const statusLabel = deal.isActive
    ? "Active"
    : deal.isUpcoming
      ? "Starting soon"
      : "Unavailable";
  const statusVariant: "default" | "secondary" | "outline" = deal.isActive
    ? "default"
    : deal.isUpcoming
      ? "secondary"
      : "outline";

  const requirementSummary =
    deal.ticketRequirements && deal.ticketRequirements.length
      ? deal.ticketRequirements
          .map((req) => `${req.quantity} × ${req.subType ?? req.ticketType}`)
          .join(" + ")
      : null;
  const maxRequirement =
    deal.ticketRequirements && deal.ticketRequirements.length
      ? Math.max(...deal.ticketRequirements.map((req) => req.quantity || 0))
      : null;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-white/10 via-white/5 to-white/5 shadow-lg shadow-black/30 backdrop-blur transition hover:-translate-y-1 hover:border-violet-400/60 hover:shadow-violet-500/20">
      {deal.heroImage ? (
        <figure className="relative aspect-[16/9] overflow-hidden">
          <Image
            src={deal.heroImage.url}
            alt={deal.heroImage.altText ?? deal.title}
            fill
            className="object-cover transition duration-500 group-hover:scale-105"
            sizes="(min-width: 768px) 50vw, 100vw"
            priority={false}
          />
          <span className="absolute left-3 top-3 sm:left-4 sm:top-4 inline-flex items-center rounded-full border border-white/30 bg-black/50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white/90 backdrop-blur-md shadow-lg">
            {formatDealTypeLabel(deal.dealType)}
          </span>
        </figure>
      ) : null}
      <div className="flex flex-1 flex-col gap-3 sm:gap-4 p-4 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-violet-300">
            {deal.partnerName ?? deal.partnerId}
          </span>
          <Badge variant={statusVariant} className="uppercase w-fit">
            {statusLabel}
          </Badge>
        </div>
        <div className="space-y-2">
          <h3 className="text-lg sm:text-xl font-semibold text-white leading-tight">
            {deal.title}
          </h3>
          {deal.descriptionSnippet ? (
            <p className="text-sm text-slate-200 leading-relaxed line-clamp-2">
              {deal.descriptionSnippet}
            </p>
          ) : null}
        </div>
        <ul className="space-y-1.5 text-xs text-slate-200 leading-relaxed">
          <li>
            {formatValidity(deal.validFrom, deal.validTo)}
            {deal.timeZoneLabel ? (
              <span className="text-slate-400"> · {deal.timeZoneLabel}</span>
            ) : null}
          </li>
          {deal.city ? (
            <li>
              City focus:{" "}
              <span className="font-semibold text-slate-100">{deal.city}</span>
            </li>
          ) : null}
          {typeof deal.usageRemaining === "number" ? (
            <li>
              Capacity remaining:{" "}
              <span
                className={
                  deal.usageRemaining === 0
                    ? "font-bold text-rose-400"
                    : deal.usageRemaining <= 3
                      ? "font-bold text-amber-400"
                      : "font-bold text-emerald-400"
                }
              >
                {deal.usageRemaining}
              </span>
            </li>
          ) : null}
          {requirementSummary ? (
            <li>
              Minimum group:{" "}
              <span className="font-semibold text-slate-100">
                {requirementSummary}
              </span>
              {typeof maxRequirement === "number" && maxRequirement > 0 ? (
                <span className="text-slate-300">
                  {" "}
                  (highest per type: {maxRequirement})
                </span>
              ) : null}
            </li>
          ) : null}
        </ul>
        <div className="flex flex-wrap gap-2">
          {deal.tags.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="border-white/30 bg-white/5 text-slate-200 text-xs"
            >
              {tag}
            </Badge>
          ))}
        </div>
        <div className="mt-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
          <LocalizedLink
            href={detailHref}
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-purple-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/40 transition hover:from-violet-600 hover:via-indigo-600 hover:to-purple-600 min-h-[44px] touch-manipulation w-full sm:w-auto"
          >
            More info
          </LocalizedLink>
          {deal.formId ? (
            <LocalizedLink
              href={`${detailHref}#generate`}
              className="inline-flex items-center justify-center rounded-full border border-violet-300/60 bg-white/10 px-4 py-2.5 text-sm font-semibold text-violet-100 shadow-inner shadow-violet-500/20 transition hover:bg-white/20 min-h-[44px] touch-manipulation w-full sm:w-auto"
            >
              Generate QR
            </LocalizedLink>
          ) : null}
          {deal.isActive ? (
            <span className="text-xs font-bold text-emerald-400 text-center sm:text-right">
              Available now
            </span>
          ) : deal.isUpcoming ? (
            <span className="text-xs font-bold text-amber-400 text-center sm:text-right">
              Launching soon
            </span>
          ) : (
            <span className="text-xs font-semibold text-slate-400 text-center sm:text-right">
              Fully booked
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

async function getSpecialDealsCms(
  locale: Locale
): Promise<CmsRenderableBlock[]> {
  const published = await getPublishedCmsPage("special-deals", locale);
  const fallback = getDefaultCmsPage("special-deals", locale);
  const blocks =
    published?.blocks ??
    (fallback?.blocks ?? []).map((block, index) => ({
      id: `${block.type}-${index}`,
      type: block.type,
      sortOrder: index,
      visible: block.visible ?? true,
      data: block.data,
    }));
  return blocks.filter((block) => block.visible !== false);
}
