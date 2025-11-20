"use client";

import type { CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import { motion, type Variants } from "framer-motion";

import { cn } from "@/lib/utils";
import { useTranslations } from "@/i18n/provider";
import { LocalizedLink } from "@/components/ui/localized-link";

export interface HomeCategoryCard {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  accentColor?: string | null;
}

const heroTextVariants: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" as const },
  },
};

const cardsContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 120, damping: 18 },
  },
};

export function HomeHero({ categories }: { categories: HomeCategoryCard[] }) {
  const t = useTranslations("hero");

  return (
    <motion.section
      className="relative isolate overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white"
      initial="hidden"
      animate="visible"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.18),transparent_55%)]" />
      <div className="mx-auto flex min-h-[70vh] w-full max-w-6xl flex-col gap-12 px-4 py-16 sm:gap-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <motion.div variants={heroTextVariants} className="space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/40 bg-gradient-to-r from-violet-500/20 via-indigo-500/20 to-purple-500/20 px-4 py-1 text-xs font-bold uppercase tracking-[0.35em] text-violet-200 backdrop-blur-sm shadow-lg shadow-violet-500/20">
            {t("tagline")}
          </span>
          <h1 className="text-balance text-4xl font-bold tracking-tight bg-gradient-to-r from-white via-violet-200 via-fuchsia-200 to-purple-200 bg-clip-text text-transparent sm:text-5xl lg:text-6xl">
            {t("headline")}
          </h1>
          <p className="max-w-2xl text-base text-slate-200 leading-relaxed sm:text-lg md:text-xl">
            {t("description")}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <LocalizedLink
              href="#categories"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-purple-500 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-violet-500/40 transition hover:from-violet-600 hover:via-indigo-600 hover:to-purple-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            >
              {t("exploreCategories")}
              <ArrowRight className="h-4 w-4" />
            </LocalizedLink>
            <LocalizedLink
              href="/bonus"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/90 transition hover:border-violet-400/60 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 backdrop-blur-sm"
            >
              {t("checkBonus")}
            </LocalizedLink>
          </div>
        </motion.div>

        <motion.div
          id="categories"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3"
          variants={cardsContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {categories.map((category, idx) => (
            <LocalizedLink key={category.id} href={`/categories/${category.slug}`} className="group block">
              <motion.article
                variants={cardVariants}
                className={cn(
                  "relative overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-white/10 via-white/5 to-white/5 p-6 transition group-hover:-translate-y-1 group-hover:border-violet-400/60 group-hover:bg-white/10 backdrop-blur-sm"
                )}
                style={
                  category.accentColor
                    ? ({
                        background:
                          idx % 2 === 0
                            ? `linear-gradient(135deg, ${category.accentColor}22, rgba(255,255,255,0.04))`
                            : undefined,
                      } as CSSProperties)
                    : undefined
                }
                whileHover={{ y: -6 }}
              >
                <div className="flex flex-col gap-3">
                  <span className="text-sm font-medium uppercase tracking-[0.25em] text-indigo-200">
                    {t("categoryLabel")}
                  </span>
                  <h2 className="text-2xl font-semibold tracking-tight text-white">
                    {category.name}
                  </h2>
                  {category.description ? (
                    <p className="text-sm text-slate-200/80 line-clamp-3">
                      {category.description}
                    </p>
                  ) : null}
                </div>
                <div className="mt-6 flex items-center gap-2 text-sm font-medium text-violet-300 group-hover:text-violet-200 transition-colors">
                  {t("viewPartners")}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </motion.article>
            </LocalizedLink>
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
}
