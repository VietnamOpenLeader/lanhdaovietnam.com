import { expect, test } from "bun:test";
import {
  encodeAdminCursor,
  encodeCursor,
  mergeSummaries,
  parseAdminCursor,
  parseCursor,
  type ContentSummary,
} from "../../src/content/pagination";

function summary(
  key: string,
  source: "markdown" | "d1",
  publishedAt = "2026-10-19T00:00:00.000Z",
  locale: "vi" | "en" = "vi",
  kind: "article" | "news" = "article",
): ContentSummary {
  return {
    key,
    source,
    translationKey: key,
    locale,
    slug: key.replace(/^[^:]+:/u, ""),
    kind,
    title: key,
    description: key,
    publishedAt,
    startsAt: null,
    endsAt: null,
    location: null,
    url: `/${locale}/posts/${key}`,
  };
}

test("merges same-date Markdown and D1 records by key with no skipped boundary", () => {
  const sameDate = "2026-10-19T00:00:00.000Z";
  const markdown = [
    summary("markdown:/vi/library/e", "markdown", sameDate),
    summary("markdown:/vi/library/c", "markdown", sameDate),
    summary("markdown:/vi/library/a", "markdown", sameDate),
  ];
  const d1 = [summary("d1:d", "d1", sameDate), summary("d1:b", "d1", sameDate)];

  expect(mergeSummaries(markdown, d1, 3).map(({ key }) => key)).toEqual([
    "markdown:/vi/library/e",
    "markdown:/vi/library/c",
    "markdown:/vi/library/a",
  ]);
});

test("same-date pages stay within their locale and kind partition", () => {
  const sameDate = "2026-10-19T00:00:00.000Z";
  const englishNews = summary("markdown:/en/library/news", "markdown", sameDate, "en", "news");
  const databaseNews = summary("d1:news", "d1", sameDate, "en", "news");

  expect(mergeSummaries([englishNews], [databaseNews], 2)).toEqual([englishNews, databaseNews]);
});

test("cursor is bound to the locale and kind filters", () => {
  const encoded = encodeCursor({
    v: 1,
    locale: "vi",
    kind: null,
    publishedAt: "2026-10-19T00:00:00.000Z",
    key: "d1:123",
  });

  expect(parseCursor(encoded, { locale: "vi", kind: null }).key).toBe("d1:123");
  expect(() => parseCursor(encoded, { locale: "en", kind: null })).toThrow();
  expect(() => parseCursor(encoded, { locale: "vi", kind: "event" })).toThrow();
  expect(() => parseCursor("not-a-cursor", { locale: "vi", kind: null })).toThrow();
  expect(() =>
    parseCursor(
      encodeCursor({
        v: 1,
        locale: "vi",
        kind: null,
        publishedAt: "2026-99-99T00:00:00.000Z",
        key: "d1:123",
      }),
      { locale: "vi", kind: null },
    ),
  ).toThrow();
});

test("admin cursor is bound to its locale and kind filters", () => {
  const cursor = {
    v: 1 as const,
    locale: "vi" as const,
    kind: null,
    updatedAt: "2026-10-19T00:00:00.000Z",
    id: "post-1",
  };
  const encoded = encodeAdminCursor(cursor);

  expect(parseAdminCursor(encoded, { locale: "vi", kind: null })).toEqual(cursor);
  expect(() => parseAdminCursor(encoded, { locale: "en", kind: null })).toThrow();
});
