# Content platform implementation choices

The implementation follows the approved plan. These choices fill in details the plan did not prescribe.

## Sound

### Use a separate read-only credential for deploy preflight

- **When:** Tasks 10–11.
- **Scenario:** CI checks whether a candidate Markdown translation key already belongs to any D1 record, including a draft. The check needs access to conflict metadata, not permission to publish, edit, or delete articles.
- **Plan gap:** It requested a read-only preflight token but left its relationship to the existing CRUD token open.
- **Decision:** Accept either an admin session/CRUD token or an independent `CONTENT_CHECK_TOKEN` for the preflight route; the dedicated credential only authenticates the read-only endpoint and is stored server-side as a digest.
- **Reach:** CI can run the preflight without holding a credential capable of modifying content.
- **Verdict / confidence:** sound / high.

### Initial merged-sitemap design (superseded)

- **When:** Task 10.
- **Scenario:** A sitemap page must include published Markdown and D1 URLs, but not drafts, and must stay bounded as the D1 table grows.
- **Plan gap:** It specified keyset iteration and a combined sitemap but not whether to duplicate the source merge in SEO code.
- **Decision:** Reuse the locale-scoped catalog and its cursor; emit one locale/page sitemap at a time.
- **Reach:** Sitemap ordering and visibility follow the same public catalog rules as the site.
- **Status:** Superseded by source-partitioned sitemap pages after the D1 query-budget review below.

### Render event metadata in the content UI

- **When:** Task 10 follow-up.
- **Scenario:** An event is stored with start/end dates and a location; showing only its title and body would hide structured details already used by event JSON-LD.
- **Plan gap:** The plan required event content and structured metadata but did not explicitly require visible event fields in the list/detail views.
- **Decision:** Show localized start/end labels, locale-formatted dates, and location when present.
- **Reach:** Event details stay aligned between the D1 and Markdown summary models; future event fields should be explicitly added to the same shared projection.
- **Verdict / confidence:** sound / medium.

## Verification boundary

Playwright E2E ran successfully against the installed system Chrome in desktop and mobile projects. The plan's local browser-install command (`bunx playwright install --with-deps chromium`) was not run because that would install/download outside the worktree; CI contains and runs that exact command. This is a documented verification substitution, not a claim that the install command passed locally.

## Quality gate

### Use one formatter/linter and the installed TypeScript legibility checker

- **When:** After Review Army.
- **Scenario:** Contributors need one local gate for formatting, linting, typecheck, and the project's TypeScript legibility standard, without adding separate formatter and ESLint toolchains.
- **Plan gap:** The plan required code-quality checks but did not choose the toolchain or specify how to invoke the global legibility skill.
- **Decision:** Use Biome for formatting and linting, TypeScript/Void for type checks, and call the installed `write-legible-code` checker from `scripts/ship-gate.sh`. CI uses Biome and TypeScript checks; the skill-specific checker remains a local gate with an overrideable path because the skill is not a repository dependency.
- **Reach:** Formatting/lint rules are reproducible in CI; local ship-gate also enforces the broader TypeScript legibility rules.
- **Verdict / confidence:** sound / medium.

### Backfill legacy posts without removing their source table

- **When:** Post-review P1 remediation; the developer accepted the recommendation to backfill.
- **Scenario:** Existing rows have only `title`, `body`, and `created_at`; the new localized catalog requires locale, slug, translation key, kind, description, status, and an ISO timestamp.
- **Decision:** A data-preserving forward migration copies each row to a Vietnamese article with deterministic `legacy-post-<id>` key/slug and normalized creation time. Only nonblank title/body and strict, calendar-valid, non-future dates are published; malformed, untouched version-1 imports become drafts with fallback metadata, while versioned operator edits are preserved and the original `posts` row remains unchanged.
- **Reach:** Existing valid posts appear in the new `/vi/` catalog, while the source table remains available for recovery and audit.
- **Verdict / confidence:** sound / high.

### Send preflight keys as one bounded JSON parameter

- **When:** Post-review D1 binding-limit remediation.
- **Scenario:** A `translation_key IN (?, ?, …)` query needs one bound variable per candidate and exceeds D1's 100-variable limit.
- **Decision:** Bind each bounded key batch as JSON and query it with SQLite `json_each`; internal SQL batches hold 500 keys, deployed manifests cap at 10,000 keys, and HTTP candidate batches cap at 100 metadata entries to stay within the byte limit.
- **Reach:** One D1 query handles each 500-key batch; a full 10,000-key manifest stays below the invocation query budget, while external requests stay below 1 MiB.
- **Verdict / confidence:** sound / medium.

### Partition sitemap pages by source

- **When:** Post-review sitemap query-budget remediation.
- **Scenario:** A merged sitemap part required replaying every catalog page before its offset, so later parts could exceed D1's per-invocation query limit.
- **Decision:** Publish separate locale/source sitemap parts for Markdown and D1. Each D1 part uses one indexed locale/status ordering query with a bounded `LIMIT` and direct `OFFSET`.
- **Reach:** Query count per D1 sitemap part is constant; indexed offset scan cost still grows with page number, so materialized cursor bookmarks may be a follow-up if sitemap corpora become very large.
- **Verdict / confidence:** sound / medium.

### Page admin lists by update time

- **When:** Post-review admin pagination remediation.
- **Scenario:** Admins must enumerate drafts and published rows beyond the public page limit of 100, including drafts without a publication timestamp.
- **Plan gap:** The plan required bounded admin listing but did not define a cursor for unpublished records.
- **Decision:** Admin pages sort by `(updatedAt DESC, id DESC)` and encode those fields with the locale/kind filter; public cursors remain bound to `(publishedAt, key)`.
- **Reach:** Admin pagination can include drafts and stays stable across ties; edits between requests are not snapshot-isolated.
- **Verdict / confidence:** sound / high.

### Preserve all legacy rows while backfilling only valid body metadata

- **When:** Post-review migration remediation.
- **Scenario:** A legacy row with an empty or oversized body cannot be inserted as published under the new body contract without failing the whole migration.
- **Plan gap:** The original plan required retaining legacy rows but did not specify conversion behavior for malformed legacy records.
- **Decision:** Copy every row to a deterministic Vietnamese D1 article. Rows with valid title/body and a strict, calendar-valid, non-future source timestamp become published; invalid rows become drafts with a nonblank review placeholder. Keep the original title/body row unchanged in `posts`.
- **Reach:** Valid legacy content appears in the new site; malformed records remain recoverable from `posts` and are not silently discarded. The existing `GET /api/posts` starter contract intentionally changes to the approved paginated catalog response.
- **Verdict / confidence:** sound / medium.

### Refuse unsafe legacy table rebuilds before destructive statements

- **When:** Final migration-safety remediation.
- **Scenario:** A database created under the earlier content schema may legally contain a blank body or mixed-kind translation group. Copying those rows into the stricter rebuilt table can fail or preserve invalid lineage; a legacy backfill key may also overlap a row already created in D1.
- **Plan gap:** The approved backfill decision did not specify how to handle intermediate schema states or namespace collisions.
- **Decision:** Keep applied migration `20261020104231_stiff_nighthawk` unchanged. A forward migration (`20261020122833_true_korath`) repairs legacy rows created under its permissive timestamp/body checks, then runs a precondition before rebuilding. It fails closed for remaining blank metadata/body or mixed-kind groups. Execute statements and migration-history insertion in one SQLite transaction in the test fixture, so failure rolls back and a repaired database can retry.
- **Reach:** Operators must resolve database conflicts before retrying migration; the migration never silently drops or overwrites those rows. Malformed legacy dates remain drafts, not published records.
- **Verdict / confidence:** sound / high.

### Count text limits in Unicode code points

- **When:** Final D1/application contract review.
- **Scenario:** A title containing 200 emoji has 200 Unicode code points but 400 UTF-16 code units; SQLite `length(TEXT)` reports 200 while JavaScript `.length` reports 400.
- **Plan gap:** Text limits were specified numerically but the unit was not defined across TypeScript and SQLite.
- **Decision:** Count title, description, and location limits in Unicode code points so Effect validation and D1 `length(TEXT)` agree; keep the body limit byte-based.
- **Reach:** API and direct D1 writes enforce the same maximum text lengths. User-facing grapheme clusters containing combining marks may contain more than one code point.
- **Verdict / confidence:** sound / medium.

### Use a bounded wire-body allowance

- **When:** Post-review API limit remediation.
- **Scenario:** A schema-valid 200 KiB body can expand above 1 MiB when JSON escapes control characters.
- **Plan gap:** The plan capped body bytes but did not account for JSON wire encoding.
- **Decision:** Set the JSON request ceiling to 1.25 MiB, above the worst-case escaped body plus metadata envelope; batch candidate metadata to 100 entries.
- **Reach:** Valid body acceptance no longer depends on JSON escaping; endpoint still bounds allocation.
- **Verdict / confidence:** sound / high.

### Keep translation-group invariants in SQLite

- **When:** Post-review integrity remediation.
- **Scenario:** Two locale rows for one `translationKey` must not diverge in `kind`, including when concurrent writes race.
- **Plan gap:** The plan required a shared kind per group but did not define a database-level cross-row constraint.
- **Decision:** Add insert/update triggers that reject mixed kinds, plus a database check for whitespace-only bodies. Void generated a table rebuild to add the check; the migration explicitly allows that rebuild and tests preserve pre-existing rows.
- **Reach:** Direct D1 writes and API writes share the same group invariant; the `posts` legacy source table is copied, not dropped.
- **Verdict / confidence:** sound / high.

### Treat API paths as credential boundaries

- **When:** Post-review API transport remediation.
- **Scenario:** An exported client method can be given an absolute URL and would otherwise attach its configured bearer token to that destination.
- **Plan gap:** The plan prohibited token forwarding through redirects but did not define direct-request target validation.
- **Decision:** Resolve and validate same-origin `/api/` paths before constructing Authorization headers; reject other targets.
- **Reach:** Future CLI consumers cannot accidentally send a bearer token to a non-API or cross-origin destination.
- **Verdict / confidence:** sound / high.

### Terminate the local test process group with a deadline

- **When:** Post-review harness remediation.
- **Scenario:** Vite launches Worker/esbuild child processes; waiting only for the root PID can hang or leave children behind.
- **Plan gap:** The plan required process-tree cleanup but did not define platform behavior or a shutdown deadline.
- **Decision:** Start the Unix server in its own process group, send TERM then bounded KILL escalation, and use direct-child termination on Windows.
- **Reach:** Local test success and failure paths return without leaving the Vite process group running.
- **Verdict / confidence:** sound / medium.
