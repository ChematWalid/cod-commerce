#!/usr/bin/env bash
# Point-in-time restore test (P3.S5a Task 7, ADR 0011's monthly restore drill, synthetic data only, D3507).
# On a compose stack of its own (project cod-restoretest, host ports +40000) with the pgBackRest overlay:
#   1. the role image's migrate builds the schema and the api answers /readyz;
#   2. stanza-create, check, full backup;
#   3. marker rows "before", the database clock read as T, marker rows "after", pg_switch_wal(), check;
#   4. restore to T into a fresh data volume: "before" rows present, "after" rows absent, api /readyz 200;
#   5. restore to the latest WAL into a fresh data volume: both present, api /readyz 200.
# The markers are written after the backup, so both restores replay archived WAL. Restored servers run with
# archiving off, so they never push a new timeline into the repository the next restore reads.
#
#   flock -w 3600 /tmp/cod-heavy-jobs.lock timeout 2400 bash scripts/ops/restore-test.sh
#   RESTORE_APP_IMAGE=<role image> (default cod-platform:image-check, built by scripts/ops/image-check.sh)
#
# Writes docs/evidence/P3.S5a/restore-test.md. No value of .env is ever printed. Never add `set -x`.
set -euo pipefail
cd "$(dirname "$0")/../.."
# shellcheck source=scripts/lib/wait-http.sh
. scripts/lib/wait-http.sh

[[ -f .env ]] || { echo "restore-test: .env is missing; cp .env.example .env" >&2; exit 1; }
set -a
# shellcheck disable=SC1091 # the local, git-ignored .env
. ./.env
set +a

IMAGE=${RESTORE_APP_IMAGE:-cod-platform:image-check}
export COMPOSE_PROJECT_NAME=cod-restoretest APP_IMAGE=$IMAGE
export COMPOSE_FILE=docker-compose.yml:deploy/postgres/compose.yml COMPOSE_PROFILES=''
export INTERNAL_HMAC_KEYS=${INTERNAL_HMAC_KEYS:-k1:evidence-internal-hmac-key-synthetic-0000000001} INTERNAL_HMAC_ACTIVE_KID=${INTERNAL_HMAC_ACTIVE_KID:-k1}
export TENANT_SECRET_KEKS=${TENANT_SECRET_KEKS:-k1:3a5c7e9f1b2d4f60718293a4b5c6d7e8f9a0b1c2d3e4f5061728394a5b6c7d8e} TENANT_SECRET_ACTIVE_KID=${TENANT_SECRET_ACTIVE_KID:-k1}
# The .env.example placeholder (accepted in development, refused when deployed): never a minted key.
: "${QUOTE_HMAC_KEYS:=k1:change-me-quote-hmac-00000000000000000000000000}"
: "${QUOTE_HMAC_ACTIVE_KID:=k1}"
export QUOTE_HMAC_KEYS QUOTE_HMAC_ACTIVE_KID
export AUTH_TOKEN_SECRET=${AUTH_TOKEN_SECRET:-evidence-auth-token-secret-synthetic-0123456789}
export POSTGRES_HOST_PORT=45433 PGBOUNCER_HOST_PORT=46432 VALKEY_HOST_PORT=46380 GARAGE_S3_HOST_PORT=43900
export MAILPIT_SMTP_HOST_PORT=41026 MAILPIT_UI_HOST_PORT=48026 API_HOST_PORT=43100 WORKER_HEALTH_HOST_PORT=43020
export STOREFRONT_HOST_PORT=43001 PLATFORM_DOMAIN=localhost
export SMTP_HOST=mailpit SMTP_PORT=1025 SMTP_FROM=no-reply@localhost SMTP_TLS=none SMTP_USERNAME='' SMTP_PASSWORD=''
# Teardown removes this project's volumes: refuse to run under any other project name.
[[ "$COMPOSE_PROJECT_NAME" == cod-restoretest ]] || { echo "restore-test: wrong compose project" >&2; exit 1; }

readonly BEFORE_ROWS=50 AFTER_ROWS=30 RECOVERY_TIMEOUT_S=180
readonly READYZ="http://127.0.0.1:$API_HOST_PORT/readyz"
out=docs/evidence/P3.S5a
report=$out/restore-test.md
mkdir -p "$out"

fail() {
  echo "RESTORE-TEST FAILED: $*" >&2
  exit 1
}
on_exit() {
  local status=$?
  if ((status != 0)); then
    docker compose logs --no-color --tail=60 postgres migrate api >&2 || true
  fi
  docker compose down -v --remove-orphans >/dev/null 2>&1 || true
  exit "$status"
}
trap on_exit EXIT

note() { printf '%s\n' "$*" >>"$report"; }
sql() { docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -Atc "$1"; }
pgbackrest() { docker compose exec -T -u postgres postgres pgbackrest --stanza=cod "$@"; }
# api_ready <label>: the api, on whatever database is current, answers /readyz 200; records the answer.
api_ready() {
  wait_http 200 "$READYZ" 120 || fail "api /readyz is not 200 $1"
  note "| api \`GET /readyz\` $1 | 200 \`$(curl -s --max-time 5 "$READYZ")\` |"
}

start_source() {
  docker compose down -v --remove-orphans >/dev/null 2>&1 || true
  docker image inspect "$IMAGE" >/dev/null 2>&1 || fail "no role image $IMAGE (run scripts/ops/image-check.sh first)"
  docker compose build postgres
  docker compose up -d api
  api_ready "on the source database"
  [[ "$(sql 'SHOW archive_mode')" == on ]] || fail "archive_mode is not on in the source database"
}

back_up() {
  local started=$SECONDS
  pgbackrest stanza-create
  pgbackrest check
  pgbackrest --type=full backup
  note "| stanza-create, check, full backup | $((SECONDS - started)) s |"
}

# Prints T, the database clock between the two marker batches.
write_markers() {
  local target
  sql "CREATE TABLE restore_marker (id int PRIMARY KEY, phase text NOT NULL, written_at timestamptz NOT NULL DEFAULT clock_timestamp())" >/dev/null
  sql "INSERT INTO restore_marker (id, phase) SELECT g, 'before' FROM generate_series(1, $BEFORE_ROWS) g" >/dev/null
  sleep 2
  target=$(sql "SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') || '+00'")
  sleep 2
  sql "INSERT INTO restore_marker (id, phase) SELECT $BEFORE_ROWS + g, 'after' FROM generate_series(1, $AFTER_ROWS) g" >/dev/null
  sql 'SELECT pg_switch_wal()' >/dev/null
  # check forces one more WAL switch and waits until that segment is archived, so every marker is in the repository.
  pgbackrest check >&2
  echo "$target"
}

# restore_into <latest|T>: replaces the data volume with a restore from the repository and starts postgres on it.
restore_into() {
  local target=$1 started=$SECONDS deadline volume
  local -a type=(--type=default)
  [[ "$target" == latest ]] || type=(--type=time "--target=$target" --target-action=promote)
  docker compose stop api >/dev/null
  docker compose rm -sf postgres >/dev/null
  volume="${COMPOSE_PROJECT_NAME}_pgdata"
  docker volume rm "$volume" >/dev/null
  docker compose run --rm --no-deps -u postgres --entrypoint pgbackrest postgres \
    --stanza=cod --archive-mode=off "${type[@]}" restore
  PGBACKREST_ENABLED=false docker compose up -d --no-deps postgres
  deadline=$((SECONDS + RECOVERY_TIMEOUT_S))
  until [[ "$(sql 'SELECT pg_is_in_recovery()' 2>/dev/null)" == f ]]; do
    ((SECONDS < deadline)) || fail "recovery to $target did not finish in $RECOVERY_TIMEOUT_S s"
    sleep 2
  done
  note "| restore to $target (fresh data volume), recovery and promotion | $((SECONDS - started)) s |"
  docker compose restart pgbouncer >/dev/null
  docker compose start api >/dev/null
}

# expect_markers <label> <before> <after>
expect_markers() {
  local counts
  counts=$(sql "SELECT count(*) FILTER (WHERE phase = 'before') || '/' || count(*) FILTER (WHERE phase = 'after') FROM restore_marker")
  [[ "$counts" == "$2/$3" ]] || fail "after the $1 restore the markers are $counts (before/after), wanted $2/$3"
  note "| markers after the $1 restore (before/after) | $counts (wanted $2/$3) |"
}

{
  echo "# Point-in-time restore test (scripts/ops/restore-test.sh, $(date -u +%Y-%m-%dT%H:%MZ), commit $(git rev-parse --short HEAD))"
  echo
  echo "Synthetic data on the compose project \`cod-restoretest\`; pgBackRest posix repository on a named volume."
  echo
  echo "| Step | Result |"
  echo "|---|---|"
} >"$report"
start_source
back_up
target=$(write_markers)
note "| T (database clock between the batches) | \`$target\` |"
restore_into "$target"
expect_markers "point-in-time" "$BEFORE_ROWS" 0
api_ready "on the point-in-time restore"
restore_into latest
expect_markers "latest" "$BEFORE_ROWS" "$AFTER_ROWS"
api_ready "on the latest restore"
{
  echo
  echo '```text'
  docker compose exec -T -u postgres postgres pgbackrest --stanza=cod info
  echo '```'
} >>"$report"
echo "RESTORE-TEST-OK ($report)"
