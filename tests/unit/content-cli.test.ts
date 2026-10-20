import { expect, test } from "bun:test";
import { runContentCLI } from "../../scripts/content";
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
  expect(() => createContentClient({
    baseURL: "http://api.example.test",
    fetcher: async () => {
      fetchCalled = true;
      return Response.json({});
    },
  })).toThrow();
  expect(fetchCalled).toBe(false);
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
