#!/usr/bin/env bash
# Builds the server image and runs the whole compose stack end to end under its own project
# (cod-verify, every *_HOST_PORT shifted by 10000), then tears it down. Never touches project `cod`.
#
#   scripts/verify-stack.sh                  migrate -> api + worker healthy, idempotent re-run,
#                                            /readyz 503 and back to 200 when postgres or valkey stops
#   scripts/verify-stack.sh --bad-password   a POSTGRES_PASSWORD that is not URL-safe stops at migrate,
#                                            names the variable and never prints the password
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=lib/wait-http.sh
. scripts/lib/wait-http.sh

mode=${1:-full}
case "$mode" in
  full | --bad-password) ;;
  *)
    echo "usage: $0 [--bad-password]" >&2
    exit 64
    ;;
esac

# .env (a copy of .env.example in CI) supplies credentials; everything below overrides it.
if [[ ! -f .env ]]; then
  echo "verify-stack: .env is missing; copy .env.example to .env first (cp .env.example .env)" >&2
  exit 1
fi
set -a
. ./.env
set +a
export COMPOSE_PROJECT_NAME=cod-verify
export POSTGRES_HOST_PORT=15433 PGBOUNCER_HOST_PORT=16432 VALKEY_HOST_PORT=16380 GARAGE_S3_HOST_PORT=13900
export MAILPIT_SMTP_HOST_PORT=11026 MAILPIT_UI_HOST_PORT=18026 API_HOST_PORT=13100 WORKER_HEALTH_HOST_PORT=13020
export APP_IMAGE=${APP_IMAGE:-cod-platform:local}
bad_password='p@ss/w:rd'
[[ "$mode" == --bad-password ]] && export POSTGRES_PASSWORD="$bad_password"

api_readyz="http://127.0.0.1:$API_HOST_PORT/readyz"
worker_readyz="http://127.0.0.1:$WORKER_HEALTH_HOST_PORT/readyz"

# Elapsed seconds per phase, so a slow CI run shows where the time went.
phase() { echo "verify-stack: $1 (${SECONDS}s)"; }

fail() {
  echo "VERIFY-STACK FAILED: $*" >&2
  exit 1
}

on_exit() {
  local status=$?
  if ((status != 0)); then
    docker compose ps -a >&2 || true
    docker compose logs --no-color --tail=80 migrate api worker >&2 || true
  fi
  docker compose down -v --remove-orphans >/dev/null 2>&1 || true
  exit "$status"
}
trap on_exit EXIT

container_of() { docker compose ps -aq "$1"; }
exit_code() { docker inspect -f '{{.State.ExitCode}}' "$(container_of "$1")"; }
started_at() { docker inspect -f '{{.State.StartedAt}}' "$(container_of "$1")"; }
restart_count() { docker inspect -f '{{.RestartCount}}' "$(container_of "$1")"; }

# wait_healthy <service...>: every service's healthcheck reports healthy within 180 s.
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

# The migrate.done line logged by the migrate container, optionally only after a timestamp.
migrate_done_line() {
  docker compose logs --no-log-prefix "$@" migrate | command grep '"event":"migrate.done"' | command tail -1 || true
}

# migrate, api and worker share APP_IMAGE: build it through one service so it is exported once,
# then `up` without --build finds it. The full run always rebuilds (it verifies the current tree);
# --bad-password reuses an existing image and builds only when there is none.
build_image() {
  docker compose build migrate
  phase "image built"
}

docker compose down -v --remove-orphans

if [[ "$mode" == --bad-password ]]; then
  docker image inspect "$APP_IMAGE" >/dev/null 2>&1 || build_image
  docker compose up -d || true # migrate fails, so up exits non-zero
  phase "stack up, migrate failed"
  [[ $(exit_code migrate) == 1 ]] || fail "migrate exited $(exit_code migrate), wanted 1"
  logs=$(docker compose logs --no-color migrate)
  command grep -q 'EnvValidationError' <<<"$logs" || fail "migrate did not log an EnvValidationError"
  command grep -q 'DATABASE_URL_DIRECT' <<<"$logs" || fail "migrate did not name DATABASE_URL_DIRECT"
  # Every fragment, so a password split by a URL parser (user:pass@host/db) cannot leak unnoticed.
  for fragment in "$bad_password" 'p@ss' 'w:rd'; do
    ! command grep -qF -- "$fragment" <<<"$logs" || fail "migrate printed the password (fragment '$fragment')"
  done
  [[ -z $(docker compose ps -q --status running api) ]] || fail "api is running although migrate failed"
  [[ -z $(docker compose ps -q --status running worker) ]] || fail "worker is running although migrate failed"
  echo "VERIFY-STACK-BAD-PASSWORD-OK"
  exit 0
fi

build_image
docker compose up -d
wait_healthy api worker
phase "api and worker healthy"
[[ $(exit_code migrate) == 0 ]] || fail "migrate exited $(exit_code migrate)"
first=$(migrate_done_line)
[[ -n "$first" ]] || fail "first migrate run logged no migrate.done line"
node -e 'const r=JSON.parse(process.argv[1]); process.exit(r.migrationsRun.length>0 && r.seed.changes.includes("global-settings:availableLanguages") ? 0 : 1)' "$first" ||
  fail "first migrate run did not migrate and seed: $first"
wait_http 200 "$api_readyz" 60 || fail "api /readyz"
wait_http 200 "$worker_readyz" 60 || fail "worker /readyz"
S3_ENDPOINT="http://127.0.0.1:$GARAGE_S3_HOST_PORT" node scripts/check-object-storage.mjs || fail "object storage"

phase "first run checked"

# A second `up` starts the exited migrate container again; it must find nothing to do.
first_start=$(started_at migrate)
sleep 1 # `logs --since` has one-second resolution
since=$(date -u +%FT%TZ)
docker compose up -d
wait_healthy api worker
[[ $(started_at migrate) != "$first_start" ]] || fail "second up did not run migrate again"
[[ $(exit_code migrate) == 0 ]] || fail "second migrate run exited $(exit_code migrate)"
second=$(migrate_done_line --since "$since")
[[ -n "$second" ]] || fail "second migrate run logged no migrate.done line"
[[ $(node -e 'const r=JSON.parse(process.argv[1]); console.log(r.migrationsRun.length+r.seed.changes.length)' "$second") == 0 ]] ||
  fail "second migrate run was not a no-op: $second"

phase "second run checked"

# Runtime loss of a dependency turns /readyz to 503 and recovers without a process restart.
for svc in postgres valkey; do
  docker compose stop "$svc"
  wait_http 503 "$api_readyz" 15 || fail "api /readyz with $svc stopped"
  wait_http 503 "$worker_readyz" 15 || fail "worker /readyz with $svc stopped"
  docker compose start "$svc"
  wait_http 200 "$api_readyz" 60 || fail "api /readyz after $svc came back"
  wait_http 200 "$worker_readyz" 60 || fail "worker /readyz after $svc came back"
done
[[ $(restart_count api) == 0 ]] || fail "api restarted $(restart_count api) times"
[[ $(restart_count worker) == 0 ]] || fail "worker restarted $(restart_count worker) times"

phase "outage loop done"
docker compose config --format json | node scripts/check-compose-portability.mjs
echo "VERIFY-STACK-OK"
