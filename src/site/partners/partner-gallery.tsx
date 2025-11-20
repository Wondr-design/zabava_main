"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Swiper as SwiperType } from "swiper";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";

interface GalleryItem {
  id: string;
  imageUrl: string;
  caption?: string | null;
}

interface PartnerGalleryProps {
  items: GalleryItem[];
  fallbackImage?: string | null;
  fallbackAlt: string;
}

export function PartnerGallery({
  items,
  fallbackImage,
  fallbackAlt,
}: PartnerGalleryProps) {
  const swiperRef = useRef<SwiperType | null>(null);
  const slides = useMemo(
    () =>
      items.filter(
        (item) => typeof item.imageUrl === "string" && item.imageUrl.trim().length > 0,
      ),
    [items],
  );
  const hasMultipleSlides = slides.length > 1;
  const [activeIndex, setActiveIndex] = useState(0);

  if (slides.length === 0) {
    if (fallbackImage) {
      return (
        <div className="relative aspect-[5/3] overflow-hidden rounded-3xl border border-white/10 shadow-xl shadow-black/20">
          <Image
            src={fallbackImage}
            alt={fallbackAlt}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 60vw"
            priority={false}
          />
        </div>
      );
    }

    return (
      <div className="relative flex aspect-[5/3] items-center justify-center rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/30 via-slate-800/50 to-slate-900 p-10 text-3xl font-semibold text-white/40 shadow-inner shadow-black/20">
        {fallbackAlt}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <Swiper
        spaceBetween={16}
        slidesPerView={1}
        onSwiper={(instance) => {
          swiperRef.current = instance;
        }}
        onDestroy={() => {
          swiperRef.current = null;
        }}
        onSlideChange={(instance) => setActiveIndex(instance.activeIndex ?? 0)}
        className="w-full overflow-hidden rounded-3xl border border-white/10 shadow-xl shadow-black/20"
      >
        {slides.map((item, index) => (
          <SwiperSlide key={item.id ?? `${item.imageUrl}-${index}`}>
            <div className="relative aspect-[5/3] w-full overflow-hidden">
              <Image
                src={item.imageUrl}
                alt={item.caption ?? fallbackAlt}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 60vw"
                priority={index === 0}
              />
              {item.caption ? (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-5 pb-4 pt-16 text-sm text-slate-100">
                  {item.caption}
                </div>
              ) : null}
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
      {hasMultipleSlides ? (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            aria-label="Previous image"
            onClick={() => swiperRef.current?.slidePrev()}
            disabled={activeIndex === 0}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white transition ${
              activeIndex === 0
                ? "cursor-not-allowed opacity-40"
                : "hover:border-white/60 hover:bg-white/20"
            }`}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-xs font-medium text-slate-200">
            {activeIndex + 1} / {slides.length}
          </span>
          <button
            type="button"
            aria-label="Next image"
            onClick={() => swiperRef.current?.slideNext()}
            disabled={activeIndex >= slides.length - 1}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white transition ${
              activeIndex >= slides.length - 1
                ? "cursor-not-allowed opacity-40"
                : "hover:border-white/60 hover:bg-white/20"
            }`}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
