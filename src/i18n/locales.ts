export const locales = ["vi", "en", "zh-CN"] as const;
export const sourceLocale = "vi" as const;

export type Locale = (typeof locales)[number];
