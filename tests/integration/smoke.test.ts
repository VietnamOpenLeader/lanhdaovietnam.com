import { expect, test } from "bun:test";
import { baseURL } from "../local-context";

test("Void returns health JSON and renders the home page", async () => {
  const health = await fetch(`${baseURL}/api/health`);
  expect(health.status).toBe(200);
  expect(await health.json()).toEqual({ ok: true });

  const page = await fetch(baseURL, { redirect: "manual" });
  expect([200, 302]).toContain(page.status);
});
