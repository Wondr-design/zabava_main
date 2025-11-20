import Image from "next/image";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { LocalizedLink } from "@/components/ui/localized-link";
import { getPublicDealBySlug } from "@/lib/data/flash-deals";
import { SiteNav } from "@/site/components/site-nav";
import { DealGenerateForm } from "@/site/special-deals/deal-generate-form";

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type PageProps = {
  params: Promise<{ slug: string }>;
};

function formatWeekdays(days: number[] | null) {
  if (!days || days.length === 0) {
    return "Valid all week";
  }
  const labels = days
    .map((day) => WEEKDAY_LABELS[day] ?? null)
    .filter((label): label is string => Boolean(label));
  return labels.length ? labels.join(", ") : "Valid all week";
}

export default async function SpecialFlashDealDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const deal = await getPublicDealBySlug(slug);

  if (!deal) {
    notFound();
  }

  const statusLabel = deal.isActive
    ? "Active"
    : deal.isUpcoming
    ? "Starting soon"
    : "Fully booked";
  const statusVariant: "default" | "secondary" | "outline" = deal.isActive
    ? "default"
    : deal.isUpcoming
    ? "secondary"
    : "outline";

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 text-white">
      <SiteNav />
      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-20 sm:px-6 lg:px-8">
        <LocalizedLink
          href="/special-flash-deals"
          className="inline-flex w-max items-center gap-2 text-xs font-semibold uppercase tracking-[0.35em] text-indigo-200/80 transition hover:text-indigo-200"
        >
          ← Back to deals
        </LocalizedLink>

        <header className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-200/80">
                {formatWeekdays(deal.validDays)}
              </p>
              <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
                {deal.title}
              </h1>
              <p className="text-sm text-slate-300">
                Powered by {deal.partnerName ?? deal.partnerId}
              </p>
            </div>
            <Badge variant={statusVariant} className="uppercase">
              {statusLabel}
            </Badge>
          </div>
          {deal.description ? (
            <p className="max-w-3xl text-base text-slate-200">{deal.description}</p>
          ) : null}
        </header>

        {deal.media.length ? (
          <section className="grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 sm:grid-cols-2">
            <div className="relative h-64 overflow-hidden rounded-2xl sm:h-full">
              <Image
                src={deal.media[0].url}
                alt={deal.media[0].altText ?? deal.title}
                fill
                className="object-cover"
                sizes="(min-width: 768px) 50vw, 100vw"
                priority={false}
              />
              <span className="absolute left-4 top-4 inline-flex items-center rounded-full border border-white/20 bg-black/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/90 backdrop-blur">
                {deal.dealType.replace("_", " ")}
              </span>
            </div>
            {deal.media.length > 1 ? (
              <div className="grid gap-4">
                {deal.media.slice(1, 4).map((item) => (
                  <figure key={item.id} className="relative h-40 overflow-hidden rounded-2xl">
                    <Image
                      src={item.url}
                      alt={item.altText ?? deal.title}
                      fill
                      className="object-cover"
                      sizes="(min-width: 768px) 50vw, 100vw"
                    />
                  </figure>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-200 md:grid-cols-2">
          <article className="space-y-3 rounded-2xl border border-white/5 bg-white/5 p-5">
            <h2 className="text-lg font-semibold text-white">Deal specifics</h2>
            <ul className="space-y-2 text-slate-200">
              <li>
                <span className="font-semibold text-white">{deal.discountPercent}% off</span> for at
                least {deal.minVisitors} visitors
              </li>
              <li>QR validity: {Math.round(deal.qrValiditySeconds / 86400)} days from issuance</li>
              <li>
                Bonus programme:{" "}
                {deal.bonusPointsOverride === null ? "not applicable" : `${deal.bonusPointsOverride} points override`}
              </li>
              {deal.priceOverrideCzk ? (
                <li>Flat price override: {deal.priceOverrideCzk} CZK per visitor</li>
              ) : null}
              {deal.city ? <li>City focus: {deal.city}</li> : null}
            </ul>
            <div className="flex flex-wrap gap-2">
              {deal.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="border-white/20 bg-transparent text-slate-200">
                  {tag}
                </Badge>
              ))}
            </div>
          </article>
          <article className="space-y-3 rounded-2xl border border-white/5 bg-white/5 p-5">
            <h2 className="text-lg font-semibold text-white">Availability & capacity</h2>
            <ul className="space-y-2 text-slate-200">
              <li>
                Valid window:{" "}
                {deal.validFrom || deal.validTo
                  ? `${formatDate(deal.validFrom)} → ${formatDate(deal.validTo)}`
                  : "Flexible scheduling"}
              </li>
              <li>
                Capacity remaining:{" "}
                {typeof deal.usageRemaining === "number"
                  ? `${deal.usageRemaining} group${deal.usageRemaining === 1 ? "" : "s"}`
                  : "Unlimited"}
              </li>
              {deal.usageLimit ? (
                <li>
                  Total cap: {deal.usageCount}/{deal.usageLimit} redemptions used
                </li>
              ) : null}
              {deal.usageLimitDaily ? (
                <li>Daily cap: {deal.usageLimitDaily} redemptions per day</li>
              ) : null}
            </ul>
            <div className="flex flex-wrap gap-2">
              {deal.audience.map((aud) => (
                <Badge key={aud} variant="secondary" className="uppercase">
                  {aud}
                </Badge>
              ))}
            </div>
          </article>
        </section>

        <DealGenerateForm
          slug={slug}
          partnerId={deal.partnerId}
          minVisitors={deal.minVisitors}
          isActive={deal.isActive}
          qrValiditySeconds={deal.qrValiditySeconds}
          partnerName={deal.partnerName ?? null}
          title={deal.title}
        />
      </section>
    </main>
  );
}

function formatDate(value: string | null) {
  if (!value) return "Flexible";
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return value;
  }
}
