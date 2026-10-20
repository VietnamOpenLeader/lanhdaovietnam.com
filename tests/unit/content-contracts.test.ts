import { expect, test } from "bun:test";
import { Schema } from "effect";
import { contentInputSchema, maxBodyBytes } from "../../src/content/contracts";
import {
  ecmascriptTrimWhitespace,
  nonEcmascriptWhitespace,
  publishedPost,
} from "../fixtures/content";

const decode = Schema.decodeUnknownSync(contentInputSchema);

test("accepts a valid localized article", () => {
  expect(decode(publishedPost)).toEqual(publishedPost);
});

test("rejects invalid locale, slug, published date and text limits", () => {
  for (const patch of [
    { locale: "cn" },
    { slug: "../secret" },
    { status: "published", publishedAt: null },
    { publishedAt: "2099-01-01T00:00:00.000Z" },
    { title: "" },
    { title: "\u00a0\u2003" },
    { description: "\u2028\u2029" },
    { title: "x".repeat(201) },
    { publishedAt: "not-a-date" },
    { body: "" },
    { body: " \n\t " },
    { body: "\u00a0\u2003\u2028\u2029\ufeff" },
    { body: "你".repeat(Math.ceil(maxBodyBytes / 3)) },
  ]) {
    expect(() => decode({ ...publishedPost, ...patch })).toThrow();
  }
});

test("validates event timing and required location", () => {
  const event = {
    ...publishedPost,
    kind: "event",
    startsAt: "2026-11-20T10:00:00.000Z",
    endsAt: "2026-11-20T09:00:00.000Z",
    location: "Hà Nội",
  };

  expect(() => decode(event)).toThrow();
  expect(() => decode({ ...event, endsAt: null, location: null })).toThrow();
  expect(() => decode({ ...event, endsAt: null, location: "\u00a0\u2003" })).toThrow();
});

test("text limits count Unicode code points consistently with SQLite", () => {
  expect(() => decode({ ...publishedPost, title: "😀".repeat(200) })).not.toThrow();
  expect(() => decode({ ...publishedPost, title: "😀".repeat(201) })).toThrow();
  expect(() => decode({ ...publishedPost, description: "😀".repeat(500) })).not.toThrow();
  expect(() => decode({ ...publishedPost, description: "😀".repeat(501) })).toThrow();
});

test("rejects NUL in bounded content text", () => {
  const nulPositions = ["\u0000abc", "a\u0000bc", "abc\u0000"];

  for (const value of nulPositions) {
    expect(() => decode({ ...publishedPost, title: value })).toThrow();
    expect(() => decode({ ...publishedPost, description: value })).toThrow();
    expect(() => decode({ ...publishedPost, body: value })).toThrow();
    expect(() =>
      decode({
        ...publishedPost,
        kind: "event",
        startsAt: "2026-11-20T10:00:00.000Z",
        location: value,
      }),
    ).toThrow();
  }
});

test("trims the complete ECMAScript whitespace set but preserves non-trimmed separators", () => {
  for (const whitespace of ecmascriptTrimWhitespace) {
    expect(() => decode({ ...publishedPost, title: whitespace })).toThrow();
    expect(() => decode({ ...publishedPost, description: whitespace })).toThrow();
    expect(() => decode({ ...publishedPost, body: whitespace })).toThrow();
    expect(() =>
      decode({
        ...publishedPost,
        kind: "event",
        startsAt: "2026-11-20T10:00:00.000Z",
        location: whitespace,
      }),
    ).toThrow();
  }

  expect(
    decode({
      ...publishedPost,
      title: nonEcmascriptWhitespace,
      description: nonEcmascriptWhitespace,
      body: nonEcmascriptWhitespace,
    }),
  ).toBeDefined();
  expect(
    decode({
      ...publishedPost,
      kind: "event",
      startsAt: "2026-11-20T10:00:00.000Z",
      location: nonEcmascriptWhitespace,
    }),
  ).toBeDefined();
});
