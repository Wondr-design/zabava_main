"use client";

import { usePathname } from "next/navigation";
import GradualBlur from "@/components/GradualBlur";

export function GradualBlurWrapper() {
  const pathname = usePathname();
  if (!pathname) return null;
  const isAdminPath =
    pathname.split("/").some((segment) => segment === "admin") ||
    pathname.startsWith("/admin");
  if (isAdminPath) return null;

  return (
    <GradualBlur
      preset="page-footer"
      target="page"
      position="bottom"
      height="4rem"
      curve="ease-out"
      zIndex={9999}
      className="pointer-events-none"
      style={{ pointerEvents: "none" }}
    />
  );
}
