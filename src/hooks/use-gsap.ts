"use client";

import { useEffect } from "react";

type GsapInstance = typeof import("gsap")["gsap"];

type GsapContext = ReturnType<GsapInstance["context"]>;

type TimelineCallback = (gsap: GsapInstance) => GsapContext | void;

/**
 * Lazy-loads GSAP and executes the provided callback when running in the browser.
 * Automatically cleans up the GSAP context if one is returned.
 */
export function useGsap(callback: TimelineCallback, deps: unknown[] = []) {
  useEffect(() => {
    let disposed = false;
    let ctx: GsapContext | void;

    async function load() {
      const { gsap } = await import("gsap");
      if (disposed) return;
      ctx = callback(gsap as GsapInstance);
    }

    void load();

    return () => {
      disposed = true;
      if (ctx) {
        ctx.revert?.();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
