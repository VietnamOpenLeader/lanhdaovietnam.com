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

function insertRecord(
  db: Database,
  overrides: Partial<ContentRecord> = {},
): void {
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
  db.run("INSERT INTO posts (title, body) VALUES (?, ?)", ["keep", "unchanged"]);
  await applyProjectMigrations(db, { after: 0 });

  expect(db.query("SELECT title, body FROM posts").get())
    .toEqual({ title: "keep", body: "unchanged" });
  expect(db.query("SELECT name FROM sqlite_master WHERE name = 'content_posts'").get())
    .not.toBeNull();

  db.close();
});

test("content constraints reject invalid locales, unpublished dates, event order, and versions", async () => {
  const db = await migratedDatabase();

  expect(() => insertRecord(db, { locale: "cn" })).toThrow();
  expect(() => insertRecord(db, { status: "published", published_at: null })).toThrow();
  expect(() => insertRecord(db, {
    kind: "event",
    starts_at: "2026-10-20T00:00:00.000Z",
    ends_at: "2026-10-19T00:00:00.000Z",
    location: "Hanoi",
  })).toThrow();
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
      index: "content_locale_kind_published",
      sql: `EXPLAIN QUERY PLAN SELECT id, title, description, kind, published_at
        FROM content_posts WHERE locale = 'vi' AND status = 'published' AND kind = 'event'
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
  ];

  for (const plan of plans) {
    const details = db.query(plan.sql).all().map((row) => JSON.stringify(row)).join(" ");
    expect(details).toContain(plan.index);
    expect(details).not.toContain("SCAN content_posts");
    if (plan.index.startsWith("content_locale_") && plan.index.endsWith("published")) {
      expect(details).not.toContain("USE TEMP B-TREE");
    }
  }

  db.close();
});
