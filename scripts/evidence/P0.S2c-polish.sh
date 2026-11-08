#!/usr/bin/env bash
# Proof-of-working evidence for P0.S2c-polish (CLAUDE.md §3a.14): runs the real compose stack under its own
# project (cod-evidence, every *_HOST_PORT shifted by 20000), screenshots the dashboard (Arabic and English,
# desktop and mobile, with the mobile sidebar open) and the storefront stub, records a bearer-only Admin API
# client into docs/evidence/P0.S2c-polish/, scans it for secrets and tears the stack down.
#
# Data is synthetic (.env placeholders, the storefront's stub stores).
set -euo pipefail
cd "$(dirname "$0")/../.."
# shellcheck source=../lib/wait-http.sh
. scripts/lib/wait-http.sh

[[ -f .env ]] || { echo "evidence: .env is missing; cp .env.example .env first" >&2; exit 1; }
set -a
. ./.env
set +a
export COMPOSE_PROJECT_NAME=cod-evidence
export POSTGRES_HOST_PORT=25433 PGBOUNCER_HOST_PORT=26432 VALKEY_HOST_PORT=26380 GARAGE_S3_HOST_PORT=23900
export MAILPIT_SMTP_HOST_PORT=21026 MAILPIT_UI_HOST_PORT=28026 API_HOST_PORT=23100 WORKER_HEALTH_HOST_PORT=23020
export STOREFRONT_HOST_PORT=23001
export APP_IMAGE=${APP_IMAGE:-cod-platform:local}

# The stub stores and page markers storefront-screens.mjs checks against the storefront source.
export DEMO_STORE_ID=demo DEMO_STORE_NAME='Demo Store' DEMO_STORE_HOST=demo.localhost DEMO_STORE_LOCALE=ar
export SECOND_STORE_ID=second SECOND_STORE_NAME='Second Store' SECOND_STORE_HOST=second.localhost SECOND_STORE_LOCALE=fr
export UNKNOWN_HOST=nope.localhost STORE_NAME_TEST_ID=store-name NOT_FOUND_TEST_ID=not-found NOT_FOUND_TEXT='Page not found'

out=docs/evidence/P0.S2c-polish
api="http://127.0.0.1:$API_HOST_PORT"
admin_api="$api/admin-api"
work=$(mktemp -d)

fail() {
  echo "EVIDENCE FAILED: $*" >&2
  exit 1
}

on_exit() {
  local status=$?
  if ((status != 0)); then
    docker compose ps -a >&2 || true
    docker compose logs --no-color --tail=60 migrate api worker storefront >&2 || true
  fi
  docker compose down -v --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$work"
  exit "$status"
}
trap on_exit EXIT

container_of() { docker compose ps -aq "$1"; }

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

secret_values=()
while IFS='=' read -r _ value; do
  value=${value%\"}
  value=${value#\"}
  [[ -n "$value" ]] && secret_values+=("$value")
done < <(command grep -E '^(export[[:space:]]+)?[A-Z0-9_]*(PASSWORD|SECRET|TOKEN|_KEY)=' .env)
((${#secret_values[@]} >= 2)) || fail "found fewer than 2 non-empty secret values in .env"

image_inputs=(. ':!docs/evidence' ':!scripts/evidence' ':!.superpowers')
dirty=$(git status --porcelain -- "${image_inputs[@]}")
[[ -z "$dirty" ]] || fail "uncommitted changes outside the evidence folders:
$dirty"
image_commit=$(git log -1 --format=%H -- "${image_inputs[@]}")
NEXT_DEPLOYMENT_ID="$(git rev-parse --short "$image_commit")"
export NEXT_DEPLOYMENT_ID

docker compose down -v --remove-orphans
docker compose build migrate
docker compose up -d
wait_healthy api worker storefront
wait_http 200 "$api/readyz" 60 || fail "api /readyz"
wait_http 200 "$api/dashboard/" 60 || fail "api /dashboard/"

export SESSION_ID=P0.S2c-polish REGEN_COMMAND=scripts/evidence/P0.S2c-polish.sh IMAGE_COMMIT=$image_commit
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/evidence/dashboard-screens.mjs "$api/dashboard" "$out/screens"
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/evidence/storefront-screens.mjs "$STOREFRONT_HOST_PORT" "$work/storefront" "$work/storefront-table.md"
cp "$work"/storefront/*.png "$out/screens/"

# --- bearer-only client ------------------------------------------------------------------
# curl keeps no cookie jar and sends no Origin, like a native app. The token lives only in $work.
rm -rf "$out/api"
mkdir -p "$out/api"
transcript="$out/api/bearer-client.md"
printf '# Bearer-only Admin API client\n\nLive exchange against `%s`: no cookie and no `Origin` header. Tokens and the password are redacted (ADR 0017).\n\n' "$admin_api" >"$transcript"

login_query='mutation ($username: String!, $password: String!) { login(username: $username, password: $password) { __typename ... on CurrentUser { identifier } } }'
login_body=$(LOGIN_QUERY=$login_query node -e 'process.stdout.write(JSON.stringify({query:process.env.LOGIN_QUERY,variables:{username:process.env.SUPERADMIN_USERNAME,password:process.env.SUPERADMIN_PASSWORD}}))')
shown_login=$(LOGIN_QUERY=$login_query node -e 'process.stdout.write(JSON.stringify({query:process.env.LOGIN_QUERY,variables:{username:process.env.SUPERADMIN_USERNAME,password:"[REDACTED]"}}))')
status=$(curl -sS -X POST -H 'content-type: application/json' -d "$login_body" -D "$work/h1" -o "$work/b1" -w '%{http_code}' --max-time 20 "$admin_api")
[[ "$status" == 200 ]] || fail "login: status $status"
token=$(command grep -i '^vendure-auth-token:' "$work/h1" | command tail -1 | command cut -d: -f2- | command tr -d ' \r')
[[ -n "$token" ]] || fail "login returned no vendure-auth-token header"
SHOWN_HEADERS='content-type: application/json' SHOWN_BODY=$shown_login TITLE='Log in, no cookie and no Origin' METHOD=POST URL=$admin_api \
  node scripts/evidence/transcript.mjs "$work/h1" "$work/b1" "$transcript"

me_body='{"query":"query { me { identifier } }"}'
status=$(curl -sS -X POST -H 'content-type: application/json' -H "authorization: Bearer $token" -d "$me_body" -D "$work/h2" -o "$work/b2" -w '%{http_code}' --max-time 20 "$admin_api")
[[ "$status" == 200 ]] || fail "me: status $status"
command grep -qF "\"identifier\":\"$SUPERADMIN_USERNAME\"" "$work/b2" || fail "me did not return the signed-in user"
SHOWN_HEADERS=$'content-type: application/json\nauthorization: Bearer [REDACTED]' SHOWN_BODY=$me_body TITLE='Authenticated Admin API call with the bearer token only' METHOD=POST URL=$admin_api \
  node scripts/evidence/transcript.mjs "$work/h2" "$work/b2" "$transcript"

status=$(curl -sS -X POST -H 'content-type: application/json' -d "$me_body" -D "$work/h3" -o "$work/b3" -w '%{http_code}' --max-time 20 "$admin_api")
[[ "$status" == 200 ]] || fail "anonymous me: status $status"
! command grep -qF "$SUPERADMIN_USERNAME" "$work/b3" || fail "the anonymous call returned the user"
SHOWN_HEADERS='content-type: application/json' SHOWN_BODY=$me_body TITLE='The same call with no token is anonymous' METHOD=POST URL=$admin_api \
  node scripts/evidence/transcript.mjs "$work/h3" "$work/b3" "$transcript"

{
  printf '\n## Storefront stub\n\n| File | URL | Viewport | Status | Checked |\n| --- | --- | --- | --- | --- |\n'
  command cat "$work/storefront-table.md"
  printf '\n## Bearer-only client\n\n[`api/bearer-client.md`](api/bearer-client.md)\n'
} >>"$out/README.md"

# --- secret scan -------------------------------------------------------------------------
for secret in "${secret_values[@]}" "$token"; do
  if command grep -rqaF -- "$secret" "$out"; then
    fail "a raw secret or token appears in $out"
  fi
done
if command grep -rqaE 'Bearer [A-Za-z0-9_-]{16,}' "$out"; then
  fail "an unredacted bearer token appears in $out"
fi
echo "secret scan: clean ($out)"
echo "EVIDENCE-OK"
