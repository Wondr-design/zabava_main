import Image from "next/image";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { LocalizedLink } from "@/components/ui/localized-link";
import { getPublicDealBySlug } from "@/lib/data/flash-deals";
import { getPartnerById } from "@/lib/data/site-directory";
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

  const partnerEntry = await getPartnerById(deal.partnerId);
  const partner = partnerEntry?.partner ?? null;
  const partnerCity =
    partner?.info?.businessAddress?.city ??
    partner?.info?.companyAddress?.city ??
    null;

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
  const groupedTicketRequirements = (() => {
    const entries = new Map<
      string,
      {
        ticketType: string;
        subItems: Array<{ subType: string | null; quantity: number }>;
        totalQuantity: number;
      }
    >();
    (deal.ticketRequirements ?? []).forEach((req) => {
      const ticketType = req.ticketType?.trim();
      if (!ticketType) return;
      const quantity = typeof req.quantity === "number" ? req.quantity : 0;
      const entry =
        entries.get(ticketType) ??
        {
          ticketType,
          subItems: [],
          totalQuantity: 0,
        };
      entry.subItems.push({
        subType: req.subType ?? null,
        quantity,
      });
      entry.totalQuantity += quantity;
      entries.set(ticketType, entry);
    });
    return Array.from(entries.values());
  })();

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
              <li>QR validity: {Math.round(deal.qrValiditySeconds / 86400)} days from issuance</li>
              {deal.city ? <li>City focus: {deal.city}</li> : null}
              {deal.timeZoneLabel ? (
                <li>
                  Time zone: <span className="font-semibold text-white">{deal.timeZoneLabel}</span>
                </li>
              ) : null}
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

        <section className="grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-200 md:grid-cols-2">
          <article className="space-y-3 rounded-2xl border border-white/5 bg-white/5 p-5">
            <h2 className="text-lg font-semibold text-white">Ticket requirements</h2>
            {groupedTicketRequirements.length ? (
              <div className="grid gap-3">
                {groupedTicketRequirements.map((requirement) => (
                  <div
                    key={requirement.ticketType}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-white">{requirement.ticketType}</p>
                      <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">
                        {requirement.totalQuantity} guest{requirement.totalQuantity === 1 ? "" : "s"}
                      </p>
                    </div>
                    {requirement.subItems.length ? (
                      <p className="mt-2 text-xs text-slate-300">
                        Includes{" "}
                        {requirement.subItems
                          .map((sub) =>
                            sub.subType
                              ? `${sub.quantity} × ${sub.subType}`
                              : `${sub.quantity} × ${requirement.ticketType}`
                          )
                          .join(" · ")}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-300">No specific ticket mixes are enforced for this deal.</p>
            )}
          </article>
        </section>

        {partner ? (
          <section className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-200">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-violet-300">
                Partner profile
              </p>
              <h2 className="text-2xl font-semibold text-white">{partner.name}</h2>
              {partner.description ? (
                <p className="text-base text-slate-200">{partner.description}</p>
              ) : null}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <ul className="space-y-1 text-xs text-slate-300">
                <li>
                  City:{" "}
                  <span className="font-semibold text-white">
                    {partnerCity ?? "Multiple"}
                  </span>
                </li>
                {partner.info.website ? (
                  <li>
                    Website:{" "}
                    <a
                      href={partner.info.website}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-indigo-300 underline decoration-indigo-500/40 underline-offset-4 hover:text-indigo-200"
                    >
                      {partner.info.website}
                    </a>
                  </li>
                ) : null}
                {partner.info.contactEmail ? (
                  <li>
                    Email:{" "}
                    <a
                      href={`mailto:${partner.info.contactEmail}`}
                      className="font-semibold text-indigo-300 underline decoration-indigo-500/40 underline-offset-4 hover:text-indigo-200"
                    >
                      {partner.info.contactEmail}
                    </a>
                  </li>
                ) : null}
              </ul>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Categories</p>
                <div className="flex flex-wrap gap-2">
                  {partner.categories.map((category) => (
                    <Badge key={category.id} variant="outline" className="border-white/20 bg-white/5 text-xs">
                      {category.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <LocalizedLink
              href={`/partners/${partner.slug}`}
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-indigo-400/60 hover:bg-white/10"
            >
              View full partner profile
            </LocalizedLink>
          </section>
        ) : null}

        {deal.formId ? (
          <div id="generate">
        <DealGenerateForm
          slug={slug}
          partnerId={deal.partnerId}
          minVisitors={deal.minVisitors}
              isActive={deal.isActive}
              qrValiditySeconds={deal.qrValiditySeconds}
              partnerName={deal.partnerName ?? null}
              title={deal.title}
          ticketRequirements={deal.ticketRequirements ?? []}
          timeZoneLabel={deal.timeZoneLabel ?? ""}
        />
          </div>
        ) : (
          <div className="rounded-3xl border border-amber-200/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            QR generation is currently unavailable for this deal. Please contact support or check back later.
          </div>
        )}
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
