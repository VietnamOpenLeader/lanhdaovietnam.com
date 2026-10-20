import pages from "@void/md/pages";
import { buildMarkdownIndex, markdownSummary } from "./markdown";
import { compareSummaries, type ContentSummary } from "./pagination";

export const markdownIndex = buildMarkdownIndex(pages);
const markdownTranslationKeys = new Set(markdownIndex.map((entry) => entry.translationKey));
const markdownByPath = new Map(markdownIndex.map((entry) => [entry.url, entry]));
const markdownByTranslationKey = new Map<string, ContentSummary[]>();

for (const entry of markdownIndex) {
  const summaries = markdownByTranslationKey.get(entry.translationKey) ?? [];
  summaries.push(markdownSummary(entry));
  markdownByTranslationKey.set(entry.translationKey, summaries);
}

for (const summaries of markdownByTranslationKey.values()) {
  summaries.sort(compareSummaries);
}

export function hasMarkdownTranslationKey(translationKey: string): boolean {
  return markdownTranslationKeys.has(translationKey);
}

export function getMarkdownEntry(path: string) {
  return markdownByPath.get(path);
}

export function getMarkdownTranslations(translationKey: string): ReadonlyArray<ContentSummary> {
  return markdownByTranslationKey.get(translationKey) ?? [];
}
