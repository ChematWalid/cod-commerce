#!/usr/bin/env bash
# P1 closing evidence (CLAUDE.md §3a.14): a store owner sees only their own business. Runs the real compose stack under
# its own project (cod-evidence, host ports +20000), seeds two businesses with a row in every P1 tenant table, runs the
# isolation matrix (apps/server/tests/isolation: the same cases the CI e2e test asserts) and writes its live transcripts,
# the entity × endpoint matrix and owner A's screens; tears everything down on exit. Never touches `cod` or `cod-verify`.
#
#   flock -w 3600 /tmp/cod-heavy-jobs.lock timeout 2400 scripts/evidence/P1-isolation.sh   # builds cod-platform:local
#   (EV_SKIP_BUILD=1 reuses a cod-platform:local built from this tree, e.g. by a separate locked build)
#
# Data is synthetic. Ids and store tokens are placeholders in the transcripts; sessions are named, never shown; the
# demo signing secrets are redacted. EV_WITH_TEAM=0 leaves out the team page (P1.S4).
set -euo pipefail
cd "$(dirname "$0")/../.."
# shellcheck source=../lib/wait-http.sh
. scripts/lib/wait-http.sh

[[ -f .env ]] || { echo "evidence: .env is missing; cp .env.example .env" >&2; exit 1; }
set -a
. ./.env
set +a
export COMPOSE_PROJECT_NAME=cod-evidence
export POSTGRES_HOST_PORT=25433 PGBOUNCER_HOST_PORT=26432 VALKEY_HOST_PORT=26380 GARAGE_S3_HOST_PORT=23900
export MAILPIT_SMTP_HOST_PORT=21026 MAILPIT_UI_HOST_PORT=28026 API_HOST_PORT=23100 WORKER_HEALTH_HOST_PORT=23020
export STOREFRONT_HOST_PORT=23001 PLATFORM_DOMAIN=localhost
export APP_IMAGE=${APP_IMAGE:-cod-platform:local}
export AUTH_TOKEN_SECRET=${AUTH_TOKEN_SECRET:-evidence-auth-token-secret-synthetic-0123456789}
export SMTP_HOST=mailpit SMTP_PORT=1025 SMTP_FROM=no-reply@localhost AUTH_DASHBOARD_URL=http://127.0.0.1:$API_HOST_PORT/dashboard
# Set, not unset: compose would otherwise read a Gmail block from a local .env and require TLS from Mailpit (D96).
export SMTP_TLS=none SMTP_USERNAME='' SMTP_PASSWORD=''
export INTERNAL_HMAC_KEYS=${EV_INTERNAL_HMAC_KEYS:-k1:evidence-internal-hmac-key-synthetic-0000000001}
export INTERNAL_HMAC_ACTIVE_KID=k1
export TENANT_SECRET_KEKS=${EV_TENANT_SECRET_KEKS:-k1:3a5c7e9f1b2d4f60718293a4b5c6d7e8f9a0b1c2d3e4f5061728394a5b6c7d8e}
export TENANT_SECRET_ACTIVE_KID=k1
# The demo handler registers the one secret provider and the demo webhook the world seeds its inbound rows with.
export PLATFORM_DEMO_HANDLERS=true
# The team screen (P1.S4).
export EV_WITH_TEAM=${EV_WITH_TEAM:-1}

out=docs/evidence/P1-isolation
api="http://127.0.0.1:$API_HOST_PORT"
work=$(mktemp -d)

fail() { echo "EVIDENCE FAILED: $*" >&2; exit 1; }
on_exit() {
  local status=$?
  if ((status != 0)); then
    docker compose ps -a >&2 || true
    docker compose logs --no-color --tail=40 migrate api worker >&2 || true
  fi
  timeout 300 docker compose down -v --remove-orphans >/dev/null 2>&1 || timeout 300 docker compose down -v --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$work"
  exit "$status"
}
trap on_exit EXIT

container_of() { docker compose ps -aq "$1"; }
wait_healthy() {
  local deadline=$((SECONDS + 420)) svc pending
  while ((SECONDS < deadline)); do
    pending=""
    for svc in "$@"; do
      [[ $(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$(container_of "$svc")" 2>/dev/null) == healthy ]] || pending+=" $svc"
    done
    [[ -z "$pending" ]] && return 0
    sleep 3
  done
  fail "not healthy after 420s:$pending"
}

[[ -n "${SUPERADMIN_USERNAME:-}" && -n "${SUPERADMIN_PASSWORD:-}" ]] || fail "SUPERADMIN_USERNAME or SUPERADMIN_PASSWORD is empty"

# --- image, from a tree that matches the commit the README names ---------------------------
image_inputs=(. ':!docs/evidence' ':!scripts/evidence' ':!.superpowers' ':!apps/server/tests' ':!.github/workflows/browser.yml')
dirty=$(git status --porcelain -- "${image_inputs[@]}")
[[ -z "$dirty" ]] || fail "uncommitted changes outside the evidence and test folders:
$dirty"
image_commit=$(git log -1 --format=%H -- "${image_inputs[@]}")
NEXT_DEPLOYMENT_ID="$(git rev-parse --short "$image_commit")"
export NEXT_DEPLOYMENT_ID
timeout 300 docker compose down -v --remove-orphans
# EV_SKIP_BUILD=1 reuses an image already built from this tree: on a loaded host the layer export alone can outlast the
# job's time limit. It is honoured only while the tagged image exists.
if [[ "${EV_SKIP_BUILD:-0}" == 1 ]] && docker image inspect "$APP_IMAGE" >/dev/null 2>&1; then
  echo "reusing $APP_IMAGE (EV_SKIP_BUILD=1)"
else
  timeout 1500 docker compose build migrate
fi
APP_SERVICES=(api worker mailpit)
timeout 300 docker compose up -d postgres
wait_healthy postgres
if ! timeout 480 docker compose up -d "${APP_SERVICES[@]}"; then
  timeout 300 docker compose rm -fsv "${APP_SERVICES[@]}" migrate pgbouncer
  timeout 480 docker compose up -d "${APP_SERVICES[@]}"
fi
wait_healthy api worker
wait_http 200 "$api/readyz" 120 || fail "api /readyz"
wait_http 200 "$api/dashboard/" 60 || fail "api /dashboard/"

rm -rf "$out/api" "$out/screens"
mkdir -p "$out/api" "$out/screens"

# --- the matrix: seed A and B, attack, transcripts --------------------------------------------
(cd apps/server && timeout 900 pnpm exec node --conditions=@cod/source -r ts-node/register/transpile-only \
  ../../scripts/evidence/P1-isolation-run.ts "$api" "../../$out" "$work") | command tee "$work/run.log" \
  || fail "the isolation matrix failed: $(command grep -E '^(FAIL|EMPTY)' "$work/run.log" | command head -20)"
command grep -q '^runs=[0-9]* failed=0 unchanged=true$' "$work/run.log" || fail "the matrix did not pass: $(command cat "$work/run.log")"

# --- owner A's screens -------------------------------------------------------------------------
timeout 900 node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/evidence/P1-isolation-screens.mjs \
  "$api/dashboard" "$out/screens" "$work/world.json" 2> >(command tee "$work/screens.log" >&2)
shot_count=$(command ls "$out"/screens/*.png | command wc -l)
wanted_shots=$((EV_WITH_TEAM == 1 ? 28 : 24))
((shot_count >= wanted_shots)) || fail "$shot_count screenshots, wanted at least $wanted_shots"

# --- README --------------------------------------------------------------------------------------
summary=$(command head -1 "$work/run.log")
{
  printf '# P1 isolation: a store owner sees only their own business\n\n'
  printf 'Live evidence from `scripts/evidence/P1-isolation.sh` on image commit `%s`. Data is synthetic.\n\n' "$NEXT_DEPLOYMENT_ID"
  printf 'Two businesses, A and B, each get two stores, an owner, a store-limited member, a custom role, a tenant secret, a\n'
  printf 'template note, a logo, a flag override, two signed demo webhooks, and team rows (a pending invitation, a\n'
  printf 'commission config and the owner'"'"'s member row). Then A'"'"'s owner (and B'"'"'s, for the cases marked\n'
  printf 'B→A) reaches for the other'"'"'s data through every merchant endpoint: by id, by list, by write, and with the other'"'"'s\n'
  printf 'store token. Each answer is judged (null, FORBIDDEN, a not-found code, or the caller'"'"'s own data only) and scanned for\n'
  printf 'every value that identifies the other business. Result: `%s`.\n\n' "$summary"
  printf 'The same cases run in CI as `apps/server/tests/e2e/p1-isolation.e2e.test.ts`.\n\n'
  printf '## Matrix (entity × how the attacker reaches)\n\n'
  command cat "$out/matrix.md"
  printf '\n## Every business had something to take\n\nRows per business in each P1 tenant table, counted after seeding:\n\n'
  command cat "$out/census.md"
  printf '\nEach owner'"'"'s view of its own business (business, stores, roles, member access, secrets, notes, profile) was read\n'
  printf 'before and after the attacks and is unchanged (`unchanged=true` above).\n\n'
  printf '## Screens\n\n`screens/<page>-<lang>-<viewport>.png`: owner A'"'"'s home, store switcher (open), settings, roles,\n'
  printf 'activity log and team members, in Arabic RTL and English, desktop (1280 px) and mobile (390 px), and B'"'"'s store opened by direct URL\n'
  printf '(not found). The script fails if a screen shows any of B'"'"'s names, or if the switcher misses A'"'"'s stores.\n\n'
  for f in "$out"/screens/*.png; do printf -- '- [`%s`](screens/%s)\n' "$(basename "$f")" "$(basename "$f")"; done
} >"$out/README.md"
rm -f "$out/matrix.md" "$out/census.md"
echo EVIDENCE-OK
