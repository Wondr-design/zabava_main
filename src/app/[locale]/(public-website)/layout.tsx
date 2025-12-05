import type { ReactNode } from "react";

import "@/styles/theme-public-premium.css";

import { BodyThemeClass } from "@/components/body-theme-class";
import { PremiumNav } from "@/site/components/premium-nav";
import { PremiumLoader } from "@/site/components/premium-loader";

type SiteLayoutProps = {
  children: ReactNode;
};

export default function SiteLayout({ children }: SiteLayoutProps) {
  return (
    <div className="theme-public-premium min-h-screen bg-white">
      <BodyThemeClass className="theme-public-premium" />
      <PremiumLoader />
      <PremiumNav />
      <div className="pt-0">
        {children}
      </div>
    </div>
  );
}
