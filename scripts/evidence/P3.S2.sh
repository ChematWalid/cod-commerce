#!/usr/bin/env bash
# Proof-of-working evidence for P3.S2 (CLAUDE.md §3a.14): runs the real compose stack under its own project (cod-evidence,
# host ports +20000), seeds the demo businesses, gives the English store (`demo2`) three products and a collection and the
# Arabic store a Darija-searchable product over the catalog Admin API, records every new storefront endpoint of the api and
# of the storefront (isolation 404s, the /api/store mismatch 400, the traversal 404, the revalidate route unsigned and
# signed, the tenant page headers, the unknown host), screenshots the Arabic, French and English stores on desktop and
# mobile, checks two `next start` instances sharing one Valkey (P3.S2-cache.sh), screenshots the compact theme, and tears
# the project down. Never touches `cod` or `cod-verify`.
#
#   flock -w 3600 /tmp/cod-heavy-jobs.lock timeout 2400 bash scripts/evidence/P3.S2.sh
#   EV_SKIP_BUILD=1 flock -w 3600 /tmp/cod-heavy-jobs.lock timeout 2400 bash scripts/evidence/P3.S2.sh
#
# It builds cod-platform:local unless EV_SKIP_BUILD=1 and cod-platform:evidence-<last image commit> exists (an image an
# evidence script built from the same commit), which it then reuses.
#
# Data is synthetic. Store and business ids, channel tokens and host bindings are placeholders after their use is asserted
# (product ids are the engine's small integers and stay); passwords, session tokens and signatures are never written.
set -euo pipefail
cd "$(dirname "$0")/../.."
# shellcheck source=../lib/wait-http.sh
. scripts/lib/wait-http.sh

[[ -f .env ]] || { echo "evidence: .env is missing; cp .env.example .env" >&2; exit 1; }
set -a
. ./.env
set +a
export COMPOSE_PROJECT_NAME=cod-evidence
export INTERNAL_HMAC_KEYS=${INTERNAL_HMAC_KEYS:-k1:evidence-internal-hmac-key-synthetic-0000000001} INTERNAL_HMAC_ACTIVE_KID=${INTERNAL_HMAC_ACTIVE_KID:-k1}
export TENANT_SECRET_KEKS=${TENANT_SECRET_KEKS:-k1:3a5c7e9f1b2d4f60718293a4b5c6d7e8f9a0b1c2d3e4f5061728394a5b6c7d8e} TENANT_SECRET_ACTIVE_KID=${TENANT_SECRET_ACTIVE_KID:-k1}
# The .env.example placeholder (accepted in development, refused when deployed): never a minted key.
: "${QUOTE_HMAC_KEYS:=k1:change-me-quote-hmac-00000000000000000000000000}"
: "${QUOTE_HMAC_ACTIVE_KID:=k1}"
export QUOTE_HMAC_KEYS QUOTE_HMAC_ACTIVE_KID
export POSTGRES_HOST_PORT=25433 PGBOUNCER_HOST_PORT=26432 VALKEY_HOST_PORT=26380 GARAGE_S3_HOST_PORT=23900
export MAILPIT_SMTP_HOST_PORT=21026 MAILPIT_UI_HOST_PORT=28026 API_HOST_PORT=23100 WORKER_HEALTH_HOST_PORT=23020
export STOREFRONT_HOST_PORT=23001 PLATFORM_DOMAIN=localhost
# Instance B of the two-instance check and the compact-theme instance (P3.S2-cache.sh).
export STOREFRONT_B_HOST_PORT=23002 STOREFRONT_COMPACT_HOST_PORT=23003
export APP_IMAGE=${APP_IMAGE:-cod-platform:local}
export AUTH_TOKEN_SECRET=${AUTH_TOKEN_SECRET:-evidence-auth-token-secret-synthetic-0123456789}
export SMTP_HOST=mailpit SMTP_PORT=1025 SMTP_FROM=no-reply@localhost AUTH_DASHBOARD_URL=http://127.0.0.1:$API_HOST_PORT/dashboard
# Set, not unset: compose would otherwise read a Gmail block from a local .env and require TLS from Mailpit.
export SMTP_TLS=none SMTP_USERNAME='' SMTP_PASSWORD=''
export DEMO_OWNER_PASSWORD=${DEMO_OWNER_PASSWORD:-evidence-demo-owner-password}
# The browser loads product images from the api's asset server on the host (D3209); the storefront only builds the URLs.
export STOREFRONT_ASSET_BASE="http://127.0.0.1:$API_HOST_PORT/assets" STOREFRONT_THEME=default
# Teardown removes this project's volumes: refuse to run under any other project name.
[[ "$COMPOSE_PROJECT_NAME" == cod-evidence ]] || { echo "evidence: wrong compose project" >&2; exit 1; }

out=docs/evidence/P3.S2
api="http://127.0.0.1:$API_HOST_PORT"
site="http://127.0.0.1:$STOREFRONT_HOST_PORT"
work=$(mktemp -d)
SNOWFLAKE_RE='^[1-9][0-9]{15,18}$'
# Values are replaced anywhere in a transcript, so a short one would corrupt status codes and other digits.
MIN_PLACEHOLDER_VALUE_LENGTH=16
# Nine from P3.S2-api.sh, then two-instances.md from P3.S2-cache.sh.
API_TRANSCRIPT_COUNT=9 TRANSCRIPT_COUNT=10
# 3 stores x 9 pages x {desktop, mobile}, plus the compact-theme home of the Arabic and English stores x 2 viewports.
SCREEN_COUNT=58
# The worker fills the projection from the outbox (D3205); a fresh stack needs a minute.
PROJECTION_WAIT_SECONDS=240

OWNER=owner@demo.example.test SECOND_OWNER=owner@second.example.test
export DEMO_HOST=demo.localhost SECOND_HOST=second.localhost EN_HOST=demo2.localhost UNKNOWN_HOST=nope.localhost
export DEMO_NAME='Demo Store' SECOND_NAME='Second Store' EN_NAME='Demo Store 2'

fail() {
  echo "EVIDENCE FAILED: $*" >&2
  # EV_DEBUG_DIR keeps the last exchange of a failed run for a look afterwards.
  if [[ -n "${EV_DEBUG_DIR:-}" ]]; then mkdir -p "$EV_DEBUG_DIR" && command cp -f "$work"/h "$work"/b "$EV_DEBUG_DIR"/ 2>/dev/null || true; fi
  exit 1
}
on_exit() {
  local status=$?
  if ((status != 0)); then
    docker compose ps -a >&2 || true
    docker compose logs --no-color --tail=40 api worker storefront >&2 || true
  fi
  # EV_KEEP_ON_FAIL=1 leaves a failed run's stack up to look at; the next run removes it first.
  if ((status != 0)) && [[ "${EV_KEEP_ON_FAIL:-}" == 1 ]]; then rm -rf "$work"; exit "$status"; fi
  docker rm -f cod-evidence-storefront-b cod-evidence-storefront-compact >/dev/null 2>&1 || true
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
  # Key lists are "kid:key"; the key alone is what could leak.
  [[ "$value" == *:* ]] && secret_values+=("${value#*:}")
done < <(command grep -E '^(export[[:space:]]+)?[A-Z0-9_]*(PASSWORD|SECRET|TOKEN|_KEY|_KEYS|_KEKS)=' .env)
((${#secret_values[@]} >= 2)) || fail "fewer than 2 secret values in .env"
# The keys this run signs and encrypts with, whether they came from .env or from the defaults above.
for key_list in "$QUOTE_HMAC_KEYS" "$INTERNAL_HMAC_KEYS" "$TENANT_SECRET_KEKS"; do
  IFS=',' read -ra entries <<<"$key_list"
  for entry in "${entries[@]}"; do secret_values+=("${entry#*:}"); done
done

# --- image, from a tree that matches the commit the README names ---------------------------
# docs are dockerignored; browser tests, the workflow and the evidence folders never reach the image's build output.
image_inputs=(. ':!docs' ':!scripts/evidence' ':!.superpowers' ':!apps/server/tests/browser' ':!.github/workflows/browser.yml')
dirty=$(git status --porcelain -- "${image_inputs[@]}")
[[ -z "$dirty" ]] || fail "uncommitted changes outside the evidence folders:
$dirty"
image_commit=$(git log -1 --format=%H -- "${image_inputs[@]}")
NEXT_DEPLOYMENT_ID="$(git rev-parse --short "$image_commit")"
export NEXT_DEPLOYMENT_ID
docker rm -f cod-evidence-storefront-b cod-evidence-storefront-compact >/dev/null 2>&1 || true
timeout 300 docker compose down -v --remove-orphans
# EV_SKIP_BUILD=1 reuses an image an evidence script built from the same commit (tagged below); anything else builds.
built_tag="cod-platform:evidence-$NEXT_DEPLOYMENT_ID"
if [[ "${EV_SKIP_BUILD:-}" == 1 && "$APP_IMAGE" == cod-platform:local ]] && docker image inspect "$built_tag" >/dev/null 2>&1; then
  echo "reusing $built_tag (EV_SKIP_BUILD=1)"
  docker tag "$built_tag" "$APP_IMAGE"
else
  started=$SECONDS
  timeout 1500 docker compose build migrate
  docker tag "$APP_IMAGE" "$built_tag"
  echo "image built in $((SECONDS - started))s"
fi
# A fresh Postgres volume can outlast its healthcheck on a loaded host, so it starts alone and is waited for; a half-created
# try leaves containers whose names block the next, so they are removed before it.
APP_SERVICES=(api worker storefront)
timeout 300 docker compose up -d postgres
wait_healthy postgres
if ! timeout 480 docker compose up -d "${APP_SERVICES[@]}"; then
  timeout 300 docker compose rm -fsv "${APP_SERVICES[@]}" migrate pgbouncer
  timeout 480 docker compose up -d "${APP_SERVICES[@]}"
fi
wait_healthy api worker storefront
wait_http 200 "$api/readyz" 120 || fail "api /readyz"
wait_http 200 "$site/livez" 60 || fail "storefront /livez"
deployment_id=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$(container_of storefront)" | command grep '^NEXT_DEPLOYMENT_ID=' | command cut -d= -f2-)
[[ "$deployment_id" == "$NEXT_DEPLOYMENT_ID" ]] || fail "the storefront runs deployment '$deployment_id', expected '$NEXT_DEPLOYMENT_ID'"

# A loaded host can take minutes to boot the seed (Vendure bootstrap plus image uploads).
timeout 900 docker compose run --rm --no-deps -e DEMO_OWNER_PASSWORD --entrypoint node migrate apps/server/dist/main-seed-demo.js \
  >"$work/seed.log" 2>&1 || fail "the demo seed failed: $(command tail -20 "$work/seed.log")"

reset_limits() { # Every call from this host shares one client address.
  timeout 30 docker compose exec -T valkey sh -c "valkey-cli --scan --pattern 'rl:*' | xargs -r valkey-cli del" >/dev/null
}

rm -rf "$out/api" "$out/screens"
mkdir -p "$out/api" "$out/screens"

# --- helpers (as in P2.S5.sh) ------------------------------------------------------------------
js() { node -e 'const b=JSON.parse(require("fs").readFileSync(process.argv[2],"utf8")); const r=eval(process.argv[1]); console.log(typeof r==="string"?r:JSON.stringify(r))' "$1" "$2"; }
assert_js() { [[ "$(js "$2" "$3")" == true ]] || fail "$1: '$2' is not true for $(command head -c 2000 "$3")"; }

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
urlencode() { node -e 'console.log(encodeURIComponent(process.argv[1]))' "$1"; }

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
MULTIPART_MAP='{"0":["variables.file"]}'
upload() { # upload <query> <file> <type> <name> <session> <channel> -> $status, $work/h, $work/b
  local operations
  operations=$(Q="$1" node -e 'console.log(JSON.stringify({query:process.env.Q,variables:{file:null}}))')
  status=$(curl -sS -X POST -D "$work/h" -o "$work/b" --max-time 60 -H "Authorization: Bearer $5" -H "vendure-token: $6" \
    -H 'apollo-require-preflight: true' -F "operations=$operations" -F "map=$MULTIPART_MAP" \
    -F "0=@$2;type=$3;filename=$4" -w '%{http_code}' "$api/admin-api?languageCode=en") || status=000
  [[ "$status" != 000 ]] || fail "no HTTP answer from $api (upload)"
}
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
Q_STORES='query { stores { id businessId subdomain channelToken } }'
store_field() { # store_field <session> <subdomain> <field>
  local any
  gql "$Q_ME" '{}' "$1" -
  any=$(js 'b.data.me.channels[0].token' "$work/b")
  gql "$Q_STORES" '{}' "$1" "$any"
  js "b.data.stores.find((s)=>s.subdomain==='$2').$3" "$work/b"
}

# --- signed calls of the api and the storefront (cod-internal-v1, ADR 0008) ---------------------
# Signed with @cod/shared/internal-auth as the server package resolves it (its built output, so a call takes milliseconds
# rather than a ts-node start); a signature is accepted for 60 seconds.
SIGN_ARGS=() SIGN_SHOWN=''
sign_for() { # sign_for <method> <path-with-query> <store-id|-> [body-file] -> SIGN_ARGS, SIGN_SHOWN
  local lines line
  lines=$(M="$1" P="$2" S="$3" F="${4:-}" node -e '
const { createRequire } = require("module");
const { readFileSync } = require("fs");
const { parseInternalKeys, signInternalRequest } = createRequire(require("path").resolve("apps/server/package.json"))("@cod/shared/internal-auth");
const e = process.env;
const key = parseInternalKeys(e.INTERNAL_HMAC_KEYS).find((k) => k.kid === e.INTERNAL_HMAC_ACTIVE_KID);
if (!key) throw new Error("the active kid is not among INTERNAL_HMAC_KEYS");
const request = { method: e.M, pathWithQuery: e.P, body: e.F ? readFileSync(e.F) : "", ...(e.S === "-" ? {} : { storeId: e.S }) };
for (const [k, v] of Object.entries(signInternalRequest(request, key, Date.now() / 1000))) console.log(k + ": " + v);')
  SIGN_ARGS=()
  while IFS= read -r line; do [[ -n "$line" ]] && SIGN_ARGS+=(-H "$line"); done <<<"$lines"
  ((${#SIGN_ARGS[@]} >= 6)) || fail "signing $1 $2 produced no headers"
  SIGN_SHOWN=$'x-internal-kid: '"$INTERNAL_HMAC_ACTIVE_KID"$'\nx-internal-ts: <unix seconds>\nx-internal-sig: [REDACTED]'
  [[ "$3" != - ]] && SIGN_SHOWN+=$'\nx-store-id: '"$3"
  return 0
}
api_get() { # api_get <path> <store-id|-|unsigned> -> $status, $work/h, $work/b, SHOWN
  local -a args=(-sS -D "$work/h" -o "$work/b" --max-time 30)
  SHOWN=''
  if [[ "$2" != unsigned ]]; then sign_for GET "$1" "$2"; args+=("${SIGN_ARGS[@]}"); SHOWN=$SIGN_SHOWN; fi
  status=$(curl "${args[@]}" -w '%{http_code}' "$api$1") || status=000
  [[ "$status" != 000 ]] || fail "no HTTP answer from $api$1"
}
emit_api() { # emit_api <file> <title> <path>: the last api_get, its signature headers redacted
  SHOWN_HEADERS=$SHOWN SHOWN_BODY=- TITLE=$2 METHOD=GET URL="$api$3" node scripts/evidence/transcript.mjs "$work/h" "$work/b" "$1"
}
expect_status() { [[ "$status" == "$2" ]] || fail "$1: HTTP $status, wanted $2: $(command head -c 1500 "$work/b")"; }

# site_get <base-url> <path> <host> [extra header...] -> $status, $work/h, $work/b (the storefront, by Host header)
site_get() {
  local base=$1 path=$2 host=$3
  shift 3
  local -a args=(-sS -D "$work/h" -o "$work/b" --max-time 60 -H "Host: $host")
  local hdr
  for hdr in "$@"; do args+=(-H "$hdr"); done
  status=$(curl "${args[@]}" -w '%{http_code}' "$base$path") || status=000
  [[ "$status" != 000 ]] || fail "no HTTP answer from $base$path"
}
# emit_site <file> <title> <method> <url> <trim-pattern|-> <shown-headers> <shown-body|->: with a trim pattern (grep -E) the
# transcript shows only the matching part of an HTML body; every check runs on the whole body before.
emit_site() {
  if [[ "$5" != - ]]; then
    command grep -oE -- "$5" "$work/b" | command head -3 >"$work/b.trim" || true
    [[ -s "$work/b.trim" ]] || fail "$2: body has nothing matching '$5'"
    command mv "$work/b.trim" "$work/b"
  fi
  SHOWN_HEADERS=$6 SHOWN_BODY=$7 TITLE=$2 METHOD=$3 URL=$4 node scripts/evidence/transcript.mjs "$work/h" "$work/b" "$1"
}

# --- sign-ins and stores ----------------------------------------------------------------------
reset_limits
login "$OWNER"; owner=$LAST_TOKEN
login "$SECOND_OWNER"; second_owner=$LAST_TOKEN
demo=$(store_field "$owner" demo channelToken); en=$(store_field "$owner" demo2 channelToken)
second=$(store_field "$second_owner" second channelToken)
remember CHANNEL_DEMO "$demo"; remember CHANNEL_EN "$en"; remember CHANNEL_SECOND "$second"
demo_store=$(store_field "$owner" demo id); en_store=$(store_field "$owner" demo2 id)
second_store=$(store_field "$second_owner" second id)
remember_id STORE_DEMO "$demo_store"; remember_id STORE_EN "$en_store"; remember_id STORE_SECOND "$second_store"
demo_business=$(store_field "$owner" demo businessId); second_business=$(store_field "$second_owner" second businessId)
remember_id BUSINESS_DEMO "$demo_business"; remember_id BUSINESS_SECOND "$second_business"
export EV_DEMO_STORE_ID=$demo_store EV_SECOND_STORE_ID=$second_store EV_EN_STORE_ID=$en_store

# shellcheck source=P3.S2-api.sh
. scripts/evidence/P3.S2-api.sh
transcripts=$(command ls "$out"/api/*.md | command wc -l)
((transcripts == API_TRANSCRIPT_COUNT)) || fail "$transcripts transcripts, wanted $API_TRANSCRIPT_COUNT"

# --- screens (instance A, default theme) ---------------------------------------------------------
reset_limits
timeout 1200 node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/evidence/P3.S2-screens.mjs \
  "$STOREFRONT_HOST_PORT" "$work/shots" stores >"$work/shots.txt" 2> >(command tee "$work/screens.log" >&2)

# --- two instances on one Valkey, then the compact theme -------------------------------------------
# shellcheck source=P3.S2-cache.sh
. scripts/evidence/P3.S2-cache.sh
transcripts=$(command ls "$out"/api/*.md | command wc -l)
((transcripts == TRANSCRIPT_COUNT)) || fail "$transcripts transcripts, wanted $TRANSCRIPT_COUNT"
timeout 600 node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/evidence/P3.S2-screens.mjs \
  "$STOREFRONT_COMPACT_HOST_PORT" "$work/shots" compact >>"$work/shots.txt" 2> >(command tee -a "$work/screens.log" >&2)
command cp "$work"/shots/*.png "$out/screens/"
shot_count=$(command ls "$out"/screens/*.png | command wc -l)
((shot_count == SCREEN_COUNT)) || fail "$shot_count screenshots, wanted $SCREEN_COUNT"

# --- README -------------------------------------------------------------------------------------
{
  command cat <<README
# Evidence for P3.S2 (storefront skeleton)

Transcripts, timings and screenshots from a live stack (CLAUDE.md §3a.14), produced by \`scripts/evidence/P3.S2.sh\`
(with \`P3.S2-api.sh\`, \`P3.S2-cache.sh\` and \`P3.S2-screens.mjs\`); nothing here is hand-written except the "What was seen"
notes. Data is synthetic: the demo seed's businesses and stores (\`$DEMO_HOST\` Arabic, \`$SECOND_HOST\` French, each with the
seed's products and two collections), plus what the script writes over the catalog Admin API: three English products with
images and a manual collection in \`$EN_HOST\` (\`$EN_NAME\`, English, empty after the seed) and one Arabic product
(\`$DARIJA_TITLE\`) in \`$DEMO_HOST\` for the Latin-script Darija search.

- Image \`cod-platform:local\` (tagged \`$built_tag\`), from a tree with no uncommitted change outside docs and the evidence
  folders, last image-relevant commit \`$image_commit\`; the running storefront's \`NEXT_DEPLOYMENT_ID\` is \`$deployment_id\`.
- Compose project \`cod-evidence\`: api, worker, storefront (instance A, host port $STOREFRONT_HOST_PORT), plus a second
  instance B of the same storefront service on $STOREFRONT_B_HOST_PORT and a compact-theme instance on
  $STOREFRONT_COMPACT_HOST_PORT (its own Valkey database, so its pages never share entries with the default theme's).
- Images are served by the api's asset server (\`STOREFRONT_ASSET_BASE=$STOREFRONT_ASSET_BASE\`).

## API transcripts

Store, business and channel ids and host bindings are placeholders (\`<STORE_DEMO>\`, …); every assertion ran on the real
values. Signed calls show the signature headers redacted. HTML bodies are cut by the script to the element that identifies
the page; the checks ran on the whole body.

| File | Shows |
| --- | --- |
| [\`api/store-resolve.md\`](api/store-resolve.md) | \`GET /store/resolve?host=\` signed: the three stores with language, direction, primary host and settings; an unknown host 404; an unsigned call 404 |
| [\`api/store-products.md\`](api/store-products.md) | \`GET /store/products\` signed for the Arabic and the English store (each its own products only), \`sort=price-asc\`, unsigned 404 |
| [\`api/store-product.md\`](api/store-product.md) | \`GET /store/product/:slug\`: the Arabic store's product (options, variants, images); the same slug signed for the French store 404; a draft's slug 404 |
| [\`api/store-search.md\`](api/store-search.md) | \`GET /store/product/search\`: Arabic without and with diacritics (same hits), Latin-script Darija \`serwal\` finding \`$DARIJA_TITLE\`; the Arabic word signed for the French store finds none of the Arabic store's products |
| [\`api/store-collections.md\`](api/store-collections.md) | \`GET /store/collections\` and \`GET /store/collection/:slug\` for the Arabic store; the same slug for the French store 404 |
| [\`api/storefront-pages.md\`](api/storefront-pages.md) | Tenant pages by \`Host\`: each store's home and products page 200 with \`cloudflare-cdn-cache-control\` and no \`set-cookie\`; unknown host 404; spoofed \`X-Forwarded-Host\` ignored |
| [\`api/storefront-isolation.md\`](api/storefront-isolation.md) | The French store's tenant path \`/_t/fr/<STORE_SECOND>/<BINDING_SECOND>\` (as written and \`%5F\`-encoded) on the Arabic host 404; the Arabic product's slug on the French host: the not-found page |
| [\`api/storefront-store-api.md\`](api/storefront-store-api.md) | \`/api/store/products\` on the Arabic host (its products, \`private, no-store\`), another store's \`storeId\` on the French host 400 empty, \`/api/store/product/..%2F..%2Fshop-api\` 404 empty |
| [\`api/storefront-revalidate.md\`](api/storefront-revalidate.md) | \`POST /api/internal/revalidate\` unsigned 404 empty, signed with a malformed body 400, signed 200 |
| [\`api/two-instances.md\`](api/two-instances.md) | Two \`next start\` instances on one Valkey: a page rendered on A is served by B from the shared cache; a signed revalidation on A refreshes B, with timings |

## Screenshots

\`screens/<store>-<page>-<viewport>.png\`: stores \`ar\` (\`$DEMO_HOST\`, RTL), \`fr\` (\`$SECOND_HOST\`) and \`en\` (\`$EN_HOST\`);
pages \`home\`, \`products\`, \`product\` (a second option picked in the variant picker), \`category\`, \`search\`, \`cart\` (after
"add to cart"), \`checkout\`, \`success\` and \`404\`; desktop 1280 × 800 and mobile 390 × 844 (scale 2, touch). Plus
\`compact-ar-home-*\` and \`compact-en-home-*\`: the same build with \`STOREFRONT_THEME=compact\` and no code change. Viewport
shots, \`reducedMotion: reduce\`. $shot_count files, each at most 300 KB.

## Browser assertions in \`scripts/evidence/P3.S2-screens.mjs\`

$(command sed -E 's/^/- /' <(command grep -v '^shot ' "$work/screens.log" | LC_ALL=C sort -u))

README
  command cat scripts/evidence/P3.S2-seen.md
} >"$out/README.md"

# --- placeholders, sizes and redaction ------------------------------------------------------------
for t in "$out"/api/*.md; do normalise_file "$t"; done
if command grep -rqE '^HTTP/1\.1 [^0-9]' "$out/api"; then fail "a placeholder corrupted a status line"; fi
if command grep -rqE '^HTTP/1\.1 [0-9]{3}[^ 0-9]' "$out/api"; then fail "a placeholder corrupted a status line"; fi
for f in "$out"/screens/*.png; do
  (($(command stat -c %s "$f") <= 300 * 1024)) || fail "$f is over 300 KB"
done
((${#session_tokens[@]} >= 2)) || fail "the redaction check would be vacuous"
for secret in "${secret_values[@]}" "$AUTH_TOKEN_SECRET" "$DEMO_OWNER_PASSWORD" "$SUPERADMIN_PASSWORD" "${session_tokens[@]}" "${cookies[@]}" "$demo" "$second" "$en"; do
  if command grep -rqaF -- "$secret" "$out/api" "$out/README.md"; then fail "a raw secret or token appears in $out"; fi
done
for id in "$demo_store" "$second_store" "$en_store" "$demo_business" "$second_business"; do
  if command grep -rqaF -- "$id" "$out/api" "$out/README.md"; then fail "a raw business or store id appears in $out"; fi
done
if command grep -rqiE 'x-internal-sig: [^[]' "$out/api"; then fail "a signature appears in $out"; fi
node --input-type=module -e '
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { findBrandingViolations } from "./packages/config/gates/branding.ts";
const dir = process.argv[1];
const files = [join(dir, "README.md"), ...readdirSync(join(dir, "api")).map((n) => join(dir, "api", n))];
const bad = findBrandingViolations(files.map((path) => ({ path, content: readFileSync(path, "utf8") })));
if (bad.length > 0) { console.error(bad.join("\n")); process.exit(1); }' "$out" || fail "a banned name appears in $out"
echo "EVIDENCE-OK"
