"use client";

import { usePathname } from "next/navigation";
import Plasma from "@/components/Plasma";

export function PlasmaWrapper() {
  const pathname = usePathname();
  if (!pathname) return null;

  const isAdminPath =
    pathname.split("/").some((segment) => segment === "admin") ||
    pathname.startsWith("/admin");

  if (isAdminPath) return null;

  return (
    <div className="fixed inset-0 w-[100dvw] h-[100dvh] -z-50 pointer-events-none overflow-hidden">
      <div className="w-full h-full">
        <Plasma
          color="#818cf8"
          speed={1}
          direction="forward"
          scale={1}
          opacity={0.3}
          mouseInteractive={false}
        />
      </div>
    </div>
  );
}

