import { markdownIndex } from "./manifest.server";
import { markdownSummary, markdownTranslations } from "./markdown";
import type { ContentKind, ContentSource, Locale } from "./contracts";
import {
  compareSummaries,
  encodeCursor,
  isAfterCursor,
  mergeSummaries,
  parseCursor,
  type ContentSummary,
  type Cursor,
} from "./pagination";
import { listContent, listPublishedTranslations } from "./programs.server";
import type { ContentMetadataRecord } from "./repository.server";
import { runContentProgram } from "./run.server";

export interface CatalogPage {
  readonly items: ReadonlyArray<ContentSummary>;
  readonly nextCursor: string | null;
}

interface CatalogRequest {
  readonly locale: Locale;
  readonly kind?: ContentKind;
  readonly limit: number;
  readonly cursor?: string;
}

const markdownPartitions = buildMarkdownPartitions();

function partitionKey(locale: Locale, kind: ContentKind | null): string {
  return `${locale}:${kind ?? "*"}`;
}

function buildMarkdownPartitions(): ReadonlyMap<string, ReadonlyArray<ContentSummary>> {
  const partitions = new Map<string, ContentSummary[]>();
  for (const locale of ["vi", "en", "zh-CN"] satisfies ReadonlyArray<Locale>) {
    partitions.set(partitionKey(locale, null), []);
    for (const kind of ["article", "news", "event"] satisfies ReadonlyArray<ContentKind>) {
      partitions.set(partitionKey(locale, kind), []);
    }
  }

  for (const entry of markdownIndex) {
    const summary = markdownSummary(entry);
    partitions.get(partitionKey(entry.locale, null))?.push(summary);
    partitions.get(partitionKey(entry.locale, entry.kind))?.push(summary);
  }

  for (const summaries of partitions.values()) summaries.sort(compareSummaries);
  return partitions;
}

function markdownAfterCursor(
  summaries: ReadonlyArray<ContentSummary>,
  cursor: Cursor | undefined,
  limit: number,
): ReadonlyArray<ContentSummary> {
  if (!cursor) return summaries.slice(0, limit);

  let low = 0;
  let high = summaries.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const summary = summaries[middle];
    if (summary && isAfterCursor(summary, cursor)) high = middle;
    else low = middle + 1;
  }
  return summaries.slice(low, low + limit);
}

function toD1Summary(
  record: ContentMetadataRecord & { readonly publishedAt: string },
): ContentSummary {
  return {
    key: `d1:${record.id}`,
    source: "d1",
    locale: record.locale,
    slug: record.slug,
    kind: record.kind,
    title: record.title,
    description: record.description,
    publishedAt: record.publishedAt,
    startsAt: record.startsAt,
    endsAt: record.endsAt,
    location: record.location,
    url: `/${record.locale}/posts/${record.slug}`,
  };
}

function d1Summary(record: ContentMetadataRecord): ContentSummary | null {
  return record.publishedAt
    ? toD1Summary({ ...record, publishedAt: record.publishedAt })
    : null;
}

export async function listCatalog(request: CatalogRequest): Promise<CatalogPage> {
  const filter = { locale: request.locale, kind: request.kind ?? null };
  const cursor = request.cursor === undefined ? undefined : parseCursor(request.cursor, filter);
  const partition = markdownPartitions.get(partitionKey(request.locale, filter.kind)) ?? [];
  const markdown = markdownAfterCursor(partition, cursor, request.limit + 1);
  const databaseRecords = await runContentProgram(listContent({
    locale: request.locale,
    ...(request.kind ? { kind: request.kind } : {}),
    includeDrafts: false,
    limit: request.limit + 1,
    ...(cursor ? { cursor } : {}),
  }));
  const d1 = databaseRecords.flatMap((record) => {
    const summary = d1Summary(record);
    return summary ? [summary] : [];
  });
  const candidates = mergeSummaries(markdown, d1, request.limit + 1);
  const items = candidates.slice(0, request.limit);
  const lastItem = items.at(-1);
  const nextCursor = candidates.length > request.limit && lastItem
    ? encodeCursor({
      v: 1,
      locale: request.locale,
      kind: filter.kind,
      publishedAt: lastItem.publishedAt,
      key: lastItem.key,
    })
    : null;

  return { items, nextCursor };
}

export async function listTranslations(
  translationKey: string,
  source: ContentSource,
): Promise<ReadonlyArray<ContentSummary>> {
  const summaries = source === "markdown"
    ? markdownTranslations(markdownIndex, translationKey)
    : (await runContentProgram(listPublishedTranslations(translationKey)))
      .flatMap((record) => {
        const summary = d1Summary(record);
        return summary ? [summary] : [];
      });
  return [...summaries].sort(compareSummaries);
}
