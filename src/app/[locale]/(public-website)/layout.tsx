import type { ReactNode } from "react";
import { GradualBlurWrapper } from "@/components/gradual-blur-wrapper";

type SiteLayoutProps = {
  children: ReactNode;
};

export default function SiteLayout({ children }: SiteLayoutProps) {
  return (
    <>
      {children}
      <GradualBlurWrapper />
    </>
  );
}
