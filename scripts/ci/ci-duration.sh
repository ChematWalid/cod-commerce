#!/usr/bin/env bash
# Prints the p90 duration (seconds) of the last 20 CI runs on main; exits 1 above the 600 s budget (ADR 0001).
set -euo pipefail

BUDGET_SECONDS=600

durations=$(gh run list --workflow ci.yml --branch main --limit 20 --status completed \
  --json createdAt,updatedAt,conclusion \
  --jq '[.[] | select(.conclusion == "success") | ((.updatedAt | fromdate) - (.createdAt | fromdate))] | sort | .[]')

if [[ -z "$durations" ]]; then
  echo "no successful CI runs on main yet" >&2
  exit 0
fi

count=$(wc -l <<<"$durations")
index=$(( (count * 9 + 9) / 10 ))   # ceil(0.9 * count), 1-based
p90=$(sed -n "${index}p" <<<"$durations")

echo "p90 over ${count} runs: ${p90}s (budget ${BUDGET_SECONDS}s)"
((p90 <= BUDGET_SECONDS))
