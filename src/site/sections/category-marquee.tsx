"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { CardSpotlight } from "@/components/ui/card-spotlight";
import { LocalizedLink } from "@/components/ui/localized-link";
import { cn } from "@/lib/utils";
import type { HomeCategoryCard } from "@/lib/data/site-directory";

interface CategoryMarqueeProps {
  categories: HomeCategoryCard[];
}

export function CategoryMarquee({ categories }: CategoryMarqueeProps) {
  const [isPaused, setIsPaused] = useState(false);

  if (categories.length === 0) return null;

  // Duplicate categories for seamless infinite scroll
  const createMarqueeItems = (items: HomeCategoryCard[]) => {
    return [...items, ...items, ...items];
  };

  const marqueeItems = createMarqueeItems(categories);

  const handleMouseEnter = () => setIsPaused(true);
  const handleMouseLeave = () => setIsPaused(false);

  const CategoryCard = ({ category }: { category: HomeCategoryCard }) => {
    // Determine if card has media or should use solid color
    const hasMedia = Boolean(category.media);
    const backgroundColor = category.accentColor || "#a3e635"; // Default to lime-400
    const textColorClass = hasMedia ? "text-white" : "text-black";

    return (
      <LocalizedLink
        href={`/categories/${category.slug}`}
        className="block flex-shrink-0 w-[320px] h-[500px]"
      >
        <CardSpotlight
          radius={350}
          color="rgb(255, 191, 0)"
          className="relative h-full w-full overflow-hidden rounded-3xl group !p-0 bg-transparent border-transparent"
        >
          {/* Blurred Border */}
          <div className="absolute inset-0 rounded-3xl border border-white/20 backdrop-blur-[2px] z-[5] pointer-events-none shadow-[0_0_20px_rgba(255,255,255,0.1)]" />
          {/* Background: Media or Solid Color */}
          <div className="absolute inset-0 z-0">
            {hasMedia ? (
              <>
                {category.media!.type === "video" ? (
                  <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                  >
                    <source src={category.media!.url} type="video/mp4" />
                    <source src={category.media!.url} type="video/webm" />
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <Image
                    src={category.media!.url}
                    alt={category.media!.alt || category.name}
                    fill
                    className={cn(
                      "object-cover transition-transform duration-500 group-hover:scale-110",
                      category.media!.type === "gif" && "object-cover"
                    )}
                    sizes="320px"
                    unoptimized={category.media!.type === "gif"}
                  />
                )}
                {/* Overlay gradient for media */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
              </>
            ) : (
              // Solid color background
              <div className="absolute inset-0" style={{ backgroundColor }} />
            )}
          </div>

          {/* Content */}
          <div
            className={cn(
              "relative z-10 flex h-full flex-col justify-between px-5 pt-12 pb-5",
              textColorClass
            )}
          >
            {/* Top Section: Title & Subtext */}
            <div className="flex flex-col gap-3 items-start text-left">
              <h3 className="font-[family-name:var(--font-influencer)] text-[4rem] uppercase tracking-wide leading-[0.4]">
                {category.name}
              </h3>

              {category.description && (
                <p
                  className={cn(
                    "text-lg font-medium leading-snug w-full text-wrap h-auto [&::first-letter]:uppercase",
                    hasMedia
                      ? "opacity-0 transition-all duration-500 transform translate-y-4 group-hover:opacity-100 group-hover:translate-y-0"
                      : "opacity-100"
                  )}
                >
                  {category.description}
                </p>
              )}
            </div>

            {/* Bottom Section: Arrow Icon */}
            <div className="flex w-full justify-end">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-black transition-all duration-500 opacity-0 transform translate-y-4 scale-50 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100">
                <ArrowUpRight className="h-6 w-6" />
              </div>
            </div>
          </div>
        </CardSpotlight>
      </LocalizedLink>
    );
  };

  return (
    <>
      {/* Header - Keep within page margins */}
      <div className="mx-auto max-w-[120rem] px-4 md:px-5">
        <div className="mb-12 text-center">
          <h2 className="font-[family-name:var(--font-influencer)] text-[64px] uppercase tracking-wide text-white leading-[0.8]">
            Explore <span className="text-[var(--ds-accent)]">Categories</span>
          </h2>
        </div>
      </div>

      {/* Marquee Container - Break out of page margins, full width */}
      <section
        className="relative w-screen -mx-4 md:-mx-5 overflow-hidden"
        style={{
          paddingLeft: 0,
          paddingRight: 0,
          maskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
          WebkitMaskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div
          className="flex gap-6 animate-scroll-right whitespace-nowrap"
          style={{
            animationPlayState: isPaused ? "paused" : "running",
            width: "max-content",
            marginLeft: 0,
            marginRight: 0,
            paddingLeft: 0,
            paddingRight: 0,
          }}
        >
          {marqueeItems.map((category, index) => (
            <CategoryCard key={`${category.id}-${index}`} category={category} />
          ))}
        </div>
      </section>
    </>
  );
}
