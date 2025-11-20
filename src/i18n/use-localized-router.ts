"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

import { useLocale } from "./provider";
import { buildLocalizedPath } from "./routing";

type RouterInstance = ReturnType<typeof useRouter>;
type NavigateOptions = Parameters<RouterInstance["push"]>[1];

export function useLocalizedRouter() {
  const router = useRouter();
  const locale = useLocale();

  const push = useCallback(
    (href: string, options?: NavigateOptions) => {
      const localized = buildLocalizedPath(href, locale);
      router.push(localized, options);
    },
    [router, locale],
  );

  const replace = useCallback(
    (href: string, options?: Parameters<RouterInstance["replace"]>[1]) => {
      const localized = buildLocalizedPath(href, locale);
      router.replace(localized, options);
    },
    [router, locale],
  );

  const prefetch = useCallback(
    (href: string, options?: Parameters<RouterInstance["prefetch"]>[1]) => {
      const localized = buildLocalizedPath(href, locale);
      router.prefetch(localized, options);
    },
    [router, locale],
  );

  return {
    push,
    replace,
    prefetch,
    back: router.back,
    forward: router.forward,
    refresh: router.refresh,
  };
}
