-- void:allow-destructive
DROP TABLE IF EXISTS temp.`__content_posts_migration_guard`;--> statement-breakpoint
CREATE TEMP TABLE `__content_posts_migration_guard` (
	`valid` integer NOT NULL CHECK (`valid` = 1)
);--> statement-breakpoint
INSERT INTO `__content_posts_migration_guard` (`valid`)
SELECT CASE
	WHEN EXISTS (
		SELECT 1 FROM `content_posts`
		WHERE length(trim(`body`, char(9, 10, 11, 12, 13, 32))) = 0
	) THEN 0
	WHEN EXISTS (
		SELECT 1 FROM `content_posts`
		GROUP BY `translation_key`
		HAVING COUNT(DISTINCT `kind`) > 1
	) THEN 0
	WHEN EXISTS (
		SELECT 1
		FROM `posts` AS legacy
		JOIN `content_posts` AS current
			ON current.`id` = 'legacy-post-' || legacy.`id`
			OR current.`translation_key` = 'legacy-post-' || legacy.`id`
			OR (
				current.`locale` = 'vi'
				AND current.`slug` = 'legacy-post-' || legacy.`id`
			)
	) THEN 0
	ELSE 1
END;--> statement-breakpoint
DROP TABLE `__content_posts_migration_guard`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_content_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`translation_key` text NOT NULL,
	`locale` text NOT NULL,
	`slug` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`body` text NOT NULL,
	`status` text NOT NULL,
	`published_at` text,
	`starts_at` text,
	`ends_at` text,
	`location` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	CONSTRAINT "content_locale_valid" CHECK("locale" IN ('vi', 'en', 'zh-CN')),
	CONSTRAINT "content_kind_valid" CHECK("kind" IN ('article', 'news', 'event')),
	CONSTRAINT "content_status_valid" CHECK("status" IN ('draft', 'published')),
	CONSTRAINT "content_title_nonempty" CHECK(length("title") BETWEEN 1 AND 200),
	CONSTRAINT "content_description_nonempty" CHECK(length("description") BETWEEN 1 AND 500),
	CONSTRAINT "content_body_size" CHECK(length(CAST("body" AS BLOB)) <= 204800),
	CONSTRAINT "content_body_nonempty" CHECK(length(trim("body", char(9, 10, 11, 12, 13, 32))) > 0),
	CONSTRAINT "content_version_positive" CHECK("version" > 0),
	CONSTRAINT "content_published_has_date" CHECK("status" != 'published' OR "published_at" IS NOT NULL),
	CONSTRAINT "content_event_fields" CHECK(("kind" = 'event' AND "starts_at" IS NOT NULL AND "location" IS NOT NULL)
        OR ("kind" != 'event' AND "starts_at" IS NULL AND "ends_at" IS NULL AND "location" IS NULL)),
	CONSTRAINT "content_event_order" CHECK("ends_at" IS NULL OR "starts_at" IS NULL OR "ends_at" >= "starts_at")
);
--> statement-breakpoint
INSERT INTO `__new_content_posts`("id", "translation_key", "locale", "slug", "kind", "title", "description", "body", "status", "published_at", "starts_at", "ends_at", "location", "created_at", "updated_at", "version") SELECT "id", "translation_key", "locale", "slug", "kind", "title", "description", "body", "status", "published_at", "starts_at", "ends_at", "location", "created_at", "updated_at", "version" FROM `content_posts`;--> statement-breakpoint
DROP TABLE `content_posts`;--> statement-breakpoint
ALTER TABLE `__new_content_posts` RENAME TO `content_posts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `content_locale_slug` ON `content_posts` (`locale`,`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `content_translation_locale` ON `content_posts` (`translation_key`,`locale`);--> statement-breakpoint
CREATE INDEX `content_locale_published` ON `content_posts` (`locale`,`status`,`published_at`,`id`);--> statement-breakpoint
CREATE INDEX `content_locale_kind_published` ON `content_posts` (`locale`,`status`,`kind`,`published_at`,`id`);--> statement-breakpoint
CREATE INDEX `content_translations` ON `content_posts` (`translation_key`,`status`);
--> statement-breakpoint
CREATE TRIGGER `content_translation_kind_insert`
BEFORE INSERT ON `content_posts`
FOR EACH ROW
WHEN EXISTS (
	SELECT 1
	FROM `content_posts` AS existing
	WHERE existing.`translation_key` = NEW.`translation_key`
		AND existing.`kind` != NEW.`kind`
)
BEGIN
	SELECT RAISE(ABORT, 'content translation kind mismatch');
END;
--> statement-breakpoint
CREATE TRIGGER `content_translation_kind_update`
BEFORE UPDATE OF `translation_key`, `kind` ON `content_posts`
FOR EACH ROW
WHEN EXISTS (
	SELECT 1
	FROM `content_posts` AS existing
	WHERE existing.`translation_key` = NEW.`translation_key`
		AND existing.`id` != OLD.`id`
		AND existing.`kind` != NEW.`kind`
)
BEGIN
	SELECT RAISE(ABORT, 'content translation kind mismatch');
END;
--> statement-breakpoint
WITH legacy_posts AS (
	SELECT
		`id`,
		`title`,
		`body`,
		strftime('%Y-%m-%dT%H:%M:%fZ', `created_at`) AS `parsed_created_at`,
		COALESCE(
			strftime('%Y-%m-%dT%H:%M:%fZ', `created_at`),
			strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
		) AS `created_at_iso`,
		length(trim(`title`)) BETWEEN 1 AND 200 AS `valid_title`,
		length(trim(`body`, char(9, 10, 11, 12, 13, 32))) > 0
			AND length(CAST(`body` AS BLOB)) <= 204800 AS `valid_body`
	FROM `posts`
)
INSERT INTO `content_posts` (
	`id`, `translation_key`, `locale`, `slug`, `kind`, `title`, `description`, `body`,
	`status`, `published_at`, `starts_at`, `ends_at`, `location`,
	`created_at`, `updated_at`, `version`
)
SELECT
	'legacy-post-' || `id`,
	'legacy-post-' || `id`,
	'vi',
	'legacy-post-' || `id`,
	'article',
	CASE WHEN `valid_title` THEN trim(`title`) ELSE 'Legacy post ' || `id` END,
	'Imported from legacy posts',
	CASE
		WHEN `valid_body` THEN `body`
		ELSE 'Original body remains in the legacy posts table.'
	END,
	CASE
		WHEN `valid_title`
			AND `valid_body`
			AND `parsed_created_at` IS NOT NULL
			AND `created_at_iso` <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
		THEN 'published'
		ELSE 'draft'
	END,
	CASE
		WHEN `valid_title`
			AND `valid_body`
			AND `parsed_created_at` IS NOT NULL
			AND `created_at_iso` <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
		THEN `created_at_iso`
		ELSE NULL
	END,
	NULL,
	NULL,
	NULL,
	`created_at_iso`,
	`created_at_iso`,
	1
FROM `legacy_posts`;
