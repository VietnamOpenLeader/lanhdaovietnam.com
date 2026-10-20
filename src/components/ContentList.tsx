import { useLingui } from "@lingui/react";
import {
  contentHeading,
  contentReadMore,
  emptyLibrary,
  filterAll,
  filterArticles,
  filterEvents,
  filterNews,
  eventStartsAt,
  nextPage,
} from "../i18n/messages";
import type { ContentKind, Locale } from "../content/contracts";
import type { ContentSummary } from "../content/pagination";
import ContentDate from "./ContentDate";

interface ContentListProps {
  readonly locale: Locale;
  readonly items: ReadonlyArray<ContentSummary>;
  readonly kind: ContentKind | null;
  readonly nextCursor: string | null;
}

const filters = [
  { kind: null, label: filterAll },
  { kind: "article", label: filterArticles },
  { kind: "news", label: filterNews },
  { kind: "event", label: filterEvents },
] as const;

function filterURL(locale: Locale, kind: ContentKind | null): string {
  const query = new URLSearchParams();
  if (kind) query.set("kind", kind);
  const suffix = query.size > 0 ? `?${query}` : "";
  return `/${locale}/${suffix}#content`;
}

function nextPageURL(locale: Locale, kind: ContentKind | null, cursor: string): string {
  const query = new URLSearchParams({ cursor });
  if (kind) query.set("kind", kind);
  return `/${locale}/?${query}#content`;
}

export default function ContentList({
  locale,
  items,
  kind,
  nextCursor,
}: ContentListProps) {
  const { _ } = useLingui();

  return (
    <section aria-labelledby="content-heading" className="mt-10" id="content">
      <h2 className="mb-4 text-xl font-semibold" id="content-heading">
        {_(contentHeading)}
      </h2>
      <nav aria-label={_(filterAll)} className="mb-6 flex flex-wrap gap-3">
        {filters.map((filter) => (
          <a
            aria-current={kind === filter.kind ? "page" : undefined}
            className="text-sm underline-offset-4 hover:underline"
            href={filterURL(locale, filter.kind)}
            key={filter.kind ?? "all"}
          >
            {_(filter.label)}
          </a>
        ))}
      </nav>
      {items.length === 0 ? (
        <p className="text-sm text-kumo-subtle">{_(emptyLibrary)}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <article className="ring ring-kumo-line rounded-xl p-5" key={item.key}>
              <p className="text-sm text-kumo-subtle">
                {_(filters.find((filter) => filter.kind === item.kind)?.label ?? filterAll)}
              </p>
              <h3 className="mt-2 text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm">{item.description}</p>
              {item.kind === "event" && item.startsAt ? (
                <p className="mt-2 text-sm">
                  {_(eventStartsAt)}: <ContentDate locale={locale} value={item.startsAt} />
                </p>
              ) : null}
              <a
                className="mt-4 inline-block text-sm font-medium underline-offset-4 hover:underline"
                href={item.url}
              >
                {_(contentReadMore)}
              </a>
            </article>
          ))}
        </div>
      )}
      {nextCursor ? (
        <a
          className="mt-6 inline-block text-sm font-medium underline-offset-4 hover:underline"
          href={nextPageURL(locale, kind, nextCursor)}
        >
          {_(nextPage)}
        </a>
      ) : null}
    </section>
  );
}
