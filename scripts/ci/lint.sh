#!/usr/bin/env bash
# Lints the repo one workspace at a time (issue #255): a single `eslint .` holds the type information of every
# tsconfig at once and ran out of heap on GitHub runners. Each workspace under apps/, packages/ and plugins/ is
# its own chunk, then a last chunk lints `.` minus those workspaces, so the chunks together cover exactly `.`
# with the same config, ignores and flags. Every chunk runs even after a failure; the exit code reports any.
set -uo pipefail

cd "$(dirname "$0")/../.."

ESLINT=(eslint --max-warnings=0 --cache)
WORKSPACE_ROOTS=(apps packages plugins)

failed=()

lint_chunk() {
  local name=$1
  shift
  echo "eslint: ${name}"
  if ! "${ESLINT[@]}" --cache-location ".eslintcache-${name//\//-}" "$@"; then
    failed+=("$name")
  fi
}

rest_ignores=()
for root in "${WORKSPACE_ROOTS[@]}"; do
  for workspace in "$root"/*/; do
    lint_chunk "${workspace%/}" "${workspace%/}"
  done
  rest_ignores+=(--ignore-pattern "${root}/*/**")
done
lint_chunk rest . "${rest_ignores[@]}"

if [[ ${#failed[@]} -gt 0 ]]; then
  echo "eslint failed in: ${failed[*]}" >&2
  exit 1
fi
