import { and, count, eq } from "void/db";
import { db } from "void/db";
import { contentPosts } from "@schema";
import type { Locale } from "../i18n/locales";
import { locales } from "../i18n/locales";
import { markdownIndex } from "../content/manifest.server";
import { listCatalog } from "../content/catalog.server";
import { escapeXML } from "./xml";

const maxEntriesPerPart = 10_000;
const maxXMLBytesPerPart = 10 * 1024 * 1024;
const d1PageSize = 500;

export interface SitemapPart {
  readonly url: string;
}

function absoluteURL(path: string, siteURL: string): string {
  return new URL(path, siteURL).toString();
}

async function countD1Published(locale: Locale): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(contentPosts)
    .where(and(eq(contentPosts.locale, locale), eq(contentPosts.status, "published")));
  return row?.total ?? 0;
}

async function localePageCounts(): Promise<
  ReadonlyArray<{
    readonly locale: Locale;
    readonly count: number;
  }>
> {
  return Promise.all(
    locales.map(async (locale) => {
      const [d1Count, markdownCount] = await Promise.all([
        countD1Published(locale),
        Promise.resolve(markdownIndex.filter((entry) => entry.locale === locale).length),
      ]);
      return { locale, count: d1Count + markdownCount };
    }),
  );
}

export async function createSitemapIndex(siteURL: string): Promise<string> {
  const counts = await localePageCounts();
  const parts: SitemapPart[] = counts.flatMap(({ locale, count: itemCount }) => {
    const pageCount = Math.ceil(itemCount / maxEntriesPerPart);
    return Array.from({ length: pageCount }, (_, index) => ({
      url: absoluteURL(`/sitemaps/${locale}-${index + 1}.xml`, siteURL),
    }));
  });
  const entries = parts.map(({ url }) => `<sitemap><loc>${escapeXML(url)}</loc></sitemap>`);
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.join("")}</sitemapindex>`;
}

async function skipSitemapEntries(
  locale: Locale,
  countToSkip: number,
): Promise<{ readonly cursor: string | undefined; readonly remaining: number }> {
  let cursor: string | undefined;
  let remaining = countToSkip;

  while (remaining > 0) {
    const page = await listCatalog({
      locale,
      limit: Math.min(d1PageSize, remaining),
      ...(cursor === undefined ? {} : { cursor }),
    });
    if (page.items.length === 0) return { cursor, remaining };
    remaining -= page.items.length;
    cursor = page.nextCursor ?? undefined;
    if (!cursor && remaining > 0) return { cursor, remaining };
  }
  return { cursor, remaining };
}

async function readSitemapPage(locale: Locale, pageNumber: number): Promise<ReadonlyArray<string>> {
  const skipCount = (pageNumber - 1) * maxEntriesPerPart;
  const skipped = await skipSitemapEntries(locale, skipCount);
  if (skipped.remaining > 0) return [];

  const urls: string[] = [];
  let cursor = skipped.cursor;
  while (urls.length < maxEntriesPerPart) {
    const page = await listCatalog({
      locale,
      limit: Math.min(d1PageSize, maxEntriesPerPart - urls.length),
      ...(cursor === undefined ? {} : { cursor }),
    });
    urls.push(...page.items.map((item) => item.url));
    cursor = page.nextCursor ?? undefined;
    if (!cursor) break;
  }
  return urls;
}

export async function createSitemapPage(
  locale: Locale,
  pageNumber: number,
  siteURL: string,
): Promise<string | null> {
  const counts = await localePageCounts();
  const localeCount = counts.find((item) => item.locale === locale)?.count ?? 0;
  const pageCount = Math.ceil(localeCount / maxEntriesPerPart);
  if (!Number.isSafeInteger(pageNumber) || pageNumber < 1 || pageNumber > pageCount) {
    return null;
  }

  const paths = await readSitemapPage(locale, pageNumber);
  const entries = paths.map(
    (path) => `<url><loc>${escapeXML(absoluteURL(path, siteURL))}</loc></url>`,
  );
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.join("")}</urlset>`;
  if (new TextEncoder().encode(xml).byteLength > maxXMLBytesPerPart) {
    throw new Error("Sitemap part exceeds the configured XML size limit.");
  }
  return xml;
}
