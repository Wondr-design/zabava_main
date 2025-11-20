"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { LocalizedLink } from "@/components/ui/localized-link";
import { Input } from "@/components/ui/input";

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
                  className="rounded bg-violet-500/40 px-1 text-white font-medium"
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

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:gap-10 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
      <div className="flex flex-col gap-6">
        <div className="space-y-2 sm:space-y-3">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl lg:text-6xl bg-gradient-to-r from-white via-violet-200 to-purple-200 bg-clip-text text-transparent">
            Explore partners
          </h1>
          <p className="text-base text-slate-200 leading-relaxed sm:text-lg md:text-xl max-w-2xl">
            Browse every Zabava partner and narrow down your search by category.
            Reserve in seconds, generate your QR pass instantly, and start earning rewards.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <div className="relative">
            <label htmlFor="partner-search" className="sr-only">
              Search partners
            </label>
            <Input
              id="partner-search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by partner name, description, or category"
              className="h-12 border-white/20 bg-white/10 text-base text-white placeholder:text-slate-400 focus-visible:ring-violet-400 focus-visible:border-violet-400/60 transition-all"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setActiveCategory(ALL_KEY)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition min-h-[44px] touch-manipulation",
                activeCategory === ALL_KEY
                  ? "border-violet-400/80 bg-gradient-to-r from-violet-500/30 via-indigo-500/30 to-purple-500/30 text-white shadow-lg shadow-violet-500/20"
                  : "border-white/20 bg-white/5 text-slate-200 hover:border-violet-300/70 hover:bg-white/10",
              )}
            >
              All partners
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategory(category.id)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium transition min-h-[44px] touch-manipulation whitespace-nowrap",
                  activeCategory === category.id
                    ? "border-violet-400/80 bg-gradient-to-r from-violet-500/30 via-indigo-500/30 to-purple-500/30 text-white shadow-lg shadow-violet-500/20"
                    : "border-white/20 bg-white/5 text-slate-200 hover:border-violet-300/70 hover:bg-white/10",
                )}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-slate-300">
          <span className="text-xs sm:text-sm">
            Showing <span className="font-semibold text-white">{filteredPartners.length}</span>{" "}
            {filteredPartners.length === 1 ? "partner" : "partners"}
            {activeCategory !== ALL_KEY
              ? ` in ${categories.find((cat) => cat.id === activeCategory)?.name ?? "All"}`
              : ""}
          </span>
          <LocalizedLink
            href="#partner-grid"
            className="text-xs uppercase tracking-[0.25em] text-violet-300 hover:text-violet-200 transition-colors"
          >
            Skip to results
          </LocalizedLink>
        </div>
      </div>

      <div
        id="partner-grid"
        className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8 xl:grid-cols-3"
      >
        {filteredPartners.map((partner) => (
          <article
            key={partner.partnerId}
            className="group flex h-full flex-col overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-white/10 via-white/5 to-white/5 shadow-lg shadow-black/30 backdrop-blur transition hover:-translate-y-1 hover:border-violet-400/60 hover:shadow-violet-500/20"
          >
            <div className="relative aspect-[4/3] overflow-hidden">
              {partner.heroImageUrl ? (
                <Image
                  src={partner.heroImageUrl}
                  alt={partner.name}
                  fill
                  className="object-cover transition duration-500 group-hover:scale-105"
                  sizes="(max-width: 1024px) 100vw, 33vw"
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-gradient-to-br from-indigo-500/30 via-slate-800/40 to-slate-900 text-3xl font-semibold text-white/40">
                  {partner.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-2 bg-gradient-to-t from-slate-950/90 to-transparent px-4 sm:px-5 pb-3 sm:pb-4 pt-12 sm:pt-14 text-xs uppercase tracking-[0.25em] text-violet-200">
                {partner.categories.slice(0, 2).map((category) => (
                  <span key={category.id}>{category.name}</span>
                ))}
                {partner.categories.length > 2 ? <span>+{partner.categories.length - 2}</span> : null}
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-4 sm:gap-6 p-4 sm:p-6">
              <div className="flex flex-col gap-2 sm:gap-3">
                <h2 className="text-lg sm:text-xl font-semibold text-white">
                  {renderHighlight(partner.name) ?? partner.name}
                </h2>
                {partner.description ? (
                  <p className="text-sm text-slate-200 leading-relaxed line-clamp-3">
                    {renderHighlight(partner.description) ?? partner.description}
                  </p>
                ) : null}
              </div>

              {partner.highlights && partner.highlights.length > 0 ? (
                <ul className="space-y-2 text-sm text-slate-200">
                  {partner.highlights.slice(0, 3).map((highlight) => (
                    <li key={highlight.id} className="line-clamp-2">
                      <span className="font-semibold text-slate-100">
                        {renderHighlight(highlight.title) ?? highlight.title}
                      </span>
                      {highlight.description ? ` – ${highlight.description}` : null}
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-auto flex flex-col gap-2 sm:gap-3">
                <LocalizedLink
                  href={`/partners/${partner.slug}`}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-violet-300/70 px-4 py-2.5 text-sm font-medium text-violet-100 transition hover:-translate-y-0.5 hover:border-violet-200 hover:text-white min-h-[44px] touch-manipulation"
                >
                  Learn more
                </LocalizedLink>
                {partner.selectedFormId ? (
                  <LocalizedLink
                    href={`/partners/${partner.slug}/book`}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-purple-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-violet-500/40 transition hover:from-violet-600 hover:via-indigo-600 hover:to-purple-600 min-h-[44px] touch-manipulation"
                  >
                    {partner.ctaPrimaryLabel ?? "Reserve and get QR pass"}
                  </LocalizedLink>
                ) : (
                  <span className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 min-h-[44px]">
                    Booking coming soon
                  </span>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
