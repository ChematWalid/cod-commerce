#!/usr/bin/env bash
# Validates the collector configs with the pinned collector image (D3503): the local one alone, and the deployed
# one (local + Grafana overlay). The receivers' and the exporter's variables get synthetic values here, so the
# check needs no secret; nothing is started and nothing is sent.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cd "$repo_root/otel"

export COLLECTOR_REDIS_ENDPOINT='valkey:6379'
export COLLECTOR_POSTGRES_ENDPOINT='postgres:5432'
export COLLECTOR_POSTGRES_USER='synthetic-monitor'
export COLLECTOR_POSTGRES_PASSWORD='synthetic-not-a-password'
export COLLECTOR_API_READYZ_URL='http://api:3000/readyz'
export COLLECTOR_WORKER_READYZ_URL='http://worker:3020/readyz'
export COLLECTOR_STOREFRONT_READYZ_URL='http://storefront:3001/readyz'
export GRAFANA_OTLP_ENDPOINT='https://otlp-gateway.example.invalid/otlp'
export GRAFANA_OTLP_AUTH='c3ludGhldGljOm5vdC1hLXRva2Vu'
export TOOL_ENV='COLLECTOR_REDIS_ENDPOINT COLLECTOR_POSTGRES_ENDPOINT COLLECTOR_POSTGRES_USER COLLECTOR_POSTGRES_PASSWORD COLLECTOR_API_READYZ_URL COLLECTOR_WORKER_READYZ_URL COLLECTOR_STOREFRONT_READYZ_URL GRAFANA_OTLP_ENDPOINT GRAFANA_OTLP_AUTH'

tool="$repo_root/scripts/ops/tool.sh"
"$tool" otelcol validate --config=collector.yaml
echo 'otel/collector.yaml: valid'
"$tool" otelcol validate --config=collector.yaml --config=collector.grafana.yaml
echo 'otel/collector.yaml + collector.grafana.yaml: valid'
