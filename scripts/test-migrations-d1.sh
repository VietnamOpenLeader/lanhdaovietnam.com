#!/usr/bin/env bash
set -euo pipefail

readonly wrangler_version="4.151.0"
scratch_dir="$(mktemp -d -t content-migrations-d1)"
readonly scratch_dir

cleanup() {
  local scratch_name="${scratch_dir##*/}"
  case "$scratch_name" in
    content-migrations-d1.*)
      if [[ -d "$scratch_dir" ]]; then
        rm -r -- "$scratch_dir"
      fi
      ;;
    *)
      printf 'Refusing to remove unexpected path: %s\n' "$scratch_dir" >&2
      exit 1
      ;;
  esac
}

trap cleanup EXIT

write_config() {
  local project_dir="$1"
  local project_name="$2"
  local database_id="$3"

  cat >"$project_dir/wrangler.toml" <<EOF
name = "$project_name"
compatibility_date = "2026-02-24"

[[d1_databases]]
binding = "DB"
database_name = "$project_name"
database_id = "$database_id"
migrations_dir = "migrations"
EOF
}

run_wrangler() {
  CI=1 bunx "wrangler@$wrangler_version" "$@"
}

assert_output_contains() {
  local expected="$1"
  local output="$2"

  if ! grep -Fq "$expected" <<<"$output"; then
    printf 'Expected output to contain: %s\n%s\n' "$expected" "$output" >&2
    exit 1
  fi
}

prepare_projects() {
  mkdir -p \
    "$scratch_dir/fresh/migrations" \
    "$scratch_dir/fresh/persist" \
    "$scratch_dir/upgrade/migrations" \
    "$scratch_dir/upgrade/persist"
  write_config "$scratch_dir/fresh" "content-migration-fresh-check" \
    "00000000-0000-0000-0000-000000000001"
  write_config "$scratch_dir/upgrade" "content-migration-upgrade-check" \
    "00000000-0000-0000-0000-000000000002"
}

apply_fresh_migrations() {
  cp db/migrations/*.sql "$scratch_dir/fresh/migrations/"
  run_wrangler d1 migrations apply content-migration-fresh-check \
    --local \
    --config "$scratch_dir/fresh/wrangler.toml" \
    --persist-to "$scratch_dir/fresh/persist"
  local pending
  pending="$(run_wrangler d1 migrations list content-migration-fresh-check \
    --local \
    --config "$scratch_dir/fresh/wrangler.toml" \
    --persist-to "$scratch_dir/fresh/persist")"
  assert_output_contains "No migrations to apply" "$pending"
}

prepare_upgrade_through_schema() {
  cp db/migrations/20261019015751_vengeful_omega_red.sql \
    "$scratch_dir/upgrade/migrations/"
  cp db/migrations/20261020043417_spicy_leo.sql "$scratch_dir/upgrade/migrations/"
  run_wrangler d1 migrations apply content-migration-upgrade-check \
    --local \
    --config "$scratch_dir/upgrade/wrangler.toml" \
    --persist-to "$scratch_dir/upgrade/persist"
  run_wrangler d1 execute content-migration-upgrade-check \
    --local \
    --config "$scratch_dir/upgrade/wrangler.toml" \
    --persist-to "$scratch_dir/upgrade/persist" \
    --command "INSERT INTO posts (title, body, created_at) VALUES ('Operator original', char(32, 10, 9), 'not-a-date'), ('Malformed source date', '# Body', '2025-02-30 10:11:12')"
}

apply_original_backfill() {
  cp db/migrations/20261020104231_stiff_nighthawk.sql "$scratch_dir/upgrade/migrations/"
  run_wrangler d1 migrations apply content-migration-upgrade-check \
    --local \
    --config "$scratch_dir/upgrade/wrangler.toml" \
    --persist-to "$scratch_dir/upgrade/persist"
  run_wrangler d1 execute content-migration-upgrade-check \
    --local \
    --config "$scratch_dir/upgrade/wrangler.toml" \
    --persist-to "$scratch_dir/upgrade/persist" \
    --command "UPDATE content_posts SET title='Operator repair', description='Operator reviewed', body='# Operator repair', status='published', published_at='2026-10-19T10:11:12.000Z', updated_at='2026-10-20T10:11:12.000Z', version=2 WHERE id='legacy-post-1'; INSERT INTO content_posts (id, translation_key, locale, slug, kind, title, description, body, status, published_at, starts_at, ends_at, location, created_at, updated_at, version) VALUES ('guard-conflict', 'guard-conflict', 'vi', 'guard-conflict', 'article', 'Conflict', ' ', '# Body', 'draft', NULL, NULL, NULL, NULL, '2026-10-19T10:11:12.000Z', '2026-10-19T10:11:12.000Z', 1)"
}

assert_repair_failure_rolls_back() {
  cp db/migrations/20261020122833_true_korath.sql "$scratch_dir/upgrade/migrations/"
  local failure
  if failure="$(run_wrangler d1 migrations apply content-migration-upgrade-check \
    --local \
    --config "$scratch_dir/upgrade/wrangler.toml" \
    --persist-to "$scratch_dir/upgrade/persist" 2>&1)"; then
    printf 'Expected the D1 guard to reject blank metadata.\n' >&2
    exit 1
  fi
  assert_output_contains "CHECK constraint failed" "$failure"

  local rollback_check
  rollback_check="$(run_wrangler d1 execute content-migration-upgrade-check \
    --local \
    --config "$scratch_dir/upgrade/wrangler.toml" \
    --persist-to "$scratch_dir/upgrade/persist" \
    --command "SELECT CASE WHEN (SELECT version FROM content_posts WHERE id='legacy-post-1')=2 AND (SELECT body FROM content_posts WHERE id='legacy-post-1')='# Operator repair' AND (SELECT description FROM content_posts WHERE id='guard-conflict')=' ' AND (SELECT COUNT(*) FROM sqlite_master WHERE name LIKE '__ivt_migration_20261020122833_%')=0 THEN 'PASS' ELSE 'FAIL' END AS rollback_check")"
  assert_output_contains "PASS" "$rollback_check"

  local pending
  pending="$(run_wrangler d1 migrations list content-migration-upgrade-check \
    --local \
    --config "$scratch_dir/upgrade/wrangler.toml" \
    --persist-to "$scratch_dir/upgrade/persist")"
  assert_output_contains "20261020122833_true_korath.sql" "$pending"
}

repair_and_retry() {
  run_wrangler d1 execute content-migration-upgrade-check \
    --local \
    --config "$scratch_dir/upgrade/wrangler.toml" \
    --persist-to "$scratch_dir/upgrade/persist" \
    --command "UPDATE content_posts SET description='Fixed metadata' WHERE id='guard-conflict'"
  run_wrangler d1 migrations apply content-migration-upgrade-check \
    --local \
    --config "$scratch_dir/upgrade/wrangler.toml" \
    --persist-to "$scratch_dir/upgrade/persist"

  local result
  result="$(run_wrangler d1 execute content-migration-upgrade-check \
    --local \
    --config "$scratch_dir/upgrade/wrangler.toml" \
    --persist-to "$scratch_dir/upgrade/persist" \
    --command "SELECT CASE WHEN (SELECT body FROM content_posts WHERE id='legacy-post-1')='# Operator repair' AND (SELECT status FROM content_posts WHERE id='legacy-post-1')='published' AND (SELECT version FROM content_posts WHERE id='legacy-post-1')=2 AND (SELECT status FROM content_posts WHERE id='legacy-post-2')='draft' AND (SELECT published_at FROM content_posts WHERE id='legacy-post-2') IS NULL THEN 'PASS' ELSE 'FAIL' END AS upgrade_check")"
  assert_output_contains "PASS" "$result"

  local pending
  pending="$(run_wrangler d1 migrations list content-migration-upgrade-check \
    --local \
    --config "$scratch_dir/upgrade/wrangler.toml" \
    --persist-to "$scratch_dir/upgrade/persist")"
  assert_output_contains "No migrations to apply" "$pending"
}

main() {
  prepare_projects
  apply_fresh_migrations
  prepare_upgrade_through_schema
  apply_original_backfill
  assert_repair_failure_rolls_back
  repair_and_retry
  printf 'Wrangler local D1 migration checks passed (fresh install, failed upgrade rollback, repair and retry).\n'
}

main "$@"
