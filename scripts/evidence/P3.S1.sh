#!/usr/bin/env bash
# Proof-of-working evidence for P3.S1 (CLAUDE.md §3a.14), copied from P2.S5.sh: runs the real compose stack under its own
# project (cod-evidence, host ports +20000), whose `migrate` converges the 69 wilayas and every store's default table
# (D3116, D3112), seeds the demo businesses, records the public and signed wilaya endpoints and every fee-group endpoint
# over REST and GraphQL with the store links and cross-business refusals, quotes a delivery in process through the
# delivery-pricing service and the offers' pricing core (P3.S1-quote.ts), takes the Delivery Pricing and store settings
# screenshots and tears the project down. Never touches `cod` or `cod-verify`.
#
#   flock -w 3600 /tmp/cod-heavy-jobs.lock timeout 2400 scripts/evidence/P3.S1.sh
#   EV_SKIP_BUILD=1 flock -w 3600 /tmp/cod-heavy-jobs.lock timeout 2400 scripts/evidence/P3.S1.sh
#
# It builds cod-platform:local unless EV_SKIP_BUILD=1 and cod-platform:evidence-<last image commit> exists (an image an
# evidence script built from the same commit), which it then reuses.
#
# Data is synthetic. Fee-group, business and store ids are placeholders after their use is asserted (product and variant
# ids are the engine's small integers and stay); passwords, session tokens, channel tokens and signatures are never written.
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
export APP_IMAGE=${APP_IMAGE:-cod-platform:local}
export AUTH_TOKEN_SECRET=${AUTH_TOKEN_SECRET:-evidence-auth-token-secret-synthetic-0123456789}
export SMTP_HOST=mailpit SMTP_PORT=1025 SMTP_FROM=no-reply@localhost AUTH_DASHBOARD_URL=http://127.0.0.1:$API_HOST_PORT/dashboard
# Set, not unset: compose would otherwise read a Gmail block from a local .env and require TLS from Mailpit.
export SMTP_TLS=none SMTP_USERNAME='' SMTP_PASSWORD=''
export DEMO_OWNER_PASSWORD=${DEMO_OWNER_PASSWORD:-evidence-demo-owner-password}
# Teardown removes this project's volumes: refuse to run under any other project name.
[[ "$COMPOSE_PROJECT_NAME" == cod-evidence ]] || { echo "evidence: wrong compose project" >&2; exit 1; }

out=docs/evidence/P3.S1
api="http://127.0.0.1:$API_HOST_PORT"
work=$(mktemp -d)
SNOWFLAKE_RE='^[1-9][0-9]{15,18}$'
# Values are replaced anywhere in a transcript, so a short one would corrupt status codes and other digits.
MIN_PLACEHOLDER_VALUE_LENGTH=16
# 12 over HTTP (P3.S1-api.sh) and 2 in process (P3.S1-quote.ts).
TRANSCRIPT_COUNT=14
# 6 screens x {ar, en} x {desktop, mobile}.
SCREEN_COUNT=24
# The two owners' API sign-ins (the screens sign in on their own): the redaction check needs both tokens to mean anything.
SIGN_IN_COUNT=2

OWNER=owner@demo.example.test SECOND_OWNER=owner@second.example.test

fail() { echo "EVIDENCE FAILED: $*" >&2; exit 1; }
on_exit() {
  local status=$?
  if ((status != 0)); then
    docker compose ps -a >&2 || true
    docker compose logs --no-color --tail=40 migrate api worker >&2 || true
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
# Browser tests and the workflow do not reach the image's build output; the evidence folders never do.
image_inputs=(. ':!docs/evidence' ':!scripts/evidence' ':!.superpowers' ':!apps/server/tests/browser' ':!.github/workflows/browser.yml')
dirty=$(git status --porcelain -- "${image_inputs[@]}")
[[ -z "$dirty" ]] || fail "uncommitted changes outside the evidence folders:
$dirty"
image_commit=$(git log -1 --format=%H -- "${image_inputs[@]}")
NEXT_DEPLOYMENT_ID="$(git rev-parse --short "$image_commit")"
export NEXT_DEPLOYMENT_ID
timeout 300 docker compose down -v --remove-orphans
# EV_SKIP_BUILD=1 reuses an image an evidence script built from the same commit (tagged below); anything else builds.
built_tag="cod-platform:evidence-$NEXT_DEPLOYMENT_ID"
if [[ "${EV_SKIP_BUILD:-}" == 1 && "$APP_IMAGE" == cod-platform:local ]] && docker image inspect "$built_tag" >/dev/null 2>&1; then
  echo "reusing $built_tag (EV_SKIP_BUILD=1)"
  docker tag "$built_tag" "$APP_IMAGE"
else
  timeout 1500 docker compose build migrate
  docker tag "$APP_IMAGE" "$built_tag"
fi
# A fresh Postgres volume can outlast its healthcheck on a loaded host, so it starts alone and is waited for; a half-created
# try leaves containers whose names block the next, so they are removed before it. No storefront: no screen here is one.
APP_SERVICES=(api worker mailpit)
timeout 300 docker compose up -d postgres
wait_healthy postgres
if ! timeout 480 docker compose up -d "${APP_SERVICES[@]}"; then
  timeout 300 docker compose rm -fsv "${APP_SERVICES[@]}" migrate pgbouncer
  timeout 480 docker compose up -d "${APP_SERVICES[@]}"
fi
wait_healthy api worker
wait_http 200 "$api/readyz" 120 || fail "api /readyz"
wait_http 200 "$api/dashboard/" 60 || fail "api /dashboard/"

# A loaded host can take minutes to boot the seed and close it (as in P3.S2.sh).
timeout 900 docker compose run --rm --no-deps -e DEMO_OWNER_PASSWORD --entrypoint node migrate apps/server/dist/main-seed-demo.js \
  >"$work/seed.log" 2>&1 || fail "the demo seed failed: $(command tail -20 "$work/seed.log")"

reset_limits() { # Every call from this host shares one client address.
  timeout 30 docker compose exec -T valkey sh -c "valkey-cli --scan --pattern 'rl:*' | xargs -r valkey-cli del" >/dev/null
}

rm -rf "$out/api" "$out/screens"
mkdir -p "$out/api" "$out/screens"

# --- helpers (as in P2.S1.sh) ------------------------------------------------------------------
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
shown_headers() { # shown_headers <session|-> <channel|-> <content-type|->
  local -a shown=()
  [[ "$3" != - ]] && shown+=("$3")
  [[ "$1" != - ]] && shown+=("Authorization: Bearer [REDACTED]")
  [[ "$2" != - ]] && shown+=("vendure-token: [REDACTED]")
  ((${#shown[@]} == 0)) || printf '%s\n' "${shown[@]}"
}
emit() { # emit <file> <title> <query> <shown-vars> <session|-> <channel|->
  local shown_body
  shown_body=$(Q="$3" V="$4" node -e 'console.log(JSON.stringify({query:process.env.Q,variables:JSON.parse(process.env.V)}))')
  SHOWN_HEADERS=$(shown_headers "$5" "$6" "$json") SHOWN_BODY=$shown_body TITLE=$2 METHOD=POST URL="$api/admin-api?languageCode=en" \
    node scripts/evidence/transcript.mjs "$work/h" "$work/b" "$1"
}
LAST_SESSION=- LAST_CHANNEL=-
rest() { # rest <method> <path> <body|-> <session|-> <channel|-> -> $status, $work/h, $work/b
  local -a args=(-sS -X "$1" -D "$work/h" -o "$work/b" --max-time 30)
  [[ "$4" != - ]] && args+=(-H "Authorization: Bearer $4")
  [[ "$5" != - ]] && args+=(-H "vendure-token: $5")
  [[ "$3" != - ]] && args+=(-H "$json" --data "$3")
  LAST_SESSION=$4 LAST_CHANNEL=$5
  status=$(curl "${args[@]}" -w '%{http_code}' "$api$2") || status=000
  [[ "$status" != 000 ]] || fail "no HTTP answer from $api$2"
}
emit_rest() { # emit_rest <file> <title> <method> <shown-path> <shown-body|->: the headers of the last `rest` call, redacted
  local type=-
  [[ "$5" != - ]] && type=$json
  SHOWN_HEADERS=$(shown_headers "$LAST_SESSION" "$LAST_CHANNEL" "$type") SHOWN_BODY=$5 TITLE=$2 METHOD=$3 URL="$api$4" \
    node scripts/evidence/transcript.mjs "$work/h" "$work/b" "$1"
}
expect_status() { [[ "$status" == "$2" ]] || fail "$1: HTTP $status, wanted $2: $(command cat "$work/b")"; }
expect_rest_code() { expect_status "$1" "$2"; assert_js "$1" "b.code==='$3'" "$work/b"; }
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
Q_STORES='query { stores { id businessId subdomain channelToken } }'
store_field() { # store_field <session> <subdomain> <field>
  local any
  gql "$Q_ME" '{}' "$1" -
  any=$(js 'b.data.me.channels[0].token' "$work/b")
  gql "$Q_STORES" '{}' "$1" "$any"
  js "b.data.stores.find((s)=>s.subdomain==='$2').$3" "$work/b"
}

# --- sign-ins and stores ----------------------------------------------------------------------
reset_limits
login "$OWNER"; owner=$LAST_TOKEN
login "$SECOND_OWNER"; second_owner=$LAST_TOKEN
demo=$(store_field "$owner" demo channelToken); second=$(store_field "$second_owner" second channelToken)
remember CHANNEL_DEMO "$demo"; remember CHANNEL_SECOND "$second"
demo_store=$(store_field "$owner" demo id); second_store=$(store_field "$second_owner" second id)
remember_id STORE_DEMO "$demo_store"; remember_id STORE_SECOND "$second_store"
demo_business=$(store_field "$owner" demo businessId); second_business=$(store_field "$second_owner" second businessId)
remember_id BUSINESS_DEMO "$demo_business"; remember_id BUSINESS_SECOND "$second_business"

# shellcheck source=P3.S1-api.sh
. scripts/evidence/P3.S1-api.sh

# --- shipping quotes, in process on the host (as P2.S4.sh) -------------------------------------
Q_PRODUCT='mutation ($input: CreateCatalogProductInput!) { createCatalogProduct(input: $input) { product { id variants { id price } } } }'
gql "$Q_PRODUCT" "$(vars "{input:{title:'منتج التوصيل للأدلة',status:'active',price:4900,sku:'EVDELIVERY'}}")" "$owner" "$demo"
expect_ok "create product"
product=$(js "String(b.data.createCatalogProduct.product.id).replace(/^T_/,'')" "$work/b")
variant=$(js "String(b.data.createCatalogProduct.product.variants[0].id).replace(/^T_/,'')" "$work/b")
# Ids and channel tokens stay in the scratch folder, never in docs/.
world="$work/p3s1-world.json"
W_BUSINESS=$demo_business W_STORE=$demo_store W_TOKEN=$demo W_PRODUCT=$product W_VARIANT=$variant node -e '
const e = process.env;
const world = { businessId: e.W_BUSINESS, storeId: e.W_STORE, channelToken: e.W_TOKEN, productId: e.W_PRODUCT,
  variantId: e.W_VARIANT, listPrice: 4900, communeHomePrice: 777 };
require("fs").writeFileSync(process.argv[1], JSON.stringify(world));' "$world"
pg_password=$(P="$POSTGRES_PASSWORD" node -e 'process.stdout.write(encodeURIComponent(process.env.P))')
db_url="postgresql://$POSTGRES_USER:$pg_password@127.0.0.1:$POSTGRES_HOST_PORT/$POSTGRES_DB"
(
  # The host process reaches the stack through its published ports; every other key is what the containers get.
  export ROLE=migrate TZ=UTC APP_ENV=development DATABASE_URL="$db_url" DATABASE_URL_DIRECT="$db_url"
  export REDIS_URL="redis://127.0.0.1:$VALKEY_HOST_PORT" S3_ENDPOINT="http://127.0.0.1:$GARAGE_S3_HOST_PORT"
  export SMTP_HOST=127.0.0.1 SMTP_PORT=$MAILPIT_SMTP_HOST_PORT
  cd apps/server
  timeout 600 pnpm exec node --conditions=@cod/source -r ts-node/register/transpile-only \
    ../../scripts/evidence/P3.S1-quote.ts "$world" "../../$out/api"
) >"$work/quote.log" 2>&1 || fail "P3.S1-quote.ts failed: $(command tail -40 "$work/quote.log")"
command grep -q '"event":"p3s1-quote.done"' "$work/quote.log" || fail "P3.S1-quote.ts did not finish: $(command tail -20 "$work/quote.log")"
transcripts=$(command ls "$out"/api/*.md | command wc -l)
((transcripts == TRANSCRIPT_COUNT)) || fail "$transcripts transcripts, wanted $TRANSCRIPT_COUNT"

# --- screens ----------------------------------------------------------------------------------
reset_limits
EV_GROUP_ID=$pricing_group EV_GROUP_NAME='خيار التسعير للأدلة' timeout 1200 \
  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/evidence/P3.S1-screens.mjs \
  "$api/dashboard" "$work/shots" >"$work/shots.txt" 2> >(command tee "$work/screens.log" >&2)
command cp "$work"/shots/*.png "$out/screens/"
shot_count=$(command ls "$out"/screens/*.png | command wc -l)
((shot_count == SCREEN_COUNT)) || fail "$shot_count screenshots, wanted $SCREEN_COUNT"

# --- README -------------------------------------------------------------------------------------
{
  command cat <<README
# Evidence for P3.S1 (wilaya and commune data, delivery pricing)

Transcripts and screenshots from a live stack (CLAUDE.md §3a.14), produced by \`scripts/evidence/P3.S1.sh\`. Data is
synthetic: the demo seed's two businesses, the 69 wilayas and 1,541 communes the \`migrate\` role converges (D3123), each
store's seeded "Platform default prices" table (D3112), and what the script creates in store A1 (\`demo\`, Arabic): a
pricing option created at 650 DZD home everywhere, then edited back to each wilaya's base price with Alger overridden to 750, Alger-Centre to 777 and the Casbah without home
delivery, linked as the store default, a spare option (deleted) and one product at 4,900 DZD. Image built from a tree
with no uncommitted change outside the evidence folders and browser tests, last image-relevant commit \`$image_commit\`.
Compose project \`cod-evidence\`.

## API transcripts

| File | Shows |
| --- | --- |
| [\`api/provinces-list.md\`](api/provinces-list.md) | \`GET /provinces\`: 69 wilayas, public and cacheable (D3117) |
| [\`api/province-by-code.md\`](api/province-by-code.md) | \`GET /provinces/code/16\` with its communes (cut to three), \`/code/1\` answering \`01\`, \`/code/70\` 404 (D3115) |
| [\`api/fee-group-create.md\`](api/fee-group-create.md) | \`POST /delivery-fees\` (201) and \`createDeliveryFeeGroup\` |
| [\`api/fee-group-list.md\`](api/fee-group-list.md) | \`GET /delivery-fees\` with the platform table, \`deliveryFeeGroups\` with a search |
| [\`api/fee-group-update.md\`](api/fee-group-update.md) | \`PUT /delivery-fees/:id\` and \`updateDeliveryFeeGroup\`: Alger at 750 stored as an override (D3107) |
| [\`api/fee-group-communes.md\`](api/fee-group-communes.md) | \`PUT /delivery-fees/:id/communes/16\` and \`setDeliveryFeeCommuneRates\`: Alger-Centre 777, the Casbah off |
| [\`api/fee-group-read.md\`](api/fee-group-read.md) | \`GET /delivery-fees/:id\` and \`deliveryFeeGroup(id)\` with the commune overrides |
| [\`api/update-store-default-fee-group.md\`](api/update-store-default-fee-group.md) | \`updateStore\` linking the store's own option as its default (#207) |
| [\`api/fee-group-delete.md\`](api/fee-group-delete.md) | \`DELETE /delivery-fees/:id\`: the platform table and the store default 409 \`group-in-use\` (D3108), a spare 200, \`deleteDeliveryFeeGroup\` of it again not found |
| [\`api/store-provinces-narrowed.md\`](api/store-provinces-narrowed.md) | signed \`GET /store/provinces/code/16?storeId=\`: the Casbah without home delivery; B's store id under A's signed store header 404 (D3135); unsigned 404 (D112) |
| [\`api/isolation-b-group-from-a.md\`](api/isolation-b-group-from-a.md) | A's owner on B's option: \`GET\`/\`PUT\`/\`communes\` 404, \`deliveryFeeGroup\` null, B's option unchanged |
| [\`api/update-store-refused-references.md\`](api/update-store-refused-references.md) | \`updateStore\` with B's option (#230) or any carrier id (#153): \`tenancy.store-reference-not-found\`, the default kept |
| [\`api/shipping-quote-commune.md\`](api/shipping-quote-commune.md) | in process: \`ShippingQuoteService.quote\` to Alger-Centre, 777 with \`source: 'commune'\` |
| [\`api/offers-quote-delivery.md\`](api/offers-quote-delivery.md) | in process: \`PricingService.quoteForScope\` carrying the fee through the offers' shipping seam, 4,900 + 777 |

Fee-group, business and store ids are placeholders (\`<GROUP_EVIDENCE>\`, …), and a \`quoteToken\` keeps only its
\`qt1\` prefix (its payload encodes the real ids); every assertion ran on the real values.
Wilaya rows are cut to three of 69 and communes to a few in the transcripts (\`ratesShown\`, \`townsShown\`).

## Screenshots

\`screens/<screen>-<lang>-<viewport>.png\`, desktop (1280 × 800) and mobile (390 × 844), Arabic and English display
language, on the Arabic demo store: \`pricing-list\` (Delivery → Delivery pricing), \`new-pricing-top\` and
\`new-pricing-table\` (the New pricing option form's settings and its wilaya table), \`edit-override\` (the saved option
with Alger's Edited mark), \`edit-communes\` (Alger expanded to its communes) and \`store-settings-fee-group\` (the store
card's Default pricing option). $shot_count files.

$(for f in "$out"/screens/*.png; do b=$(basename "$f"); echo "- [\`screens/$b\`](screens/$b)"; done)

## Browser assertions in \`scripts/evidence/P3.S1-screens.mjs\`

Each line below is a failing assertion in the script if it does not hold.

$(command sed -E 's/^/- /' <(command grep -v '^shot ' "$work/screens.log"))

README
  if [[ -f scripts/evidence/P3.S1-seen.md ]]; then command cat scripts/evidence/P3.S1-seen.md; fi
} >"$out/README.md"

# --- placeholders, sizes and redaction ------------------------------------------------------------
for t in "$out"/api/*.md; do normalise_file "$t"; done
if command grep -rqE '^HTTP/1\.1 [^0-9]' "$out/api"; then fail "a placeholder corrupted a status line"; fi
if command grep -rqE '^HTTP/1\.1 [0-9]{3}[^ 0-9]' "$out/api"; then fail "a placeholder corrupted a status line"; fi
for f in "$out"/screens/*.png; do
  (($(command stat -c %s "$f") <= 300 * 1024)) || fail "$f is over 300 KB"
done
if command grep -rEn 'qt1\.[^.]+\.[A-Za-z0-9_-]{20,}' "$out"; then fail 'token signature in evidence'; fi
# A token payload is base64url JSON holding the real ids, out of reach of the placeholders above.
if command grep -rEn 'qt1\.eyJ' "$out"; then fail 'token payload in evidence'; fi
((${#session_tokens[@]} >= SIGN_IN_COUNT)) || fail "the redaction check would be vacuous"
for secret in "${secret_values[@]}" "$AUTH_TOKEN_SECRET" "$DEMO_OWNER_PASSWORD" "$SUPERADMIN_PASSWORD" "${session_tokens[@]}" "${cookies[@]}" "$demo" "$second"; do
  if command grep -rqaF -- "$secret" "$out/api" "$out/README.md"; then fail "a raw secret or token appears in $out"; fi
done
for id in "$demo_store" "$second_store" "$demo_business" "$second_business"; do
  if command grep -rqaF -- "$id" "$out/api" "$out/README.md"; then fail "a raw business or store id appears in $out"; fi
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
