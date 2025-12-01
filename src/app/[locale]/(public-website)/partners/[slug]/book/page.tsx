import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  applyBookingCapToForm,
  getPartnerFormById,
} from "@/lib/data/partner-forms";
import { getPartnerBySlug } from "@/lib/data/site-directory";
import { SiteNav } from "@/site/components/site-nav";
import { PartnerFormRunner } from "@/site/forms/partner-form-runner";
import { LocalizedLink } from "@/components/ui/localized-link";
import { getDealWithMeta } from "@/lib/data/flash-deals";
import type { DealTicketRequirement } from "@/lib/deals/ticket-requirements";

type PartnerBookingPageContext = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PartnerBookingPageContext): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPartnerBySlug(slug);
  if (!result) return {};
  return {
    title: `Reserve ${result.partner.name} · Zabava`,
    description:
      result.partner.description ??
      "Reserve a visit and generate your Zabava QR pass instantly.",
  };
}

export default async function PartnerBookingPage({
  params,
}: PartnerBookingPageContext) {
  const { slug } = await params;
  const result = await getPartnerBySlug(slug);
  if (!result) {
    notFound();
  }

  const { partner } = result;

  const partnerMetadata = partner.metadata as Record<string, unknown>;
  const selectedFormId =
    partner.selectedFormId ??
    (typeof partnerMetadata.selectedFormId === "string"
      ? (partnerMetadata.selectedFormId as string)
      : null);

  const form = selectedFormId ? await getPartnerFormById(selectedFormId) : null;
  const isFormReady = form && form.status === "published";
  const bookingCap = partner.ticketing?.maxGuestsPerBooking ?? null;
  const enrichedForm =
    form && bookingCap ? applyBookingCapToForm(form, bookingCap) : form;
  let dealSnapshot: {
    id: string;
    slug: string | null;
    title: string;
    minVisitors: number;
    validFrom: string | null;
    validTo: string | null;
    validDays: number[] | null;
    ticketRequirements: DealTicketRequirement[];
  } | null = null;

  if (
    enrichedForm &&
    enrichedForm.usageType === "deal" &&
    enrichedForm.dealId
  ) {
    try {
      const entry = await getDealWithMeta(enrichedForm.dealId);
      if (entry?.deal) {
        dealSnapshot = {
          id: entry.deal.id,
          slug: entry.deal.slug,
          title: entry.deal.title,
          minVisitors: entry.deal.min_visitors,
          validFrom: entry.deal.valid_from,
          validTo: entry.deal.valid_to,
          validDays: entry.deal.valid_days,
          ticketRequirements:
            (entry.deal.ticket_requirements as
              | DealTicketRequirement[]
              | null) ?? [],
        };
      }
    } catch (error) {
      console.error("partner_booking_deal_load_failed", error);
    }
  }

  return (
    <main className="flex min-h-screen flex-col text-white">
      <SiteNav />
      <section className="bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 py-20">
        <div className="mx-auto flex w-full max-w-[120rem] flex-col gap-6 px-4 lg:px-24">
          <div className="flex flex-wrap items-center gap-3 text-sm text-indigo-200">
            <LocalizedLink
              href={`/partners/${partner.slug}`}
              className="rounded-full border border-white/15 px-4 py-1 transition hover:border-indigo-300 hover:text-white"
            >
              ← Back to {partner.name}
            </LocalizedLink>
            <span className="rounded-full border border-white/15 px-4 py-1 uppercase tracking-[0.35em] text-indigo-200/80">
              Reserve
            </span>
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Reserve your visit to {partner.name}
            </h1>
            <p className="max-w-3xl text-lg text-slate-200">
              Complete the steps below to confirm your reservation and receive a
              QR pass for fast check-in. We&apos;ll email the pass to you and
              keep your loyalty points in sync.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto w-full max-w-[120rem] px-4 lg:px-24">
          {isFormReady && enrichedForm ? (
            <PartnerFormRunner
              partnerId={partner.partnerId}
              partnerName={partner.name}
              form={enrichedForm}
              categories={partner.categories.map((category) => category.name)}
              ticketCatalog={partner.ticketDetails ?? []}
              ticketAddons={partner.ticketAddons ?? []}
              dealSnapshot={dealSnapshot ?? undefined}
            />
          ) : (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-indigo-200/80 shadow-2xl shadow-black/30">
              Booking for this partner is temporarily unavailable. Please check
              back soon or contact our team for assistance.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
