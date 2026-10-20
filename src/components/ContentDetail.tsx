import type { Messages } from "@lingui/core";
import { useLingui } from "@lingui/react";
import { LocaleProvider } from "../i18n/runtime";
import type { Locale } from "../i18n/locales";
import type { ContentSummary } from "../content/pagination";
import { eventEndsAt, eventLocation, eventStartsAt } from "../i18n/messages";
import LanguageLinks from "./LanguageLinks";
import ContentDate from "./ContentDate";

interface ContentDetailProps {
  readonly locale: Locale;
  readonly messages: Messages;
  readonly entry: ContentSummary;
  readonly html: string;
  readonly translations: ReadonlyArray<ContentSummary>;
}

function DetailBody({
  locale,
  entry,
  html,
  translations,
}: Omit<ContentDetailProps, "messages">) {
  const { _ } = useLingui();
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <article>
        <h1 className="text-3xl font-semibold">{entry.title}</h1>
        <p className="mt-3 text-sm text-kumo-subtle">{entry.description}</p>
        {entry.kind === "event" ? (
          <dl className="mt-4 grid gap-2 text-sm">
            {entry.startsAt ? (
              <div>
                <dt className="font-medium">{_(eventStartsAt)}</dt>
                <dd><ContentDate locale={locale} value={entry.startsAt} /></dd>
              </div>
            ) : null}
            {entry.endsAt ? (
              <div>
                <dt className="font-medium">{_(eventEndsAt)}</dt>
                <dd><ContentDate locale={locale} value={entry.endsAt} /></dd>
              </div>
            ) : null}
            {entry.location ? (
              <div>
                <dt className="font-medium">{_(eventLocation)}</dt>
                <dd>{entry.location}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
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
