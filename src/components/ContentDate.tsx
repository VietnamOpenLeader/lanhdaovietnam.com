import type { Locale } from "../i18n/locales";

interface ContentDateProps {
  readonly locale: Locale;
  readonly value: string;
}

export default function ContentDate({ locale, value }: ContentDateProps) {
  const displayValue = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
  return <time dateTime={value}>{displayValue}</time>;
}
