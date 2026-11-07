#!/usr/bin/env bash
# Proof-of-working evidence for P0.S2b-3 (CLAUDE.md §3a.14): runs the compose stack under its own
# project (cod-evidence, every *_HOST_PORT shifted by 20000), records live request/response
# transcripts into docs/evidence/P0.S2b-3/, and tears the stack down. Never touches `cod` or `cod-verify`.
#
#   scripts/evidence/P0.S2b-3.sh
#
# Tokens, cookies and the password are redacted by this script, which fails if any raw secret
# remains in an output file. Data is synthetic (.env placeholders).
set -euo pipefail
cd "$(dirname "$0")/../.."
# shellcheck source=../lib/wait-http.sh
. scripts/lib/wait-http.sh

if [[ ! -f .env ]]; then
  echo "evidence: .env is missing; copy .env.example to .env first (cp .env.example .env)" >&2
  exit 1
fi
set -a
. ./.env
set +a
export COMPOSE_PROJECT_NAME=cod-evidence
export POSTGRES_HOST_PORT=25433 PGBOUNCER_HOST_PORT=26432 VALKEY_HOST_PORT=26380 GARAGE_S3_HOST_PORT=23900
export MAILPIT_SMTP_HOST_PORT=21026 MAILPIT_UI_HOST_PORT=28026 API_HOST_PORT=23100 WORKER_HEALTH_HOST_PORT=23020
export APP_IMAGE=${APP_IMAGE:-cod-platform:local}

out=docs/evidence/P0.S2b-3
api="http://127.0.0.1:$API_HOST_PORT"
worker="http://127.0.0.1:$WORKER_HEALTH_HOST_PORT"
work=$(mktemp -d)

fail() {
  echo "EVIDENCE FAILED: $*" >&2
  exit 1
}

on_exit() {
  local status=$?
  if ((status != 0)); then
    docker compose ps -a >&2 || true
    docker compose logs --no-color --tail=60 migrate api worker >&2 || true
  fi
  docker compose down -v --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$work"
  exit "$status"
}
trap on_exit EXIT

container_of() { docker compose ps -aq "$1"; }
exit_code() { docker inspect -f '{{.State.ExitCode}}' "$(container_of "$1")"; }
started_at() { docker inspect -f '{{.State.StartedAt}}' "$(container_of "$1")"; }

wait_healthy() {
  local deadline=$((SECONDS + 180)) svc pending
  while ((SECONDS < deadline)); do
    pending=""
    for svc in "$@"; do
      [[ $(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$(container_of "$svc")" 2>/dev/null) == healthy ]] ||
        pending+=" $svc"
    done
    [[ -z "$pending" ]] && return 0
    sleep 2
  done
  fail "not healthy after 180s:$pending"
}

# Appends one transcript section to a file (formatting and redaction: scripts/evidence/transcript.mjs).
#   record <file> <title> <method> <url> <request-body|-> <request-header>...
# Each request header is "<sent>|<shown>": the first part goes on the wire, the second into the
# transcript (so a bearer token is shown redacted). Set DISPLAY_BODY to print a different request
# body than the one sent (the login password). A connection failure (status 000) aborts the run.
# Leaves the raw response in $work/h and $work/b.
record() {
  local file=$1 title=$2 method=$3 url=$4 body=$5
  shift 5
  local -a curl_args=(-sS -X "$method" -D "$work/h" -o "$work/b" --max-time 20)
  local -a shown=()
  local hdr status
  for hdr in "$@"; do
    curl_args+=(-H "${hdr%%|*}")
    shown+=("${hdr#*|}")
  done
  [[ "$body" != - ]] && curl_args+=(--data "$body")
  status=$(curl "${curl_args[@]}" -w '%{http_code}' "$url") || status=000
  [[ "$status" != 000 ]] || fail "$title: no HTTP answer from $url"
  SHOWN_HEADERS=$(printf '%s\n' "${shown[@]+"${shown[@]}"}") SHOWN_BODY=${DISPLAY_BODY:-$body} \
    TITLE=$title METHOD=$method URL=$url node scripts/evidence/transcript.mjs "$work/h" "$work/b" "$file"
}

begin() { # begin <file> <heading> <intro>
  printf '# %s\n\n%s\n\n' "$2" "$3" >"$1"
}

rm -rf "$out/api"
mkdir -p "$out/api"
docker compose down -v --remove-orphans

docker image inspect "$APP_IMAGE" >/dev/null 2>&1 || docker compose build migrate
docker compose up -d
wait_healthy api worker
[[ $(exit_code migrate) == 0 ]] || fail "migrate exited $(exit_code migrate)"

# --- migrate.md ---------------------------------------------------------------------------
# Only the migrate.done line: the surrounding lines carry timestamps and driver warnings that change per run.
done_line() { # done_line [docker compose logs args...]: the last raw migrate.done JSON line
  docker compose logs --no-color --no-log-prefix "$@" migrate | command grep '"event":"migrate.done"' | command tail -1
}
pretty_json() { node -e 'console.log(JSON.stringify(JSON.parse(process.argv[1]), null, 2))' "$1"; }
first_line=$(done_line) || true
[[ -n "$first_line" ]] || fail "first migrate run logged no migrate.done line"
first_excerpt=$(pretty_json "$first_line")
first_code=$(exit_code migrate)

first_start=$(started_at migrate)
sleep 1 # `logs --since` has one-second resolution
since=$(date -u +%FT%TZ)
docker compose up -d
wait_healthy api worker
[[ $(started_at migrate) != "$first_start" ]] || fail "second up did not run migrate again"
second_line=$(done_line --since "$since") || true
[[ -n "$second_line" ]] || fail "second migrate run logged no migrate.done line"
second_excerpt=$(pretty_json "$second_line")
second_code=$(exit_code migrate)
[[ $first_code == 0 && $second_code == 0 ]] || fail "migrate exit codes $first_code / $second_code"
node -e 'const r=JSON.parse(process.argv[1]); process.exit(r.migrationsRun.length===0 && r.seed.changes.length===0 ? 0 : 1)' "$second_line" ||
  fail "second migrate run was not a no-op: $second_line"

{
  printf '# migrate\n\nThe one-shot `migrate` service runs migrations and the seed before api and worker start. The `migrate.done` line of its container log (the rest is migration SQL and timestamped framework output) and its exit code, taken with `docker inspect`.\n\n'
  printf '### First start (empty database)\n\n```text\n%s\n```\n\nContainer exit code (`docker inspect -f {{.State.ExitCode}}`): `%s`\n\n' "$first_excerpt" "$first_code"
  printf '### Second start (`docker compose up -d` again)\n\nNothing left to do: `migrationsRun` and `seed.changes` are empty.\n\n```text\n%s\n```\n\nContainer exit code: `%s`\n\n' "$second_excerpt" "$second_code"
} >"$out/api/migrate.md"

# --- health ------------------------------------------------------------------------------
begin "$out/api/health-api.md" "API health" "Liveness and readiness of the api service (container port 3000, published on \`$API_HOST_PORT\`). Readiness turns 503 while Valkey is stopped and recovers without a restart."
begin "$out/api/health-worker.md" "Worker health" "Health server of the worker (container port 3020, published on \`$WORKER_HEALTH_HOST_PORT\`). Readiness turns 503 while Valkey is stopped and recovers without a restart."

probe() { # probe <file> <base> <label>
  record "$1" "$3: GET /livez" GET "$2/livez" -
  record "$1" "$3: GET /readyz" GET "$2/readyz" -
}
probe "$out/api/health-api.md" "$api" "Healthy"
probe "$out/api/health-worker.md" "$worker" "Healthy"
docker compose stop valkey
wait_http 503 "$api/readyz" 30 || fail "api /readyz with valkey stopped"
wait_http 503 "$worker/readyz" 30 || fail "worker /readyz with valkey stopped"
probe "$out/api/health-api.md" "$api" "Valkey stopped"
probe "$out/api/health-worker.md" "$worker" "Valkey stopped"
docker compose start valkey
wait_http 200 "$api/readyz" 60 || fail "api /readyz after valkey came back"
wait_http 200 "$worker/readyz" 60 || fail "worker /readyz after valkey came back"
probe "$out/api/health-api.md" "$api" "Valkey started again"
probe "$out/api/health-worker.md" "$worker" "Valkey started again"

# --- admin login -------------------------------------------------------------------------
json='Content-Type: application/json'
login_query='mutation Login($username: String!, $password: String!) { login(username: $username, password: $password) { __typename ... on CurrentUser { identifier channels { code } } ... on ErrorResult { errorCode message } } }'
login_body=$(Q="$login_query" U="$SUPERADMIN_USERNAME" P="$SUPERADMIN_PASSWORD" node -e 'console.log(JSON.stringify({query:process.env.Q,variables:{username:process.env.U,password:process.env.P}}))')
begin "$out/api/admin-login.md" "Admin API login" "Superadmin login with the \`login\` mutation on \`POST /admin-api\`. The server accepts the session as a cookie or as a bearer token; the token, cookie value and password are redacted by the evidence script."
shown_body=$(Q="$login_query" U="$SUPERADMIN_USERNAME" node -e 'console.log(JSON.stringify({query:process.env.Q,variables:{username:process.env.U,password:"[REDACTED]"}}))')
# The real body (with the password) goes on the wire; the transcript prints the redacted one.
DISPLAY_BODY=$shown_body record "$out/api/admin-login.md" "POST /admin-api: login mutation" POST "$api/admin-api?languageCode=en" "$login_body" \
  "$json|content-type: application/json"
cp "$work/h" "$work/login.h"
cp "$work/b" "$work/login.b"
token=$(command grep -i '^vendure-auth-token:' "$work/login.h" | command head -1 | node -e 'console.log(require("fs").readFileSync(0,"utf8").split(":")[1].trim())')
[[ -n "$token" ]] || fail "login returned no vendure-auth-token header"
command grep -q '"CurrentUser"' "$work/login.b" || fail "login did not return CurrentUser"

# --- seeded data -------------------------------------------------------------------------
seed_query='{ activeChannel { code defaultCurrencyCode availableCurrencyCodes pricesIncludeTax availableLanguageCodes defaultTaxZone { name } defaultShippingZone { name } } globalSettings { availableLanguages } }'
seed_body=$(Q="$seed_query" node -e 'console.log(JSON.stringify({query:process.env.Q}))')
begin "$out/api/admin-seeded-data.md" "Admin API seeded data" "One authenticated Admin API query (bearer token, redacted) showing what the seed created: DZD as the default currency, prices including tax, the Algeria zones and the languages ar, fr and en."
record "$out/api/admin-seeded-data.md" "POST /admin-api: activeChannel and globalSettings" POST "$api/admin-api?languageCode=en" "$seed_body" \
  "$json|content-type: application/json" "Authorization: Bearer $token|Authorization: Bearer [REDACTED]"
node -e '
const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).data;
const c = r.activeChannel;
const ok = c.defaultCurrencyCode === "DZD" && c.pricesIncludeTax === true && c.defaultTaxZone.name === "Algeria" &&
  c.defaultShippingZone.name === "Algeria" && c.availableLanguageCodes.join() === "ar,fr,en" && r.globalSettings.availableLanguages.join() === "ar,fr,en";
process.exit(ok ? 0 : 1);
' "$work/b" || fail "seeded data differs from the expected DZD / Algeria / ar,fr,en: $(command cat "$work/b")"

# --- README ------------------------------------------------------------------------------
cat >"$out/README.md" <<README
# Evidence for P0.S2b-3 (server data layer and image)

Request/response transcripts from a live run of the compose stack (CLAUDE.md §3a.14). Generated on $(date -u +%F) by
\`scripts/evidence/P0.S2b-3.sh\`; nothing here is hand-written. Data is synthetic (placeholders from \`.env.example\`);
tokens, cookies and the password are redacted by the script, and per-check \`durationMs\` values are dropped so re-runs regenerate identical files.

| File                                                 | Shows                                                                                                                  |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [\`api/migrate.md\`](api/migrate.md)                   | The \`migrate\` container log excerpt and exit code 0 on the first start, then a no-op second start (nothing migrated or seeded) |
| [\`api/health-api.md\`](api/health-api.md)             | api \`/livez\` and \`/readyz\`: healthy (200), Valkey stopped (503, \`redis.ok: false\`), recovered (200)                       |
| [\`api/health-worker.md\`](api/health-worker.md)       | The same three states for the worker health server                                                                     |
| [\`api/admin-login.md\`](api/admin-login.md)           | Superadmin login through \`POST /admin-api\` with token and cookie values redacted                                       |
| [\`api/admin-seeded-data.md\`](api/admin-seeded-data.md) | Authenticated query: DZD, prices include tax, Algeria zones, languages ar/fr/en                                       |

## Re-run

\`\`\`bash
cp .env.example .env   # once; the script needs the root .env
scripts/evidence/P0.S2b-3.sh
\`\`\`

It uses its own compose project (\`cod-evidence\`, host ports shifted by 20000), reuses the \`\${APP_IMAGE:-cod-platform:local}\`
image (building it only when absent), and removes the stack and its volumes on exit. It fails if the password, the cookie
secret or a token value appears in any output file.
README

# --- redaction check ---------------------------------------------------------------------
cookies=$(command grep -i '^set-cookie:' "$work/login.h" | node -e 'for (const l of require("fs").readFileSync(0,"utf8").split("\n")) { const m = /^set-cookie:\s*[^=]+=([^;\s]+)/i.exec(l); if (m) console.log(m[1]); }')
# Every secret must be non-empty (an empty needle matches nothing and would pass silently).
[[ -n "${SUPERADMIN_PASSWORD:-}" ]] || fail "SUPERADMIN_PASSWORD is empty; the redaction check would be vacuous"
[[ -n "${COOKIE_SECRET:-}" ]] || fail "COOKIE_SECRET is empty; the redaction check would be vacuous"
[[ -n "$token" ]] || fail "login token is empty; the redaction check would be vacuous"
[[ -n "$cookies" ]] || fail "login returned no Set-Cookie values; the redaction check would be vacuous"
for secret in "$SUPERADMIN_PASSWORD" "$COOKIE_SECRET" "$token" $cookies; do
  if command grep -rqF -- "$secret" "$out"; then
    fail "a raw secret appears in $out"
  fi
done
echo "redaction check: no password, token or cookie secret in $out"
echo "EVIDENCE-OK"
