"use client";

import type { CSSProperties } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { motion, type Variants } from "framer-motion";

import { cn } from "@/lib/utils";
import { useTranslations } from "@/i18n/provider";
import { LocalizedLink } from "@/components/ui/localized-link";
import { Badge } from "@/components/ui/badge";

export interface HomeCategoryCard {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  accentColor?: string | null;
}

const heroTextVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

const cardsContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 100, damping: 15 },
  },
};

export function HomeHero({ categories }: { categories: HomeCategoryCard[] }) {
  const t = useTranslations("hero");

  return (
    <section className="relative isolate w-full overflow-hidden pt-20 sm:pt-24">
      {/* Background Gradients */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-violet-600/20 rounded-full blur-[100px] opacity-50 mix-blend-screen" />
        <div className="absolute bottom-0 left-1/4 w-[800px] h-[400px] bg-indigo-600/10 rounded-full blur-[80px] opacity-30" />
      </div>

      <div className="mx-auto max-w-[120rem] px-4 pb-20 lg:px-24">
        <motion.div
          className="flex flex-col items-center text-center"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.15 } },
          }}
        >
          <motion.div variants={heroTextVariants} className="mb-6">
            <Badge
              variant="outline"
              className="border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-sm font-medium text-violet-200 backdrop-blur-md hover:bg-violet-500/20 transition-colors"
            >
              <Sparkles className="mr-2 h-3.5 w-3.5 text-violet-300" />
              {t("tagline")}
            </Badge>
          </motion.div>

          <motion.h1
            variants={heroTextVariants}
            className="max-w-4xl text-balance text-5xl font-bold tracking-tight text-white sm:text-6xl md:text-7xl"
          >
            {t("headline")}
          </motion.h1>

          <motion.p
            variants={heroTextVariants}
            className="mt-6 max-w-2xl text-lg text-slate-300 leading-relaxed sm:text-xl"
          >
            {t("description")}
          </motion.p>

          <motion.div
            variants={heroTextVariants}
            className="mt-10 flex flex-wrap items-center justify-center gap-4"
          >
            <LocalizedLink
              href="#categories"
              className="inline-flex h-12 items-center justify-center rounded-full bg-white px-8 text-sm font-semibold text-slate-950 transition-all hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              {t("exploreCategories")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </LocalizedLink>
            <LocalizedLink
              href="/bonus"
              className="inline-flex h-12 items-center justify-center rounded-full border border-white/10 bg-white/5 px-8 text-sm font-semibold text-white transition-all hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              {t("checkBonus")}
            </LocalizedLink>
          </motion.div>
        </motion.div>

        <motion.div
          id="categories"
          className="mt-20 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          variants={cardsContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {categories.map((category, idx) => (
            <LocalizedLink
              key={category.id}
              href={`/categories/${category.slug}`}
              className="group relative"
            >
              <motion.article
                variants={cardVariants}
                className={cn(
                  "relative h-full overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 transition-all duration-300 hover:border-violet-500/50 hover:bg-white/10 hover:shadow-2xl hover:shadow-violet-500/10"
                )}
                style={
                  category.accentColor
                    ? ({
                        "--accent": category.accentColor,
                      } as CSSProperties)
                    : undefined
                }
              >
                <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-white/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                
                <div className="relative z-10 flex flex-col h-full">
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white shadow-inner ring-1 ring-white/20 group-hover:bg-violet-500 group-hover:text-white transition-colors duration-300">
                    {/* Placeholder icon based on index or category name could go here */}
                     <span className="text-lg font-bold">{category.name.charAt(0)}</span>
                  </div>
                  
                  <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-violet-200 transition-colors">
                    {category.name}
                  </h3>
                  
                  {category.description ? (
                    <p className="text-sm text-slate-400 line-clamp-3 mb-6 flex-grow">
                      {category.description}
                    </p>
                  ) : <div className="flex-grow" />}

                  <div className="flex items-center text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                    {t("viewPartners")}
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </div>
                </div>
              </motion.article>
            </LocalizedLink>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
