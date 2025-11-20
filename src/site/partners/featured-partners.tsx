"use client";

import Image from "next/image";
import { MapPin, Star } from "lucide-react";
import { motion, type Variants } from "framer-motion";

import { cn } from "@/lib/utils";
import { useTranslations } from "@/i18n/provider";
import { LocalizedLink } from "@/components/ui/localized-link";

export interface FeaturedPartner {
  partnerId: string;
  name: string;
  slug: string;
  description?: string | null;
  heroImageUrl?: string | null;
  isFeatured?: boolean;
  categories: Array<{ id: string; name: string; slug: string }>;
  highlights?: Array<{
    id: string;
    title: string;
    description?: string | null;
  }>;
  ctaPrimaryLabel?: string | null;
  selectedFormId?: string | null;
}

export function FeaturedPartners({
  partners,
}: {
  partners: FeaturedPartner[];
}) {
  const t = useTranslations("home.featured");

  if (partners.length === 0) return null;

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 24 },
    visible: (index: number = 0) => ({
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 140,
        damping: 18,
        delay: index * 0.08,
      },
    }),
  };

  return (
    <section className="bg-gradient-to-b from-slate-900/60 via-slate-950/40 to-slate-950 py-16 sm:py-20 lg:py-24">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 sm:gap-12 sm:px-6 lg:px-8">
        <motion.div
          className="flex flex-col gap-3 sm:gap-4"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <span className="text-xs sm:text-sm font-bold uppercase tracking-[0.3em] text-violet-300">
            {t("tagline")}
          </span>
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-violet-200 to-purple-200 bg-clip-text text-transparent sm:text-4xl md:text-5xl">
            {t("headline")}
          </h2>
          <p className="max-w-2xl text-base text-slate-200 leading-relaxed sm:text-lg">
            {t("description")}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8 xl:grid-cols-3">
          {partners.map((partner, index) => (
            <motion.article
              key={partner.partnerId}
              className="group flex h-full flex-col overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-white/10 via-white/5 to-white/5 shadow-lg shadow-black/30 backdrop-blur transition hover:-translate-y-1 hover:border-violet-400/60 hover:shadow-violet-500/20"
              variants={cardVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              custom={index}
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                {partner.heroImageUrl ? (
                  <Image
                    src={partner.heroImageUrl}
                    alt={partner.name}
                    fill
                    className="object-cover transition duration-500 group-hover:scale-105"
                    sizes="(max-width: 1024px) 100vw, 33vw"
                    priority={false}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-indigo-500/30 via-slate-800/40 to-slate-900 text-3xl font-semibold text-white/40">
                    {partner.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                {partner.isFeatured !== false ? (
                  <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-slate-950/90 to-transparent px-4 sm:px-5 pb-3 sm:pb-4 pt-12 sm:pt-14 text-xs uppercase tracking-[0.25em] text-violet-200">
                    <Star className="h-3 w-3 text-amber-400" />
                    {t("badge")}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-1 flex-col gap-4 sm:gap-6 p-4 sm:p-6">
                <div className="flex flex-col gap-2 sm:gap-3">
                  <h3 className="text-lg sm:text-xl font-semibold text-white">
                    {partner.name}
                  </h3>
                  {partner.description ? (
                    <p className="text-sm text-slate-200 leading-relaxed line-clamp-3">
                      {partner.description}
                    </p>
                  ) : null}
                </div>

                {partner.highlights && partner.highlights.length > 0 ? (
                  <ul className="space-y-2">
                    {partner.highlights.slice(0, 3).map((highlight) => (
                      <li
                        key={highlight.id}
                        className="flex items-start gap-2 text-sm text-slate-200"
                      >
                        <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-violet-400 shadow-[0_0_10px_rgba(139,92,246,0.6)]" />
                        <span className="line-clamp-2">
                          <strong className="text-slate-100">
                            {highlight.title}
                          </strong>
                          {highlight.description
                            ? ` – ${highlight.description}`
                            : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <div className="mt-auto flex flex-wrap items-center gap-2">
                  {partner.categories.map((category) => (
                    <LocalizedLink
                      key={category.id}
                      href={`/categories/${category.slug}`}
                      className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-violet-300 hover:bg-white/10 hover:text-white min-h-[28px] touch-manipulation"
                    >
                      <MapPin className="h-3 w-3 text-violet-300" />
                      {category.name}
                    </LocalizedLink>
                  ))}
                </div>

                <div className="flex flex-col gap-2 sm:gap-3 pt-2">
                  <LocalizedLink
                    href={`/partners/${partner.slug}`}
                    className={cn(
                      "inline-flex items-center justify-center gap-2 rounded-full border border-violet-300/70 px-4 py-2.5 text-sm font-medium text-violet-100 transition min-h-[44px] touch-manipulation",
                      "hover:-translate-y-0.5 hover:border-violet-200 hover:text-white"
                    )}
                  >
                    {t("learnMore")}
                  </LocalizedLink>
                  {partner.selectedFormId ? (
                    <LocalizedLink
                      href={`/partners/${partner.slug}/book`}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-purple-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-violet-500/40 transition hover:from-violet-600 hover:via-indigo-600 hover:to-purple-600 min-h-[44px] touch-manipulation"
                    >
                      {partner.ctaPrimaryLabel ?? t("reserve")}
                    </LocalizedLink>
                  ) : (
                    <span className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 min-h-[44px]">
                      {t("comingSoon")}
                    </span>
                  )}
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
