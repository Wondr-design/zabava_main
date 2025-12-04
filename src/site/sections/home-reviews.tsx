export type HomeReviewItem = {
  quote: string;
  author: string;
  role?: string | null;
};

export type HomeReviewsContent = {
  title: string;
  eyebrow?: string;
  description?: string;
  layout?: "grid" | "carousel";
  items: HomeReviewItem[];
};

export const defaultHomeReviewsContent: HomeReviewsContent = {
  title: "Loved by partners & guests",
  eyebrow: "Testimonials",
  description:
    "Zabava keeps reservations, ticket edits, and loyalty points perfectly in sync.",
  layout: "grid",
  items: [
    {
      quote: "Door-side edits are finally fast for my staff.",
      author: "Ava Havel",
      role: "Experience Manager · Prague Museum",
    },
    {
      quote: "Guests love seeing their discounted tickets inside the QR email.",
      author: "Matej Procházka",
      role: "Partner Success Lead",
    },
    {
      quote: "Reward syncing just works across every locale.",
      author: "Kim Lee",
      role: "Director of CX",
    },
  ],
};

type HomeReviewsProps = HomeReviewsContent;

export function HomeReviews({
  title,
  eyebrow = "Testimonials",
  description,
  layout = "grid",
  items,
}: HomeReviewsProps) {
  const safeItems = items.length ? items : defaultHomeReviewsContent.items;
  return (
    <section className="mx-auto w-full max-w-[120rem] space-y-8 px-4 py-16 lg:px-24 text-white">
      <div className="space-y-3 text-center">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-emerald-300/80">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="font-[family-name:var(--font-influencer)] text-[48px] uppercase tracking-wide text-white leading-[0.8]">
          {title}
        </h2>
        {description ? (
          <p className="text-base text-slate-200/80">{description}</p>
        ) : null}
      </div>
      {safeItems.length ? (
        <div
          className={`grid gap-6 ${
            layout === "grid" ? "md:grid-cols-3" : "grid-cols-1"
          }`}
        >
          {safeItems.map((review, index) => (
            <figure
              key={`${review.author}-${review.quote.slice(0, 12)}`}
              className="group relative flex h-full flex-col rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-8 shadow-lg transition-all duration-300 hover:border-white/20 hover:shadow-xl hover:shadow-black/20"
            >
              {/* Quote Icon */}
              <div className="absolute top-6 right-6 opacity-10 group-hover:opacity-20 transition-opacity">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-white"
                >
                  <path
                    d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"
                    fill="currentColor"
                  />
                  <path
                    d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"
                    fill="currentColor"
                  />
                </svg>
              </div>

              {/* Content */}
              <div className="flex-1 flex flex-col">
                <blockquote className="flex-1 text-lg leading-relaxed text-white/95 mb-6 relative z-10">
                  <span className="text-2xl leading-none text-white/40 mr-1">
                    "
                  </span>
                  {review.quote}
                  <span className="text-2xl leading-none text-white/40 ml-1">
                    "
                  </span>
                </blockquote>

                <figcaption className="mt-auto pt-6 border-t border-white/10">
                  <p className="font-semibold text-white text-base mb-1">
                    {review.author}
                  </p>
                  {review.role ? (
                    <p className="text-sm text-slate-300/80">{review.role}</p>
                  ) : null}
                </figcaption>
              </div>
            </figure>
          ))}
        </div>
      ) : null}
    </section>
  );
}
