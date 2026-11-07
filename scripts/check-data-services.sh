#!/usr/bin/env bash
# Verifies the local data stack (docker compose up -d must have run).
set -euo pipefail
cd "$(dirname "$0")/.."
set -a
. ./.env
set +a

wait_healthy() {
  local deadline=$((SECONDS + 90)) svc status pending
  while ((SECONDS < deadline)); do
    status=$(docker compose ps --format '{{.Service}} {{.Health}}')
    pending=""
    for svc in "$@"; do
      command grep -qx "$svc healthy" <<<"$status" || pending+=" $svc"
    done
    [[ -z "$pending" ]] && return 0
    sleep 2
  done
  echo "not healthy after 90s:$pending" >&2
  return 1
}

wait_healthy postgres pgbouncer valkey garage mailpit

# assert <message> <command...>: names the failing check in the log, then exits 1.
assert() {
  local msg=$1
  shift
  if ! "$@"; then
    echo "CHECK FAILED: $msg" >&2
    exit 1
  fi
}
config_has() { command grep -q "$1" <<<"$cfg"; }
valkey_policy_is_noeviction() {
  [[ $(docker compose exec -T valkey valkey-cli CONFIG GET maxmemory-policy | command tail -1 | tr -d '\r') == noeviction ]]
}
pg_version_is_17() {
  [[ $(docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc 'SHOW server_version') == 17.* ]]
}
garage_key_has_rwo() {
  docker compose exec -T garage /garage bucket info "$S3_BUCKET_PRIVATE" | command grep -qE "^RWO +$S3_ACCESS_KEY"
}
# The pgbouncer image has no psql, so run the client from the postgres container.
select_one_through_pgbouncer() {
  [[ $(docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" postgres \
    psql -h pgbouncer -p 5432 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc 'select 1') == 1 ]]
}

cfg=$(docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" postgres \
  psql -h pgbouncer -U "$POSTGRES_USER" -d pgbouncer -tA -F'|' -c 'SHOW CONFIG') ||
  {
    echo "CHECK FAILED: SHOW CONFIG on the pgbouncer admin console" >&2
    exit 1
  }
assert "pgbouncer pool_mode is not transaction" config_has '^pool_mode|transaction|'
assert "pgbouncer max_prepared_statements is not 200" config_has '^max_prepared_statements|200|'
assert "pgbouncer cannot run 'select 1' on postgres (DB_HOST, DB_PASSWORD or auth type)" select_one_through_pgbouncer
assert "valkey maxmemory-policy is not noeviction" valkey_policy_is_noeviction
assert "postgres server_version is not 17.x" pg_version_is_17
assert "garage key $S3_ACCESS_KEY lacks RWO on bucket $S3_BUCKET_PRIVATE" garage_key_has_rwo
S3_ENDPOINT="http://127.0.0.1:${GARAGE_S3_HOST_PORT:-3900}" node scripts/check-object-storage.mjs ||
  {
    echo "CHECK FAILED: object storage PUT/GET/presigned/anonymous" >&2
    exit 1
  }
echo "DATA-SERVICES-OK"
