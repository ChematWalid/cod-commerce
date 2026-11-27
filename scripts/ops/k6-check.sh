#!/usr/bin/env bash
# Runs the k6 scripts and the warm-up against a local compose stack of its own (project cod-k6check, host ports
# +40000) and keeps their summaries in docs/evidence/P3.S5a/k6/: warm-up, smoke, a 60 s constant load and the
# flash sale (PENDING until P3.S4 serves the intake route). Reuses the role image of scripts/ops/image-check.sh.
#
#   flock -w 3600 /tmp/cod-heavy-jobs.lock timeout 2400 bash scripts/ops/k6-check.sh
#   IMAGE=<ref> RATE=20 DURATION=60s ... to change the image or the load
#
# Data is synthetic (the demo seed); no value of .env is ever printed. Never add `set -x`.
set -euo pipefail
cd "$(dirname "$0")/../.."
# shellcheck source=scripts/lib/wait-http.sh
. scripts/lib/wait-http.sh

[[ -f .env ]] || { echo "k6-check: .env is missing; cp .env.example .env" >&2; exit 1; }
set -a
# shellcheck disable=SC1091 # the local, git-ignored .env
. ./.env
set +a

IMAGE=${IMAGE:-cod-platform:image-check}
RATE=${RATE:-20}
DURATION=${DURATION:-60s}
export COMPOSE_PROJECT_NAME=cod-k6check APP_IMAGE=$IMAGE
export INTERNAL_HMAC_KEYS=${INTERNAL_HMAC_KEYS:-k1:evidence-internal-hmac-key-synthetic-0000000001} INTERNAL_HMAC_ACTIVE_KID=${INTERNAL_HMAC_ACTIVE_KID:-k1}
export TENANT_SECRET_KEKS=${TENANT_SECRET_KEKS:-k1:3a5c7e9f1b2d4f60718293a4b5c6d7e8f9a0b1c2d3e4f5061728394a5b6c7d8e} TENANT_SECRET_ACTIVE_KID=${TENANT_SECRET_ACTIVE_KID:-k1}
# The .env.example placeholders (accepted in development, refused when deployed): never a minted key or password.
: "${QUOTE_HMAC_KEYS:=k1:change-me-quote-hmac-00000000000000000000000000}"
: "${QUOTE_HMAC_ACTIVE_KID:=k1}"
: "${DEMO_OWNER_PASSWORD:=change-me-demo-owner}"
export QUOTE_HMAC_KEYS QUOTE_HMAC_ACTIVE_KID DEMO_OWNER_PASSWORD
export AUTH_TOKEN_SECRET=${AUTH_TOKEN_SECRET:-evidence-auth-token-secret-synthetic-0123456789}
export POSTGRES_HOST_PORT=45433 PGBOUNCER_HOST_PORT=46432 VALKEY_HOST_PORT=46380 GARAGE_S3_HOST_PORT=43900
export MAILPIT_SMTP_HOST_PORT=41026 MAILPIT_UI_HOST_PORT=48026 API_HOST_PORT=43100 WORKER_HEALTH_HOST_PORT=43020
export STOREFRONT_HOST_PORT=43001 PLATFORM_DOMAIN=localhost
export SMTP_HOST=mailpit SMTP_PORT=1025 SMTP_FROM=no-reply@localhost SMTP_TLS=none SMTP_USERNAME='' SMTP_PASSWORD=''
# Teardown removes this project's volumes: refuse to run under any other project name.
[[ "$COMPOSE_PROJECT_NAME" == cod-k6check ]] || { echo "k6-check: wrong compose project" >&2; exit 1; }

readonly STORES="demo.localhost second.localhost"
readonly ORIGIN="http://127.0.0.1:$STOREFRONT_HOST_PORT"
out=docs/evidence/P3.S5a/k6

fail() {
  echo "K6-CHECK FAILED: $*" >&2
  exit 1
}
on_exit() {
  local status=$?
  if ((status != 0)); then
    docker compose logs --no-color --tail=60 migrate api worker storefront >&2 || true
  fi
  docker compose down -v --remove-orphans >/dev/null 2>&1 || true
  exit "$status"
}
trap on_exit EXIT

container_of() { docker compose ps -aq "$1"; }

wait_healthy() {
  local deadline=$((SECONDS + 240)) svc pending
  while ((SECONDS < deadline)); do
    pending=""
    for svc in "$@"; do
      [[ $(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$(container_of "$svc")" 2>/dev/null) == healthy ]] ||
        pending+=" $svc"
    done
    [[ -z "$pending" ]] && return 0
    sleep 2
  done
  fail "not healthy after 240 s:$pending"
}

start_stack() {
  docker image inspect "$IMAGE" >/dev/null 2>&1 || fail "no image $IMAGE; build it with scripts/ops/image-check.sh"
  docker compose down -v --remove-orphans >/dev/null 2>&1 || true
  docker compose up -d
  wait_healthy api worker storefront
  # The image's entry point runs a role, so the seed replaces it. DEMO_OWNER_PASSWORD comes from .env.
  docker compose run --rm --no-deps -T -e ROLE=migrate -e DEMO_OWNER_PASSWORD --entrypoint node migrate \
    --enable-source-maps apps/server/dist/main-seed-demo.js >/dev/null || fail "demo seed"
  wait_http 200 "$ORIGIN/readyz" 60 || fail "storefront /readyz"
}

# k6 <script> [-e NAME=value...]: runs one script from the pinned image on the host network.
k6() {
  local script=$1
  shift
  TOOL_NETWORK=host scripts/ops/tool.sh k6 run --quiet -e ORIGIN="$ORIGIN" -e STORE_HOST=demo.localhost \
    -e SUMMARY_DIR="$out" "$@" "ops/k6/$script"
}

mkdir -p "$out"
start_stack
{
  echo "# Warm-up (scripts/ops/warm-up.sh, $(date -u +%Y-%m-%dT%H:%MZ), commit $(git rev-parse --short HEAD))"
  echo
  echo '```text'
  WARMUP_ORIGIN="$ORIGIN" WARMUP_HOSTS="$STORES" WARMUP_TOP_N=5 scripts/ops/warm-up.sh 2>&1 || echo "WARM-UP FAILED"
  echo '```'
} >"$out/warm-up.md"
! command grep -q 'WARM-UP FAILED' "$out/warm-up.md" || fail "warm-up (see $out/warm-up.md)"
k6 smoke.js || fail "k6 smoke"
k6 constant-load.js -e RATE="$RATE" -e DURATION="$DURATION" || fail "k6 constant load"
k6 flash-sale.js -e SYNTHETIC_STORE=1 || fail "k6 flash sale"
echo "K6-CHECK-OK ($out)"
