import { Schema } from "effect";
import { ContentError } from "../core/errors";
import { contentKinds, locales, type ContentKind, type Locale } from "./contracts";

export interface ContentSummary {
  readonly key: string;
  readonly source: "markdown" | "d1";
  readonly locale: Locale;
  readonly slug: string;
  readonly kind: ContentKind;
  readonly title: string;
  readonly description: string;
  readonly publishedAt: string;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
  readonly location: string | null;
  readonly url: string;
}

export interface Cursor {
  readonly v: 1;
  readonly locale: Locale;
  readonly kind: ContentKind | null;
  readonly publishedAt: string;
  readonly key: string;
}

export interface CursorFilter {
  readonly locale: Locale;
  readonly kind: ContentKind | null;
}

const cursorKeySchema = Schema.String.check(
  Schema.isMaxLength(256),
  Schema.isPattern(/^(?:d1:[A-Za-z0-9_-]+|markdown:\/(?:vi|en|zh-CN)\/library\/[a-z0-9-]+)$/u),
);
const cursorSchema = Schema.Struct({
  v: Schema.Literal(1),
  locale: Schema.Literals(locales),
  kind: Schema.NullOr(Schema.Literals(contentKinds)),
  publishedAt: Schema.String.check(
    Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u),
    Schema.makeFilter((value) => {
      const date = new Date(value);
      return Number.isFinite(date.valueOf()) && date.toISOString() === value
        ? undefined
        : "Expected a valid UTC timestamp";
    }),
  ),
  key: cursorKeySchema,
});
const cursorEncodingPattern = /^[A-Za-z0-9_-]{1,1024}$/u;

function invalidCursor(): never {
  throw new ContentError({ status: 400, code: "VALIDATION" });
}

function encodeBase64Url(value: string): string {
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decodeBase64Url(encoded: string): string {
  const normalized = encoded.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return atob(padded);
}

export function encodeCursor(cursor: Cursor): string {
  return encodeBase64Url(JSON.stringify(cursor));
}

export function parseCursor(encoded: string, filter: CursorFilter): Cursor {
  if (!cursorEncodingPattern.test(encoded)) return invalidCursor();

  try {
    const cursor = Schema.decodeUnknownSync(cursorSchema, {
      onExcessProperty: "error",
    })(JSON.parse(decodeBase64Url(encoded)));
    if (cursor.locale !== filter.locale || cursor.kind !== filter.kind) {
      return invalidCursor();
    }
    return cursor;
  } catch {
    return invalidCursor();
  }
}

export function compareSummaries(left: ContentSummary, right: ContentSummary): number {
  if (left.publishedAt !== right.publishedAt) {
    return left.publishedAt > right.publishedAt ? -1 : 1;
  }
  return left.key > right.key ? -1 : left.key < right.key ? 1 : 0;
}

export function mergeSummaries(
  markdown: ReadonlyArray<ContentSummary>,
  d1: ReadonlyArray<ContentSummary>,
  limit: number,
): ContentSummary[] {
  const merged: ContentSummary[] = [];
  let markdownIndex = 0;
  let d1Index = 0;

  while (merged.length < limit && markdownIndex < markdown.length && d1Index < d1.length) {
    const markdownItem = markdown[markdownIndex];
    const d1Item = d1[d1Index];
    if (!markdownItem || !d1Item) break;

    if (compareSummaries(markdownItem, d1Item) <= 0) {
      merged.push(markdownItem);
      markdownIndex += 1;
    } else {
      merged.push(d1Item);
      d1Index += 1;
    }
  }

  while (merged.length < limit && markdownIndex < markdown.length) {
    const item = markdown[markdownIndex];
    if (!item) break;
    merged.push(item);
    markdownIndex += 1;
  }
  while (merged.length < limit && d1Index < d1.length) {
    const item = d1[d1Index];
    if (!item) break;
    merged.push(item);
    d1Index += 1;
  }
  return merged;
}

export function isAfterCursor(summary: ContentSummary, cursor: Cursor): boolean {
  return (
    summary.publishedAt < cursor.publishedAt ||
    (summary.publishedAt === cursor.publishedAt && summary.key < cursor.key)
  );
}
