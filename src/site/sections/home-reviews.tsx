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
        <h2 className="text-3xl font-semibold">{title}</h2>
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
          {safeItems.map((review) => (
            <figure
              key={`${review.author}-${review.quote.slice(0, 12)}`}
              className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_50px_rgba(15,15,20,0.4)] backdrop-blur"
            >
              <blockquote className="flex-1 text-lg leading-relaxed text-white/90">
                "{review.quote}"
              </blockquote>
              <figcaption className="mt-4 text-sm text-slate-200/80">
                <p className="font-semibold text-white">{review.author}</p>
                {review.role ? <p>{review.role}</p> : null}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}
    </section>
  );
}
