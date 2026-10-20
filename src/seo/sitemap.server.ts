import type { Locale } from "../i18n/locales";
import { locales } from "../i18n/locales";
import { countPublishedByLocale, listPublishedSlugs } from "../content/programs.server";
import { markdownIndex } from "../content/manifest.server";
import { runContentProgram } from "../content/run.server";
import { escapeXML } from "./xml";

const maxEntriesPerPart = 10_000;
const maxXMLBytesPerPart = 10 * 1024 * 1024;

export type SitemapSource = "d1" | "markdown";

export interface SitemapPart {
  readonly url: string;
}

interface LocaleCounts {
  readonly locale: Locale;
  readonly d1Count: number;
  readonly markdownCount: number;
}

const markdownPathsByLocale = new Map(
  locales.map((locale) => [
    locale,
    markdownIndex.filter((entry) => entry.locale === locale).map((entry) => entry.url),
  ]),
);

function absoluteURL(path: string, siteURL: string): string {
  return new URL(path, siteURL).toString();
}

async function localePageCounts(): Promise<ReadonlyArray<LocaleCounts>> {
  return Promise.all(
    locales.map(async (locale) => {
      const d1Count = await runContentProgram(countPublishedByLocale(locale));
      return {
        locale,
        d1Count,
        markdownCount: markdownPathsByLocale.get(locale)?.length ?? 0,
      };
    }),
  );
}

function sitemapParts(
  locale: Locale,
  source: SitemapSource,
  count: number,
  siteURL: string,
): SitemapPart[] {
  const pageCount = Math.ceil(count / maxEntriesPerPart);
  return Array.from({ length: pageCount }, (_, index) => ({
    url: absoluteURL(`/sitemaps/${locale}-${source}-${index + 1}.xml`, siteURL),
  }));
}

export async function createSitemapIndex(siteURL: string): Promise<string> {
  const counts = await localePageCounts();
  const parts = counts.flatMap(({ locale, d1Count, markdownCount }) => [
    ...sitemapParts(locale, "markdown", markdownCount, siteURL),
    ...sitemapParts(locale, "d1", d1Count, siteURL),
  ]);
  const entries = parts.map(({ url }) => `<sitemap><loc>${escapeXML(url)}</loc></sitemap>`);
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.join("")}</sitemapindex>`;
}

async function countSitemapEntries(locale: Locale, source: SitemapSource): Promise<number> {
  return source === "markdown"
    ? (markdownPathsByLocale.get(locale)?.length ?? 0)
    : runContentProgram(countPublishedByLocale(locale));
}

async function readSitemapPage(
  locale: Locale,
  source: SitemapSource,
  offset: number,
): Promise<ReadonlyArray<string>> {
  if (source === "markdown") {
    return markdownPathsByLocale.get(locale)?.slice(offset, offset + maxEntriesPerPart) ?? [];
  }

  const slugs = await runContentProgram(listPublishedSlugs(locale, maxEntriesPerPart, offset));
  return slugs.map((slug) => `/${locale}/posts/${slug}`);
}

export async function createSitemapPage(
  locale: Locale,
  source: SitemapSource,
  pageNumber: number,
  siteURL: string,
): Promise<string | null> {
  if (!Number.isSafeInteger(pageNumber) || pageNumber < 1) return null;
  const offset = (pageNumber - 1) * maxEntriesPerPart;
  if (!Number.isSafeInteger(offset)) return null;

  const count = await countSitemapEntries(locale, source);
  const pageCount = Math.ceil(count / maxEntriesPerPart);
  if (pageNumber > pageCount) return null;

  const paths = await readSitemapPage(locale, source, offset);
  const entries = paths.map(
    (path) => `<url><loc>${escapeXML(absoluteURL(path, siteURL))}</loc></url>`,
  );
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.join("")}</urlset>`;
  if (new TextEncoder().encode(xml).byteLength > maxXMLBytesPerPart) {
    throw new Error("Sitemap part exceeds the configured XML size limit.");
  }
  return xml;
}
