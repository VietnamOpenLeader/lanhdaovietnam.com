import { expect, test } from "bun:test";
import type { VoidMdPage } from "@void/md/pages";
import { buildMarkdownIndex } from "../../src/content/markdown";

function markdownPage(
  locale: "vi" | "en" | "zh-CN",
  slug: string,
  title: string,
  translationKey = "origins",
): VoidMdPage {
  return {
    path: `/${locale}/library/${slug}`,
    title,
    frontmatter: {
      translationKey,
      locale,
      slug,
      kind: "article",
      title,
      description: `${title} description`,
      status: "published",
      publishedAt: "2026-10-19T00:00:00.000Z",
    },
    headings: [],
  };
}

test("indexes Markdown translations by locale and preserves explicit source keys", () => {
  const index = buildMarkdownIndex([
    markdownPage("vi", "khoi-nguon", "Khởi nguồn"),
    markdownPage("en", "origins", "Origins"),
  ]);

  expect(index.map((entry) => entry.key)).toEqual([
    "markdown:/en/library/origins",
    "markdown:/vi/library/khoi-nguon",
  ]);
  expect(index.map((entry) => entry.translationKey)).toEqual(["origins", "origins"]);
});

test("rejects drafts, path/frontmatter disagreement and duplicate translations", () => {
  const draft = markdownPage("vi", "draft", "Draft");
  draft.frontmatter.status = "draft";
  expect(() => buildMarkdownIndex([draft])).toThrow();

  const mismatched = markdownPage("vi", "different", "Different");
  mismatched.frontmatter.slug = "other";
  expect(() => buildMarkdownIndex([mismatched])).toThrow();

  expect(() =>
    buildMarkdownIndex([markdownPage("vi", "one", "One"), markdownPage("vi", "two", "Two")]),
  ).toThrow();
});

test("reserves legacy D1 translation keys from Markdown content", () => {
  expect(() =>
    buildMarkdownIndex([markdownPage("vi", "legacy-post", "Legacy post", "legacy-post-1")]),
  ).toThrow();
});
