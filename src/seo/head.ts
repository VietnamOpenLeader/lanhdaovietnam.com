import type { HeadDescriptor } from "void";
import type { Locale } from "../i18n/locales";
import type { ContentSummary } from "../content/pagination";

interface ContentHeadInput {
  readonly entry: ContentSummary;
  readonly alternates: ReadonlyArray<ContentSummary>;
  readonly siteURL: string;
}

interface HomeHeadInput {
  readonly locale: Locale;
  readonly title: string;
  readonly description: string;
  readonly siteURL: string;
}

interface AuthHeadInput {
  readonly locale: Locale;
  readonly title: string;
}

function absoluteURL(path: string, siteURL: string): string {
  return new URL(path, siteURL).toString();
}

function serializeJSONLD(value: object): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function jsonLDType(entry: ContentSummary): string {
  if (entry.kind === "news") return "NewsArticle";
  if (entry.kind === "event") return "Event";
  return "Article";
}

function jsonLD(entry: ContentSummary, url: string): string {
  return serializeJSONLD({
    "@context": "https://schema.org",
    "@type": jsonLDType(entry),
    headline: entry.title,
    description: entry.description,
    datePublished: entry.publishedAt,
    inLanguage: entry.locale,
    url,
    ...(entry.kind === "event" && entry.startsAt ? { startDate: entry.startsAt } : {}),
    ...(entry.kind === "event" && entry.endsAt ? { endDate: entry.endsAt } : {}),
    ...(entry.kind === "event" && entry.location
      ? { location: { "@type": "Place", name: entry.location } }
      : {}),
  });
}

function localizedAlternates(
  entry: ContentSummary,
  alternates: ReadonlyArray<ContentSummary>,
  siteURL: string,
): HeadDescriptor["link"] {
  const byLocale = new Map<Locale, ContentSummary>();
  for (const alternate of alternates) {
    if (!byLocale.has(alternate.locale)) byLocale.set(alternate.locale, alternate);
  }
  byLocale.set(entry.locale, entry);
  return [
    { rel: "canonical", href: absoluteURL(entry.url, siteURL) },
    ...[...byLocale.entries()].map(([locale, alternate]) => ({
      rel: "alternate",
      hreflang: locale,
      href: absoluteURL(alternate.url, siteURL),
    })),
  ];
}

export function buildContentHead(input: ContentHeadInput): HeadDescriptor {
  const canonical = absoluteURL(input.entry.url, input.siteURL);
  const isArticle = input.entry.kind !== "event";
  return {
    title: input.entry.title,
    htmlAttrs: { lang: input.entry.locale },
    meta: [
      { name: "description", content: input.entry.description },
      { property: "og:title", content: input.entry.title },
      { property: "og:description", content: input.entry.description },
      { property: "og:type", content: isArticle ? "article" : "website" },
      { property: "og:url", content: canonical },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: input.entry.title },
      { name: "twitter:description", content: input.entry.description },
    ],
    link: localizedAlternates(input.entry, input.alternates, input.siteURL),
    script: [{ type: "application/ld+json", innerHTML: jsonLD(input.entry, canonical) }],
  };
}

export function buildHomeHead(input: HomeHeadInput): HeadDescriptor {
  const canonical = absoluteURL(`/${input.locale}/`, input.siteURL);
  return {
    title: input.title,
    htmlAttrs: { lang: input.locale },
    meta: [
      { name: "description", content: input.description },
      { property: "og:title", content: input.title },
      { property: "og:description", content: input.description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: canonical },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: input.title },
      { name: "twitter:description", content: input.description },
    ],
    link: [{ rel: "canonical", href: canonical }],
  };
}

export function buildAuthHead(input: AuthHeadInput): HeadDescriptor {
  return {
    title: input.title,
    htmlAttrs: { lang: input.locale },
    meta: [{ name: "robots", content: "noindex,nofollow" }],
  };
}
