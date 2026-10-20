import type { VoidMdPage } from "@void/md/pages";
import { Schema } from "effect";
import { ContentError } from "../core/errors";
import {
  contentMetadataSchema,
  locales,
  type ContentKind,
  type ContentMetadata,
  type Locale,
} from "./contracts";
import { compareSummaries, type ContentSummary } from "./pagination";

export interface PublishedMarkdownEntry extends ContentMetadata {
  readonly key: string;
  readonly source: "markdown";
  readonly status: "published";
  readonly publishedAt: string;
  readonly url: string;
}

interface TranslationGroup {
  readonly kind: ContentKind;
  readonly locales: Set<Locale>;
}

const libraryPath = /^\/(vi|en|zh-CN)\/library\/([a-z0-9]+(?:-[a-z0-9]+)*)$/u;
const alphabetical = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);

function invalidMarkdown(path: string, translationKey?: string): never {
  throw new ContentError({
    status: 422,
    code: "VALIDATION",
    fields: { slug: path, ...(translationKey ? { translationKey } : {}) },
  });
}

function readRoute(path: string): { readonly locale: Locale; readonly slug: string } {
  const match = libraryPath.exec(path);
  if (!match) return invalidMarkdown(path);
  const locale = locales.find((candidate) => candidate === match[1]);
  const slug = match[2];
  if (!locale || !slug) return invalidMarkdown(path);
  return { locale, slug };
}

function readMetadata(page: VoidMdPage): ContentMetadata {
  try {
    const frontmatter = page.frontmatter;
    return Schema.decodeUnknownSync(contentMetadataSchema, {
      onExcessProperty: "error",
    })({
      ...frontmatter,
      publishedAt: frontmatter.publishedAt ?? null,
      startsAt: frontmatter.startsAt ?? null,
      endsAt: frontmatter.endsAt ?? null,
      location: frontmatter.location ?? null,
    });
  } catch {
    return invalidMarkdown(page.path);
  }
}

function assertPublishedMetadata(
  page: VoidMdPage,
  route: { readonly locale: Locale; readonly slug: string },
  metadata: ContentMetadata,
): asserts metadata is PublishedMarkdownEntry {
  if (
    metadata.status !== "published" ||
    metadata.publishedAt === null ||
    metadata.locale !== route.locale ||
    metadata.slug !== route.slug ||
    page.title !== metadata.title
  ) {
    return invalidMarkdown(page.path);
  }
}

function assertUniqueTranslation(
  page: VoidMdPage,
  metadata: ContentMetadata,
  paths: Set<string>,
  groups: Map<string, TranslationGroup>,
): void {
  if (paths.has(page.path)) invalidMarkdown(page.path, metadata.translationKey);
  paths.add(page.path);

  const group = groups.get(metadata.translationKey);
  if (!group) {
    groups.set(metadata.translationKey, {
      kind: metadata.kind,
      locales: new Set([metadata.locale]),
    });
    return;
  }
  if (group.kind !== metadata.kind || group.locales.has(metadata.locale)) {
    invalidMarkdown(page.path, metadata.translationKey);
  }
  group.locales.add(metadata.locale);
}

export function buildMarkdownIndex(
  pages: ReadonlyArray<VoidMdPage>,
): ReadonlyArray<PublishedMarkdownEntry> {
  const paths = new Set<string>();
  const groups = new Map<string, TranslationGroup>();
  const entries = pages.map((page): PublishedMarkdownEntry => {
    const route = readRoute(page.path);
    const metadata = readMetadata(page);
    assertPublishedMetadata(page, route, metadata);
    assertUniqueTranslation(page, metadata, paths, groups);
    return {
      ...metadata,
      key: `markdown:${page.path}`,
      source: "markdown",
      status: "published",
      publishedAt: metadata.publishedAt,
      url: page.path,
    };
  });
  return entries.sort((left, right) => alphabetical(left.url, right.url));
}

export function markdownSummary(entry: PublishedMarkdownEntry): ContentSummary {
  return {
    key: entry.key,
    source: "markdown",
    locale: entry.locale,
    slug: entry.slug,
    kind: entry.kind,
    title: entry.title,
    description: entry.description,
    publishedAt: entry.publishedAt,
    startsAt: entry.startsAt,
    endsAt: entry.endsAt,
    location: entry.location,
    url: entry.url,
  };
}

export function markdownTranslations(
  entries: ReadonlyArray<PublishedMarkdownEntry>,
  translationKey: string,
): ReadonlyArray<ContentSummary> {
  return entries
    .filter((entry) => entry.translationKey === translationKey)
    .map(markdownSummary)
    .sort(compareSummaries);
}
