#!/usr/bin/env bash
set -euo pipefail

base="${SHIP_GATE_BASE:-origin/main}"
checker="${WRITE_LEGIBLE_CODE_CHECKER:-${HOME}/.agents/skills/write-legible-code/scripts/check_legibility.py}"

if [[ ! -f "$checker" ]]; then
  printf 'TypeScript legibility checker not found: %s\n' "$checker" >&2
  printf 'Set WRITE_LEGIBLE_CODE_CHECKER to the installed checker path.\n' >&2
  exit 2
fi

bun run format:check
bun run lint
bun run typecheck
python3 "$checker" --lang typescript --diff "$base" --errors-only
