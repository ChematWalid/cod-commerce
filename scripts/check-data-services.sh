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

cfg=$(docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" postgres \
  psql -h pgbouncer -U "$POSTGRES_USER" -d pgbouncer -tA -F'|' -c 'SHOW CONFIG')
command grep -q '^pool_mode|transaction|' <<<"$cfg"
command grep -q '^max_prepared_statements|200|' <<<"$cfg"
[[ $(docker compose exec -T valkey valkey-cli CONFIG GET maxmemory-policy | command tail -1 | tr -d '\r') == noeviction ]]
[[ $(docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc 'SHOW server_version') == 17.* ]]
docker compose exec -T garage /garage bucket info "$S3_BUCKET_PRIVATE" | command grep -qE "^RWO +$S3_ACCESS_KEY"
S3_ENDPOINT="http://127.0.0.1:${GARAGE_S3_HOST_PORT:-3900}" node scripts/check-object-storage.mjs
echo "DATA-SERVICES-OK"
