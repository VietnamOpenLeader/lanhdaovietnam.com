export const locales = ["vi", "en", "zh-CN"] as const;
export const sourceLocale = "vi" as const;

export type Locale = (typeof locales)[number];

export function parseLocale(value: string | undefined): Locale | null {
  return locales.find((locale) => locale === value) ?? null;
}
