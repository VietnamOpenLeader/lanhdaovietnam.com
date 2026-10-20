import { expect, test } from "bun:test";
import { Schema } from "effect";
import { adminToken, baseURL, contentCheckToken } from "../local-context";
import { contentCheckResultSchema, type ContentMetadata } from "../../src/content/contracts";
import { publishedPost } from "../fixtures/content";

const savedResponseSchema = Schema.Struct({
  data: Schema.Struct({ id: Schema.String, version: Schema.Number }),
});

function adminHeaders(token = adminToken): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function readResult(value: unknown): Schema.Schema.Type<typeof contentCheckResultSchema> {
  return Schema.decodeUnknownSync(contentCheckResultSchema)(value);
}

function toMetadata(
  input: typeof publishedPost,
  translationKey: string,
  slug: string,
): ContentMetadata {
  return {
    translationKey,
    locale: input.locale,
    slug,
    kind: input.kind,
    title: input.title,
    description: input.description,
    status: input.status,
    publishedAt: input.publishedAt,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    location: input.location,
  };
}

test("read-only content preflight detects published source conflicts without returning bodies", async () => {
  const translationKey = `preflight-${crypto.randomUUID()}`;
  const slug = `preflight-${crypto.randomUUID()}`;
  const created = await fetch(`${baseURL}/api/posts`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ ...publishedPost, translationKey, slug }),
  });
  expect(created.status).toBe(201);
  const row = Schema.decodeUnknownSync(savedResponseSchema)(await created.json()).data;
  const candidate = toMetadata(publishedPost, translationKey, "candidate-origin");

  try {
    const unauthenticated = await fetch(`${baseURL}/api/content-check`);
    expect(unauthenticated.status).toBe(401);

    const deployed = await fetch(`${baseURL}/api/content-check`, {
      headers: { Authorization: `Bearer ${contentCheckToken}` },
    });
    expect(deployed.status).toBe(200);
    const deployedBody = await deployed.text();
    expect(deployedBody).not.toContain('"body"');
    expect(readResult(JSON.parse(deployedBody)).conflictKeys).toEqual([]);

    const duplicateCandidate = await fetch(`${baseURL}/api/content-check`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({
        entries: [candidate, { ...candidate, slug: "another-candidate" }],
      }),
    });
    expect(duplicateCandidate.status).toBe(422);

    const bodyRejected = await fetch(`${baseURL}/api/content-check`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({
        entries: [{ ...candidate, body: "must not be uploaded to preflight" }],
      }),
    });
    expect(bodyRejected.status).toBe(422);

    const candidateCheck = await fetch(`${baseURL}/api/content-check`, {
      method: "POST",
      headers: adminHeaders(contentCheckToken),
      body: JSON.stringify({ entries: [candidate] }),
    });
    expect(candidateCheck.status).toBe(200);
    expect(readResult(await candidateCheck.json()).conflictKeys).toEqual([translationKey]);

    const deniedCrud = await fetch(`${baseURL}/api/posts`, {
      method: "POST",
      headers: adminHeaders(contentCheckToken),
      body: JSON.stringify({ ...publishedPost, translationKey: "read-only", slug: "read-only" }),
    });
    expect(deniedCrud.status).toBe(401);
  } finally {
    await fetch(`${baseURL}/api/posts/${row.id}`, {
      method: "DELETE",
      headers: adminHeaders(),
      body: JSON.stringify({ version: row.version }),
    });
  }
});

test("content preflight enforces the one-hundred-entry request limit", async () => {
  const entries: ContentMetadata[] = Array.from({ length: 101 }, (_, index) => ({
    translationKey: `preflight-key-${index}`,
    locale: "vi",
    slug: `preflight-key-${index}`,
    kind: "article",
    title: "Candidate",
    description: "Candidate metadata",
    status: "published",
    publishedAt: "2026-10-19T00:00:00.000Z",
    startsAt: null,
    endsAt: null,
    location: null,
  }));

  const response = await fetch(`${baseURL}/api/content-check`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ entries: entries.slice(0, 100) }),
  });

  expect(response.status).toBe(200);
  expect(readResult(await response.json())).toMatchObject({
    checkedCount: 100,
    conflictKeys: [],
  });

  const oversized = await fetch(`${baseURL}/api/content-check`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ entries }),
  });
  expect(oversized.status).toBe(422);
});

test("content preflight reserves translation keys owned by D1 drafts", async () => {
  const translationKey = `draft-owner-${crypto.randomUUID()}`;
  const slug = `draft-owner-${crypto.randomUUID()}`;
  const created = await fetch(`${baseURL}/api/posts`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({
      ...publishedPost,
      translationKey,
      slug,
      status: "draft",
      publishedAt: null,
    }),
  });
  expect(created.status).toBe(201);
  const row = Schema.decodeUnknownSync(savedResponseSchema)(await created.json()).data;

  try {
    const candidate = await fetch(`${baseURL}/api/content-check`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({
        entries: [toMetadata(publishedPost, translationKey, `candidate-${slug}`)],
      }),
    });

    expect(candidate.status).toBe(200);
    expect(readResult(await candidate.json()).conflictKeys).toEqual([translationKey]);
  } finally {
    await fetch(`${baseURL}/api/posts/${row.id}`, {
      method: "DELETE",
      headers: adminHeaders(),
      body: JSON.stringify({ version: row.version }),
    });
  }
});
