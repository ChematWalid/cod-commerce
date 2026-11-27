#!/usr/bin/env bash
# Checks the role image (P3.S5a Task 2) and writes the evidence to docs/evidence/P3.S5a/:
#   - builds it (the commit id as NEXT_DEPLOYMENT_ID) and records its size against the previous image;
#   - every role runs as a non-root user, and the runtime holds no dev dependency or workspace toolchain;
#   - `docker history --no-trunc` holds nothing secret-like;
#   - Trivy secret scan (fails the run) and HIGH/CRITICAL vulnerability counts, via scripts/ops/tool.sh;
#   - a CycloneDX SBOM (kept whole when <= 1 MB, else a summary);
#   - on a compose stack of its own (project cod-imagecheck, host ports +30000): RSS per role, the node-level
#     /api/readyz answer while the api is up and once it is stopped, and `docker compose stop` time and exit code
#     per role (api < 30 s, worker < 65 s, storefront < 30 s, never SIGKILL's 137).
#
#   flock -w 3600 /tmp/cod-heavy-jobs.lock timeout 2400 bash scripts/ops/image-check.sh
#   IC_SKIP_BUILD=1 ... reuses an existing $IMAGE
#
# Data is synthetic; no value of .env is ever printed. Never add `set -x`.
set -euo pipefail
cd "$(dirname "$0")/../.."
# shellcheck source=scripts/lib/wait-http.sh
. scripts/lib/wait-http.sh

[[ -f .env ]] || { echo "image-check: .env is missing; cp .env.example .env" >&2; exit 1; }
set -a
# shellcheck disable=SC1091 # the local, git-ignored .env
. ./.env
set +a

IMAGE=${IMAGE:-cod-platform:image-check}
BASELINE_IMAGE=${BASELINE_IMAGE:-cod-platform:local}
export COMPOSE_PROJECT_NAME=cod-imagecheck APP_IMAGE=$IMAGE
export INTERNAL_HMAC_KEYS=${INTERNAL_HMAC_KEYS:-k1:evidence-internal-hmac-key-synthetic-0000000001} INTERNAL_HMAC_ACTIVE_KID=${INTERNAL_HMAC_ACTIVE_KID:-k1}
export TENANT_SECRET_KEKS=${TENANT_SECRET_KEKS:-k1:3a5c7e9f1b2d4f60718293a4b5c6d7e8f9a0b1c2d3e4f5061728394a5b6c7d8e} TENANT_SECRET_ACTIVE_KID=${TENANT_SECRET_ACTIVE_KID:-k1}
# The .env.example placeholder (accepted in development, refused when deployed): never a minted key.
: "${QUOTE_HMAC_KEYS:=k1:change-me-quote-hmac-00000000000000000000000000}"
: "${QUOTE_HMAC_ACTIVE_KID:=k1}"
export QUOTE_HMAC_KEYS QUOTE_HMAC_ACTIVE_KID
export AUTH_TOKEN_SECRET=${AUTH_TOKEN_SECRET:-evidence-auth-token-secret-synthetic-0123456789}
export POSTGRES_HOST_PORT=35433 PGBOUNCER_HOST_PORT=36432 VALKEY_HOST_PORT=36380 GARAGE_S3_HOST_PORT=33900
export MAILPIT_SMTP_HOST_PORT=31026 MAILPIT_UI_HOST_PORT=38026 API_HOST_PORT=33100 WORKER_HEALTH_HOST_PORT=33020
export STOREFRONT_HOST_PORT=33001 PLATFORM_DOMAIN=localhost
export SMTP_HOST=mailpit SMTP_PORT=1025 SMTP_FROM=no-reply@localhost SMTP_TLS=none SMTP_USERNAME='' SMTP_PASSWORD=''
# Teardown removes this project's volumes: refuse to run under any other project name.
[[ "$COMPOSE_PROJECT_NAME" == cod-imagecheck ]] || { echo "image-check: wrong compose project" >&2; exit 1; }

readonly API_STOP_LIMIT_S=30 WORKER_STOP_LIMIT_S=65 STOREFRONT_STOP_LIMIT_S=30
readonly SIGKILL_EXIT=137 SBOM_MAX_BYTES=1048576
# Values that must never sit in an image layer: placeholders of build-only secrets, key material, known token shapes.
readonly SECRET_LIKE='change-me|BEGIN [A-Z ]*PRIVATE KEY|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|xox[abpr]-|sk_live_|(SECRET|PASSWORD|TOKEN|HMAC_KEYS|KEKS)[A-Z_]*=[^ $]'

out=docs/evidence/P3.S5a
report=$out/image-check.md
work=$(mktemp -d)
mkdir -p "$out/sbom" "$out/api"

fail() {
  echo "IMAGE-CHECK FAILED: $*" >&2
  exit 1
}
on_exit() {
  local status=$?
  if ((status != 0)); then
    docker compose logs --no-color --tail=60 migrate api worker storefront >&2 || true
  fi
  docker compose down -v --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$work"
  exit "$status"
}
trap on_exit EXIT

note() { printf '%s\n' "$*" >>"$report"; }
container_of() { docker compose ps -aq "$1"; }
mib() { awk -v b="$1" 'BEGIN { printf "%.0f MiB", b / 1048576 }'; }

build_image() {
  local deploy_id started
  deploy_id="$(git rev-parse --short HEAD)"
  [[ -z "$(git status --porcelain)" ]] || deploy_id+="-dirty"
  started=$SECONDS
  docker build -t "$IMAGE" --build-arg NEXT_DEPLOYMENT_ID="$deploy_id" .
  echo "image-check: built $IMAGE in $((SECONDS - started)) s"
}

check_size() {
  local size baseline="n/a"
  size=$(docker image inspect -f '{{.Size}}' "$IMAGE")
  if docker image inspect "$BASELINE_IMAGE" >/dev/null 2>&1; then
    baseline=$(mib "$(docker image inspect -f '{{.Size}}' "$BASELINE_IMAGE")")
  fi
  note "| Image size | $(mib "$size") (single-stage baseline \`$BASELINE_IMAGE\`: $baseline) |"
}

check_users() {
  local role uid
  for role in api worker migrate storefront; do
    uid=$(docker run --rm -e ROLE="$role" "$IMAGE" id -u)
    [[ "$uid" != 0 ]] || fail "ROLE=$role runs as root"
    note "| ROLE=$role user id | $uid |"
  done
  # The runtime keeps production dependencies only: no workspace root install, no compiler, no test runner.
  docker run --rm "$IMAGE" sh -c \
    '! test -e /app/node_modules && ! test -e apps/server/node_modules/typescript && ! test -e apps/server/node_modules/vitest && ! test -d apps/server/src' ||
    fail "the runtime carries dev dependencies or the source tree"
  note "| Dev dependencies, root node_modules, server src | absent |"
}

check_history() {
  if docker history --no-trunc --format '{{.CreatedBy}}' "$IMAGE" | command grep -Eq -- "$SECRET_LIKE"; then
    fail "docker history holds a secret-like value (pattern match; not printed)"
  fi
  note "| \`docker history --no-trunc\` secret-like values | none |"
}

check_trivy() {
  scripts/ops/tool.sh trivy image --quiet --scanners secret --exit-code 1 "$IMAGE" >"$work/secrets.txt" ||
    { command cat "$work/secrets.txt" >&2; fail "Trivy found a secret in the image"; }
  note "| Trivy secret scan | no finding |"
  scripts/ops/tool.sh trivy image --quiet --scanners vuln --severity HIGH,CRITICAL --format json "$IMAGE" >"$work/vulns.json"
  # shellcheck disable=SC2016 # JavaScript, not shell.
  node -e '
    const report = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
    const counts = { HIGH: 0, CRITICAL: 0 };
    for (const result of report.Results ?? []) for (const v of result.Vulnerabilities ?? []) counts[v.Severity] += 1;
    console.log(`| Trivy vulnerabilities | CRITICAL ${counts.CRITICAL}, HIGH ${counts.HIGH} |`);
  ' "$work/vulns.json" >>"$report"
}

write_sbom() {
  local sbom="$work/sbom.cdx.json" size
  scripts/ops/tool.sh trivy image --quiet --format cyclonedx "$IMAGE" >"$sbom"
  size=$(stat -c %s "$sbom")
  rm -f "$out/sbom/image.cdx.json"
  if ((size <= SBOM_MAX_BYTES)); then
    command cp "$sbom" "$out/sbom/image.cdx.json"
  fi
  # shellcheck disable=SC2016 # JavaScript, not shell.
  node -e '
    const sbom = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
    const components = sbom.components ?? [];
    const byType = {};
    for (const c of components) byType[c.type] = (byType[c.type] ?? 0) + 1;
    const lines = [
      "# Image SBOM summary (CycloneDX, Trivy)", "",
      `Format ${sbom.bomFormat} ${sbom.specVersion}; ${components.length} components.`, "",
      "| Type | Count |", "|---|---|",
      ...Object.entries(byType).sort().map(([type, count]) => `| ${type} | ${count} |`), "",
      `Full SBOM: ${process.argv[2] === "kept" ? "image.cdx.json (beside this file)" : "over 1 MB, not committed; re-run scripts/ops/image-check.sh"}.`,
    ];
    console.log(lines.join("\n"));
  ' "$sbom" "$( ((size <= SBOM_MAX_BYTES)) && echo kept || echo dropped)" >"$out/sbom/summary.md"
  note "| SBOM | \`sbom/summary.md\` ($(mib "$size") CycloneDX) |"
}

# transcript <file> <title> <url>: a live GET of the storefront's /api/readyz, headers and body as answered.
transcript() {
  local status
  status=$(curl -s --max-time 5 -D "$work/h" -o "$work/b" -w '%{http_code}' "$3" || true)
  {
    echo "## $2"
    echo
    echo '```http'
    echo "GET ${3#http://127.0.0.1:"$STOREFRONT_HOST_PORT"} HTTP/1.1"
    echo "Host: 127.0.0.1"
    echo '```'
    echo
    echo "Status: $status"
    echo
    echo '```http'
    command grep -iE '^(content-type|cache-control):' "$work/h" | tr -d '\r'
    echo '```'
    echo
    echo '```json'
    node -e 'console.log(JSON.stringify(JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")), null, 2))' "$work/b"
    echo '```'
    echo
  } >>"$1"
  echo "$status"
}

wait_healthy() {
  local deadline=$((SECONDS + 240)) svc pending
  while ((SECONDS < deadline)); do
    pending=""
    for svc in "$@"; do
      [[ $(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$(container_of "$svc")" 2>/dev/null) == healthy ]] ||
        pending+=" $svc"
    done
    [[ -z "$pending" ]] && return 0
    sleep 2
  done
  fail "not healthy after 240 s:$pending"
}

record_rss() {
  local svc
  for svc in api worker storefront; do
    note "| RSS $svc (idle, \`docker stats --no-stream\`) | $(docker stats --no-stream --format '{{.MemUsage}}' "$(container_of "$svc")" | cut -d/ -f1 | tr -d ' ') |"
  done
}

# timed_stop <service> <limit-s>: stops one role, checks its stop time and that it was not SIGKILLed.
timed_stop() {
  local svc=$1 limit=$2 started elapsed code
  started=$(date +%s%N)
  docker compose stop "$svc" >/dev/null
  elapsed=$(( ($(date +%s%N) - started) / 1000000 ))
  code=$(docker inspect -f '{{.State.ExitCode}}' "$(container_of "$svc")")
  [[ "$code" != "$SIGKILL_EXIT" ]] || fail "$svc was killed (exit $code) after $elapsed ms"
  ((elapsed < limit * 1000)) || fail "$svc took $elapsed ms to stop, limit ${limit} s"
  note "| \`docker compose stop $svc\` | $elapsed ms, exit code $code (limit ${limit} s) |"
}

check_stack() {
  local readyz="http://127.0.0.1:$STOREFRONT_HOST_PORT/api/readyz" api_md="$out/api/api-readyz.md" status
  docker compose down -v --remove-orphans >/dev/null 2>&1 || true
  docker compose up -d
  wait_healthy api worker storefront
  record_rss
  wait_http 200 "$readyz" 30 || fail "/api/readyz never answered 200 with the api up"
  printf '# Storefront node-level readiness: GET /api/readyz (live, %s)\n\n' "$(date -u +%Y-%m-%dT%H:%MZ)" >"$api_md"
  status=$(transcript "$api_md" "The node-local api is ready" "$readyz")
  [[ "$status" == 200 ]] || fail "/api/readyz answered $status with the api up"
  timed_stop api "$API_STOP_LIMIT_S"
  status=$(transcript "$api_md" "The node-local api is stopped: 503, without its error text" "$readyz")
  [[ "$status" == 503 ]] || fail "/api/readyz answered $status with the api stopped"
  timed_stop worker "$WORKER_STOP_LIMIT_S"
  timed_stop storefront "$STOREFRONT_STOP_LIMIT_S"
}

if [[ "${IC_SKIP_BUILD:-}" == 1 ]] && docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "image-check: reusing $IMAGE"
else
  build_image
fi
{
  echo "# Role image check (scripts/ops/image-check.sh, $(date -u +%Y-%m-%dT%H:%MZ), commit $(git rev-parse --short HEAD))"
  echo
  echo "| Check | Result |"
  echo "|---|---|"
} >"$report"
check_size
check_users
check_history
check_trivy
write_sbom
check_stack
echo "IMAGE-CHECK-OK ($report)"
