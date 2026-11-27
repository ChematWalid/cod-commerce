#!/usr/bin/env bash
# Proof-of-working evidence for P3.S5a Task 3 (CLAUDE.md §3a.14): starts Postgres, Valkey and the OpenTelemetry Collector
# of docker-compose.yml under their own project (cod-p3s5a-otel, ops profile, nothing published), with the debug exporter
# at `detailed`; runs the evidence producer (P3.S5a-otel-producer.ts) in a node container on that network through the
# server's observability preload; and writes what the collector printed: the platform gauges over OTLP, the Valkey and
# Postgres receivers' metrics, and the slow-query report from pg_stat_statements. Tears the project down on exit and never
# touches `cod`.
#
#   flock -w 3600 /tmp/cod-heavy-jobs.lock timeout 2400 bash scripts/evidence/P3.S5a-otel.sh
#
# Data is synthetic: the .env.example placeholders, synthetic jobs and synthetic outbox numbers.
set -euo pipefail
cd "$(dirname "$0")/../.."
repo_root="$(pwd -P)"

set -a
# shellcheck source=/dev/null # the committed placeholders: synthetic values only.
. ./.env.example
set +a
export COMPOSE_PROJECT_NAME=cod-p3s5a-otel APP_ENV=development COMPOSE_PROFILES=ops COLLECTOR_DEBUG_VERBOSITY=detailed
export POSTGRES_HOST_PORT=0 VALKEY_HOST_PORT=0
readonly NODE_IMAGE='node:24.22.1-bookworm-slim@sha256:be8204d4bd327363357f532187b752ff62759c31bedf98e9e18fc08c9cbd605c'
readonly OUT=docs/evidence/P3.S5a/otel
mkdir -p "$OUT"

cleanup() { docker compose down -v --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker compose up -d --wait postgres valkey
docker compose up -d otel-collector
network="${COMPOSE_PROJECT_NAME}_default"

docker run --rm --network "$network" --user "$(id -u):$(id -g)" -e HOME=/tmp \
  -v "$repo_root:/work:ro" -w /work/apps/server \
  -e ROLE=worker -e APP_ENV=development -e OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318 \
  -e EVIDENCE_REDIS_URL=redis://valkey:6379 -e NODE_PATH=/work/apps/server/node_modules \
  "$NODE_IMAGE" node --conditions=@cod/source -r ts-node/register/transpile-only -r ./src/config/otel.ts \
  ../../scripts/evidence/P3.S5a-otel-producer.ts

# The receivers scrape every 60 s; wait for one Postgres and one Valkey collection.
for _ in $(seq 1 60); do
  logs="$(docker compose logs --no-color otel-collector 2>&1)"
  if grep -q 'redis.memory.used' <<<"$logs" && grep -q 'postgresql.backends' <<<"$logs"; then break; fi
  sleep 2
done
logs="$(docker compose logs --no-color --no-log-prefix otel-collector 2>&1)"

{
  echo '# P3.S5a: OpenTelemetry metrics dump (collector debug exporter)'
  echo
  echo "Recorded $(date -u +%Y-%m-%dT%H:%MZ) by \`scripts/evidence/P3.S5a-otel.sh\` from the live collector of"
  echo "docker-compose.yml (project \`$COMPOSE_PROJECT_NAME\`, ops profile). Synthetic data only."
  echo
  echo '## Platform gauges (over OTLP from the observability preload)'
  echo
  echo "The resource and the \`cod-platform\` scope of the export, as the debug exporter printed them."
  echo
  echo '```text'
  # The producer's resource (cod-worker), and within it only the cod-platform scope (not the runtime metrics).
  awk '/ResourceMetrics #/ { res = 0; scope = 0 }
       /service\.name: Str\(cod-worker\)/ { res = 1; print; next }
       res && /InstrumentationScope / { scope = ($0 ~ /cod-platform/); if (scope) print; next }
       res && /-> (service\.namespace|deployment\.)/ { print; next }
       res && scope && (/-> (Name|Unit|pool|queue|state|task):/ || /Value:/)' <<<"$logs" |
    sed -E 's/^[[:space:]]+//' | head -200
  echo '```'
  echo
  echo '## Valkey and Postgres receivers (metric names seen)'
  echo
  echo '```text'
  grep -oE 'Name: (redis|postgresql)\.[a-z_.]+' <<<"$logs" | sort -u
  echo '```'
} >"$OUT/metrics-dump.md"

{
  echo '# P3.S5a: slow-query report (pg_stat_statements)'
  echo
  echo "Recorded $(date -u +%Y-%m-%dT%H:%MZ) by \`scripts/ops/slow-queries.sh --ensure --limit 5\` against the evidence"
  echo 'Postgres (fresh volume: the init script created the extension; --ensure is a no-op on it).'
  echo
  echo '```text'
  scripts/ops/slow-queries.sh --ensure --limit 5
  echo '```'
} >"$OUT/slow-queries.md"

echo "evidence: $OUT/metrics-dump.md, $OUT/slow-queries.md"
