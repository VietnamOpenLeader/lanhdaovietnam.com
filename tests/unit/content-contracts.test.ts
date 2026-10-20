import { expect, test } from "bun:test";
import { Schema } from "effect";
import { contentInputSchema, maxBodyBytes } from "../../src/content/contracts";
import { publishedPost } from "../fixtures/content";

const decode = Schema.decodeUnknownSync(contentInputSchema);

test("accepts a valid localized article", () => {
  expect(decode(publishedPost)).toEqual(publishedPost);
});

test("rejects invalid locale, slug, published date and text limits", () => {
  for (const patch of [
    { locale: "cn" },
    { slug: "../secret" },
    { status: "published", publishedAt: null },
    { title: "" },
    { title: "x".repeat(201) },
    { publishedAt: "not-a-date" },
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
});
