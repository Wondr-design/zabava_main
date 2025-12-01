"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { LocalizedLink } from "@/components/ui/localized-link";
import { useTranslations } from "@/i18n/provider";

export interface PartnerLogo {
  partnerId: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  heroImageUrl?: string | null;
}

interface PartnerLogoGridProps {
  partners: PartnerLogo[];
}

export function PartnerLogoGrid({ partners }: PartnerLogoGridProps) {
  const [pausedRow, setPausedRow] = useState<string | null>(null);
  const t = useTranslations("home.featured");
  
  if (partners.length === 0) return null;

  // Split partners into two rows
  const firstRowPartners = partners.slice(0, Math.ceil(partners.length / 2));
  const secondRowPartners = partners.slice(Math.ceil(partners.length / 2));

  // Create duplicates for seamless scroll
  const createMarqueeItems = (items: PartnerLogo[]) => {
    return [...items, ...items, ...items];
  };

  const firstRowMarquee = createMarqueeItems(firstRowPartners);
  const secondRowMarquee = createMarqueeItems(secondRowPartners);

  const LogoCard = ({ partner, rowId }: { partner: PartnerLogo; rowId: string }) => {
    const imageUrl = partner.logoUrl || partner.heroImageUrl;

    return (
      <LocalizedLink
        href={`/partners/${partner.slug}`}
        className="flex-shrink-0 mx-3"
        onMouseEnter={() => setPausedRow(rowId)}
        onMouseLeave={() => setPausedRow(null)}
      >
        <div className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden transition-all hover:border-white/20">
          {imageUrl ? (
            <div className="relative w-full h-full">
              <Image
                src={imageUrl}
                alt={partner.name}
                fill
                className="object-contain object-center p-2"
                sizes="(min-width: 1024px) 112px, (min-width: 640px) 96px, 80px"
              />
            </div>
          ) : (
            <span className="text-sm font-medium text-white/60 text-center">
              {partner.name.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
      </LocalizedLink>
    );
  };

  return (
    <section className="relative overflow-hidden py-20">
      <div className="mx-auto max-w-[120rem] px-4 lg:px-24">
        {/* Header */}
        <div className="mb-12 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-2">
            <h2 className="font-[family-name:var(--font-influencer)] text-5xl uppercase tracking-wide text-white sm:text-6xl">
              Meet our <span className="text-lime-400">top-tier</span>
            </h2>
            <h2 className="font-[family-name:var(--font-influencer)] text-5xl uppercase tracking-wide text-white sm:text-6xl">
              customers
            </h2>
          </div>
          <LocalizedLink href="/partners">
            <div className="group relative flex items-center rounded-full bg-white pr-1 pl-6 py-1 shadow-lg transition-shadow hover:shadow-xl">
              <span className="text-sm font-medium uppercase tracking-wide text-[#2d2a32] pr-4">
                {t("learnMore")}
              </span>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f7c04a] shadow-md transition-transform group-hover:scale-110">
                <ArrowUpRight className="h-5 w-5 text-white" />
              </div>
            </div>
          </LocalizedLink>
        </div>

        {/* Logo Marquee */}
        <div className="relative">
          {/* First Row - Scrolling Right */}
          {firstRowPartners.length > 0 && (
            <div className="relative flex overflow-hidden mb-6">
              {/* Left Gradient */}
              <div className="absolute left-0 top-0 bottom-0 w-32 z-10 bg-gradient-to-r from-slate-950 to-transparent pointer-events-none" />
              {/* Right Gradient */}
              <div className="absolute right-0 top-0 bottom-0 w-32 z-10 bg-gradient-to-l from-slate-950 to-transparent pointer-events-none" />
              <div
                className="flex animate-scroll-right whitespace-nowrap"
                style={{
                  animationPlayState: pausedRow === "first" ? "paused" : "running",
                  width: "max-content",
                }}
              >
                {firstRowMarquee.map((partner, index) => (
                  <LogoCard key={`first-${partner.partnerId}-${index}`} partner={partner} rowId="first" />
                ))}
              </div>
            </div>
          )}

          {/* Second Row - Scrolling Left */}
          {secondRowPartners.length > 0 && (
            <div className="relative flex overflow-hidden">
              {/* Left Gradient */}
              <div className="absolute left-0 top-0 bottom-0 w-32 z-10 bg-gradient-to-r from-slate-950 to-transparent pointer-events-none" />
              {/* Right Gradient */}
              <div className="absolute right-0 top-0 bottom-0 w-32 z-10 bg-gradient-to-l from-slate-950 to-transparent pointer-events-none" />
              <div
                className="flex animate-scroll-left whitespace-nowrap"
                style={{
                  animationPlayState: pausedRow === "second" ? "paused" : "running",
                  width: "max-content",
                }}
              >
                {secondRowMarquee.map((partner, index) => (
                  <LogoCard key={`second-${partner.partnerId}-${index}`} partner={partner} rowId="second" />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
