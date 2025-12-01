import type { ReactNode } from "react";

import "@/styles/theme-public.css";

import { GradualBlurWrapper } from "@/components/gradual-blur-wrapper";
import { DotGridWrapper } from "@/components/dot-grid-wrapper";
import { PlasmaWrapper } from "@/components/plasma-wrapper";
import { BodyThemeClass } from "@/components/body-theme-class";

type SiteLayoutProps = {
  children: ReactNode;
};

export default function SiteLayout({ children }: SiteLayoutProps) {
  return (
    <div
      className="theme-public min-h-screen"
      style={{ backgroundColor: "var(--ds-surface-base)" }}
    >
      <BodyThemeClass className="theme-public" />
      <PlasmaWrapper />
      <DotGridWrapper />
      {children}
      <GradualBlurWrapper />
    </div>
  );
}
