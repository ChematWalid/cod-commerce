#!/usr/bin/env bash
# Checks the alert rules with promtool from the pinned Prometheus image (D3503): syntax and PromQL first, then
# the synthetic unit tests that prove each tested alert fires on its condition (ops/alerts/rules.test.yml).
# Nothing is started and nothing is sent.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cd "$repo_root/ops/alerts"

tool="$repo_root/scripts/ops/tool.sh"
"$tool" promtool check rules rules.yml
"$tool" promtool test rules rules.test.yml
echo 'ops/alerts/rules.yml: valid, unit tests pass'
