import { expect, test } from "bun:test";
import { baseURL } from "../local-context";

test("Void returns health JSON and renders the home page", async () => {
  const health = await fetch(`${baseURL}/api/health`);
  expect(health.status).toBe(200);
  expect(await health.json()).toEqual({ ok: true });

  const page = await fetch(baseURL, { redirect: "manual" });
  expect([200, 302]).toContain(page.status);
});

test("Void renders each locale's trusted Markdown page on the server", async () => {
  const pages = [
    ["/vi/library/khoi-nguon", "Khởi nguồn"],
    ["/en/library/origins", "Origins"],
    ["/zh-CN/library/qi-yuan", "起源"],
  ] as const;

  const responses = await Promise.all(
    pages.map(async ([path, title]) => {
      const response = await fetch(`${baseURL}${path}`);
      return { response, title };
    }),
  );

  for (const { response, title } of responses) {
    expect(response.status).toBe(200);
    expect(await response.text()).toContain(title);
  }
});

test("the localized homepage indexes the published Markdown collection", async () => {
  const response = await fetch(`${baseURL}/vi/`);
  expect(response.status).toBe(200);
  expect(await response.text()).toContain("Khởi nguồn");
});
