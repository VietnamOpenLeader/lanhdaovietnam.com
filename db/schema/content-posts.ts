import { sql } from "void/db";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "void/schema-d1";
import type { ContentKind, ContentStatus, Locale } from "../../src/content/contracts";

export const contentPosts = sqliteTable(
  "content_posts",
  {
    id: text("id").primaryKey(),
    translationKey: text("translation_key").notNull(),
    locale: text("locale").$type<Locale>().notNull(),
    slug: text("slug").notNull(),
    kind: text("kind").$type<ContentKind>().notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    body: text("body").notNull(),
    status: text("status").$type<ContentStatus>().notNull(),
    publishedAt: text("published_at"),
    startsAt: text("starts_at"),
    endsAt: text("ends_at"),
    location: text("location"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    uniqueIndex("content_locale_slug").on(table.locale, table.slug),
    uniqueIndex("content_translation_locale").on(table.translationKey, table.locale),
    index("content_locale_published").on(table.locale, table.status, table.publishedAt, table.id),
    index("content_locale_kind_published").on(
      table.locale,
      table.status,
      table.kind,
      table.publishedAt,
      table.id,
    ),
    index("content_translations").on(table.translationKey, table.status),
    check("content_locale_valid", sql`${table.locale} IN ('vi', 'en', 'zh-CN')`),
    check("content_kind_valid", sql`${table.kind} IN ('article', 'news', 'event')`),
    check("content_status_valid", sql`${table.status} IN ('draft', 'published')`),
    check("content_title_nonempty", sql`length(${table.title}) BETWEEN 1 AND 200`),
    check("content_description_nonempty", sql`length(${table.description}) BETWEEN 1 AND 500`),
    check("content_body_size", sql`length(CAST(${table.body} AS BLOB)) <= 204800`),
    check(
      "content_body_nonempty",
      sql`length(trim(${table.body}, char(9, 10, 11, 12, 13, 32))) > 0`,
    ),
    check("content_version_positive", sql`${table.version} > 0`),
    check(
      "content_published_has_date",
      sql`${table.status} != 'published' OR ${table.publishedAt} IS NOT NULL`,
    ),
    check(
      "content_event_fields",
      sql`(${table.kind} = 'event' AND ${table.startsAt} IS NOT NULL AND ${table.location} IS NOT NULL)
        OR (${table.kind} != 'event' AND ${table.startsAt} IS NULL AND ${table.endsAt} IS NULL AND ${table.location} IS NULL)`,
    ),
    check(
      "content_event_order",
      sql`${table.endsAt} IS NULL OR ${table.startsAt} IS NULL OR ${table.endsAt} >= ${table.startsAt}`,
    ),
  ],
);
