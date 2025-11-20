"use client";

import Link from "next/link";
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";

import { useLocale } from "@/i18n/provider";
import { buildLocalizedPath } from "@/i18n/routing";
import type { Locale } from "@/i18n/config";

type LocalizedLinkProps = Omit<ComponentPropsWithoutRef<typeof Link>, "href"> & {
  href: string;
  targetLocale?: Locale;
};

export const LocalizedLink = forwardRef<HTMLAnchorElement, LocalizedLinkProps>(
  ({ href, targetLocale, children, ...props }, ref) => {
    const locale = useLocale();
    const resolvedHref = buildLocalizedPath(href, locale, {
      targetLocale: targetLocale ?? locale,
    });

    const normalizedChild: ReactNode =
      typeof children === "string" || typeof children === "number"
        ? <span>{children}</span>
        : children;

    return (
      <Link ref={ref} href={resolvedHref} {...props}>
        {normalizedChild}
      </Link>
    );
  },
);

LocalizedLink.displayName = "LocalizedLink";
