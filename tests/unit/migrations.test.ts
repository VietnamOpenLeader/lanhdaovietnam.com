import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { applyProjectMigrations } from "../migration-fixture";
import { ecmascriptTrimWhitespace, nonEcmascriptWhitespace } from "../fixtures/content";

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

async function databaseBeforeIntegrityMigration(): Promise<Database> {
  const db = new Database(":memory:");
  await applyProjectMigrations(db, { through: 1 });
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
  db.run("INSERT INTO posts (title, body, created_at) VALUES (?, ?, ?)", [
    "Needs date review",
    "# Needs date review",
    "not-a-date",
  ]);
  db.run("INSERT INTO posts (title, body, created_at) VALUES (?, ?, ?)", [
    "Whitespace body",
    "\u00a0\u2003\u2028\u2029\ufeff",
    "2026-10-19 10:11:12",
  ]);
  await applyProjectMigrations(db, { after: 0, through: 1 });
  insertRecord(db, {
    id: "existing-content",
    translation_key: "existing-content",
    slug: "existing-content",
  });
  const legacyRowsBeforeRebuild = db.query("SELECT * FROM posts ORDER BY id").all();
  const contentRowsBeforeRebuild = db.query("SELECT * FROM content_posts ORDER BY id").all();
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
  expect(db.query("SELECT COUNT(*) AS total FROM posts").get()).toEqual({ total: 4 });
  expect(db.query("SELECT * FROM posts ORDER BY id").all()).toEqual(legacyRowsBeforeRebuild);
  expect(db.query("SELECT * FROM content_posts WHERE id = 'existing-content'").all()).toEqual(
    contentRowsBeforeRebuild,
  );
  expect(
    db.query("SELECT status, published_at FROM content_posts WHERE id = 'legacy-post-3'").get(),
  ).toEqual({ status: "draft", published_at: null });
  expect(
    db
      .query("SELECT body, status, published_at FROM content_posts WHERE id = 'legacy-post-4'")
      .get(),
  ).toEqual({
    body: "Original body remains in the legacy posts table.",
    status: "draft",
    published_at: null,
  });
  expect(
    db.query("SELECT title, body FROM content_posts WHERE id = 'existing-content'").get(),
  ).toEqual({ title: "Welcome", body: "# Welcome" });
  expect(
    db.query("SELECT name FROM sqlite_master WHERE name = 'content_posts'").get(),
  ).not.toBeNull();

  db.close();
});

test("legacy timestamps require strict calendar-valid shapes before publication", async () => {
  const db = new Database(":memory:");
  const timestamps = [
    "2025-02-30 10:11:12",
    "2025-02-29 10:11:12",
    "2025-01-01 24:00:00",
    "0",
    "2025-01-01 10:11:12trailing",
    "2026-10-19T10:11:12+15:00",
    "2026-10-19T10:11:12.1Z",
    "2026-10-19T10:11:12+07:00",
    "2026-10-19T10:11:12.345Z",
    "2099-01-01 00:00:00",
  ];

  await applyProjectMigrations(db, { through: 0 });
  for (const [index, timestamp] of timestamps.entries()) {
    db.run("INSERT INTO posts (title, body, created_at) VALUES (?, ?, ?)", [
      `Legacy timestamp ${index + 1}`,
      "# Legacy timestamp",
      timestamp,
    ]);
  }
  await applyProjectMigrations(db, { after: 0 });

  for (const legacyId of [
    "legacy-post-1",
    "legacy-post-2",
    "legacy-post-3",
    "legacy-post-4",
    "legacy-post-5",
    "legacy-post-6",
    "legacy-post-7",
    "legacy-post-10",
  ]) {
    expect(
      db.query("SELECT status, published_at FROM content_posts WHERE id = ?").get(legacyId),
    ).toEqual({ status: "draft", published_at: null });
    expect(db.query("SELECT created_at FROM content_posts WHERE id = ?").get(legacyId)).toEqual({
      created_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u),
    });
  }
  expect(
    db.query("SELECT status, published_at FROM content_posts WHERE id = 'legacy-post-8'").get(),
  ).toEqual({
    status: "published",
    published_at: "2026-10-19T03:11:12.000Z",
  });
  expect(
    db.query("SELECT status, published_at FROM content_posts WHERE id = 'legacy-post-9'").get(),
  ).toEqual({
    status: "published",
    published_at: "2026-10-19T10:11:12.345Z",
  });

  db.close();
});

test("forward migration downgrades malformed legacy dates and blank bodies", async () => {
  const db = new Database(":memory:");
  await applyProjectMigrations(db, { through: 0 });
  db.run("INSERT INTO posts (title, body, created_at) VALUES (?, ?, ?)", [
    "Malformed timestamp",
    "# Valid body",
    "2025-02-30 10:11:12",
  ]);
  db.run("INSERT INTO posts (title, body, created_at) VALUES (?, ?, ?)", [
    "Whitespace body",
    "\u00a0\u2003\u2028\u2029\ufeff",
    "2026-10-19 10:11:12",
  ]);
  db.run("INSERT INTO posts (title, body, created_at) VALUES (?, ?, ?)", [
    "NUL body",
    "Visible\u0000hidden",
    "2026-10-19 10:11:12",
  ]);
  await applyProjectMigrations(db, { after: 0, through: 2 });

  expect(db.query("SELECT status FROM content_posts WHERE id = 'legacy-post-1'").get()).toEqual({
    status: "published",
  });
  expect(db.query("SELECT status FROM content_posts WHERE id = 'legacy-post-2'").get()).toEqual({
    status: "published",
  });
  expect(db.query("SELECT status FROM content_posts WHERE id = 'legacy-post-3'").get()).toEqual({
    status: "published",
  });
  expect(
    db
      .query("SELECT tag FROM __test_migration_history WHERE tag = ?")
      .get("20261020104231_stiff_nighthawk"),
  ).toEqual({
    tag: "20261020104231_stiff_nighthawk",
  });
  expect(
    db
      .query("SELECT tag FROM __test_migration_history WHERE tag = ?")
      .get("20261020122833_true_korath"),
  ).toBeNull();

  await applyProjectMigrations(db, { after: 2 });

  expect(
    db.query("SELECT status, published_at FROM content_posts WHERE id = 'legacy-post-1'").get(),
  ).toEqual({ status: "draft", published_at: null });
  expect(
    db
      .query("SELECT body, status, published_at FROM content_posts WHERE id = 'legacy-post-2'")
      .get(),
  ).toEqual({
    body: "Original body remains in the legacy posts table.",
    status: "draft",
    published_at: null,
  });
  expect(
    db
      .query("SELECT body, status, published_at FROM content_posts WHERE id = 'legacy-post-3'")
      .get(),
  ).toEqual({
    body: "Original body remains in the legacy posts table.",
    status: "draft",
    published_at: null,
  });
  expect(
    db
      .query("SELECT tag FROM __test_migration_history WHERE tag = ?")
      .get("20261020122833_true_korath"),
  ).toEqual({
    tag: "20261020122833_true_korath",
  });
  expect(db.query("SELECT COUNT(*) AS total FROM posts").get()).toEqual({ total: 3 });

  db.close();
});

test("forward migration preserves legacy content edited after the initial backfill", async () => {
  const db = new Database(":memory:");
  await applyProjectMigrations(db, { through: 0 });
  db.run("INSERT INTO posts (title, body, created_at) VALUES (?, ?, ?)", [
    "Legacy article",
    " \n\t ",
    "not-a-date",
  ]);
  await applyProjectMigrations(db, { after: 0, through: 2 });
  db.query(`
    UPDATE content_posts
    SET title = ?, description = ?, body = ?, status = ?, published_at = ?, updated_at = ?, version = ?
    WHERE id = 'legacy-post-1'
  `).run(
    "Reviewed article",
    "Reviewed by an editor",
    "# Operator repair",
    "published",
    "2026-10-19T10:11:12.000Z",
    "2026-10-20T10:11:12.000Z",
    2,
  );
  const operatorEdit = db.query("SELECT * FROM content_posts WHERE id = 'legacy-post-1'").get();

  await applyProjectMigrations(db, { after: 2 });

  expect(db.query("SELECT * FROM content_posts WHERE id = 'legacy-post-1'").get()).toEqual(
    operatorEdit,
  );
  db.close();
});

test("content constraints reject invalid locales, unpublished dates, event order, and versions", async () => {
  const db = await migratedDatabase();
  const nulPositions = ["\u0000abc", "a\u0000bc", "abc\u0000"];

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
  for (const whitespace of ecmascriptTrimWhitespace) {
    expect(() => insertRecord(db, { body: whitespace })).toThrow();
    expect(() => insertRecord(db, { title: whitespace })).toThrow();
    expect(() => insertRecord(db, { description: whitespace })).toThrow();
  }
  expect(() => insertRecord(db, { title: `${"x".repeat(200)} ` })).toThrow();
  expect(() => insertRecord(db, { title: "😀".repeat(201) })).toThrow();
  expect(() => insertRecord(db, { description: `${"x".repeat(500)} ` })).toThrow();
  expect(() => insertRecord(db, { description: "😀".repeat(501) })).toThrow();
  for (const value of nulPositions) {
    expect(() => insertRecord(db, { title: value })).toThrow();
    expect(() => insertRecord(db, { description: value })).toThrow();
    expect(() => insertRecord(db, { body: value })).toThrow();
    expect(() =>
      insertRecord(db, {
        kind: "event",
        starts_at: "2026-10-20T00:00:00.000Z",
        location: value,
      }),
    ).toThrow();
  }
  expect(() =>
    insertRecord(db, {
      kind: "event",
      starts_at: "2026-10-20T00:00:00.000Z",
      location: "\u00a0\u2003",
    }),
  ).toThrow();
  expect(() =>
    insertRecord(db, {
      kind: "event",
      starts_at: "2026-10-20T00:00:00.000Z",
      location: `${"x".repeat(200)} `,
    }),
  ).toThrow();
  expect(() =>
    insertRecord(db, {
      kind: "event",
      starts_at: "2026-10-20T00:00:00.000Z",
      location: "😀".repeat(201),
    }),
  ).toThrow();
  for (const location of nulPositions) {
    expect(() =>
      insertRecord(db, {
        kind: "event",
        starts_at: "2026-10-20T00:00:00.000Z",
        location,
      }),
    ).toThrow();
  }
  insertRecord(db, {
    id: "emoji-title",
    translation_key: "emoji-title",
    slug: "emoji-title",
    title: "😀".repeat(200),
  });
  insertRecord(db, {
    id: "emoji-description",
    translation_key: "emoji-description",
    slug: "emoji-description",
    description: "😀".repeat(500),
  });
  insertRecord(db, {
    id: "non-trimmed-whitespace",
    translation_key: "non-trimmed-whitespace",
    slug: "non-trimmed-whitespace",
    title: nonEcmascriptWhitespace,
    description: nonEcmascriptWhitespace,
    body: nonEcmascriptWhitespace,
  });
  insertRecord(db, {
    id: "non-trimmed-location",
    translation_key: "non-trimmed-location",
    slug: "non-trimmed-location",
    kind: "event",
    starts_at: "2026-10-20T00:00:00.000Z",
    location: nonEcmascriptWhitespace,
  });
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

test("migration rolls back on legacy id, key, and locale slug collisions", async () => {
  const collisions: ReadonlyArray<Pick<ContentRecord, "id" | "translation_key" | "slug">> = [
    { id: "legacy-post-1", translation_key: "reserved-id", slug: "reserved-id" },
    { id: "reserved-key", translation_key: "legacy-post-1", slug: "reserved-key" },
    { id: "reserved-slug", translation_key: "reserved-slug", slug: "legacy-post-1" },
  ];

  for (const collision of collisions) {
    const db = await databaseBeforeIntegrityMigration();
    db.run("INSERT INTO posts (title, body, created_at) VALUES (?, ?, ?)", [
      "Legacy article",
      "# Legacy article",
      "2026-10-19 10:11:12",
    ]);
    insertRecord(db, collision);
    const contentSchema = db
      .query("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'content_posts'")
      .get();
    const contentRows = db.query("SELECT * FROM content_posts ORDER BY id").all();

    await expect(applyProjectMigrations(db, { after: 1 })).rejects.toThrow();
    expect(
      db
        .query("SELECT tag FROM __test_migration_history WHERE tag = ?")
        .get("20261020104231_stiff_nighthawk"),
    ).toBeNull();
    expect(
      db
        .query("SELECT name FROM sqlite_master WHERE name = '__ivt_migration_20261020122833_guard'")
        .get(),
    ).toBeNull();
    expect(
      db
        .query("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'content_posts'")
        .get(),
    ).toEqual(contentSchema);
    expect(db.query("SELECT * FROM content_posts ORDER BY id").all()).toEqual(contentRows);
    expect(
      db
        .query(
          "SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'content_posts'",
        )
        .all(),
    ).toEqual([]);

    db.query("DELETE FROM content_posts WHERE id = ?").run(collision.id);
    await applyProjectMigrations(db, { after: 1 });
    expect(
      db
        .query("SELECT tag FROM __test_migration_history WHERE tag = ?")
        .get("20261020104231_stiff_nighthawk"),
    ).toEqual({
      tag: "20261020104231_stiff_nighthawk",
    });
    expect(
      db
        .query("SELECT tag FROM __test_migration_history WHERE tag = ?")
        .get("20261020122833_true_korath"),
    ).toEqual({
      tag: "20261020122833_true_korath",
    });

    expect(
      db
        .query("SELECT name FROM sqlite_master WHERE name = '__ivt_migration_20261020122833_guard'")
        .get(),
    ).toBeNull();
    expect(
      db.query("SELECT name FROM sqlite_master WHERE name = '__new_content_posts'").get(),
    ).toBeNull();
    expect(db.query("SELECT status FROM content_posts WHERE id = 'legacy-post-1'").get()).toEqual({
      status: "published",
    });

    db.close();
  }
});

test("migration refuses pre-existing blank bodies before rebuilding the content table", async () => {
  const db = await databaseBeforeIntegrityMigration();
  insertRecord(db, { id: "blank-existing", body: " \n\t " });

  await expect(applyProjectMigrations(db, { after: 1 })).rejects.toThrow();
  expect(db.query("SELECT body FROM content_posts WHERE id = 'blank-existing'").get()).toEqual({
    body: " \n\t ",
  });
  expect(
    db.query("SELECT name FROM sqlite_master WHERE name = '__new_content_posts'").get(),
  ).toBeNull();

  db.close();
});

test("migration refuses ECMAScript-whitespace-only existing bodies before rebuilding", async () => {
  const whitespaceBodies = ecmascriptTrimWhitespace;

  for (const [index, body] of whitespaceBodies.entries()) {
    const db = await databaseBeforeIntegrityMigration();
    const id = `unicode-blank-${index}`;
    insertRecord(db, { id, body });
    const contentRows = db.query("SELECT * FROM content_posts ORDER BY id").all();

    await expect(applyProjectMigrations(db, { after: 1 })).rejects.toThrow(
      /CHECK constraint failed/u,
    );
    expect(
      db
        .query("SELECT name FROM sqlite_master WHERE name = '__ivt_migration_20261020122833_guard'")
        .get(),
    ).toBeNull();
    expect(db.query("SELECT * FROM content_posts ORDER BY id").all()).toEqual(contentRows);
    expect(
      db.query("SELECT name FROM sqlite_master WHERE name = '__new_content_posts'").get(),
    ).toBeNull();

    db.close();
  }
});

test("migration refuses pre-existing blank metadata before rebuilding", async () => {
  const invalidRows: ReadonlyArray<Partial<ContentRecord>> = [
    { id: "blank-title", title: "\u2003" },
    { id: "blank-description", description: "\u00a0" },
    {
      id: "blank-event-location",
      translation_key: "blank-event",
      locale: "en",
      slug: "blank-event",
      kind: "event",
      starts_at: "2026-10-20T00:00:00.000Z",
      location: "\u2028",
    },
  ];

  for (const invalidRow of invalidRows) {
    const db = await databaseBeforeIntegrityMigration();
    insertRecord(db, invalidRow);
    const contentRows = db.query("SELECT * FROM content_posts ORDER BY id").all();

    await expect(applyProjectMigrations(db, { after: 1 })).rejects.toThrow(
      /CHECK constraint failed/u,
    );
    expect(db.query("SELECT * FROM content_posts ORDER BY id").all()).toEqual(contentRows);
    expect(
      db.query("SELECT name FROM sqlite_master WHERE name = '__new_content_posts'").get(),
    ).toBeNull();

    db.close();
  }
});

test("migration refuses NUL-bearing nonlegacy metadata without losing the row", async () => {
  const db = new Database(":memory:");
  await applyProjectMigrations(db, { through: 2 });
  insertRecord(db, { id: "nul-metadata", title: "A\u0000B" });
  const original = db.query("SELECT * FROM content_posts WHERE id = 'nul-metadata'").get();

  await expect(applyProjectMigrations(db, { after: 2 })).rejects.toThrow(
    /CHECK constraint failed/u,
  );
  expect(db.query("SELECT * FROM content_posts WHERE id = 'nul-metadata'").get()).toEqual(original);
  expect(
    db
      .query("SELECT tag FROM __test_migration_history WHERE tag = ?")
      .get("20261020122833_true_korath"),
  ).toBeNull();
  expect(
    db
      .query(
        "SELECT COUNT(*) AS total FROM sqlite_master WHERE name LIKE '__ivt_migration_20261020122833_%'",
      )
      .get(),
  ).toEqual({ total: 0 });
  expect(
    db.query("SELECT name FROM sqlite_master WHERE name = '__new_content_posts'").get(),
  ).toBeNull();

  db.close();
});

test("migration refuses pre-existing mixed-kind translation groups before rebuilding", async () => {
  const db = await databaseBeforeIntegrityMigration();
  insertRecord(db);
  insertRecord(db, {
    id: "mixed-kind-existing",
    translation_key: "welcome",
    locale: "en",
    slug: "welcome-en",
    kind: "news",
  });

  await expect(applyProjectMigrations(db, { after: 1 })).rejects.toThrow();
  expect(db.query("SELECT kind FROM content_posts WHERE id = 'mixed-kind-existing'").get()).toEqual(
    { kind: "news" },
  );
  expect(
    db.query("SELECT name FROM sqlite_master WHERE name = '__new_content_posts'").get(),
  ).toBeNull();

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
