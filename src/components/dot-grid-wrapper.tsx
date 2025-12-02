"use client";

import { usePathname } from "next/navigation";
import DotGrid from "@/components/DotGrid";

export function DotGridWrapper() {
  const pathname = usePathname();
  if (!pathname) return null;

  const isAdminPath =
    pathname.split("/").some((segment) => segment === "admin") ||
    pathname.startsWith("/admin");

  if (isAdminPath) return null;

  return (
    <div className="fixed inset-0 -z-50 pointer-events-none">
      <DotGrid
        dotSize={2}
        gap={24}
        baseColor="#1A160D"
        activeColor="#fbbf24"
        proximity={70}
        speedTrigger={150}
        shockRadius={80}
        shockStrength={3}
        resistance={400}
        returnDuration={1.5}
        className="w-full h-full"
      />
    </div>
  );
}
