"use client";

import { useEffect } from "react";

interface BodyThemeClassProps {
  className: string;
}

export function BodyThemeClass({ className }: BodyThemeClassProps) {
  useEffect(() => {
    if (!className || typeof document === "undefined") {
      return;
    }
    const tokens = className.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      return;
    }
    document.body.classList.add(...tokens);
    return () => {
      document.body.classList.remove(...tokens);
    };
  }, [className]);

  return null;
}
