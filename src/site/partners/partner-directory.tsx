"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X, ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { LocalizedLink } from "@/components/ui/localized-link";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";

export interface PartnerDirectoryCategory {
  id: string;
  name: string;
  slug: string;
}

export interface PartnerDirectoryPartner {
  partnerId: string;
  slug: string;
  name: string;
  description: string | null;
  heroImageUrl: string | null;
  categories: Array<{ id: string; name: string; slug: string }>;
  highlights: Array<{ id: string; title: string; description?: string | null }>;
  selectedFormId: string | null;
  ctaPrimaryLabel: string | null;
}

interface PartnerDirectoryProps {
  categories: PartnerDirectoryCategory[];
  partners: PartnerDirectoryPartner[];
}

const ALL_KEY = "all";

export function PartnerDirectory({ categories, partners }: PartnerDirectoryProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeCategory, setActiveCategory] = useState<string>(ALL_KEY);
  const urlQuery = searchParams?.get("q") ?? "";
  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  useEffect(() => {
    setSearchQuery(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    if (!router || !pathname) return;
    const params = new URLSearchParams(searchParams?.toString());
    const nextQuery = searchQuery.trim();
    if (nextQuery) {
      params.set("q", nextQuery);
    } else {
      params.delete("q");
    }
    const next = params.toString();
    const current = searchParams?.toString() ?? "";
    if (next === current) return;
    router.replace(`${pathname}${next ? `?${next}` : ""}`, { scroll: false });
  }, [searchQuery, pathname, router, searchParams]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const highlightRegex = useMemo(() => {
    if (!normalizedQuery) return null;
    const escaped = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(${escaped})`, "ig");
  }, [normalizedQuery]);

  const renderHighlight = useMemo(
    () =>
      function render(text?: string | null) {
        if (!text) return null;
        if (!highlightRegex) return text;
        const parts = text.split(highlightRegex);
        return parts.map((part, index) =>
          part.toLowerCase() === normalizedQuery ? (
            <mark
              key={`${text}-${index}`}
              className="rounded bg-[var(--ds-accent)]/40 px-1 text-white font-medium"
            >
              {part}
            </mark>
          ) : (
            <span key={`${text}-${index}`}>{part}</span>
          )
        );
      },
    [highlightRegex, normalizedQuery]
  );

  const filteredPartners = useMemo(() => {
    const list = partners.filter((partner) => {
      const matchesCategory =
        activeCategory === ALL_KEY
          ? true
          : partner.categories.some((category) => category.id === activeCategory);
      if (!matchesCategory) return false;
      if (!normalizedQuery) return true;
      const haystack = [
        partner.name,
        partner.description ?? "",
        ...partner.categories.map((category) => category.name),
        partner.highlights?.map((highlight) => highlight.title).join(" ") ?? "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [activeCategory, partners, normalizedQuery]);

  const clearSearch = () => {
    setSearchQuery("");
  };

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-12 px-4 py-16 sm:gap-16 lg:px-8 lg:py-24">
      {/* Header Section */}
      <div className="flex flex-col gap-8">
        <div className="space-y-4">
          <h1
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl uppercase tracking-wide leading-tight"
            style={{ fontFamily: "var(--font-influencer)" }}
          >
            Explore partners
          </h1>
          <p className="text-lg sm:text-xl text-foreground/80 leading-relaxed max-w-3xl">
            Browse every Zabava partner and narrow down your search by category.
            Reserve in seconds, generate your QR pass instantly, and start earning rewards.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative group">
          <div
            className={cn(
              "relative flex items-center gap-3 rounded-2xl border transition-all duration-300",
              "bg-[var(--ds-surface-card)]/50 backdrop-blur-sm",
              isSearchFocused
                ? "border-[var(--ds-accent)]/60 shadow-lg shadow-[var(--ds-accent)]/10"
                : "border-border/30 hover:border-border/50",
              "focus-within:border-[var(--ds-accent)]/60 focus-within:shadow-lg focus-within:shadow-[var(--ds-accent)]/10"
            )}
          >
            <div className="absolute left-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-foreground/40 transition-colors group-focus-within:text-[var(--ds-accent)]" />
            </div>
            <Input
              id="partner-search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              placeholder="Search by partner name, description, or category..."
              className={cn(
                "h-14 pl-12 pr-12 border-0 bg-transparent text-base text-foreground",
                "placeholder:text-foreground/40",
                "focus-visible:ring-0 focus-visible:ring-offset-0"
              )}
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-4 flex items-center justify-center h-8 w-8 rounded-full bg-foreground/10 hover:bg-foreground/20 text-foreground/60 hover:text-foreground transition-colors"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--ds-accent)]" />
            <span className="text-sm font-semibold uppercase tracking-wider text-foreground/60">
              Filter by category
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <motion.button
              type="button"
              onClick={() => setActiveCategory(ALL_KEY)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "relative rounded-full border px-5 py-2.5 text-sm font-medium transition-all min-h-[44px] touch-manipulation",
                "font-[family-name:var(--font-influencer)] uppercase tracking-wide",
                activeCategory === ALL_KEY
                  ? "border-[var(--ds-accent)]/80 bg-[var(--ds-accent)]/10 text-[var(--ds-accent)] shadow-lg shadow-[var(--ds-accent)]/20"
                  : "border-border/30 bg-[var(--ds-surface-card)]/50 text-foreground/80 hover:border-[var(--ds-accent)]/40 hover:bg-[var(--ds-accent)]/5",
              )}
            >
              All partners
              {activeCategory === ALL_KEY && (
                <motion.div
                  layoutId="activeCategory"
                  className="absolute inset-0 rounded-full border-2 border-[var(--ds-accent)]/80"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
            </motion.button>
            {categories.map((category) => (
              <motion.button
                key={category.id}
                type="button"
                onClick={() => setActiveCategory(category.id)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "relative rounded-full border px-5 py-2.5 text-sm font-medium transition-all min-h-[44px] touch-manipulation whitespace-nowrap",
                  "font-[family-name:var(--font-influencer)] uppercase tracking-wide",
                  activeCategory === category.id
                    ? "border-[var(--ds-accent)]/80 bg-[var(--ds-accent)]/10 text-[var(--ds-accent)] shadow-lg shadow-[var(--ds-accent)]/20"
                    : "border-border/30 bg-[var(--ds-surface-card)]/50 text-foreground/80 hover:border-[var(--ds-accent)]/40 hover:bg-[var(--ds-accent)]/5",
                )}
              >
                {category.name}
                {activeCategory === category.id && (
                  <motion.div
                    layoutId="activeCategory"
                    className="absolute inset-0 rounded-full border-2 border-[var(--ds-accent)]/80"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-foreground/60">
            Showing <span className="font-semibold text-foreground">{filteredPartners.length}</span>{" "}
            {filteredPartners.length === 1 ? "partner" : "partners"}
            {activeCategory !== ALL_KEY && (
              <>
                {" "}in{" "}
                <span className="font-semibold text-[var(--ds-accent)]">
                  {categories.find((cat) => cat.id === activeCategory)?.name ?? "All"}
                </span>
              </>
            )}
          </span>
          {filteredPartners.length > 0 && (
            <LocalizedLink
              href="#partner-grid"
              className="text-xs uppercase tracking-wider text-[var(--ds-accent)]/80 hover:text-[var(--ds-accent)] transition-colors flex items-center gap-1"
            >
              Skip to results
              <ArrowRight className="h-3 w-3" />
            </LocalizedLink>
          )}
        </div>
      </div>

      {/* Partner Grid */}
      <AnimatePresence mode="wait">
        {filteredPartners.length > 0 ? (
          <motion.div
            key={`${activeCategory}-${normalizedQuery}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            id="partner-grid"
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:gap-8"
          >
            {filteredPartners.map((partner, index) => (
              <motion.article
                key={partner.partnerId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.4 }}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border/30 bg-[var(--ds-surface-card)]/50 backdrop-blur-sm transition-all duration-300 hover:border-[var(--ds-accent)]/40 hover:shadow-xl hover:shadow-[var(--ds-accent)]/10 hover:-translate-y-1"
              >
                {/* Image Section */}
                <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-slate-800/50 to-slate-900/50">
                  {partner.heroImageUrl ? (
                    <Image
                      src={partner.heroImageUrl}
                      alt={partner.name}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                      sizes="(max-width: 1024px) 100vw, 33vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-[var(--ds-accent)]/20 via-slate-800/40 to-slate-900/50">
                      <span className="text-4xl font-bold text-foreground/30 uppercase tracking-wider">
                        {partner.name.slice(0, 2)}
                      </span>
                    </div>
                  )}
                  {/* Category Badges */}
                  <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-2 bg-gradient-to-t from-slate-950/95 via-slate-950/80 to-transparent px-4 pb-3 pt-8">
                    {partner.categories.slice(0, 2).map((category) => (
                      <span
                        key={category.id}
                        className="rounded-full bg-[var(--ds-accent)]/20 border border-[var(--ds-accent)]/30 px-2.5 py-1 text-xs font-medium uppercase tracking-wider text-[var(--ds-accent)]"
                      >
                        {category.name}
                      </span>
                    ))}
                    {partner.categories.length > 2 && (
                      <span className="rounded-full bg-foreground/10 border border-border/30 px-2.5 py-1 text-xs font-medium uppercase tracking-wider text-foreground/60">
                        +{partner.categories.length - 2}
                      </span>
                    )}
                  </div>
                </div>

                {/* Content Section */}
                <div className="flex flex-1 flex-col gap-4 p-6">
                  <div className="flex flex-col gap-2">
                    <h2 className="text-xl font-semibold text-foreground leading-tight">
                      {renderHighlight(partner.name) ?? partner.name}
                    </h2>
                    {partner.description && (
                      <p className="text-sm text-foreground/70 leading-relaxed line-clamp-2">
                        {renderHighlight(partner.description) ?? partner.description}
                      </p>
                    )}
                  </div>

                  {/* Highlights */}
                  {partner.highlights && partner.highlights.length > 0 && (
                    <ul className="space-y-1.5 text-sm text-foreground/60">
                      {partner.highlights.slice(0, 2).map((highlight) => (
                        <li key={highlight.id} className="flex items-start gap-2 line-clamp-1">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--ds-accent)] flex-shrink-0" />
                          <span>
                            <span className="font-medium text-foreground/80">
                              {renderHighlight(highlight.title) ?? highlight.title}
                            </span>
                            {highlight.description && (
                              <span className="text-foreground/50">
                                {" "}– {highlight.description}
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Actions */}
                  <div className="mt-auto flex flex-col gap-2 pt-2">
                    <LocalizedLink
                      href={`/partners/${partner.slug}`}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/30 bg-[var(--ds-surface-elevated)]/50 px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:border-[var(--ds-accent)]/40 hover:bg-[var(--ds-accent)]/5 hover:text-[var(--ds-accent)] min-h-[44px] touch-manipulation group/link"
                    >
                      Learn more
                      <ArrowRight className="h-4 w-4 transition-transform group-hover/link:translate-x-1" />
                    </LocalizedLink>
                    {partner.selectedFormId ? (
                      <LocalizedLink
                        href={`/partners/${partner.slug}/book`}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--ds-accent)] to-[var(--ds-accent-hover)] px-4 py-2.5 text-sm font-medium text-[var(--ds-text-inverse)] shadow-lg shadow-[var(--ds-accent)]/20 transition-all hover:shadow-xl hover:shadow-[var(--ds-accent)]/30 hover:-translate-y-0.5 min-h-[44px] touch-manipulation"
                      >
                        {partner.ctaPrimaryLabel ?? "Reserve and get QR pass"}
                      </LocalizedLink>
                    ) : (
                      <span className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/30 bg-[var(--ds-surface-muted)]/50 px-4 py-2.5 text-sm font-medium text-foreground/50 min-h-[44px]">
                        Booking coming soon
                      </span>
                    )}
                  </div>
                </div>
              </motion.article>
            ))}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="rounded-full bg-[var(--ds-accent)]/10 p-6 mb-6">
              <Search className="h-12 w-12 text-[var(--ds-accent)]/60" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">No partners found</h3>
            <p className="text-foreground/60 max-w-md">
              Try adjusting your search or filter criteria to find what you're looking for.
            </p>
            {(searchQuery || activeCategory !== ALL_KEY) && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setActiveCategory(ALL_KEY);
                }}
                className="mt-6 rounded-xl border border-[var(--ds-accent)]/30 bg-[var(--ds-accent)]/10 px-6 py-2.5 text-sm font-medium text-[var(--ds-accent)] hover:bg-[var(--ds-accent)]/20 transition-colors"
              >
                Clear all filters
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
