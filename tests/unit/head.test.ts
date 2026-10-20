import { expect, test } from "bun:test";
import {
  buildAuthHead,
  buildContentHead,
  buildHomeHead,
} from "../../src/seo/head";
import type { ContentSummary } from "../../src/content/pagination";

const vietnameseArticle: ContentSummary = {
  key: "d1:1",
  source: "d1",
  locale: "vi",
  slug: "khoi-nguon",
  kind: "article",
  title: "Khởi nguồn",
  description: "Giới thiệu",
  publishedAt: "2026-10-19T00:00:00.000Z",
  startsAt: null,
  endsAt: null,
  location: null,
  url: "/vi/posts/khoi-nguon",
};

test("content head uses one canonical and localized published alternates", () => {
  const englishArticle: ContentSummary = {
    ...vietnameseArticle,
    key: "d1:2",
    locale: "en",
    slug: "origins",
    title: "Origins",
    url: "/en/posts/origins",
  };
  const head = buildContentHead({
    entry: vietnameseArticle,
    alternates: [vietnameseArticle, englishArticle],
    siteURL: "https://lanhdaovietnam.com",
  });

  expect(head.htmlAttrs?.lang).toBe("vi");
  expect(head.link?.filter((item) => item.rel === "canonical"))
    .toEqual([{ rel: "canonical", href: "https://lanhdaovietnam.com/vi/posts/khoi-nguon" }]);
  expect(head.link?.filter((item) => item.rel === "alternate")).toContainEqual({
    rel: "alternate",
    hreflang: "en",
    href: "https://lanhdaovietnam.com/en/posts/origins",
  });
});

test("JSON-LD escapes markup and uses event schema only for events", () => {
  const event: ContentSummary = {
    ...vietnameseArticle,
    key: "d1:event",
    kind: "event",
    title: "</script><script>alert(1)</script>",
    startsAt: "2026-11-01T00:00:00.000Z",
    endsAt: "2026-11-02T00:00:00.000Z",
    location: "Hanoi",
    url: "/vi/posts/meeting",
  };
  const head = buildContentHead({
    entry: event,
    alternates: [event],
    siteURL: "https://lanhdaovietnam.com",
  });
  const jsonLD = head.script?.[0]?.innerHTML;

  expect(jsonLD).toContain('"@type":"Event"');
  expect(jsonLD).not.toContain("</script>");
  expect(jsonLD).toContain("\\u003c/script>");
});

test("home and login head use locale and keep authentication out of search", () => {
  expect(buildHomeHead({
    locale: "zh-CN",
    title: "越南领导力",
    description: "介绍",
    siteURL: "https://lanhdaovietnam.com",
  }).htmlAttrs?.lang).toBe("zh-CN");
  expect(buildAuthHead({
    locale: "vi",
    title: "Đăng nhập",
  }).meta).toContainEqual({ name: "robots", content: "noindex,nofollow" });
});
