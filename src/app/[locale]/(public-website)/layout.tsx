import type { ReactNode } from "react";

import "@/styles/theme-public.css";

import { GradualBlurWrapper } from "@/components/gradual-blur-wrapper";
import { DotGridWrapper } from "@/components/dot-grid-wrapper";
import { PlasmaWrapper } from "@/components/plasma-wrapper";
import { BodyThemeClass } from "@/components/body-theme-class";
import { SiteNav } from "@/site/components/site-nav";

type SiteLayoutProps = {
  children: ReactNode;
};

export default function SiteLayout({ children }: SiteLayoutProps) {
  return (
    <div className="theme-public min-h-screen">
      <BodyThemeClass className="theme-public" />
      <PlasmaWrapper />
      <DotGridWrapper />
      <SiteNav />
      <div className="pt-[120px]">
        {children}
      </div>
      <GradualBlurWrapper />
    </div>
  );
}
