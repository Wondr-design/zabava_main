"use client";

import Image from "next/image";
import { MapPin, Star, ArrowRight } from "lucide-react";
import { motion, type Variants } from "framer-motion";

import { cn } from "@/lib/utils";
import { useTranslations } from "@/i18n/provider";
import { LocalizedLink } from "@/components/ui/localized-link";
import { Badge } from "@/components/ui/badge";

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
    hidden: { opacity: 0, y: 20 },
    visible: (index: number = 0) => ({
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15,
        delay: index * 0.05,
      },
    }),
  };

  return (
    <section className="relative py-20 sm:py-24">
      <div className="mx-auto max-w-[120rem] px-4 lg:px-24">
        <motion.div
          className="mb-12 flex flex-col items-center text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5 }}
        >
          <Badge
            variant="outline"
            className="mb-4 border-indigo-500/30 bg-indigo-500/10 text-indigo-300"
          >
            {t("tagline")}
          </Badge>
          <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            {t("headline")}
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-slate-400">
            {t("description")}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {partners.map((partner, index) => (
            <motion.article
              key={partner.partnerId}
              className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/5 transition-all duration-300 hover:border-indigo-500/50 hover:bg-white/10 hover:shadow-2xl hover:shadow-indigo-500/10"
              variants={cardVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.1 }}
              custom={index}
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                {partner.heroImageUrl ? (
                  <Image
                    src={partner.heroImageUrl}
                    alt={partner.name}
                    fill
                    className="object-cover transition duration-700 group-hover:scale-105"
                    sizes="(max-width: 1024px) 100vw, 33vw"
                    priority={false}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-slate-900 text-3xl font-bold text-slate-700">
                    {partner.name.slice(0, 2).toUpperCase()}
                  </div>
                )}

                {/* Gradient Overlay */}
                <div className="absolute inset-0" />

                {partner.isFeatured !== false && (
                  <div className="absolute top-4 right-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-amber-400 shadow-lg">
                      <Star className="h-4 w-4 fill-current" />
                    </div>
                  </div>
                )}

                <div className="absolute bottom-4 left-4 right-4">
                  <div className="flex flex-wrap gap-2">
                    {partner.categories.slice(0, 2).map((category) => (
                      <span
                        key={category.id}
                        className="inline-flex items-center rounded-full bg-black/50 border border-white/10 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur-md"
                      >
                        {category.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-1 flex-col p-6">
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-300 transition-colors">
                  {partner.name}
                </h3>

                {partner.description ? (
                  <p className="text-sm text-slate-400 line-clamp-2 mb-4 flex-grow">
                    {partner.description}
                  </p>
                ) : (
                  <div className="flex-grow" />
                )}

                {partner.highlights && partner.highlights.length > 0 && (
                  <ul className="mb-6 space-y-2">
                    {partner.highlights.slice(0, 2).map((highlight) => (
                      <li
                        key={highlight.id}
                        className="flex items-start text-sm text-slate-300"
                      >
                        <span className="mr-2 mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-500" />
                        <span className="line-clamp-1">{highlight.title}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-auto grid grid-cols-2 gap-3">
                  <LocalizedLink
                    href={`/partners/${partner.slug}`}
                    className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
                  >
                    {t("learnMore")}
                  </LocalizedLink>
                  {partner.selectedFormId ? (
                    <LocalizedLink
                      href={`/partners/${partner.slug}/book`}
                      className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 shadow-lg shadow-indigo-500/20"
                    >
                      {partner.ctaPrimaryLabel ?? t("reserve")}
                    </LocalizedLink>
                  ) : (
                    <span className="inline-flex items-center justify-center rounded-xl border border-white/5 bg-white/5 px-4 py-2 text-sm font-medium text-slate-500 cursor-not-allowed">
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
