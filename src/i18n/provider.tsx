"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import type { Locale } from "./config";

type Messages = Record<string, unknown>;

type TranslationContextValue = {
  locale: Locale;
  messages: Messages;
  t: (key: string, defaultValue?: string) => string;
};

const TranslationContext = createContext<TranslationContextValue | null>(null);

function getFromDictionary(messages: Messages, key: string) {
  return key.split(".").reduce<unknown>((acc, segment) => {
    if (acc && typeof acc === "object" && segment in acc) {
      return (acc as Record<string, unknown>)[segment];
    }
    return undefined;
  }, messages);
}

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: ReactNode;
}) {
  const value = useMemo<TranslationContextValue>(() => {
    const translator = (key: string, defaultValue?: string) => {
      const result = getFromDictionary(messages, key);
      if (typeof result === "string") return result;
      if (result !== undefined && result !== null) {
        return String(result);
      }
      return defaultValue ?? key;
    };
    return {
      locale,
      messages,
      t: translator,
    };
  }, [locale, messages]);

  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslations(namespace?: string) {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error("useTranslations must be used within an I18nProvider");
  }

  return useCallback(
    (key: string, defaultValue?: string) => {
      const fullKey = namespace ? `${namespace}.${key}` : key;
      return context.t(fullKey, defaultValue);
    },
    [context, namespace]
  );
}

export function useLocale() {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error("useLocale must be used within an I18nProvider");
  }
  return context.locale;
}

export function useLocalizedPath() {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error("useLocalizedPath must be used within an I18nProvider");
  }
  const { locale } = context;
  return useCallback(
    (href: string) => {
      if (!href) return `/${locale}`;
      if (
        href.startsWith("http://") ||
        href.startsWith("https://") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) {
        return href;
      }
      if (href.startsWith(`/${locale}`)) return href;
      if (href === "/") return `/${locale}`;
      if (href.startsWith("/")) return `/${locale}${href}`;
      return `/${locale}/${href}`;
    },
    [locale]
  );
}
