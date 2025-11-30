"use client";

import { useState } from "react";
import Image from "next/image";
import { CardSpotlight } from "@/components/ui/card-spotlight";
import { LocalizedLink } from "@/components/ui/localized-link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { HomeCategoryCard } from "./home-hero";

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
    return (
      <LocalizedLink
        href={`/categories/${category.slug}`}
        className="block flex-shrink-0 mx-3 w-[320px] h-[500px]"
      >
        <CardSpotlight
          radius={350}
          color="rgb(34, 197, 94)"
          className="relative h-full w-full overflow-hidden rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl group"
        >
          {/* Media Container */}
          <div className="absolute inset-0 z-0">
            {category.media ? (
              <>
                {category.media.type === "video" ? (
                  <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                  >
                    <source src={category.media.url} type="video/mp4" />
                    <source src={category.media.url} type="video/webm" />
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <Image
                    src={category.media.url}
                    alt={category.media.alt || category.name}
                    fill
                    className={cn(
                      "object-cover transition-transform duration-500 group-hover:scale-110",
                      category.media.type === "gif" && "object-cover"
                    )}
                    sizes="320px"
                    unoptimized={category.media.type === "gif"}
                  />
                )}
                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
              </>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 to-slate-950/80" />
            )}
          </div>

          {/* Content */}
          <div className="relative z-10 flex h-full flex-col justify-end p-6">
            <div className="flex flex-col">
              {category.tag && (
                <Badge
                  variant="outline"
                  className="mb-4 w-fit border-lime-400/50 bg-lime-400/10 px-3 py-1 text-xs font-semibold uppercase text-lime-300 backdrop-blur-md"
                >
                  {category.tag}
                </Badge>
              )}

              <h3 className="mb-2 text-4xl font-bold leading-tight text-white sm:text-5xl">
                {category.name}
              </h3>

              {category.description && (
                <p className="text-base leading-relaxed text-white/90 line-clamp-2">
                  {category.description}
                </p>
              )}
            </div>
          </div>
        </CardSpotlight>
      </LocalizedLink>
    );
  };

  return (
    <section className="relative py-16 sm:py-20">
      <div className="mx-auto max-w-[120rem] px-4 lg:px-24">
        {/* Header */}
        <div className="mb-12 text-center">
          <h2 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Explore <span className="text-lime-300">Categories</span>
          </h2>
        </div>

        {/* Marquee Container */}
        <div
          className="relative overflow-hidden"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Left Gradient */}
          <div className="absolute left-0 top-0 z-20 h-full w-32 bg-gradient-to-r from-slate-950 to-transparent pointer-events-none" />
          {/* Right Gradient */}
          <div className="absolute right-0 top-0 z-20 h-full w-32 bg-gradient-to-l from-slate-950 to-transparent pointer-events-none" />

          <div
            className="flex animate-scroll-right whitespace-nowrap"
            style={{
              animationPlayState: isPaused ? "paused" : "running",
              width: "max-content",
            }}
          >
            {marqueeItems.map((category, index) => (
              <CategoryCard
                key={`${category.id}-${index}`}
                category={category}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

