import type { Locale } from "./config";

type Dictionary = Record<string, unknown>;

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  en: () =>
    import("./dictionaries/en.json").then((module) => module.default as Dictionary),
  cs: () =>
    import("./dictionaries/cs.json").then((module) => module.default as Dictionary),
};

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  const loadDictionary = dictionaries[locale];
  return loadDictionary();
}
