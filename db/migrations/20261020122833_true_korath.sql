-- void:allow-destructive
CREATE TABLE `__ivt_migration_20261020122833_legacy_post_repair` AS
WITH legacy_timestamp_shapes AS (
	SELECT
		`id`,
		`title`,
		`body`,
		`created_at`,
		CASE
			WHEN length(`created_at`) IN (19, 20, 24, 25, 29)
				AND substr(`created_at`, 5, 1) = '-'
				AND substr(`created_at`, 8, 1) = '-'
				AND substr(`created_at`, 14, 1) = ':'
				AND substr(`created_at`, 17, 1) = ':'
				AND substr(`created_at`, 1, 4) NOT GLOB '*[^0-9]*'
				AND substr(`created_at`, 6, 2) NOT GLOB '*[^0-9]*'
				AND substr(`created_at`, 9, 2) NOT GLOB '*[^0-9]*'
				AND substr(`created_at`, 12, 2) NOT GLOB '*[^0-9]*'
				AND substr(`created_at`, 15, 2) NOT GLOB '*[^0-9]*'
				AND substr(`created_at`, 18, 2) NOT GLOB '*[^0-9]*'
				AND (
					(length(`created_at`) = 19 AND substr(`created_at`, 11, 1) = ' ')
					OR (
						length(`created_at`) = 20
						AND substr(`created_at`, 11, 1) = 'T'
						AND substr(`created_at`, 20, 1) = 'Z'
					)
					OR (
						length(`created_at`) = 24
						AND substr(`created_at`, 11, 1) = 'T'
						AND substr(`created_at`, 20, 1) = '.'
						AND substr(`created_at`, 21, 3) NOT GLOB '*[^0-9]*'
						AND substr(`created_at`, 24, 1) = 'Z'
					)
					OR (
						length(`created_at`) = 25
						AND substr(`created_at`, 11, 1) = 'T'
						AND substr(`created_at`, 20, 1) IN ('+', '-')
						AND substr(`created_at`, 23, 1) = ':'
						AND substr(`created_at`, 21, 2) NOT GLOB '*[^0-9]*'
						AND substr(`created_at`, 24, 2) NOT GLOB '*[^0-9]*'
					)
					OR (
						length(`created_at`) = 29
						AND substr(`created_at`, 11, 1) = 'T'
						AND substr(`created_at`, 20, 1) = '.'
						AND substr(`created_at`, 21, 3) NOT GLOB '*[^0-9]*'
						AND substr(`created_at`, 24, 1) IN ('+', '-')
						AND substr(`created_at`, 27, 1) = ':'
						AND substr(`created_at`, 25, 2) NOT GLOB '*[^0-9]*'
						AND substr(`created_at`, 28, 2) NOT GLOB '*[^0-9]*'
					)
				)
			THEN 1
			ELSE 0
		END AS `has_supported_shape`
	FROM `posts`
),
legacy_timestamp_validity AS (
	SELECT
		*,
		CASE
			WHEN `has_supported_shape` = 1
				AND CAST(substr(`created_at`, 1, 4) AS INTEGER) BETWEEN 1 AND 9999
				AND CAST(substr(`created_at`, 6, 2) AS INTEGER) BETWEEN 1 AND 12
				AND CAST(substr(`created_at`, 9, 2) AS INTEGER) BETWEEN 1 AND CASE
					CAST(substr(`created_at`, 6, 2) AS INTEGER)
					WHEN 2 THEN CASE
						WHEN CAST(substr(`created_at`, 1, 4) AS INTEGER) % 400 = 0
							OR (
								CAST(substr(`created_at`, 1, 4) AS INTEGER) % 4 = 0
								AND CAST(substr(`created_at`, 1, 4) AS INTEGER) % 100 != 0
							)
						THEN 29
						ELSE 28
					END
					WHEN 4 THEN 30
					WHEN 6 THEN 30
					WHEN 9 THEN 30
					WHEN 11 THEN 30
					ELSE 31
				END
				AND CAST(substr(`created_at`, 12, 2) AS INTEGER) BETWEEN 0 AND 23
				AND CAST(substr(`created_at`, 15, 2) AS INTEGER) BETWEEN 0 AND 59
				AND CAST(substr(`created_at`, 18, 2) AS INTEGER) BETWEEN 0 AND 59
				AND (
					length(`created_at`) NOT IN (25, 29)
					OR (
						CAST(substr(
							`created_at`,
							CASE WHEN length(`created_at`) = 25 THEN 21 ELSE 25 END,
							2
						) AS INTEGER) BETWEEN 0 AND 14
						AND CAST(substr(
							`created_at`,
							CASE WHEN length(`created_at`) = 25 THEN 24 ELSE 28 END,
							2
						) AS INTEGER) BETWEEN 0 AND 59
						AND (
							CAST(substr(
								`created_at`,
								CASE WHEN length(`created_at`) = 25 THEN 21 ELSE 25 END,
								2
							) AS INTEGER) < 14
							OR CAST(substr(
								`created_at`,
								CASE WHEN length(`created_at`) = 25 THEN 24 ELSE 28 END,
								2
							) AS INTEGER) = 0
						)
					)
				)
				AND strftime('%Y-%m-%dT%H:%M:%fZ', `created_at`) IS NOT NULL
			THEN strftime('%Y-%m-%dT%H:%M:%fZ', `created_at`)
			ELSE NULL
		END AS `parsed_created_at`
	FROM `legacy_timestamp_shapes`
),
legacy_post_state AS (
	SELECT
		`id`,
		'legacy-post-' || `id` AS `content_id`,
		`parsed_created_at`,
		length(trim(`title`, char(9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279))) BETWEEN 1 AND 200 AS `valid_title`,
		length(trim(`body`, char(9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279))) > 0
			AND length(CAST(`body` AS BLOB)) <= 204800 AS `valid_body`
	FROM `legacy_timestamp_validity`
)
SELECT
	`content_id`,
	`parsed_created_at`,
	`valid_title`,
	`valid_body`,
	CASE
		WHEN `parsed_created_at` IS NULL
			OR `parsed_created_at` > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
			OR NOT `valid_title`
			OR NOT `valid_body`
		THEN 1
		ELSE 0
	END AS `needs_draft`,
	CASE
		WHEN `parsed_created_at` IS NULL
			OR `parsed_created_at` > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
		THEN 1
		ELSE 0
	END AS `needs_timestamp_fallback`
FROM `legacy_post_state`;--> statement-breakpoint
UPDATE `content_posts`
SET `title` = 'Legacy post ' || substr(`id`, 13)
WHERE `version` = 1
	AND `id` IN (
		SELECT `content_id`
		FROM `__ivt_migration_20261020122833_legacy_post_repair`
		WHERE NOT `valid_title`
	);--> statement-breakpoint
UPDATE `content_posts`
SET `body` = 'Original body remains in the legacy posts table.'
WHERE `version` = 1
	AND `id` IN (
		SELECT `content_id`
		FROM `__ivt_migration_20261020122833_legacy_post_repair`
		WHERE NOT `valid_body`
	);--> statement-breakpoint
UPDATE `content_posts`
SET `status` = 'draft', `published_at` = NULL
WHERE `version` = 1
	AND `id` IN (
		SELECT `content_id`
		FROM `__ivt_migration_20261020122833_legacy_post_repair`
		WHERE `needs_draft` = 1
	);--> statement-breakpoint
UPDATE `content_posts`
SET
	`created_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
	`updated_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE `version` = 1
	AND `id` IN (
		SELECT `content_id`
		FROM `__ivt_migration_20261020122833_legacy_post_repair`
		WHERE `needs_timestamp_fallback` = 1
);--> statement-breakpoint
DROP TABLE `__ivt_migration_20261020122833_legacy_post_repair`;--> statement-breakpoint
CREATE TABLE `__ivt_migration_20261020122833_guard` (
	`valid` integer NOT NULL CHECK (`valid` = 1)
);--> statement-breakpoint
INSERT INTO `__ivt_migration_20261020122833_guard` (`valid`)
SELECT CASE
	WHEN EXISTS (
		SELECT 1 FROM `content_posts`
		WHERE length(trim(`body`, char(9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279))) = 0
			OR length(trim(`title`, char(9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279))) = 0
			OR length(trim(`description`, char(9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279))) = 0
			OR (
				`kind` = 'event'
				AND length(trim(`location`, char(9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279))) = 0
			)
	) THEN 0
	WHEN EXISTS (
		SELECT 1 FROM `content_posts`
		GROUP BY `translation_key`
		HAVING COUNT(DISTINCT `kind`) > 1
	) THEN 0
	ELSE 1
END;--> statement-breakpoint
DROP TABLE `__ivt_migration_20261020122833_guard`;--> statement-breakpoint
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
	CONSTRAINT "content_title_nonempty" CHECK(length("title") BETWEEN 1 AND 200 AND length(trim("title", char(9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279))) > 0),
	CONSTRAINT "content_description_nonempty" CHECK(length("description") BETWEEN 1 AND 500 AND length(trim("description", char(9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279))) > 0),
	CONSTRAINT "content_body_size" CHECK(length(CAST("body" AS BLOB)) <= 204800),
	CONSTRAINT "content_body_nonempty" CHECK(length(trim("body", char(9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279))) > 0),
	CONSTRAINT "content_event_location_nonempty" CHECK("kind" != 'event' OR (length("location") BETWEEN 1 AND 200 AND length(trim("location", char(9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279))) > 0)),
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
CREATE UNIQUE INDEX `content_locale_slug` ON `content_posts` (`locale`,`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `content_translation_locale` ON `content_posts` (`translation_key`,`locale`);--> statement-breakpoint
CREATE INDEX `content_locale_published` ON `content_posts` (`locale`,`status`,`published_at`,`id`);--> statement-breakpoint
CREATE INDEX `content_locale_kind_published` ON `content_posts` (`locale`,`status`,`kind`,`published_at`,`id`);--> statement-breakpoint
CREATE INDEX `content_translations` ON `content_posts` (`translation_key`,`status`);--> statement-breakpoint
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
