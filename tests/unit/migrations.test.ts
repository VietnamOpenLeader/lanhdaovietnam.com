import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { applyProjectMigrations } from "../migration-fixture";

interface ContentRecord {
  id: string;
  translation_key: string;
  locale: string;
  slug: string;
  kind: string;
  title: string;
  description: string;
  body: string;
  status: string;
  published_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

const contentRecord: ContentRecord = {
  id: "post-1",
  translation_key: "welcome",
  locale: "vi",
  slug: "welcome",
  kind: "article",
  title: "Welcome",
  description: "A welcome article",
  body: "# Welcome",
  status: "published",
  published_at: "2026-10-19T00:00:00.000Z",
  starts_at: null,
  ends_at: null,
  location: null,
  created_at: "2026-10-19T00:00:00.000Z",
  updated_at: "2026-10-19T00:00:00.000Z",
  version: 1,
};

async function migratedDatabase(): Promise<Database> {
  const db = new Database(":memory:");
  await applyProjectMigrations(db, {});
  return db;
}

function insertRecord(db: Database, overrides: Partial<ContentRecord> = {}): void {
  const record = { ...contentRecord, ...overrides };
  db.query(`
    INSERT INTO content_posts (
      id, translation_key, locale, slug, kind, title, description, body,
      status, published_at, starts_at, ends_at, location, created_at, updated_at, version
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `).run(
    record.id,
    record.translation_key,
    record.locale,
    record.slug,
    record.kind,
    record.title,
    record.description,
    record.body,
    record.status,
    record.published_at,
    record.starts_at,
    record.ends_at,
    record.location,
    record.created_at,
    record.updated_at,
    record.version,
  );
}

test("the content migration preserves legacy posts and adds indexed localized rows", async () => {
  const db = new Database(":memory:");

  await applyProjectMigrations(db, { through: 0 });
  db.run("INSERT INTO posts (title, body, created_at) VALUES (?, ?, ?)", [
    "Legacy article",
    "# Legacy article",
    "2026-10-19 10:11:12",
  ]);
  db.run("INSERT INTO posts (title, body, created_at) VALUES (?, ?, ?)", [
    "",
    " \n\t ",
    "not-a-date",
  ]);
  await applyProjectMigrations(db, { after: 0, through: 1 });
  insertRecord(db, {
    id: "existing-content",
    translation_key: "existing-content",
    slug: "existing-content",
  });
  await applyProjectMigrations(db, { after: 1 });

  expect(
    db
      .query(`
      SELECT translation_key, locale, slug, kind, title, description,
        body, status, published_at
      FROM content_posts WHERE id = 'legacy-post-1'
    `)
      .get(),
  ).toEqual({
    translation_key: "legacy-post-1",
    locale: "vi",
    slug: "legacy-post-1",
    kind: "article",
    title: "Legacy article",
    description: "Imported from legacy posts",
    body: "# Legacy article",
    status: "published",
    published_at: "2026-10-19T10:11:12.000Z",
  });
  expect(db.query("SELECT title, body FROM posts").get()).toEqual({
    title: "Legacy article",
    body: "# Legacy article",
  });
  expect(
    db
      .query(`
      SELECT title, body, status, published_at
      FROM content_posts WHERE id = 'legacy-post-2'
    `)
      .get(),
  ).toEqual({
    title: "Legacy post 2",
    body: "Original body remains in the legacy posts table.",
    status: "draft",
    published_at: null,
  });
  expect(db.query("SELECT COUNT(*) AS total FROM posts").get()).toEqual({ total: 2 });
  expect(
    db.query("SELECT title, body FROM content_posts WHERE id = 'existing-content'").get(),
  ).toEqual({ title: "Welcome", body: "# Welcome" });
  expect(
    db.query("SELECT name FROM sqlite_master WHERE name = 'content_posts'").get(),
  ).not.toBeNull();

  db.close();
});

test("content constraints reject invalid locales, unpublished dates, event order, and versions", async () => {
  const db = await migratedDatabase();

  expect(() => insertRecord(db, { locale: "cn" })).toThrow();
  expect(() => insertRecord(db, { status: "published", published_at: null })).toThrow();
  expect(() =>
    insertRecord(db, {
      kind: "event",
      starts_at: "2026-10-20T00:00:00.000Z",
      ends_at: "2026-10-19T00:00:00.000Z",
      location: "Hanoi",
    }),
  ).toThrow();
  expect(() => insertRecord(db, { body: "  \n\t" })).toThrow();
  expect(() => insertRecord(db, { version: 0 })).toThrow();

  db.close();
});

test("content keys are unique per locale and translation", async () => {
  const db = await migratedDatabase();
  insertRecord(db);

  expect(() => insertRecord(db, { id: "post-2", slug: "other" })).toThrow();
  expect(() => insertRecord(db, { id: "post-3", translation_key: "other" })).toThrow();

  db.close();
});

test("all locales in one translation group keep the same content kind", async () => {
  const db = await migratedDatabase();
  insertRecord(db);

  expect(() =>
    insertRecord(db, {
      id: "post-2",
      translation_key: "welcome",
      locale: "en",
      slug: "welcome",
      kind: "news",
    }),
  ).toThrow();
  insertRecord(db, {
    id: "post-3",
    translation_key: "welcome",
    locale: "en",
    slug: "welcome-en",
  });
  expect(() =>
    db.query("UPDATE content_posts SET kind = 'news' WHERE id = 'post-3'").run(),
  ).toThrow();

  db.close();
});

test("public list, kind list, slug lookup, and translations use their indexes", async () => {
  const db = await migratedDatabase();
  const plans = [
    {
      index: "content_locale_published",
      sql: `EXPLAIN QUERY PLAN SELECT id, title, description, kind, published_at
        FROM content_posts WHERE locale = 'vi' AND status = 'published'
        ORDER BY published_at DESC, id DESC LIMIT 20`,
    },
    {
      index: "content_locale_published",
      sql: `EXPLAIN QUERY PLAN SELECT slug
        FROM content_posts WHERE locale = 'vi' AND status = 'published'
        ORDER BY published_at DESC, id DESC LIMIT 10000 OFFSET 20000`,
    },
    {
      index: "content_locale_kind_published",
      sql: `EXPLAIN QUERY PLAN SELECT id, title, description, kind, published_at
        FROM content_posts WHERE locale = 'vi' AND status = 'published' AND kind = 'event'
        ORDER BY published_at DESC, id DESC LIMIT 20`,
    },
    {
      index: "content_locale_published",
      sql: `EXPLAIN QUERY PLAN SELECT id, title, description, kind, published_at
        FROM content_posts
        WHERE locale = 'vi' AND status = 'published'
          AND (published_at < '2026-10-19T00:00:00.000Z'
            OR (published_at = '2026-10-19T00:00:00.000Z' AND id < 'ffffffff'))
        ORDER BY published_at DESC, id DESC LIMIT 20`,
    },
    {
      index: "content_locale_slug",
      sql: "EXPLAIN QUERY PLAN SELECT * FROM content_posts WHERE locale = 'vi' AND slug = 'welcome'",
    },
    {
      index: "content_translations",
      sql: `EXPLAIN QUERY PLAN SELECT locale, slug FROM content_posts
        WHERE translation_key = 'welcome' AND status = 'published'`,
    },
    {
      index: "content_translations",
      sql: `EXPLAIN QUERY PLAN SELECT translation_key, locale FROM content_posts
        WHERE translation_key IN ('welcome', 'another-key') AND status = 'published'`,
    },
  ];

  for (const plan of plans) {
    const details = db
      .query(plan.sql)
      .all()
      .map((row) => JSON.stringify(row))
      .join(" ");
    expect(details).toContain(plan.index);
    expect(details).not.toContain("SCAN content_posts");
    if (plan.index.startsWith("content_locale_") && plan.index.endsWith("published")) {
      expect(details).not.toContain("USE TEMP B-TREE");
    }
  }

  db.close();
});
