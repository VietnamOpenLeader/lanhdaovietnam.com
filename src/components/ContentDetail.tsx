import type { Messages } from "@lingui/core";
import { LocaleProvider } from "../i18n/runtime";
import type { Locale } from "../i18n/locales";
import type { ContentSummary } from "../content/pagination";
import LanguageLinks from "./LanguageLinks";

interface ContentDetailProps {
  readonly locale: Locale;
  readonly messages: Messages;
  readonly title: string;
  readonly description: string;
  readonly html: string;
  readonly translations: ReadonlyArray<ContentSummary>;
}

function DetailBody({
  locale,
  title,
  description,
  html,
  translations,
}: Omit<ContentDetailProps, "messages">) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <article>
        <h1 className="text-3xl font-semibold">{title}</h1>
        <p className="mt-3 text-sm text-kumo-subtle">{description}</p>
        <div className="mt-6">
          <LanguageLinks locale={locale} translations={translations} />
        </div>
        <div className="void-md mt-8" dangerouslySetInnerHTML={{ __html: html }} />
      </article>
    </main>
  );
}

export default function ContentDetail(props: ContentDetailProps) {
  return (
    <LocaleProvider locale={props.locale} messages={props.messages}>
      <DetailBody {...props} />
    </LocaleProvider>
  );
}
