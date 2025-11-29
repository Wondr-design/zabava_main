export type HomeFaqItem = { question: string; answer: string };

export type HomeFaqContent = {
  title: string;
  eyebrow?: string;
  description?: string;
  items: HomeFaqItem[];
};

export const defaultHomeFaqContent: HomeFaqContent = {
  title: "Answers for every team",
  eyebrow: "FAQ",
  description: "Still curious? These are the questions we hear most often.",
  items: [
    {
      question: "How do I edit a visitor’s ticket type on arrival?",
      answer:
        "Staff can scan the QR code, open the visit editor, and use the same ticket catalog configured in the CMS to add or remove ticket types before marking the guest as visited.",
    },
    {
      question: "Do guests automatically earn rewards?",
      answer:
        "Yes. Once staff mark the visit as completed, Zabava syncs the estimated points to the guest’s account and emails a confirmation.",
    },
    {
      question: "Can we localize copy for multiple languages?",
      answer:
        "Absolutely. The CMS lets you edit each locale separately while keeping layout and blocks in sync.",
    },
  ],
};

type HomeFaqProps = HomeFaqContent;

export function HomeFaq({
  title,
  eyebrow = "FAQ",
  description,
  items,
}: HomeFaqProps) {
  const safeItems = items.length ? items : defaultHomeFaqContent.items;
  return (
    <section className="mx-auto w-full max-w-[120rem] space-y-8 px-4 py-16 lg:px-24 text-white">
      <div className="space-y-3 text-center">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-sky-300/80">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-3xl font-semibold">{title}</h2>
        {description ? (
          <p className="text-base text-slate-200/80">{description}</p>
        ) : null}
      </div>
      {safeItems.length ? (
        <div className="space-y-4">
          {safeItems.map((faq) => (
            <details
              key={faq.question}
              className="group rounded-3xl border border-white/10 bg-white/5 px-6 py-4 shadow-[0_16px_40px_rgba(15,15,20,0.35)] backdrop-blur transition"
            >
              <summary className="cursor-pointer list-none text-lg font-semibold text-white/90 focus:outline-none">
                {faq.question}
              </summary>
              <p className="mt-3 text-base text-slate-200/80 leading-relaxed">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      ) : null}
    </section>
  );
}
