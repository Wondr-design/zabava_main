import type { CmsBlockDataMap, CmsBlockType } from "@/lib/cms/block-registry";
import type { Locale } from "@/i18n/config";

interface CmsDefaultBlock<TType extends CmsBlockType = CmsBlockType> {
  type: TType;
  data: CmsBlockDataMap[TType];
  visible?: boolean;
}

interface CmsDefaultEntry {
  title: string;
  blocks: CmsDefaultBlock[];
}

export const CMS_SECTIONS = [
  {
    slug: "home",
    label: "Homepage",
    description: "Primary marketing sections on the public landing page.",
  },
  {
    slug: "privacy",
    label: "Privacy policy",
    description: "Legal pages displayed on the public website.",
  },
  {
    slug: "faq",
    label: "FAQ",
    description:
      "Answers for guests, partners, and staff shown on support-heavy pages.",
  },
  {
    slug: "reviews",
    label: "Reviews",
    description:
      "Testimonial landing pages or sections embedded on partner highlight pages.",
  },
  {
    slug: "special-deals",
    label: "Special deals overview",
    description:
      "Hero and CTA sections for the public flash/special deals directory.",
  },
] as const;

const homeBlocksEn: CmsDefaultBlock[] = [
  {
    type: "hero",
    data: {
      eyebrow: "Zabava",
      title: "Curated adventures, effortless loyalty.",
      body: "Discover vetted partners, generate QR passes in seconds, and earn bonus points automatically after each visit.",
      align: "center",
      tone: "brand",
      ctaLabel: "Browse partners",
      ctaHref: "/en/partners",
    },
  },
  {
    type: "reviews",
    data: {
      title: "Loved by partners & guests",
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
    },
  },
  {
    type: "faq",
    data: {
      title: "Answers for every team",
      items: [
        {
          question: "How do staff edit ticket types?",
          answer:
            "They scan the QR code, open visit details, and use the partner ticket catalog to add or remove sub-options before marking the guest as visited.",
        },
        {
          question: "When are rewards credited?",
          answer:
            "Points are granted immediately after staff mark the visit as completed, and guests receive an email confirmation.",
        },
        {
          question: "Can we localize messaging?",
          answer:
            "Yes. Every CMS page supports individual locales so you can tailor copy for English, Czech, and beyond.",
        },
      ],
    },
  },
];

const homeBlocksCs: CmsDefaultBlock[] = [
  {
    type: "hero",
    data: {
      eyebrow: "Zabava",
      title: "Zážitek, rezervace a věrnost v jedné aplikaci.",
      body: "Najděte ověřené partnery, vygenerujte QR vstupenku během pár vteřin a získejte body hned po návštěvě.",
      align: "center",
      tone: "brand",
      ctaLabel: "Prohlédnout partnery",
      ctaHref: "/cs/partners",
    },
  },
  {
    type: "reviews",
    data: {
      title: "Partneři i hosté věří Zabavě",
      layout: "grid",
      items: [
        {
          quote: "Personál zvládne úpravy vstupenek během pár sekund.",
          author: "Lucie Jelínková",
          role: "Vedoucí provozu · Tech Park",
        },
        {
          quote: "Zákazníci vidí slevy i body přímo v QR kódu.",
          author: "Pavel Šmid",
          role: "Partner Manager",
        },
      ],
    },
  },
  {
    type: "faq",
    data: {
      title: "Časté dotazy",
      items: [
        {
          question: "Mohu měnit typy vstupenek na místě?",
          answer:
            "Ano. Personál otevře detail návštěvy po načtení QR kódu a upraví jednotlivé podtypy podle přání hosta.",
        },
        {
          question: "Kdy se přičítají body?",
          answer:
            "Ihned po potvrzení návštěvy personálem. Host dostane potvrzovací e-mail s přehledem bodů.",
        },
        {
          question: "Podporuje Zabava více jazyků?",
          answer:
            "Obsah v CMS můžete psát pro každý jazyk zvlášť a zachovat jednotné rozložení bloků.",
        },
      ],
    },
  },
];

const privacyBlocksEn: CmsDefaultBlock[] = [
  {
    type: "hero",
    data: {
      eyebrow: "Zabava",
      title: "Privacy Policy",
      body: "We use your information to confirm visits, deliver QR passes, and award loyalty perks. Here’s how we collect, process, and safeguard that data.",
      align: "left",
      tone: "brand",
      ctaLabel: "Contact privacy",
      ctaHref: "mailto:privacy@zabava.com",
    },
  },
  {
    type: "legal_section",
    data: {
      heading: "What we collect",
      body: "Booking forms capture details you submit (name, email, ticket selections, guest counts, and optional notes). We log verification attempts and staff check-ins to prevent fraud and ensure accurate reward payouts.",
    },
  },
  {
    type: "legal_section",
    data: {
      heading: "How your data is used",
      body: "We generate QR codes, verify attendance, award loyalty points, send transactional updates, and provide anonymized analytics to our partners to improve guest experiences.",
    },
  },
  {
    type: "legal_section",
    data: {
      heading: "Retention and sharing",
      body: "Visit submissions are stored for up to 24 months so attractions can verify history. We never sell personal data. Information is shared only with the attraction linked to your booking, trusted processors (email delivery, analytics), or when legally required.",
    },
  },
  {
    type: "legal_section",
    data: {
      heading: "Your choices",
      body: "Contact privacy@zabava.com to request access, updates, or deletion of your data. You can revoke marketing consents anytime using the unsubscribe links in each email.",
    },
  },
];

const privacyBlocksCs: CmsDefaultBlock[] = [
  {
    type: "hero",
    data: {
      eyebrow: "Zabava",
      title: "Zásady ochrany osobních údajů",
      body: "Vaše údaje používáme k potvrzení návštěvy, doručení QR kódů a přidělení věrnostních výhod. Níže popisujeme, jak data shromažďujeme, zpracováváme a chráníme.",
      align: "left",
      tone: "brand",
      ctaLabel: "Kontaktujte nás",
      ctaHref: "mailto:privacy@zabava.com",
    },
  },
  {
    type: "legal_section",
    data: {
      heading: "Jaká data shromažďujeme",
      body: "Formuláře ukládají údaje, které vyplníte (jméno, e-mail, vybrané typy vstupenek, počty hostů a dobrovolné poznámky). Zaznamenáváme také ověření a odbavení, abychom předešli podvodům.",
    },
  },
  {
    type: "legal_section",
    data: {
      heading: "K čemu data používáme",
      body: "Generujeme QR kódy, ověřujeme účast, připisujeme body, zasíláme transakční e-maily a poskytujeme anonymizovaná data partnerům pro zlepšení služeb.",
    },
  },
  {
    type: "legal_section",
    data: {
      heading: "Uchování a sdílení",
      body: "Záznamy uchováváme až 24 měsíců pro ověření historie návštěv. Údaje nikdy neprodáváme. Sdílíme je pouze s atrakcí spojenou s vaší rezervací, důvěryhodnými zpracovateli nebo pokud to vyžaduje zákon.",
    },
  },
  {
    type: "legal_section",
    data: {
      heading: "Vaše práva",
      body: "Kontaktujte privacy@zabava.com a požádejte o přístup, úpravu nebo smazání údajů. Souhlasy s marketingem lze kdykoli odvolat prostřednictvím odhlašovacího odkazu v e-mailech.",
    },
  },
];

const faqBlocksEn: CmsDefaultBlock[] = [
  {
    type: "hero",
    data: {
      eyebrow: "Support Center",
      title: "All the answers guests need before tapping Generate QR",
      body: "Highlight clear next steps for visitors, partners, and staff. Each FAQ block can be reused across locales with localized copy.",
      align: "center",
      tone: "muted",
    },
  },
  {
    type: "faq",
    data: {
      title: "Guests & rewards",
      items: [
        {
          question: "When does my QR code expire?",
          answer:
            "Each deal email lists the last valid day. If the partner enforces a start/end window, it is also visible inside the QR generator and the confirmation email.",
        },
        {
          question: "How do I pick the right ticket type?",
          answer:
            "The first step of the form explains the minimum visitors per ticket. We verify you meet that requirement before issuing the QR code.",
        },
      ],
    },
  },
  {
    type: "faq",
    data: {
      title: "Partners & staff",
      items: [
        {
          question: "Can staff modify ticket selections on arrival?",
          answer:
            "Yes. After scanning the QR code, staff can open the visit detail view, adjust ticket requirements, and lock in the final visitor mix before marking the visit as complete.",
        },
        {
          question: "Where do new deals show up?",
          answer:
            "Live deals populate the public flash deals page instantly. You can embed CMS managed sections on landing pages or link directly from partner marketing.",
        },
      ],
    },
  },
  {
    type: "link_collection",
    data: {
      title: "Need more help?",
      layout: "stack",
      items: [
        {
          label: "Contact support",
          href: "mailto:support@zabava.com",
          description: "We respond within one business day.",
          variant: "primary",
        },
        {
          label: "View partner guides",
          href: "/en/partners/guides",
          description: "How to configure tickets, rewards, and CMS blocks.",
          variant: "ghost",
        },
      ],
    },
  },
];

const faqBlocksCs: CmsDefaultBlock[] = [
  {
    type: "hero",
    data: {
      eyebrow: "Podpora Zabava",
      title: "Všechny odpovědi pro hosty i partnery na jednom místě",
      body: "Každý FAQ blok můžete přeložit do konkrétního jazyka a zároveň zachovat stejné rozložení napříč stránkami.",
      align: "center",
      tone: "muted",
    },
  },
  {
    type: "faq",
    data: {
      title: "Hosté a věrnost",
      items: [
        {
          question: "Kdy vyprší můj QR kód?",
          answer:
            "Poslední platný den je uveden v e-mailu s QR kódem i v prvním kroku formuláře. Pokud má partner časové omezení, uvidíte ho na obou místech.",
        },
        {
          question: "Jak si vyberu správný typ vstupenky?",
          answer:
            "První krok formuláře vysvětluje, kolik osob je pro daný typ potřeba. Před vydáním QR kódu ověříme, že splňujete podmínky.",
        },
      ],
    },
  },
  {
    type: "faq",
    data: {
      title: "Partneři a personál",
      items: [
        {
          question: "Může personál upravit vstupenky až na místě?",
          answer:
            "Ano. Po načtení QR kódu otevře detail návštěvy, upraví požadovaný počet subtypů a návštěvu označí jako dokončenou.",
        },
        {
          question: "Kde se zobrazují nové nabídky?",
          answer:
            "Publikované nabídky se okamžitě objeví na stránce s flash deals. Tyto CMS bloky můžete vložit i na marketingové stránky partnerů.",
        },
      ],
    },
  },
  {
    type: "link_collection",
    data: {
      title: "Potřebujete poradit?",
      layout: "stack",
      items: [
        {
          label: "Kontaktujte podporu",
          href: "mailto:support@zabava.com",
          description: "Ozveme se do jednoho pracovního dne.",
          variant: "primary",
        },
        {
          label: "Průvodci pro partnery",
          href: "/cs/partners/navody",
          description: "Jak nastavit vstupenky, odměny a obsah CMS.",
          variant: "ghost",
        },
      ],
    },
  },
];

const reviewsBlocksEn: CmsDefaultBlock[] = [
  {
    type: "hero",
    data: {
      eyebrow: "Partner love",
      title: "Reviews and press snippets that boost conversion",
      body: "Mix editorial quotes, carousel testimonials, and CTA link lists to drive visitors to your priority experiences.",
      align: "center",
      tone: "brand",
    },
  },
  {
    type: "reviews",
    data: {
      title: "Enterprise experiences choose Zabava",
      layout: "carousel",
      items: [
        {
          quote:
            "Generating QR passes with required ticket mixes cut our concierge time in half.",
          author: "Sara Knights",
          role: "Hospitality Lead · Aurora Voyage",
        },
        {
          quote:
            "CMS-managed content means marketing can tweak testimonials without new releases.",
          author: "Daniel Novak",
          role: "Head of Digital · City Experience",
        },
        {
          quote:
            "We ship faster because every landing section now lives in one dashboard.",
          author: "Marta Nowak",
          role: "Growth Manager · Urban Escapes",
        },
      ],
    },
  },
  {
    type: "link_collection",
    data: {
      title: "Ready to create your own page?",
      layout: "grid",
      items: [
        {
          label: "Browse flash deals",
          href: "/en/special-flash-deals",
          description: "See live examples that reuse these CMS blocks.",
          variant: "primary",
        },
        {
          label: "Book a demo",
          href: "https://calendly.com/zabava/demo",
          description: "Walk through the CMS + QR flow with our team.",
          variant: "secondary",
        },
        {
          label: "Partner success stories",
          href: "/en/reviews",
          description: "Explore embedded reviews across landing pages.",
          variant: "ghost",
        },
      ],
    },
  },
];

const reviewsBlocksCs: CmsDefaultBlock[] = [
  {
    type: "hero",
    data: {
      eyebrow: "Důvěřují nám",
      title: "Reference a citace, které zvednou důvěru návštěvníků",
      body: "Kombinujte karusel s recenzemi a dalšími CTA bloky a veďte návštěvníky na nejdůležitější akce.",
      align: "center",
      tone: "brand",
    },
  },
  {
    type: "reviews",
    data: {
      title: "Partneři doporučují Zabavu",
      layout: "grid",
      items: [
        {
          quote:
            "QR kódy s přesnými požadavky na vstupenky nám šetří desítky minut každou hodinu.",
          author: "Andrea Pešková",
          role: "Customer Success · Royal Exhibits",
        },
        {
          quote:
            "Marketing si upraví citace v CMS bez zásahu vývoje a nový obsah je online během minuty.",
          author: "Radek Jelínek",
          role: "Founder · Adventure Labs",
        },
      ],
    },
  },
  {
    type: "link_collection",
    data: {
      title: "Další akce",
      layout: "grid",
      items: [
        {
          label: "Flash deals",
          href: "/cs/special-flash-deals",
          description: "Živá nabídka s tímto obsahem v praxi.",
          variant: "primary",
        },
        {
          label: "Domluvte si demo",
          href: "https://calendly.com/zabava/demo",
          description: "Získáte průvodce všemi kroky v CMS.",
          variant: "secondary",
        },
      ],
    },
  },
];

const specialDealsBlocksEn: CmsDefaultBlock[] = [
  {
    type: "hero",
    data: {
      eyebrow: "Flash & special deals",
      title: "Flexible QR passes for curated group experiences",
      body: "Every offer enforces ticket requirements, partner-set capacities, and timezone-aware validity. Embed this section on landing pages to highlight what guests unlock.",
      align: "center",
      tone: "brand",
      ctaLabel: "Browse current deals",
      ctaHref: "/en/special-flash-deals",
    },
  },
  {
    type: "link_collection",
    data: {
      title: "Quick actions",
      layout: "grid",
      items: [
        {
          label: "FAQ for guests",
          href: "/en/faq",
          description: "Explain minimum group sizes and QR timing.",
          variant: "ghost",
        },
        {
          label: "Contact concierge",
          href: "mailto:hello@zabava.cz",
          description: "Plan a custom itinerary for large groups.",
          variant: "primary",
        },
      ],
    },
  },
];

const specialDealsBlocksCs: CmsDefaultBlock[] = [
  {
    type: "hero",
    data: {
      eyebrow: "Speciální nabídky",
      title: "Flexibilní QR kódy pro skupinové zážitky",
      body: "Každá nabídka respektuje požadavky na vstupenky, kapacity partnera a časová pásma. Sdílejte tuto sekci na stránkách, kde přivádíte návštěvníky na bleskové akce.",
      align: "center",
      tone: "brand",
      ctaLabel: "Zobrazit nabídky",
      ctaHref: "/cs/special-flash-deals",
    },
  },
  {
    type: "link_collection",
    data: {
      title: "Nejčastější kroky",
      layout: "grid",
      items: [
        {
          label: "FAQ pro hosty",
          href: "/cs/faq",
          description: "Vysvětlete velikost skupin a platnost QR.",
          variant: "ghost",
        },
        {
          label: "Kontaktujte concierge",
          href: "mailto:hello@zabava.cz",
          description: "Naplánujeme balíček pro vaši skupinu.",
          variant: "primary",
        },
      ],
    },
  },
];

export const CMS_DEFAULTS: Record<
  (typeof CMS_SECTIONS)[number]["slug"],
  Partial<Record<Locale, CmsDefaultEntry>>
> = {
  home: {
    en: {
      title: "Homepage",
      blocks: homeBlocksEn,
    },
    cs: {
      title: "Homepage",
      blocks: homeBlocksCs,
    },
  },
  privacy: {
    en: {
      title: "Privacy Policy",
      blocks: privacyBlocksEn,
    },
    cs: {
      title: "Zásady ochrany osobních údajů",
      blocks: privacyBlocksCs,
    },
  },
  faq: {
    en: {
      title: "FAQ",
      blocks: faqBlocksEn,
    },
    cs: {
      title: "FAQ",
      blocks: faqBlocksCs,
    },
  },
  reviews: {
    en: {
      title: "Reviews",
      blocks: reviewsBlocksEn,
    },
    cs: {
      title: "Recenze",
      blocks: reviewsBlocksCs,
    },
  },
  "special-deals": {
    en: {
      title: "Special Deals",
      blocks: specialDealsBlocksEn,
    },
    cs: {
      title: "Speciální nabídky",
      blocks: specialDealsBlocksCs,
    },
  },
};

export function getDefaultCmsPage(slug: string, locale: Locale) {
  const defaults = CMS_DEFAULTS[slug as keyof typeof CMS_DEFAULTS];
  if (!defaults) return null;
  return defaults[locale] ?? defaults.en ?? Object.values(defaults)[0] ?? null;
}
