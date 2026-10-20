import { expect, test } from "bun:test";
import { Schema } from "effect";
import { adminToken, baseURL } from "../local-context";
import { publishedPost } from "../fixtures/content";

const savedRecordSchema = Schema.Struct({ id: Schema.String, version: Schema.Number });
const savedResponseSchema = Schema.Struct({ data: savedRecordSchema });
const summarySchema = Schema.Struct({
  key: Schema.String,
  source: Schema.Literals(["markdown", "d1"]),
  translationKey: Schema.String,
  locale: Schema.String,
  kind: Schema.String,
  url: Schema.String,
});
const pageSchema = Schema.Struct({
  data: Schema.Array(summarySchema),
  nextCursor: Schema.NullOr(Schema.String),
});

function readSavedRecord(value: unknown): Schema.Schema.Type<typeof savedRecordSchema> {
  return Schema.decodeUnknownSync(savedResponseSchema)(value).data;
}

function readPage(value: unknown): Schema.Schema.Type<typeof pageSchema> {
  return Schema.decodeUnknownSync(pageSchema)(value);
}

function adminHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${adminToken}`,
  };
}

test("merged catalog paginates across same-date Markdown and D1 records without gaps", async () => {
  const savedRecords: Array<Schema.Schema.Type<typeof savedRecordSchema>> = [];

  try {
    for (const slug of ["catalog-one", "catalog-two"]) {
      const key = `${slug}-${crypto.randomUUID()}`;
      const response = await fetch(`${baseURL}/api/posts`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ ...publishedPost, translationKey: key, slug: key }),
      });
      expect(response.status).toBe(201);
      savedRecords.push(readSavedRecord(await response.json()));
    }

    const homepage = await fetch(`${baseURL}/vi/`);
    expect(await homepage.text()).toContain("catalog-one");

    const seen = new Set<string>();
    let cursor: string | null = null;
    let pages = 0;
    do {
      const query = new URLSearchParams({ locale: "vi", kind: "article", limit: "1" });
      if (cursor) query.set("cursor", cursor);
      const response = await fetch(`${baseURL}/api/posts?${query}`);
      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).not.toContain('"body"');
      const page = readPage(JSON.parse(body));
      expect(page.data).toHaveLength(1);
      const item = page.data[0];
      if (item) {
        expect(seen.has(item.key)).toBe(false);
        expect(item.translationKey.length).toBeGreaterThan(0);
        seen.add(item.key);
      }
      cursor = page.nextCursor;
      pages += 1;
      expect(pages).toBeLessThanOrEqual(20);
    } while (cursor !== null);

    expect(seen.has("markdown:/vi/library/khoi-nguon")).toBe(true);
    for (const { id } of savedRecords) expect(seen.has(`d1:${id}`)).toBe(true);

    const english = readPage(
      await (await fetch(`${baseURL}/api/posts?locale=en&kind=article&limit=20`)).json(),
    );
    expect(english.data.every(({ locale }) => locale === "en")).toBe(true);
    expect(english.data.some(({ source }) => source === "markdown")).toBe(true);

    const invalidCursor = await fetch(
      `${baseURL}/api/posts?locale=en&kind=article&limit=1&cursor=not-a-cursor`,
    );
    expect(invalidCursor.status).toBe(400);
    const emptyCursor = await fetch(`${baseURL}/api/posts?locale=en&kind=article&limit=1&cursor=`);
    expect(emptyCursor.status).toBe(400);

    const wrongFilter = new URLSearchParams({
      locale: "en",
      kind: "article",
      limit: "1",
    });
    const firstPage = readPage(
      await (await fetch(`${baseURL}/api/posts?locale=vi&kind=article&limit=1`)).json(),
    );
    if (firstPage.nextCursor) wrongFilter.set("cursor", firstPage.nextCursor);
    expect((await fetch(`${baseURL}/api/posts?${wrongFilter}`)).status).toBe(400);
  } finally {
    await Promise.all(
      savedRecords.map(({ id, version }) =>
        fetch(`${baseURL}/api/posts/${id}`, {
          method: "DELETE",
          headers: adminHeaders(),
          body: JSON.stringify({ version }),
        }),
      ),
    );
  }
});
