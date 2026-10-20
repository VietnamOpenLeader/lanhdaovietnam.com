import { expect, test } from "bun:test";
import { parseMarkdownContent } from "../../src/content/frontmatter";

const publishedArticle = `---
translationKey: origins
locale: vi
slug: khoi-nguon
kind: article
title: Khởi nguồn
description: Bài viết mẫu.
status: published
publishedAt: 2026-10-19T00:00:00.000Z
---

# Khởi nguồn

Nội dung.
`;

test("parses published Markdown while preserving its body", () => {
  const parsed = parseMarkdownContent(publishedArticle);
  expect(parsed.metadata.locale).toBe("vi");
  expect(parsed.metadata.slug).toBe("khoi-nguon");
  expect(parsed.body).toBe("# Khởi nguồn\n\nNội dung.\n");
});

test("rejects invalid YAML, unknown metadata and oversized files", () => {
  expect(() => parseMarkdownContent("---\ntitle: [\n---\n")).toThrow();
  expect(() =>
    parseMarkdownContent(
      publishedArticle.replace("title: Khởi nguồn", "unexpected: value\ntitle: Khởi nguồn"),
    ),
  ).toThrow();
  expect(() => parseMarkdownContent(`${publishedArticle}\n${"x".repeat(512 * 1024)}`)).toThrow();
});

test("rejects YAML tags that could create executable values", () => {
  expect(() =>
    parseMarkdownContent(
      publishedArticle.replace("title: Khởi nguồn", "title: !!js/function function () {}"),
    ),
  ).toThrow();
});
