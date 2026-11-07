#!/usr/bin/env bash
# Idempotent GitHub bootstrap: labels, milestones and one issue per roadmap session.
# Source of truth: docs/roadmap/README.md (phase table + "Session list" table).
# Usage: scripts/github/bootstrap.sh [--dry-run] [--repo OWNER/REPO]
# Re-running is safe: existing labels are updated, existing milestones/issues (exact title) are skipped.
set -euo pipefail

DRY_RUN=0
REPO=""
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --repo) REPO="$2"; shift ;;
    *) echo "Unknown argument: $1" >&2; exit 64 ;;
  esac
  shift
done

ROOT="$(git rev-parse --show-toplevel)"
README="$ROOT/docs/roadmap/README.md"
[ -f "$README" ] || { echo "Missing $README" >&2; exit 1; }

gh auth status >/dev/null 2>&1 || { echo "gh is not authenticated; run 'gh auth login' yourself." >&2; exit 1; }
[ -n "$REPO" ] || REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"

run() {  # run a creating command, or print it in dry-run mode; retry once on rate limit
  if [ "$DRY_RUN" -eq 1 ]; then echo "DRY: $*" >&2; return 0; fi
  local out
  if out="$("$@" 2>&1)"; then sleep 2; return 0; fi
  if echo "$out" | grep -qiE "rate limit|secondary|abuse|HTTP 403|HTTP 429"; then
    echo "Rate limited; waiting 60s then retrying once..." >&2
    sleep 60
    "$@" >/dev/null && { sleep 2; return 0; }
    echo "Still rate limited; re-run this script later to resume." >&2
    exit 2
  fi
  echo "$out" >&2
  return 1
}

# ---------- Phases: "| [P{n} Name](file.md) | ..." ----------
declare -A PHASE_NAME PHASE_FILE
while IFS= read -r line; do
  name="$(echo "$line" | sed -E 's/^\| \[([^]]+)\]\(([^)]+)\).*/\1/')"
  file="$(echo "$line" | sed -E 's/^\| \[([^]]+)\]\(([^)]+)\).*/\2/')"
  num="$(echo "$name" | sed -E 's/^P([0-9]+) .*/\1/')"
  PHASE_NAME[$num]="$name"
  PHASE_FILE[$num]="$file"
done < <(grep -E '^\| \[P[0-9]+ [^]]+\]\([^)]+\) \|' "$README")

# ---------- Labels ----------
labels_created=0
label() { run gh label create "$1" --color "$2" --description "$3" --force --repo "$REPO"; labels_created=$((labels_created+1)); }
for n in $(seq 0 10); do label "phase-$n" "1D76DB" "Roadmap phase $n"; done
label "maintenance" "FBCA04" "Upstream Vendure sync and upkeep"
label "vendure-patch" "D93F0B" "PR that patches @vendure/* via pnpm patch (ADR 0001)"
label "security" "B60205" "Security-relevant change or finding"

# ---------- Milestones ----------
existing_ms="$(gh api "repos/$REPO/milestones?state=all&per_page=100" --jq '.[].title')"
ms_total=0; ms_created=0
milestone() {
  ms_total=$((ms_total+1))
  if grep -qxF "$1" <<<"$existing_ms"; then return 0; fi
  run gh api -X POST "repos/$REPO/milestones" -f title="$1" >/dev/null
  ms_created=$((ms_created+1))
}
for n in $(seq 0 10); do milestone "${PHASE_NAME[$n]}"; done
milestone "Maintenance"

# ---------- Issues: rows of the "## Session list" table ----------
existing_issues="$(gh issue list --repo "$REPO" --state all --limit 500 --json title --jq '.[].title')"
total=0; created=0; skipped=0
while IFS='|' read -r _ id title _rest; do
  id="$(echo "$id" | xargs)"; title="$(echo "$title" | sed -E 's/^ +| +$//g')"
  full="$id $title"
  total=$((total+1))
  if [ "$id" = "M.S1" ]; then
    lbl="maintenance"; ms="Maintenance"; file="${PHASE_FILE[10]}"
  else
    num="$(echo "$id" | sed -E 's/^P([0-9]+)\..*/\1/')"
    lbl="phase-$num"; ms="${PHASE_NAME[$num]}"; file="${PHASE_FILE[$num]}"
  fi
  if grep -qxF "$full" <<<"$existing_issues"; then skipped=$((skipped+1)); continue; fi
  body="Brief: https://github.com/$REPO/blob/main/docs/roadmap/$file (section $id)
Rules: CLAUDE.md and docs/roadmap/CONTRIBUTING.md"
  run gh issue create --repo "$REPO" --title "$full" --body "$body" --label "$lbl" --milestone "$ms" >/dev/null
  created=$((created+1))
done < <(awk '/^## Session list/{f=1;next} /^## /{f=0} f' "$README" | grep -E '^\| (P[0-9]+\.S[0-9]+[ab]?|M\.S1) \|')

echo "labels=$labels_created milestones=$ms_total (created=$ms_created) issues_total=$total created=$created skipped=$skipped dry_run=$DRY_RUN"
