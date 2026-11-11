#!/usr/bin/env bash
# Proof-of-working evidence for P1.S5 (CLAUDE.md §3a.14): runs the real compose stack under its own project (cod-evidence, host
# ports +20000), records `switchableStores` (owner, member, two businesses, an archived store, anonymous and a foreign
# token refused), `createStore` followed by the new store in the list, the merchant's stock `orders` refused, takes the
# merchant shell and superadmin screenshots, and tears everything down. Never touches `cod` or `cod-verify`.
#
#   timeout 1800 scripts/evidence/P1.S5.sh   # always builds cod-platform:local first
#
# Data is synthetic. Ids and channel tokens are placeholders after their use is asserted; passwords and session tokens are never written.
set -euo pipefail
cd "$(dirname "$0")/../.."
# shellcheck source=../lib/wait-http.sh
. scripts/lib/wait-http.sh

[[ -f .env ]] || { echo "evidence: .env is missing; cp .env.example .env" >&2; exit 1; }
set -a
. ./.env
set +a
export COMPOSE_PROJECT_NAME=cod-evidence
export POSTGRES_HOST_PORT=25433 PGBOUNCER_HOST_PORT=26432 VALKEY_HOST_PORT=26380 GARAGE_S3_HOST_PORT=23900
export MAILPIT_SMTP_HOST_PORT=21026 MAILPIT_UI_HOST_PORT=28026 API_HOST_PORT=23100 WORKER_HEALTH_HOST_PORT=23020
export STOREFRONT_HOST_PORT=23001 PLATFORM_DOMAIN=localhost
export APP_IMAGE=${APP_IMAGE:-cod-platform:local}
export AUTH_TOKEN_SECRET=${AUTH_TOKEN_SECRET:-evidence-auth-token-secret-synthetic-0123456789}
export SMTP_HOST=mailpit SMTP_PORT=1025 SMTP_FROM=no-reply@localhost AUTH_DASHBOARD_URL=http://127.0.0.1:$API_HOST_PORT/dashboard
# Set, not unset: compose would otherwise read a Gmail block from a local .env and require TLS from Mailpit.
export SMTP_TLS=none SMTP_USERNAME='' SMTP_PASSWORD=''
export DEMO_OWNER_PASSWORD=${DEMO_OWNER_PASSWORD:-evidence-demo-owner-password}
export EV_RUN=${EV_RUN:-$(date +%s)}

out=docs/evidence/P1.S5
api="http://127.0.0.1:$API_HOST_PORT"
work=$(mktemp -d)
SNOWFLAKE_RE='^[1-9][0-9]{15,18}$'
# Values are replaced anywhere in a transcript, so a short one would corrupt status codes and other digits.
MIN_PLACEHOLDER_VALUE_LENGTH=16

OWNER=owner@demo.example.test SECOND_OWNER=owner@second.example.test LIMITED=limited@demo.example.test

fail() { echo "EVIDENCE FAILED: $*" >&2; exit 1; }
on_exit() {
  local status=$?
  if ((status != 0)); then
    docker compose ps -a >&2 || true
    docker compose logs --no-color --tail=30 migrate api worker >&2 || true
  fi
  timeout 300 docker compose down -v --remove-orphans >/dev/null 2>&1 || timeout 300 docker compose down -v --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$work"
  exit "$status"
}
trap on_exit EXIT

container_of() { docker compose ps -aq "$1"; }
wait_healthy() {
  local deadline=$((SECONDS + 420)) svc pending
  while ((SECONDS < deadline)); do
    pending=""
    for svc in "$@"; do
      [[ $(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$(container_of "$svc")" 2>/dev/null) == healthy ]] || pending+=" $svc"
    done
    [[ -z "$pending" ]] && return 0
    sleep 3
  done
  fail "not healthy after 420s:$pending"
}

[[ -n "${SUPERADMIN_USERNAME:-}" && -n "${SUPERADMIN_PASSWORD:-}" && -n "${COOKIE_SECRET:-}" ]] || fail "SUPERADMIN_* or COOKIE_SECRET is empty"
secret_values=()
while IFS='=' read -r _ value; do
  value=${value%\"}; value=${value#\"}
  [[ -n "$value" ]] && secret_values+=("$value")
done < <(command grep -E '^(export[[:space:]]+)?[A-Z0-9_]*(PASSWORD|SECRET|TOKEN|_KEY)=' .env)
((${#secret_values[@]} >= 2)) || fail "fewer than 2 secret values in .env"

# --- image, from a tree that matches the commit the README names ---------------------------
# Browser tests and the workflow do not reach the image's build output; the evidence folders never do.
image_inputs=(. ':!docs/evidence' ':!scripts/evidence' ':!.superpowers' ':!apps/server/tests/browser' ':!.github/workflows/browser.yml')
dirty=$(git status --porcelain -- "${image_inputs[@]}")
[[ -z "$dirty" ]] || fail "uncommitted changes outside the evidence folders:
$dirty"
image_commit=$(git log -1 --format=%H -- "${image_inputs[@]}")
NEXT_DEPLOYMENT_ID="$(git rev-parse --short "$image_commit")"
export NEXT_DEPLOYMENT_ID
timeout 300 docker compose down -v --remove-orphans
timeout 600 docker compose build migrate
# A fresh Postgres volume can outlast its healthcheck on a loaded host (initdb's shutdown checkpoint took minutes under IO
# pressure), so it starts alone and is waited for; the second `up` try covers what is left.
# Under IO pressure the daemon can also take minutes to create containers; a try cut short leaves half-created ones whose
# names block the next, so they are removed before it.
APP_SERVICES=(api worker storefront mailpit)
timeout 300 docker compose up -d postgres
wait_healthy postgres
if ! timeout 480 docker compose up -d "${APP_SERVICES[@]}"; then
  timeout 300 docker compose rm -fsv "${APP_SERVICES[@]}" migrate pgbouncer
  timeout 480 docker compose up -d "${APP_SERVICES[@]}"
fi
wait_healthy api worker storefront
wait_http 200 "$api/readyz" 120 || fail "api /readyz"
wait_http 200 "$api/dashboard/" 60 || fail "api /dashboard/"

timeout 180 docker compose run --rm --no-deps -e DEMO_OWNER_PASSWORD --entrypoint node migrate apps/server/dist/main-seed-demo.js \
  >"$work/seed.log" 2>&1 || fail "the demo seed failed: $(command tail -20 "$work/seed.log")"
command grep -q "$LIMITED" "$work/seed.log" || fail "the seed did not create the members"

reset_limits() { # Every call from this host shares one client address.
  timeout 30 docker compose exec -T valkey sh -c "valkey-cli --scan --pattern 'rl:*' | xargs -r valkey-cli del" >/dev/null
}

rm -rf "$out/api" "$out/screens"
mkdir -p "$out/api" "$out/screens"

# --- helpers (as in P1.S3.sh) ----------------------------------------------------------------
js() { node -e 'const b=JSON.parse(require("fs").readFileSync(process.argv[2],"utf8")); const r=eval(process.argv[1]); console.log(typeof r==="string"?r:JSON.stringify(r))' "$1" "$2"; }
assert_js() { [[ "$(js "$2" "$3")" == true ]] || fail "$1: '$2' is not true for $(command cat "$3")"; }

declare -A PLACEHOLDERS=()
remember() {
  [[ -n "$2" && "$2" != undefined ]] || fail "remember $1: empty"
  ((${#2} >= MIN_PLACEHOLDER_VALUE_LENGTH)) || fail "remember $1: too short to replace safely"
  PLACEHOLDERS[$2]=$1
}
remember_id() { [[ "$2" =~ $SNOWFLAKE_RE ]] || fail "$1: not a snowflake id"; remember "$1" "$2"; }
normalise_file() {
  local map=""
  for k in "${!PLACEHOLDERS[@]}"; do map+="$k=${PLACEHOLDERS[$k]},"; done
  IDMAP=$map node -e '
const fs = require("fs");
let t = fs.readFileSync(process.argv[1], "utf8");
for (const [v, p] of process.env.IDMAP.split(",").filter(Boolean).map((e) => e.split("=")).sort((a, b) => b[0].length - a[0].length)) t = t.split(v).join("<" + p + ">");
fs.writeFileSync(process.argv[1], t);' "$1"
}

json='Content-Type: application/json'
begin() { printf '# %s\n\n%s\n\n' "$2" "$3" >"$1"; }
vars() { node -e 'console.log(JSON.stringify(eval("("+process.argv[1]+")")))' "$1"; }

status=000
gql() { # gql <query> <vars-json> <session|-> <channel|-> -> $status, $work/h, $work/b
  local body
  body=$(Q="$1" V="$2" node -e 'console.log(JSON.stringify({query:process.env.Q,variables:JSON.parse(process.env.V)}))')
  local -a args=(-sS -X POST -D "$work/h" -o "$work/b" --max-time 30 -H "$json" --data "$body")
  [[ "$3" != - ]] && args+=(-H "Authorization: Bearer $3")
  [[ "$4" != - ]] && args+=(-H "vendure-token: $4")
  status=$(curl "${args[@]}" -w '%{http_code}' "$api/admin-api?languageCode=en") || status=000
  [[ "$status" != 000 ]] || fail "no HTTP answer from $api"
}
shown_headers() {
  local -a shown=("$json")
  [[ "$1" != - ]] && shown+=("Authorization: Bearer [REDACTED]")
  [[ "$2" != - ]] && shown+=("vendure-token: [REDACTED]")
  printf '%s\n' "${shown[@]}"
}
emit() { # emit <file> <title> <query> <shown-vars> <session|-> <channel|->
  local shown_body
  shown_body=$(Q="$3" V="$4" node -e 'console.log(JSON.stringify({query:process.env.Q,variables:JSON.parse(process.env.V)}))')
  SHOWN_HEADERS=$(shown_headers "$5" "$6") SHOWN_BODY=$shown_body TITLE=$2 METHOD=POST URL="$api/admin-api?languageCode=en" \
    node scripts/evidence/transcript.mjs "$work/h" "$work/b" "$1"
}
expect_code() { assert_js "$1" "(b.errors||[]).some((e)=>e.extensions&&e.extensions.code==='$2')" "$work/b"; }
expect_ok() { assert_js "$1" '!b.errors' "$work/b"; }

session_tokens=() cookies=()
header_token() { command grep -i '^vendure-auth-token:' "$work/h" | command head -1 | command tr -d '\r' | command awk '{print $2}'; }
Q_LOGIN='mutation ($username: String!, $password: String!) { login(username: $username, password: $password) { __typename ... on CurrentUser { identifier } ... on ErrorResult { errorCode message } } }'
login() { # login <user> -> $LAST_TOKEN
  gql "$Q_LOGIN" "$(U="$1" P="$DEMO_OWNER_PASSWORD" node -e 'console.log(JSON.stringify({username:process.env.U,password:process.env.P}))')" - -
  assert_js "login $1" 'b.data.login.__typename==="CurrentUser"' "$work/b"
  LAST_TOKEN=$(header_token)
  [[ -n "$LAST_TOKEN" ]] || fail "login $1: no auth token header"
  session_tokens+=("$LAST_TOKEN")
  while read -r c; do [[ -n "$c" ]] && cookies+=("$c"); done < <(command grep -i '^set-cookie:' "$work/h" | command sed -E 's/^[^=]+=([^;[:space:]]+).*/\1/')
}

Q_ME='query { me { channels { token } } }'
Q_STORES='query { stores { id subdomain channelToken } }'
Q_SWITCHABLE='query { switchableStores { platformDomain stores { id businessId channelId name subdomain language } } }'
Q_CREATE='mutation ($input: CreateStoreInput!) { createStore(input: $input) { id businessId name subdomain language } }'
Q_ARCHIVE='mutation ($id: String!) { archiveStore(id: $id) { id name subdomain } }'
Q_ORDERS='query { orders { totalItems } }'

# --- sign-ins and stores ----------------------------------------------------------------------
reset_limits
login "$OWNER"; owner=$LAST_TOKEN
login "$SECOND_OWNER"; second_owner=$LAST_TOKEN
login "$LIMITED"; limited=$LAST_TOKEN

store_field() { # store_field <session> <subdomain> <field>
  local any
  gql "$Q_ME" '{}' "$1" -
  any=$(js 'b.data.me.channels[0].token' "$work/b")
  gql "$Q_STORES" '{}' "$1" "$any"
  js "b.data.stores.find((s)=>s.subdomain==='$2').$3" "$work/b"
}
demo=$(store_field "$owner" demo channelToken); second=$(store_field "$second_owner" second channelToken)
remember CHANNEL_DEMO "$demo"; remember CHANNEL_SECOND "$second"
demo_store=$(store_field "$owner" demo id); demo2_store=$(store_field "$owner" demo2 id)
second_store=$(store_field "$second_owner" second id); second2_store=$(store_field "$second_owner" second2 id)
remember_id STORE_DEMO "$demo_store"; remember_id STORE_DEMO2 "$demo2_store"
remember_id STORE_SECOND "$second_store"; remember_id STORE_SECOND2 "$second2_store"

# --- switchable-stores.md ---------------------------------------------------------------------
f="$out/api/switchable-stores.md"
begin "$f" "switchableStores" "The stores the caller can switch to: active stores of the active business on which the caller holds a role. No channel token is returned (D85)."
gql "$Q_SWITCHABLE" '{}' "$owner" "$demo"; expect_ok owner
assert_js owner "b.data.switchableStores.stores.map((s)=>s.id).join()==='$demo_store,$demo2_store'" "$work/b"
business_demo=$(js 'b.data.switchableStores.stores[0].businessId' "$work/b"); remember_id BUSINESS_DEMO "$business_demo"
assert_js owner "b.data.switchableStores.stores.every((s)=>s.businessId==='$business_demo')" "$work/b"
emit "$f" "The owner of business A: both stores" "$Q_SWITCHABLE" '{}' "$owner" "$demo"
gql "$Q_SWITCHABLE" '{}' "$second_owner" "$second"; expect_ok second
assert_js second "b.data.switchableStores.stores.map((s)=>s.id).join()==='$second_store,$second2_store'" "$work/b"
business_second=$(js 'b.data.switchableStores.stores[0].businessId' "$work/b"); remember_id BUSINESS_SECOND "$business_second"
[[ "$business_second" != "$business_demo" ]] || fail "both businesses have one id"
emit "$f" "The owner of business B: B's two stores, none of A's (asserted on the real ids)" "$Q_SWITCHABLE" '{}' "$second_owner" "$second"
gql "$Q_SWITCHABLE" '{}' "$limited" "$demo"; expect_ok member
assert_js member "b.data.switchableStores.stores.map((s)=>s.id).join()==='$demo_store'" "$work/b"
emit "$f" "A member with a role on one selected store: that store only" "$Q_SWITCHABLE" '{}' "$limited" "$demo"
gql "$Q_SWITCHABLE" '{}' - -; expect_code anonymous FORBIDDEN
emit "$f" "Anonymous: FORBIDDEN" "$Q_SWITCHABLE" '{}' - -
gql "$Q_SWITCHABLE" '{}' "$owner" "$second"; expect_code "foreign token" FORBIDDEN
emit "$f" "The owner of A with B's channel token: FORBIDDEN" "$Q_SWITCHABLE" '{}' "$owner" "$second"

# --- create-store.md --------------------------------------------------------------------------
f="$out/api/create-store.md"
begin "$f" "createStore, then the list; archiveStore, then the list" "A new store appears in \`switchableStores\`; once archived it is gone from it."
subdomain="ev${EV_RUN}"
input=$(vars "{input:{name:'Evidence store',subdomain:'$subdomain',language:'fr'}}")
gql "$Q_CREATE" "$input" "$owner" "$demo"; expect_ok create
created=$(js 'b.data.createStore.id' "$work/b"); remember_id STORE_CREATED "$created"
emit "$f" "createStore" "$Q_CREATE" "$input" "$owner" "$demo"
listed=false
for _ in 1 2 3 4 5 6 7 8 9 10; do # The creator's session can take a moment to hold the new channel (D87).
  gql "$Q_SWITCHABLE" '{}' "$owner" "$demo"; expect_ok "after create"
  [[ "$(js "b.data.switchableStores.stores.some((s)=>s.id==='$created')" "$work/b")" == true ]] && { listed=true; break; }
  sleep 1
done
[[ "$listed" == true ]] || fail "the new store is not switchable: $(command cat "$work/b")"
assert_js "after create" "b.data.switchableStores.stores.length===3" "$work/b"
emit "$f" "switchableStores: the new store is listed" "$Q_SWITCHABLE" '{}' "$owner" "$demo"
gql "$Q_ARCHIVE" "$(vars "{id:'$created'}")" "$owner" "$demo"; expect_ok archive
emit "$f" "archiveStore" "$Q_ARCHIVE" "$(vars "{id:'$created'}")" "$owner" "$demo"
gql "$Q_SWITCHABLE" '{}' "$owner" "$demo"; expect_ok "after archive"
assert_js "after archive" "b.data.switchableStores.stores.map((s)=>s.id).join()==='$demo_store,$demo2_store'" "$work/b"
emit "$f" "switchableStores: the archived store is absent" "$Q_SWITCHABLE" '{}' "$owner" "$demo"

# --- stock-refused.md -------------------------------------------------------------------------
f="$out/api/stock-refused.md"
begin "$f" "A merchant on a stock query" "Merchants hold only stock \`Authenticated\` (D59): the stock \`orders\` query answers FORBIDDEN whatever the dashboard shows."
gql "$Q_ORDERS" '{}' "$owner" "$demo"; expect_code "stock orders" FORBIDDEN
emit "$f" "orders, the owner of A on A's store: FORBIDDEN" "$Q_ORDERS" '{}' "$owner" "$demo"

# --- screens ----------------------------------------------------------------------------------
reset_limits
EV_FOREIGN_STORE_ID=$second_store timeout 900 node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/evidence/P1.S5-screens.mjs \
  "$api/dashboard" "$work/shots" >"$work/shots.txt" 2> >(command tee "$work/screens.log" >&2)
command cp "$work"/shots/*.png "$out/screens/"
shot_count=$(command ls "$out"/screens/*.png | command wc -l)
((shot_count == 88)) || fail "$shot_count screenshots, wanted 88"

# --- README -------------------------------------------------------------------------------------
{
  cat <<README
# Evidence for P1.S5 (admin shell, navigation and Arabic RTL)

Transcripts and screenshots from a live stack (CLAUDE.md §3a.14), produced by \`scripts/evidence/P1.S5.sh\`. Data is synthetic. Image
built from a tree with no uncommitted change outside the evidence folders and browser tests, last image-relevant commit
\`$image_commit\`. Compose project \`cod-evidence\`.

## API transcripts

| File | Shows |
| --- | --- |
| [\`api/switchable-stores.md\`](api/switchable-stores.md) | \`switchableStores\` for the owners of two businesses and a selected-store member; anonymous and a foreign channel token FORBIDDEN |
| [\`api/create-store.md\`](api/create-store.md) | \`createStore\`, the new store in \`switchableStores\`, \`archiveStore\`, the archived store absent |
| [\`api/stock-refused.md\`](api/stock-refused.md) | The merchant's stock \`orders\` query FORBIDDEN |

Store and business ids and channel tokens are placeholders; every assertion ran on the real values. Channel ids are the engine's small integers.

## Screenshots

\`screens/<screen>-<lang>-<viewport>-<theme>.png\`, for desktop (1280 px) and mobile (390 px), Arabic and English, light and dark:
\`home\`, \`sidebar\` (Finance open; on mobile the sidebar sheet), \`switcher-open\`, \`create-store\` (a taken address typed),
\`account-menu\`, \`settings\`, \`skeleton-leaf\` (\`/cod-orders/spam\`), \`store-leaf\` (\`/stores/active/products\`),
\`not-found-stock-route\` (\`/orders\`), \`not-found-other-business-store\` (\`/stores/<B's store id>/products\`), and
\`staff-nav\` (the superadmin; on mobile the sidebar sheet). $shot_count files.

## Browser assertions in \`scripts/evidence/P1.S5-screens.mjs\`

Each line below is a failing assertion in the script if it does not hold.

$(command sed -E 's/^/- /' <(command grep -v '^shot ' "$work/screens.log"))

README
  command cat scripts/evidence/P1.S5-seen.md
} >"$out/README.md"

# --- placeholders, sizes and redaction ------------------------------------------------------------
for t in "$out"/api/*.md; do normalise_file "$t"; done
if command grep -rqE '^HTTP/1\.1 [^0-9]' "$out/api"; then fail "a placeholder corrupted a status line"; fi
if command grep -rqE '^HTTP/1\.1 [0-9]{3}[^ 0-9]' "$out/api"; then fail "a placeholder corrupted a status line"; fi
for f in "$out"/screens/*.png; do
  (($(command stat -c %s "$f") <= 300 * 1024)) || fail "$f is over 300 KB"
done
((${#session_tokens[@]} >= 3)) || fail "the redaction check would be vacuous"
for secret in "${secret_values[@]}" "$AUTH_TOKEN_SECRET" "$DEMO_OWNER_PASSWORD" "$SUPERADMIN_PASSWORD" "${session_tokens[@]}" "${cookies[@]}" "$demo" "$second"; do
  if command grep -rqaF -- "$secret" "$out/api" "$out/README.md"; then fail "a raw secret or token appears in $out"; fi
done
node --input-type=module -e '
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { findBrandingViolations } from "./packages/config/gates/branding.ts";
const dir = process.argv[1];
const files = [join(dir, "README.md"), ...readdirSync(join(dir, "api")).map((n) => join(dir, "api", n))];
const bad = findBrandingViolations(files.map((path) => ({ path, content: readFileSync(path, "utf8") })));
if (bad.length > 0) { console.error(bad.join("\n")); process.exit(1); }' "$out" || fail "a banned name appears in $out"
echo "EVIDENCE-OK"
