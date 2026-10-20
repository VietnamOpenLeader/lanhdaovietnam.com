# Content authoring

## Markdown is the source for editorial content

Store public, static content in `pages/<locale>/library/`. Supported locale folder names are `vi`, `en`, and `zh-CN`; `cn` is not an alias. Each language version has a locale-specific slug and shares a `translationKey`.

```markdown
---
translationKey: origins
locale: vi
slug: khoi-nguon
kind: article
title: Khởi nguồn
description: Một đoạn giới thiệu ngắn.
status: published
publishedAt: 2026-10-19T00:00:00.000Z
---

# Khởi nguồn

Nội dung Markdown.
```

`kind` is `article`, `news`, or `event`. Published Markdown in `pages/` must be complete and valid. Do not store drafts there: a file in the public Pages tree is directly reachable even if it is omitted from a list.

Published bodies cannot be blank, and `publishedAt` cannot be in the future. Events additionally require `startsAt` and `location`; `endsAt` is optional but cannot precede `startsAt`. Timestamps use UTC ISO format. Raw HTML is not enabled for D1 Markdown rendering.

Create one file for each available locale. Do not reuse a slug across locales by assumption; language switch links are built from published translation records. A translation group belongs to either Markdown or D1, never both. Run the content gate before a commit:

```sh
bun run content:check
bun run i18n:check
```

## D1-backed content

Use D1 for content that changes at runtime. The CLI calls the local or configured API; it never writes to a Worker filesystem.

The additive legacy migration keeps the original `posts` table unchanged and copies rows into Vietnamese article records using stable `legacy-post-<id>` slugs and translation keys. Rows with valid title/body metadata and a parseable, non-future `created_at` become published articles; records with invalid title/body/date metadata become drafts with a note to review the original row. Before rebuilding `content_posts`, the migration stops if existing records have blank bodies, mixed content kinds within a translation group, or a key/slug collision with a legacy row.

```sh
export CONTENT_API_URL=http://127.0.0.1:5173

bun run content list --locale vi
bun run content get CONTENT_ID
bun run content create --file article.json
bun run content update CONTENT_ID --file article.json --version 2
bun run content delete CONTENT_ID --version 3 --yes
bun run content check
bun run content check --api
```

Create/update JSON files use the same metadata fields as Markdown, plus `body` containing Markdown text. `update` also requires the current optimistic `--version`. Delete always requires explicit `--yes`.

`import PATH` parses Markdown frontmatter and body with the repository's safe YAML/Effect Schema parser, posts it to D1, and leaves the source file untouched. Importing from `pages/*/library/` is rejected. Importing an existing `(translationKey, locale)` is a conflict, not an overwrite.

Set `CONTENT_API_URL` and `CONTENT_API_TOKEN` in the shell, never on the command line. Remote URLs must use HTTPS; HTTP is allowed only for loopback development. API lists are published-only by default. `--admin` requires an admin session or the configured content API token.

## Translation ownership

`translationKey` links translations with matching meaning and kind. The source (`markdown` or `d1`) owns the entire group. Build/API checks reject duplicate locales within a group and groups split between sources. There is no automatic translation or Markdown↔D1 synchronization.

The Lingui UI catalogs are JSON and translated separately from article bodies. Run `bun run i18n:extract` after changing UI message descriptors, fill translations for all locales, then run `bun run i18n:check` and `bun run i18n:compile`.
