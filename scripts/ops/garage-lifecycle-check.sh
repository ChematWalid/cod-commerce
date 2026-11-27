#!/usr/bin/env bash
# Runs scripts/ops/garage-lifecycle.sh against a throwaway Garage (compose project cod-lifecyclecheck, its own volumes
# and port 43901) and writes the rules Garage stored to docs/evidence/P3.S5a/garage-lifecycle.md.
#
#   bash scripts/ops/garage-lifecycle-check.sh
#
# Uses the local .env's synthetic Garage values; prints none of them. Never add `set -x`.
set -euo pipefail
cd "$(dirname "$0")/../.."
# shellcheck source=scripts/lib/wait-http.sh
. scripts/lib/wait-http.sh

[[ -f .env ]] || { echo "garage-lifecycle-check: .env is missing; cp .env.example .env" >&2; exit 1; }
set -a
# shellcheck disable=SC1091 # the local, git-ignored .env
. ./.env
set +a

export COMPOSE_PROJECT_NAME=cod-lifecyclecheck COMPOSE_FILE=docker-compose.yml COMPOSE_PROFILES='' GARAGE_S3_HOST_PORT=43901
[[ "$COMPOSE_PROJECT_NAME" == cod-lifecyclecheck ]] || { echo "garage-lifecycle-check: wrong compose project" >&2; exit 1; }
trap 'docker compose down -v --remove-orphans >/dev/null 2>&1 || true' EXIT

docker compose up -d --wait garage
# The S3 API answers 403 to an unsigned request once the bucket exists.
wait_http 403 "http://127.0.0.1:$GARAGE_S3_HOST_PORT/$S3_BUCKET_PRIVATE" 60

out=docs/evidence/P3.S5a/garage-lifecycle.md
mkdir -p "$(dirname "$out")"
stored=$(S3_ENDPOINT="http://127.0.0.1:$GARAGE_S3_HOST_PORT" GARAGE_LIFECYCLE_PRINT=1 scripts/ops/garage-lifecycle.sh)
{
  echo "# Garage lifecycle rules (scripts/ops/garage-lifecycle-check.sh, $(date -u +%Y-%m-%dT%H:%MZ), commit $(git rev-parse --short HEAD))"
  echo
  echo "Throwaway Garage \`$(docker compose config --images 2>/dev/null | command grep garage)\`, private bucket \`$S3_BUCKET_PRIVATE\`."
  echo "\`GET /$S3_BUCKET_PRIVATE?lifecycle\` after the PUT:"
  echo
  echo '```text'
  echo "$stored" | head -n 1
  echo '```'
  echo
  echo '```xml'
  # One element per line, so the stored rules read and diff.
  echo "$stored" | tail -n +2 | command sed 's/></>\n</g'
  echo '```'
} >"$out"
echo "GARAGE-LIFECYCLE-CHECK-OK ($out)"
