#!/usr/bin/env bash
# Proof-of-working evidence for P0.S2b-4 (CLAUDE.md §3a.14): runs the real compose stack under its own
# project (cod-evidence, every *_HOST_PORT shifted by 20000), screenshots the merchant dashboard login and
# shell pages in Arabic and English on desktop and mobile into docs/evidence/P0.S2b-4/, and tears the stack
# down. Never touches `cod` or `cod-verify`.
#
#   scripts/evidence/P0.S2b-4.sh   # always rebuilds cod-platform:local first (the layer cache keeps that cheap)
#
# The browser work is scripts/evidence/dashboard-screens.mjs. Data is synthetic (.env placeholders).
set -euo pipefail
cd "$(dirname "$0")/../.."
# shellcheck source=../lib/wait-http.sh
. scripts/lib/wait-http.sh

if [[ ! -f .env ]]; then
  echo "evidence: .env is missing; copy .env.example to .env first (cp .env.example .env)" >&2
  exit 1
fi
set -a
. ./.env
set +a
export COMPOSE_PROJECT_NAME=cod-evidence
export POSTGRES_HOST_PORT=25433 PGBOUNCER_HOST_PORT=26432 VALKEY_HOST_PORT=26380 GARAGE_S3_HOST_PORT=23900
export MAILPIT_SMTP_HOST_PORT=21026 MAILPIT_UI_HOST_PORT=28026 API_HOST_PORT=23100 WORKER_HEALTH_HOST_PORT=23020
export APP_IMAGE=${APP_IMAGE:-cod-platform:local}

out=docs/evidence/P0.S2b-4
api="http://127.0.0.1:$API_HOST_PORT"

fail() {
  echo "EVIDENCE FAILED: $*" >&2
  exit 1
}

on_exit() {
  local status=$?
  if ((status != 0)); then
    docker compose ps -a >&2 || true
    docker compose logs --no-color --tail=60 migrate api worker >&2 || true
  fi
  docker compose down -v --remove-orphans >/dev/null 2>&1 || true
  exit "$status"
}
trap on_exit EXIT

container_of() { docker compose ps -aq "$1"; }

wait_healthy() {
  local deadline=$((SECONDS + 180)) svc pending
  while ((SECONDS < deadline)); do
    pending=""
    for svc in "$@"; do
      [[ $(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$(container_of "$svc")" 2>/dev/null) == healthy ]] ||
        pending+=" $svc"
    done
    [[ -z "$pending" ]] && return 0
    sleep 2
  done
  fail "not healthy after 180s:$pending"
}

[[ -n "${SUPERADMIN_PASSWORD:-}" ]] || fail "SUPERADMIN_PASSWORD is empty; the redaction check would be vacuous"
[[ -n "${COOKIE_SECRET:-}" ]] || fail "COOKIE_SECRET is empty; the redaction check would be vacuous"

# The README states which commit the image was built from, so the image is always built here, from a tree
# that matches that commit everywhere except the evidence folders and the SDD notes (which the image does
# not need). The commit is the last one that touched anything else.
image_inputs=(. ':!docs/evidence' ':!scripts/evidence' ':!.superpowers')
dirty=$(git status --porcelain -- "${image_inputs[@]}")
[[ -z "$dirty" ]] || fail "uncommitted changes outside the evidence folders; commit or stash them first:
$dirty"
image_commit=$(git log -1 --format=%H -- "${image_inputs[@]}")
[[ -n "$image_commit" ]] || fail "no commit touches the image inputs; nothing to attribute the image to"
head_before=$(git rev-parse HEAD)

docker compose down -v --remove-orphans
docker compose build migrate

# The build takes minutes: the image must still match the commit the README names.
[[ "$(git rev-parse HEAD)" == "$head_before" ]] || fail "HEAD moved during the image build"
dirty=$(git status --porcelain -- "${image_inputs[@]}")
[[ -z "$dirty" ]] || fail "the tree changed during the image build:
$dirty"
docker compose up -d
wait_healthy api worker
wait_http 200 "$api/readyz" 60 || fail "api /readyz"
wait_http 200 "$api/dashboard/" 60 || fail "api /dashboard/"

started=$SECONDS
IMAGE_COMMIT=$image_commit \
  REGEN_COMMAND="scripts/evidence/P0.S2b-4.sh" \
  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/evidence/dashboard-screens.mjs "$api/dashboard" "$out/screens"
echo "screenshots taken in $((SECONDS - started))s"

# --- redaction check ---------------------------------------------------------------------
for secret in "$SUPERADMIN_PASSWORD" "$COOKIE_SECRET"; do
  if command grep -rqaF -- "$secret" "$out"; then
    fail "a raw secret appears in $out"
  fi
done
echo "redaction check: no password or cookie secret in $out"
echo "EVIDENCE-OK"
