import type { MessageDescriptor } from "@lingui/core";
import { useLingui } from "@lingui/react";
import {
  languageChinese,
  languageEnglish,
  languageSelect,
  languageVietnamese,
  translationUnavailable,
} from "../i18n/messages";
import { locales, type Locale } from "../i18n/locales";
import type { ContentSummary } from "../content/pagination";

interface LanguageLinksProps {
  readonly locale: Locale;
  readonly translations?: ReadonlyArray<ContentSummary>;
}

const languageLabels = {
  vi: languageVietnamese,
  en: languageEnglish,
  "zh-CN": languageChinese,
} satisfies Record<Locale, MessageDescriptor>;

export default function LanguageLinks({ locale, translations }: LanguageLinksProps) {
  const { _ } = useLingui();

  return (
    <nav aria-label={_(languageSelect)} className="flex items-center gap-3">
      {locales.map((targetLocale) => {
        const translation = translations?.find((item) => item.locale === targetLocale);
        const isCurrent = locale === targetLocale;
        const unavailable = translations !== undefined && !translation && !isCurrent;
        return (
          <a
            aria-current={isCurrent ? "page" : undefined}
            className="text-sm underline-offset-4 hover:underline"
            href={translations === undefined
              ? `/${targetLocale}/`
              : translation?.url ?? `/${targetLocale}/`}
            key={targetLocale}
          >
            {_(languageLabels[targetLocale])}
            {unavailable ? (
              <span className="text-kumo-subtle"> · {_(translationUnavailable)}</span>
            ) : null}
          </a>
        );
      })}
    </nav>
  );
}
