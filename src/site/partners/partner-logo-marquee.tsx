"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { LocalizedLink } from "@/components/ui/localized-link";
import { useTranslations } from "@/i18n/provider";

export interface PartnerLogo {
  partnerId: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  heroImageUrl?: string | null;
}

interface PartnerLogoMarqueeProps {
  partners: PartnerLogo[];
}

export function PartnerLogoMarquee({ partners }: PartnerLogoMarqueeProps) {
  const [pausedRow, setPausedRow] = useState<string | null>(null);
  const t = useTranslations("home.featured");

  // Filter partners that have a logo or hero image
  const partnersWithLogos = partners.filter(
    (partner) => partner.logoUrl || partner.heroImageUrl
  );

  if (partnersWithLogos.length === 0) return null;

  // Create enough duplicates to fill the width (repeat 5 times for seamless scroll)
  const createMarqueeItems = (items: PartnerLogo[]) => {
    return [...items, ...items, ...items, ...items, ...items];
  };

  // Split partners into two rows
  const firstRowPartners = partnersWithLogos.slice(0, Math.ceil(partnersWithLogos.length / 2));
  const secondRowPartners = partnersWithLogos.slice(Math.ceil(partnersWithLogos.length / 2));
  
  const firstRowMarquee = createMarqueeItems(firstRowPartners);
  const secondRowMarquee = createMarqueeItems(secondRowPartners);

  const LogoCard = ({ partner, rowId }: { partner: PartnerLogo; rowId: string }) => {
    const imageUrl = partner.logoUrl || partner.heroImageUrl;
    
    return (
      <LocalizedLink
        href={`/partners/${partner.slug}`}
        className="flex-shrink-0 mx-4"
        onMouseEnter={() => setPausedRow(rowId)}
        onMouseLeave={() => setPausedRow(null)}
      >
        <div className="w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48 rounded-3xl bg-black/40 border border-white/20 backdrop-blur-xl flex items-center justify-center overflow-hidden transition-all hover:border-white/40 hover:bg-black/60">
          {imageUrl ? (
            <div className="relative w-full h-full">
              <Image
                src={imageUrl}
                alt={partner.name}
                fill
                className="object-contain p-4"
                sizes="(min-width: 1024px) 192px, (min-width: 640px) 160px, 128px"
              />
            </div>
          ) : (
            <span className="text-lg font-semibold text-white/60 text-center px-4">
              {partner.name.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
      </LocalizedLink>
    );
  };

  return (
    <section className="text-white py-16 sm:py-20 overflow-hidden">
      <div className="mx-auto max-w-[120rem] px-4 lg:px-24">
        {/* Header */}
        <div className="flex flex-col items-center justify-between mb-12 sm:flex-row sm:items-center">
          <h2 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl text-center sm:text-left">
            Meet our <span className="text-lime-300">top-tier</span> Attraction centers
          </h2>
          <LocalizedLink href="/partners">
            <Button
              variant="outline"
              className="mt-4 sm:mt-0 text-white border-white/20 bg-transparent hover:bg-white/10"
            >
              {t("learnMore")}
            </Button>
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

