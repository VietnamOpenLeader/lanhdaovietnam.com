import { expect, test } from "bun:test";
import { Schema } from "effect";
import type { ContentInput } from "../../src/content/contracts";
import { adminToken, baseURL } from "../local-context";
import { publishedPost } from "../fixtures/content";

const savedRecordSchema = Schema.Struct({ id: Schema.String, version: Schema.Number });
const savedResponseSchema = Schema.Struct({ data: savedRecordSchema });

function readSavedRecord(value: unknown): Schema.Schema.Type<typeof savedRecordSchema> {
  return Schema.decodeUnknownSync(savedResponseSchema)(value).data;
}

function adminHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${adminToken}`,
  };
}

async function createContent(
  content: ContentInput,
): Promise<Schema.Schema.Type<typeof savedRecordSchema>> {
  const response = await fetch(`${baseURL}/api/posts`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify(content),
  });
  expect(response.status).toBe(201);
  return readSavedRecord(await response.json());
}

async function deleteContent(
  record: Schema.Schema.Type<typeof savedRecordSchema>,
): Promise<void> {
  await fetch(`${baseURL}/api/posts/${record.id}`, {
    method: "DELETE",
    headers: adminHeaders(),
    body: JSON.stringify({ version: record.version }),
  });
}

test("localized home pages and login render server HTML for supported locales", async () => {
  const homes = [
    ["/vi/", "Lãnh đạo Việt Nam"],
    ["/en/", "Leaders of Vietnam"],
    ["/zh-CN/", "越南领导力"],
  ] as const;

  for (const [path, title] of homes) {
    const response = await fetch(`${baseURL}${path}`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain(title);
  }

  expect((await fetch(`${baseURL}/cn/`)).status).toBe(404);

  const root = await fetch(baseURL, { redirect: "manual" });
  expect(root.status).toBe(302);
  expect(root.headers.get("location")).toBe("/vi/");

  const login = await fetch(`${baseURL}/en/login`);
  const loginHTML = await login.text();
  expect(login.status).toBe(200);
  expect(loginHTML).toContain("Sign in to your account");
  expect(loginHTML).toContain("name=\"email\"");
  expect(loginHTML).toContain("GitHub sign-in is not configured.");
  expect(loginHTML).toContain("Google sign-in is not configured.");
  expect(loginHTML).toContain("X sign-in is not configured.");
});

test("D1 detail pages render safe Markdown and only link to published translations", async () => {
  const translationKey = `page-${crypto.randomUUID()}`;
  const viSlug = `${translationKey}-vi`;
  const enSlug = `${translationKey}-en`;
  const draftSlug = `${translationKey}-draft`;
  const records: Array<Schema.Schema.Type<typeof savedRecordSchema>> = [];

  try {
    records.push(await createContent({
      ...publishedPost,
      translationKey,
      slug: viSlug,
      body: '<script>alert(1)</script>\n\n[bad](javascript:alert(1))\n\nBài viết an toàn.',
    }));
    records.push(await createContent({
      ...publishedPost,
      translationKey,
      locale: "en",
      slug: enSlug,
      title: "Safe translated page",
      description: "English translation.",
      body: "# Safe translated page",
    }));
    records.push(await createContent({
      ...publishedPost,
      translationKey: `${translationKey}-draft`,
      slug: draftSlug,
      status: "draft",
      publishedAt: null,
    }));

    const detail = await fetch(`${baseURL}/vi/posts/${viSlug}`);
    const html = await detail.text();
    expect(detail.status).toBe(200);
    expect(html).toContain("Bài viết an toàn.");
    expect(html).toContain(`href="/en/posts/${enSlug}"`);
    expect(html).toContain("Chưa có bản dịch cho ngôn ngữ này.");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toMatch(/href=["']javascript:/iu);

    expect((await fetch(`${baseURL}/vi/posts/${draftSlug}`)).status).toBe(404);
    expect((await fetch(`${baseURL}/vi/posts/${translationKey}-unknown`)).status).toBe(404);
  } finally {
    await Promise.all(records.map(deleteContent));
  }
});
