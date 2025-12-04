"use client";

import React, { useMemo } from "react";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { LocalizedLink } from "@/components/ui/localized-link";
import { useTranslations } from "@/i18n/provider";
import { LogoLoop, type LogoItem } from "@/components/LogoLoop";

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
  const t = useTranslations("home.featured");

  if (partners.length === 0) return null;

  // Split partners into two rows
  const firstRowPartners = partners.slice(0, Math.ceil(partners.length / 2));
  const secondRowPartners = partners.slice(Math.ceil(partners.length / 2));

  // Create a map of partner names to slugs for easy lookup
  const partnerSlugMap = useMemo(() => {
    const map = new Map<string, string>();
    partners.forEach((partner) => {
      map.set(partner.name, partner.slug);
    });
    return map;
  }, [partners]);

  // Convert partners to LogoItem format for LogoLoop
  const convertToLogoItems = (partnerList: PartnerLogo[]): LogoItem[] => {
    return partnerList.map((partner) => {
      const imageUrl = partner.logoUrl || partner.heroImageUrl;

      if (imageUrl) {
        return {
          src: imageUrl,
          alt: partner.name,
          title: partner.name,
        };
      } else {
        return {
          node: (
            <div className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden transition-all hover:border-white/20">
              <span className="text-sm font-medium text-white/60 text-center">
                {partner.name.slice(0, 2).toUpperCase()}
              </span>
            </div>
          ),
          title: partner.name,
          ariaLabel: partner.name,
        };
      }
    });
  };

  const firstRowLogos = useMemo(
    () => convertToLogoItems(firstRowPartners),
    [firstRowPartners]
  );
  const secondRowLogos = useMemo(
    () => convertToLogoItems(secondRowPartners),
    [secondRowPartners]
  );

  // Custom render function for logos with images - wraps in LocalizedLink
  const renderLogoItem = (item: LogoItem, key: React.Key) => {
    const isNodeItem = "node" in item;
    const partnerName = item.title || (item as any).ariaLabel || "";
    const partnerSlug = partnerSlugMap.get(partnerName) || "";
    const linkHref = partnerSlug ? `/partners/${partnerSlug}` : "#";

    if (isNodeItem) {
      return (
        <LocalizedLink href={linkHref} className="flex-shrink-0">
          {item.node}
        </LocalizedLink>
      );
    }

    return (
      <LocalizedLink href={linkHref} className="flex-shrink-0">
        <div className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden transition-all hover:border-white/20">
          <Image
            src={item.src}
            alt={item.alt || ""}
            width={112}
            height={112}
            className="object-contain object-center p-2"
            sizes="(min-width: 1024px) 112px, (min-width: 640px) 96px, 80px"
          />
        </div>
      </LocalizedLink>
    );
  };

  return (
    <section className="relative overflow-hidden py-20">
      <div className="mx-auto max-w-[120rem] px-0 lg:px-0">
        {/* Header */}
        <div className="mb-12 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-2">
            <h2 className="font-[family-name:var(--font-influencer)] text-5xl uppercase tracking-wide text-white sm:text-6xl">
              Meet our <span className="text-[var(--ds-accent)]">top-tier</span>
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

        {/* Logo Loops */}
        <div className="relative space-y-6">
          {/* First Row - Moving Left */}
          {firstRowLogos.length > 0 && (
            <div className="relative">
              <LogoLoop
                logos={firstRowLogos}
                direction="left"
                speed={20}
                logoHeight={112}
                gap={24}
                pauseOnHover={true}
                fadeOut={true}
                renderItem={renderLogoItem}
                className="w-full"
              />
            </div>
          )}

          {/* Second Row - Moving Right */}
          {secondRowLogos.length > 0 && (
            <div className="relative">
              <LogoLoop
                logos={secondRowLogos}
                direction="right"
                speed={20}
                logoHeight={112}
                gap={24}
                pauseOnHover={true}
                fadeOut={true}
                renderItem={renderLogoItem}
                className="w-full"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
