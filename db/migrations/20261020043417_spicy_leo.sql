CREATE TABLE `content_posts` (
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
	CONSTRAINT "content_locale_valid" CHECK("content_posts"."locale" IN ('vi', 'en', 'zh-CN')),
	CONSTRAINT "content_kind_valid" CHECK("content_posts"."kind" IN ('article', 'news', 'event')),
	CONSTRAINT "content_status_valid" CHECK("content_posts"."status" IN ('draft', 'published')),
	CONSTRAINT "content_title_nonempty" CHECK(length("content_posts"."title") BETWEEN 1 AND 200),
	CONSTRAINT "content_description_nonempty" CHECK(length("content_posts"."description") BETWEEN 1 AND 500),
	CONSTRAINT "content_body_size" CHECK(length(CAST("content_posts"."body" AS BLOB)) <= 204800),
	CONSTRAINT "content_version_positive" CHECK("content_posts"."version" > 0),
	CONSTRAINT "content_published_has_date" CHECK("content_posts"."status" != 'published' OR "content_posts"."published_at" IS NOT NULL),
	CONSTRAINT "content_event_fields" CHECK(("content_posts"."kind" = 'event' AND "content_posts"."starts_at" IS NOT NULL AND "content_posts"."location" IS NOT NULL)
        OR ("content_posts"."kind" != 'event' AND "content_posts"."starts_at" IS NULL AND "content_posts"."ends_at" IS NULL AND "content_posts"."location" IS NULL)),
	CONSTRAINT "content_event_order" CHECK("content_posts"."ends_at" IS NULL OR "content_posts"."starts_at" IS NULL OR "content_posts"."ends_at" >= "content_posts"."starts_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_locale_slug` ON `content_posts` (`locale`,`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `content_translation_locale` ON `content_posts` (`translation_key`,`locale`);--> statement-breakpoint
CREATE INDEX `content_locale_published` ON `content_posts` (`locale`,`status`,`published_at`,`id`);--> statement-breakpoint
CREATE INDEX `content_locale_kind_published` ON `content_posts` (`locale`,`status`,`kind`,`published_at`,`id`);--> statement-breakpoint
CREATE INDEX `content_translations` ON `content_posts` (`translation_key`,`status`);--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`userId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`idToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`password` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`userId`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expiresAt` integer NOT NULL,
	`token` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`userId` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`userId`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`emailVerified` integer NOT NULL,
	`image` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);