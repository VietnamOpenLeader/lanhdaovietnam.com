# Operations

## Runtime boundary

Void owns the Cloudflare Worker/Hono runtime, Pages/Islands, Auth, D1 bindings, and migrations. Effect v4 owns schemas, typed failures, business programs, and repositories. D1 access uses Void's Drizzle adapter. The login island uses the experimental `@xstate/effect` integration with an actor scoped to that mounted island.

## Local setup and migrations

```sh
bun install --frozen-lockfile
bun run typecheck
bunx void db status
bunx void db migrate
bun run dev
```

The content migration is additive and retains the legacy `posts` table. Do not use `void db reset`, `void db seed`, or `void db push` to update an existing database. Review generated SQL and run only local migrations during development. Production migrations are applied by the approved Void deployment workflow.

## Authentication and credentials

- Email/password is enabled by Void. GitHub, Google, and Twitter appear only when both provider credentials are configured. Configure each provider's callback URL for the exact environment origin and `/api/auth/callback/<provider>`.
- `ADMIN_USER_IDS` is a server-side allowlist of immutable auth user IDs. An empty list grants no web administrator. `/api/profile` returns the current user's own ID; an operator adds it to the allowlist out of band.
- The content CLI uses `CONTENT_API_TOKEN` as a bearer secret. The Worker stores only `CONTENT_API_TOKEN_SHA256`. The token format is 43–128 URL-safe characters.
- Deployment preflight uses a separate read-only `CONTENT_CHECK_TOKEN`, verified against `CONTENT_CHECK_TOKEN_SHA256`. It can inspect content conflict keys/counts but cannot read drafts or perform CRUD.
- Never put raw tokens, token hashes, OAuth client secrets, or test credentials in source control, command arguments, logs, or screenshots. Provide values through protected environment/secret managers.

To create a high-entropy token locally without saving it in a file:

```sh
export CONTENT_API_TOKEN="$(openssl rand -hex 32)"
printf '%s' "$CONTENT_API_TOKEN" | shasum -a 256
```

Store the raw CLI token in the operator's secret manager and configure only its SHA-256 digest on the Worker as `CONTENT_API_TOKEN_SHA256`. Repeat with an independent value for the read-only preflight token and `CONTENT_CHECK_TOKEN_SHA256`.

The email provider is local-first; no password reset/verification email workflow is enabled until delivery is configured. Live social OAuth callbacks and production authentication are not covered by local tests without operator credentials.

## Pre-deploy conflict check

`bun run content check --api` sends candidate Markdown metadata from the local Pages tree to `/api/content-check`. The route is read-only and checks bounded batches of translation keys against published D1 records. It does not send Markdown bodies or change either source.

The `void-deploy` GitHub workflow runs local gates, then this preflight, then deploy/migrations. Set GitHub variable `CONTENT_API_URL` and secret `CONTENT_CHECK_TOKEN`. Missing credentials, an unavailable endpoint, or a conflict stops the workflow; there is no silent bypass. The check is **not** a distributed lock: avoid concurrent content writes during a deployment preflight.

For the first deployment, `/api/content-check` does not exist until the Worker is bootstrapped. An operator must approve and perform that initial bootstrap separately; the automatic workflow intentionally cannot skip its preflight.

## CI and browser checks

Pull requests run:

```sh
bun install --frozen-lockfile
bun run check
bunx playwright install --with-deps chromium
bun run test:e2e
```

Tests use disposable local Void/D1 projects and synthetic tokens, not production OAuth or API credentials. `test:e2e` exercises Chromium desktop and mobile viewports; if Playwright's browser binary is not installed locally, install it with the command above.

## Rollback and data safety

Application rollback does not undo D1 writes or remove content created after deployment. Migrations are additive; schema rollback requires a reviewed forward migration. Never restore or reset a remote database without explicit operator approval and a recovery plan for writes made after the restore point.
