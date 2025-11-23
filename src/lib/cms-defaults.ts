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
};

export function getDefaultCmsPage(slug: string, locale: Locale) {
  const defaults = CMS_DEFAULTS[slug as keyof typeof CMS_DEFAULTS];
  if (!defaults) return null;
  return defaults[locale] ?? defaults.en ?? Object.values(defaults)[0] ?? null;
}

