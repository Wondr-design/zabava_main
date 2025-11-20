import type { Locale } from "./config";
import { getDictionary } from "./get-dictionary";

type Messages = Record<string, unknown>;

function getFromDictionary(messages: Messages, key: string) {
  return key.split(".").reduce<unknown>((acc, segment) => {
    if (acc && typeof acc === "object" && segment in acc) {
      return (acc as Record<string, unknown>)[segment];
    }
    return undefined;
  }, messages);
}

export function createTranslator(
  messages: Messages,
  namespace?: string,
) {
  return (key: string, defaultValue?: string) => {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    const result = getFromDictionary(messages, fullKey);
    if (typeof result === "string") return result;
    if (result !== undefined && result !== null) {
      return String(result);
    }
    return defaultValue ?? key;
  };
}

export async function getTranslator(
  locale: Locale,
  namespace?: string,
) {
  const messages = await getDictionary(locale);
  return createTranslator(messages, namespace);
}
