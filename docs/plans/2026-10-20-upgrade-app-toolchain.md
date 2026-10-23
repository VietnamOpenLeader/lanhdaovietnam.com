# Upgrade app dependencies and Vite+ tooling implementation plan

> **For agentic workers:** Execute inline via `finishing-execution`, task by task.

**Goal:** Upgrade direct app dependencies to their latest stable releases, pin Bun 1.4.4, and replace Biome formatting/linting with the Vite+ local CLI without changing Void's runtime/build workflow.
**Architecture:** Keep Bun and `bun.lock` as the sole package manager and lockfile. Use project-local `vite-plus` for `vp fmt` and `vp lint`, configure it in the existing `vite.config.mts`, and retain Bun's built-in type checker and Void's existing build/test commands.
**Tech Stack:** Bun 1.4.4, Void, Vite 8, Vite+ 1.4.0, Oxfmt, Oxlint.

## Global Constraints

- Update direct dependencies to their npm `latest` stable dist-tags; resolve required breaking changes rather than keeping stale major versions.
- Do not add pnpm or a second lockfile.
- Preserve Void's plugins and its existing `dev`, `build`, deployment, and test workflows.
- Keep type checking on Bun's built-in checker; do not enable Vite+'s independent tsgolint type-check path.
- Keep generated data, migrations, and production credentials untouched.
- Push the completed, validated change to `origin/main`, as requested.

---

### Task 1: Upgrade direct dependencies and pin Bun

**Files:**

- Modify: `package.json` — dependency versions and `packageManager`.
- Modify: `bun.lock` — resolve the upgraded dependency graph.
- Modify: `.github/workflows/ci.yml` — Bun version used in CI.
- Modify: `.github/workflows/void-deploy.yml` — Bun version used before deployment.

**Interfaces:**

- Consumes: Existing Bun-only dependency graph and CI workflows.
- Produces: Latest-stable direct app dependencies, project Bun pin `bun@1.4.4`, and matching lockfile/CI installs.

- [x] **Step 1: Remove the old formatter dependency and add Vite+** — Remove the Biome dev dependency and add `vite-plus@1.4.0`.
- [x] **Step 2: Upgrade the remaining direct dependencies** — Run `bun update --latest`; review any pre-release-to-stable or major-version changes and adapt application code only where required by the resulting typecheck, test, and build failures.
- [x] **Step 3: Pin Bun consistently** — Set `packageManager` to `"bun@1.4.4"` in `package.json` and update both `oven-sh/setup-bun` version inputs to `1.4.4`.
- [x] **Step 4: Verify install reproducibility and version state** — Run `bun install --frozen-lockfile` and `bun outdated`. Expected: install exits 0 and no direct dependency is reported behind its `latest` version.

### Task 2: Replace Biome with Vite+ formatting and linting

**Files:**

- Modify: `vite.config.mts` — use Vite+'s `defineConfig` and add `fmt` and `lint` configuration while preserving the existing Void and Tailwind plugins.
- Modify: `package.json` — use `vp fmt`/`vp lint` scripts; retain direct Vite for Void's existing CLI commands.
- Modify: `bun.lock` — lock Vite+ and the updated direct Vite package.
- Modify: `README.md` — document Vite+ checks instead of Biome.
- Modify: `docs/operations.md` — document Vite+ checks instead of Biome.

**Interfaces:**

- Consumes: Vite+ 1.4.0 installed locally and the existing `vite.config.mts`.
- Produces: `bun run format`, `bun run format:check`, and `bun run lint` invoking Vite+; `bun run typecheck` continues to invoke `bun --check`.

- [x] **Step 1: Configure the local Vite+ toolchain** — Set Vite+'s `fmt` and `lint` blocks in `vite.config.mts`; retain the direct `vite` package because Void's current `dev` and `build` scripts invoke its CLI, and retain all existing plugin registrations.
- [x] **Step 2: Switch quality scripts** — Replace Biome commands with documented `vp fmt` and `vp lint` invocations. Keep the full `check` pipeline and Void Vite build/deploy entrypoints intact.
- [x] **Step 3: Reformat and update docs** — Run `bun run format` and update README and operations instructions so they no longer refer to Biome.
- [x] **Step 4: Run static checks and project gates** — Run `bun run check` and `bun run test:e2e`. Expected: every command exits 0.
- [x] **Step 5: Confirm the release state** — Run `git diff --check`, inspect the full diff, commit the validated upgrade, and push `main` to `origin`. Verify the remote `refs/heads/main` points to the pushed commit.
