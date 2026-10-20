# Lãnh đạo Việt Nam

A multilingual publishing site built on Void Pages, Cloudflare Workers, and D1. Effect v4 is the business-logic core; Void remains the runtime and routing/database adapter. Public content is authored as Markdown by default, with an authenticated API/CLI for dynamic D1 content.

## Local development

```sh
bun install --frozen-lockfile
bun run typecheck
bunx void db migrate
bun run dev
```

The supported UI locales are `vi`, `en`, and `zh-CN`. Markdown lives under `pages/<locale>/library/`; D1-backed articles, news, and events use `/<locale>/posts/<slug>`.

## Quality gates

```sh
bun run check
bunx playwright install --with-deps chromium
bun run test:e2e
```

`bun run check` runs catalog/content validation, type/unit/API/CLI tests, and the production build. Browser E2E is separate because it requires Chromium.

## Content workflows

- [Markdown authoring](docs/content-authoring.md)
- [Operations, auth, secrets, and deployment](docs/operations.md)
- Local CLI entry point: `bun run content --help`

Never commit OAuth credentials, API tokens, or token hashes. Production deployment is gated by CI and an authenticated, read-only content conflict check.
