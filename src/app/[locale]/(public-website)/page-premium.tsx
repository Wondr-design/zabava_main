import { PremiumHero } from "@/site/sections/premium-hero";
import { PremiumFeatures } from "@/site/sections/premium-features";
import { PremiumPartnerBenefits } from "@/site/sections/premium-partner-benefits";
import { PremiumHowItWorks } from "@/site/sections/premium-how-it-works";
import { PremiumTestimonials } from "@/site/sections/premium-testimonials";
import { PremiumFooter } from "@/site/components/premium-footer";
import { PartnerLogoGrid } from "@/site/partners/partner-logo-grid";
import { getPublicDirectory } from "@/lib/data/site-directory";

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

export default async function PremiumHomePage({ params }: HomePageProps) {
  const { partners } = await getPublicDirectory();

  const partnerLogos = partners.map((partner) => ({
    partnerId: partner.partnerId,
    slug: partner.slug,
    name: partner.name,
    logoUrl: partner.media.logoUrl,
    heroImageUrl: partner.heroImageUrl,
  }));

  return (
    <main className="flex min-h-screen flex-col bg-white">
      <PremiumHero />
      <PremiumFeatures />
      <PremiumPartnerBenefits />
      <PremiumHowItWorks />
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Trusted by Leading Experience Partners
            </h2>
            <p className="text-lg text-gray-600">
              Join hundreds of successful businesses using Zabava
            </p>
          </div>
          <PartnerLogoGrid partners={partnerLogos} />
        </div>
      </section>
      <PremiumTestimonials />
      <PremiumFooter />
    </main>
  );
}

