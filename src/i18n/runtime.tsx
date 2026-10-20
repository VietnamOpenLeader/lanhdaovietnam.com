import { setupI18n, type I18n, type Messages } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { useMemo, type ReactNode } from "react";
import type { Locale } from "./locales";

const catalogLoaders = {
  vi: async () => (await import("../locales/vi/messages.ts")).messages,
  en: async () => (await import("../locales/en/messages.ts")).messages,
  "zh-CN": async () => (await import("../locales/zh-CN/messages.ts")).messages,
} satisfies Record<Locale, () => Promise<Messages>>;

export function loadMessages(locale: Locale): Promise<Messages> {
  return catalogLoaders[locale]();
}

export async function loadI18n(locale: Locale): Promise<I18n> {
  const messages = await loadMessages(locale);
  return setupI18n({ locale, messages: { [locale]: messages } });
}

interface LocaleProviderProps {
  readonly locale: Locale;
  readonly messages: Messages;
  readonly children: ReactNode;
}

export function LocaleProvider({ locale, messages, children }: LocaleProviderProps) {
  const i18n = useMemo(
    () => setupI18n({ locale, messages: { [locale]: messages } }),
    [locale, messages],
  );
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
}
