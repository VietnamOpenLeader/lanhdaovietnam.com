import pages from "@void/md/pages";
import { buildMarkdownIndex } from "./markdown";

export const markdownIndex = buildMarkdownIndex(pages);
const markdownTranslationKeys = new Set(markdownIndex.map((entry) => entry.translationKey));
const markdownByPath = new Map(markdownIndex.map((entry) => [entry.url, entry]));

export function hasMarkdownTranslationKey(translationKey: string): boolean {
  return markdownTranslationKeys.has(translationKey);
}

export function getMarkdownEntry(path: string) {
  return markdownByPath.get(path);
}
