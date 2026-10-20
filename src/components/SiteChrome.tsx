import { useLingui } from "@lingui/react";
import type { ReactNode } from "react";
import { homePageTitle, navigationHome, navigationLibrary, signIn } from "../i18n/messages";
import type { Locale } from "../i18n/locales";
import type { ContentSummary } from "../content/pagination";
import LanguageLinks from "./LanguageLinks";

interface SiteChromeProps {
  readonly locale: Locale;
  readonly translationLinks?: ReadonlyArray<ContentSummary>;
  readonly children: ReactNode;
}

export default function SiteChrome({ locale, translationLinks, children }: SiteChromeProps) {
  const { _ } = useLingui();

  return (
    <>
      <header className="border-b border-kumo-line">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <a className="text-base font-semibold" href={`/${locale}/`}>
            {_(homePageTitle)}
          </a>
          <nav className="flex items-center gap-4">
            <a className="text-sm underline-offset-4 hover:underline" href={`/${locale}/`}>
              {_(navigationHome)}
            </a>
            <a className="text-sm underline-offset-4 hover:underline" href={`/${locale}/#content`}>
              {_(navigationLibrary)}
            </a>
            <a className="text-sm underline-offset-4 hover:underline" href={`/${locale}/login`}>
              {_(signIn)}
            </a>
          </nav>
          <LanguageLinks locale={locale} translations={translationLinks} />
        </div>
      </header>
      {children}
    </>
  );
}
