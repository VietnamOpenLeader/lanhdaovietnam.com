# Content platform implementation choices

The implementation follows the approved plan. These choices fill in details the plan did not prescribe.

## Sound

### Use a separate read-only credential for deploy preflight

- **When:** Tasks 10–11.
- **Scenario:** CI checks whether a candidate Markdown translation key already belongs to published D1 content. The check needs access to conflict metadata, not permission to publish, edit, or delete articles.
- **Plan gap:** It requested a read-only preflight token but left its relationship to the existing CRUD token open.
- **Decision:** Accept either an admin session/CRUD token or an independent `CONTENT_CHECK_TOKEN` for the preflight route; the dedicated credential only authenticates the read-only endpoint and is stored server-side as a digest.
- **Reach:** CI can run the preflight without holding a credential capable of modifying content.
- **Verdict / confidence:** sound / high.

### Keep sitemap pagination on the merged public catalog

- **When:** Task 10.
- **Scenario:** A sitemap page must include published Markdown and D1 URLs, but not drafts, and must stay bounded as the D1 table grows.
- **Plan gap:** It specified keyset iteration and a combined sitemap but not whether to duplicate the source merge in SEO code.
- **Decision:** Reuse the locale-scoped catalog and its cursor; emit one locale/page sitemap at a time.
- **Reach:** Sitemap ordering and visibility follow the same public catalog rules as the site.
- **Verdict / confidence:** sound / high.

### Render event metadata in the content UI

- **When:** Task 10 follow-up.
- **Scenario:** An event is stored with start/end dates and a location; showing only its title and body would hide structured details already used by event JSON-LD.
- **Plan gap:** The plan required event content and structured metadata but did not explicitly require visible event fields in the list/detail views.
- **Decision:** Show localized start/end labels, locale-formatted dates, and location when present.
- **Reach:** Event details stay aligned between the D1 and Markdown summary models; future event fields should be explicitly added to the same shared projection.
- **Verdict / confidence:** sound / medium.

## Verification boundary

Playwright E2E ran successfully against the installed system Chrome in desktop and mobile projects. The plan's local browser-install command (`bunx playwright install --with-deps chromium`) was not run because that would install/download outside the worktree; CI contains and runs that exact command. This is a documented verification substitution, not a claim that the install command passed locally.
