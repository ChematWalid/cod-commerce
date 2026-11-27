#!/usr/bin/env bash
# The slow-query report from pg_stat_statements (ADR 0015): the statements with the most total execution time.
# It runs psql inside the compose `postgres` container, so it needs no client on the host and no password on a
# command line (the container's own POSTGRES_USER and POSTGRES_DB are used).
#
#   scripts/ops/slow-queries.sh [--ensure] [--limit N]
#     --ensure   create the extension first (idempotent; needed once on a database created before it was loaded)
#     --limit N  how many statements to list (default 20)
#   COMPOSE_PROJECT_NAME picks the stack (default: the one docker-compose.yml names).
#
# Statements are normalized by Postgres ($1, $2 …), so the report holds no parameter values.
set -euo pipefail

readonly EX_USAGE=64
ensure=0
limit=20
while [ "$#" -gt 0 ]; do
  case "$1" in
    --ensure) ensure=1 ;;
    --limit)
      shift
      [[ "${1:-}" =~ ^[0-9]+$ ]] || { echo "--limit needs a number" >&2; exit "$EX_USAGE"; }
      limit="$1"
      ;;
    *) echo "usage: $0 [--ensure] [--limit N]" >&2; exit "$EX_USAGE" ;;
  esac
  shift
done

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cd "$repo_root"

psql_in_postgres() {
  # shellcheck disable=SC2016 # expanded by the container's shell, from the container's environment.
  docker compose exec -T postgres sh -c 'exec psql -v ON_ERROR_STOP=1 -X -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"' psql "$@"
}

if [ "$ensure" = 1 ]; then
  psql_in_postgres -c 'CREATE EXTENSION IF NOT EXISTS pg_stat_statements;'
fi

psql_in_postgres -P pager=off -c "
SELECT round(total_exec_time::numeric, 1)                AS total_ms,
       calls,
       round(mean_exec_time::numeric, 2)                 AS mean_ms,
       round((100 * total_exec_time / nullif(sum(total_exec_time) OVER (), 0))::numeric, 1) AS pct,
       rows,
       left(regexp_replace(query, '\s+', ' ', 'g'), 160) AS query
  FROM pg_stat_statements
 WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
 ORDER BY total_exec_time DESC
 LIMIT ${limit};"
