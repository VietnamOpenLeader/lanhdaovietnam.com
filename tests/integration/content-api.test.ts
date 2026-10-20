import { expect, test } from "bun:test";
import { Schema } from "effect";
import { adminToken, baseURL } from "../local-context";
import { publishedPost } from "../fixtures/content";

const savedRecordSchema = Schema.Struct({
  id: Schema.String,
  version: Schema.Number,
  status: Schema.String,
  body: Schema.String,
});
const contentResponseSchema = Schema.Struct({ data: savedRecordSchema });

function readRecord(value: unknown): Schema.Schema.Type<typeof savedRecordSchema> {
  return Schema.decodeUnknownSync(contentResponseSchema)(value).data;
}

function adminHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${adminToken}`,
  };
}

test("content CRUD requires admin credentials and rejects stale versions", async () => {
  const url = `${baseURL}/api/posts`;
  const key = `api-${crypto.randomUUID()}`;
  const payload = { ...publishedPost, translationKey: key, slug: key };
  const anonymous = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  expect(anonymous.status).toBe(401);

  const unauthorized = await fetch(url, {
    method: "POST",
    headers: { ...adminHeaders(), Authorization: `Bearer ${"A".repeat(43)}` },
    body: JSON.stringify(payload),
  });
  expect(unauthorized.status).toBe(401);

  const created = await fetch(url, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify(payload),
  });
  expect(created.status).toBe(201);
  const createdRecord = readRecord(await created.json());
  const duplicate = await fetch(url, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify(payload),
  });
  expect(duplicate.status).toBe(409);

  const update = () =>
    fetch(`${url}/${createdRecord.id}`, {
      method: "PUT",
      headers: adminHeaders(),
      body: JSON.stringify({
        ...payload,
        title: "Updated",
        version: createdRecord.version,
      }),
    });
  const updated = await update();
  expect(updated.status).toBe(200);
  const updatedRecord = readRecord(await updated.json());
  expect(updatedRecord.version).toBe(createdRecord.version + 1);
  expect((await update()).status).toBe(409);

  const published = await fetch(`${url}/${createdRecord.id}`);
  expect(published.status).toBe(200);
  expect(readRecord(await published.json()).body).toBe(payload.body);

  const unpublished = await fetch(`${url}/${createdRecord.id}`, {
    method: "PUT",
    headers: adminHeaders(),
    body: JSON.stringify({
      ...payload,
      status: "draft",
      publishedAt: null,
      version: updatedRecord.version,
    }),
  });
  expect(unpublished.status).toBe(200);
  const draftRecord = readRecord(await unpublished.json());
  expect((await fetch(`${url}/${createdRecord.id}`)).status).toBe(404);

  const deleted = await fetch(`${url}/${createdRecord.id}`, {
    method: "DELETE",
    headers: adminHeaders(),
    body: JSON.stringify({ version: draftRecord.version }),
  });
  expect(deleted.status).toBe(204);
  expect((await fetch(`${url}/${createdRecord.id}`)).status).toBe(404);
});

test("draft content is hidden from public reads and lists", async () => {
  const key = `draft-${crypto.randomUUID()}`;
  const created = await fetch(`${baseURL}/api/posts`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({
      ...publishedPost,
      translationKey: key,
      slug: key,
      status: "draft",
      publishedAt: null,
    }),
  });
  expect(created.status).toBe(201);
  const record = readRecord(await created.json());

  expect((await fetch(`${baseURL}/api/posts/${record.id}`)).status).toBe(404);
  const list = await fetch(`${baseURL}/api/posts?locale=vi`);
  expect(list.status).toBe(200);
  const listBody = await list.text();
  expect(listBody).not.toContain(record.id);
  expect(listBody).not.toContain('"body"');

  const adminList = await fetch(`${baseURL}/api/posts?locale=vi&view=admin`, {
    headers: adminHeaders(),
  });
  expect(adminList.status).toBe(200);
  expect(await adminList.text()).toContain(record.id);
  expect((await fetch(`${baseURL}/api/posts?locale=vi&view=admin`)).status).toBe(401);
});

test("signed-in members cannot write content without the admin allowlist", async () => {
  const signup = await fetch(`${baseURL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: baseURL,
    },
    body: JSON.stringify({
      name: "Content API member",
      email: `content-${crypto.randomUUID()}@example.test`,
      password: "test-password-123",
    }),
  });
  expect(signup.status).toBe(200);

  const cookie = signup.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
  const write = await fetch(`${baseURL}/api/posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      Origin: baseURL,
    },
    body: JSON.stringify(publishedPost),
  });
  expect(write.status).toBe(403);
});

test("concurrent creates for the same locale and slug yield one conflict", async () => {
  const key = `concurrent-${crypto.randomUUID()}`;
  const payload = { ...publishedPost, translationKey: key, slug: key };
  const create = () =>
    fetch(`${baseURL}/api/posts`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify(payload),
    });
  const responses = await Promise.all([create(), create()]);
  expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
});

test("D1 cannot take ownership of a Markdown translation key", async () => {
  const key = `d1-${crypto.randomUUID()}`;
  const original = await fetch(`${baseURL}/api/posts`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ ...publishedPost, translationKey: key, slug: key }),
  });
  expect(original.status).toBe(201);
  const record = readRecord(await original.json());

  try {
    const update = await fetch(`${baseURL}/api/posts/${record.id}`, {
      method: "PUT",
      headers: adminHeaders(),
      body: JSON.stringify({
        ...publishedPost,
        translationKey: "origins",
        slug: `duplicate-origin-${crypto.randomUUID()}`,
        version: record.version,
      }),
    });
    expect(update.status).toBe(409);
    expect(await update.text()).not.toContain("SQL");

    const create = await fetch(`${baseURL}/api/posts`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({
        ...publishedPost,
        translationKey: "origins",
        slug: `duplicate-create-${crypto.randomUUID()}`,
      }),
    });
    expect(create.status).toBe(409);
    expect(await create.text()).not.toContain("SQL");
  } finally {
    await fetch(`${baseURL}/api/posts/${record.id}`, {
      method: "DELETE",
      headers: adminHeaders(),
      body: JSON.stringify({ version: record.version }),
    });
  }
});

test("content endpoints reject malformed JSON and invalid payloads", async () => {
  const missing = await fetch(`${baseURL}/api/posts`, {
    method: "POST",
    headers: adminHeaders(),
  });
  expect(missing.status).toBe(400);

  const malformed = await fetch(`${baseURL}/api/posts`, {
    method: "POST",
    headers: adminHeaders(),
    body: "{",
  });
  expect(malformed.status).toBe(400);

  const invalid = await fetch(`${baseURL}/api/posts`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ ...publishedPost, locale: "cn" }),
  });
  expect(invalid.status).toBe(422);

  const oversized = await fetch(`${baseURL}/api/posts`, {
    method: "POST",
    headers: adminHeaders(),
    body: "x".repeat(220_000),
  });
  expect(oversized.status).toBe(413);
});
