import type { ContentInput } from "../../src/content/contracts";

export const ecmascriptTrimWhitespace = [
  "\u0009",
  "\u000a",
  "\u000b",
  "\u000c",
  "\u000d",
  "\u0020",
  "\u00a0",
  "\u1680",
  "\u2000",
  "\u2001",
  "\u2002",
  "\u2003",
  "\u2004",
  "\u2005",
  "\u2006",
  "\u2007",
  "\u2008",
  "\u2009",
  "\u200a",
  "\u2028",
  "\u2029",
  "\u202f",
  "\u205f",
  "\u3000",
  "\ufeff",
] as const;

export const nonEcmascriptWhitespace = "\u0085";

export const publishedPost: ContentInput = {
  translationKey: "api-fixture",
  locale: "vi",
  slug: "khoi-nguon",
  kind: "article",
  title: "Khởi nguồn",
  description: "Bài viết mẫu cho nền tảng nội dung.",
  body: "# Khởi nguồn\n\nĐi về cội nguồn.",
  status: "published",
  publishedAt: "2026-10-19T00:00:00.000Z",
  startsAt: null,
  endsAt: null,
  location: null,
};
