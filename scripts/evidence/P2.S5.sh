#!/usr/bin/env bash
# Proof-of-working evidence for P2.S5 (CLAUDE.md §3a.14): runs the real compose stack under its own project (cod-evidence,
# host ports +20000), seeds the demo businesses, records every offers admin endpoint over REST and GraphQL (app types,
# create, publish, lists, get, version conflict, lifecycle, duplicate, delete, codes, stats, previews, cross-business and
# permission refusals), takes the offers dashboard screenshots and tears the project down. Never touches `cod` or
# `cod-verify`.
#
#   flock -w 3600 /tmp/cod-heavy-jobs.lock timeout 2400 scripts/evidence/P2.S5.sh
#   EV_SKIP_BUILD=1 flock -w 3600 /tmp/cod-heavy-jobs.lock timeout 2400 scripts/evidence/P2.S5.sh
#
# It builds cod-platform:local unless EV_SKIP_BUILD=1 and cod-platform:evidence-<last image commit> exists (an image an
# evidence script built from the same commit), which it then reuses.
#
# Data is synthetic. Offer, code, business and store ids are placeholders after their use is asserted (product and variant
# ids are the engine's small integers and stay); passwords, session tokens and channel tokens are never written.
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

out=docs/evidence/P2.S5
api="http://127.0.0.1:$API_HOST_PORT"
work=$(mktemp -d)
SNOWFLAKE_RE='^[1-9][0-9]{15,18}$'
# Values are replaced anywhere in a transcript, so a short one would corrupt status codes and other digits.
MIN_PLACEHOLDER_VALUE_LENGTH=16
TRANSCRIPT_COUNT=21
# 12 screens x {ar, en} x {desktop, mobile}.
SCREEN_COUNT=48

OWNER=owner@demo.example.test SECOND_OWNER=owner@second.example.test
# The seed's member of the Demo business holding `orders.view` only (seed-demo-members.ts).
NO_OFFERS_MEMBER=orders@demo.example.test

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

timeout 300 docker compose run --rm --no-deps -e DEMO_OWNER_PASSWORD --entrypoint node migrate apps/server/dist/main-seed-demo.js \
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
login "$NO_OFFERS_MEMBER"; no_offers_member=$LAST_TOKEN

# shellcheck source=P2.S5-api.sh
. scripts/evidence/P2.S5-api.sh
transcripts=$(command ls "$out"/api/*.md | command wc -l)
((transcripts == TRANSCRIPT_COUNT)) || fail "$transcripts transcripts, wanted $TRANSCRIPT_COUNT"

# --- screens ----------------------------------------------------------------------------------
reset_limits
EV_PRODUCT_ID=$product EV_QUANTITY_OFFER_ID=$quantity_offer EV_BXGY_OFFER_ID=$bxgy_offer EV_ADDON_OFFER_ID=$addon_offer \
  EV_CODES_OFFER_ID=$codes_offer timeout 1200 \
  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/evidence/P2.S5-screens.mjs \
  "$api/dashboard" "$work/shots" >"$work/shots.txt" 2> >(command tee "$work/screens.log" >&2)
command cp "$work"/shots/*.png "$out/screens/"
shot_count=$(command ls "$out"/screens/*.png | command wc -l)
((shot_count == SCREEN_COUNT)) || fail "$shot_count screenshots, wanted $SCREEN_COUNT"

# --- README -------------------------------------------------------------------------------------
{
  command cat <<README
# Evidence for P2.S5 (offer kinds BXGY and add-on, offers admin)

Transcripts and screenshots from a live stack (CLAUDE.md §3a.14), produced by \`scripts/evidence/P2.S5.sh\`. Data is
synthetic: the demo seed's two businesses, plus what the script creates in store A1 (\`demo\`, Arabic) over the catalog
Admin API (a product at 4,900 DZD and an add-on product at 1,500 DZD) and over the offers API. Image built from a tree
with no uncommitted change outside the evidence folders and browser tests, last image-relevant commit \`$image_commit\`.
Compose project \`cod-evidence\`.

## API transcripts

Every offers endpoint is shown over REST (status codes per D2520) and, where it adds something, over GraphQL.

| File | Shows |
| --- | --- |
| [\`api/app-types.md\`](api/app-types.md) | \`GET /offers/app-types\` and \`offerAppTypes\`: the seven cards of the create dialog, discount codes as a product discount with codes |
| [\`api/create-quantity-draft.md\`](api/create-quantity-draft.md) | \`POST /offers\`: a quantity draft on the 4,900 product, 201 |
| [\`api/publish-invalid.md\`](api/publish-invalid.md) | \`POST /offers/:id/publish\` of a draft with no product: 422 \`offers.publish-invalid\` with its problems |
| [\`api/publish.md\`](api/publish.md) | \`POST /offers/:id/publish\` and \`publishOffer\`: status \`active\`, \`publishedAt\` set |
| [\`api/list-by-status-and-kind.md\`](api/list-by-status-and-kind.md) | \`GET /offers?status=active&kind=quantity\` and \`offers(options:)\` |
| [\`api/list-by-product.md\`](api/list-by-product.md) | \`GET /offers?productId=\`: the offers on the 4,900 product |
| [\`api/get-with-code-count.md\`](api/get-with-code-count.md) | \`GET /offers/:id\` and \`offer(id:)\` of the codes offer: \`codeCount\` |
| [\`api/update-version-conflict.md\`](api/update-version-conflict.md) | \`PATCH /offers/:id\` at the current version (200), then at the old one: 409 \`offers.offer-conflict\` |
| [\`api/pause-resume-archive.md\`](api/pause-resume-archive.md) | \`POST /offers/:id/pause\`, \`/resume\`, \`/archive\` |
| [\`api/edit-archived-refused.md\`](api/edit-archived-refused.md) | \`PATCH\` and \`updateOffer\` on an archived offer: refused |
| [\`api/duplicate.md\`](api/duplicate.md) | \`POST /offers/:id/duplicate\`: a new draft copy, 201 |
| [\`api/delete-published-refused.md\`](api/delete-published-refused.md) | \`DELETE /offers/:id\` of a published offer: 409 \`offers.offer-not-deletable\`; a draft deletes |
| [\`api/codes-add-and-generate.md\`](api/codes-add-and-generate.md) | \`POST /offers/:id/codes\` (lower case stored upper case), \`/codes/generate\`, \`generateOfferCodes\`, \`GET /offers/:id/codes\`, \`DELETE /offers/:id/codes/:code\` |
| [\`api/codes-same-in-two-businesses.md\`](api/codes-same-in-two-businesses.md) | \`SAME10\` added in business A and in business B; each lists only its own row |
| [\`api/stats-zero.md\`](api/stats-zero.md) | \`GET /offers/:id/stats\` and \`offerStats\` before any order: zeros |
| [\`api/preview-quantity.md\`](api/preview-quantity.md) | \`POST /offers/preview\` and \`previewOffer\`: 1 piece 5,700 with a nudge of 980, 2 pieces 9,620, 3 pieces 12,495 (delivery free) |
| [\`api/preview-bxgy.md\`](api/preview-bxgy.md) | buy 2 get 1: a gift line at 0, total 9,800 + 800 |
| [\`api/preview-addon.md\`](api/preview-addon.md) | an add-on at 1,200 accepted: 4,900 + 1,200 + 800 |
| [\`api/preview-warning-total-mode.md\`](api/preview-warning-total-mode.md) | a total-price tier of 10,000 for 3 pieces: warning \`tier_total_not_divisible\` |
| [\`api/isolation-b-offer-from-a.md\`](api/isolation-b-offer-from-a.md) | A's owner on B's offer: \`GET\`/\`PATCH\`/\`/codes\` 404, \`offer(id:)\` null |
| [\`api/forbidden-without-offers-view.md\`](api/forbidden-without-offers-view.md) | a member without \`offers.view\`: \`GET /offers\` 403, \`offers\` FORBIDDEN |

Offer, code, business and store ids and channel tokens are placeholders (\`<OFFER_QUANTITY>\`, …); every assertion ran on
the real values. Product and variant ids are the engine's small integers.

## Screenshots

\`screens/<screen>-<lang>-<viewport>.png\`, desktop (1280 × 800) and mobile (390 × 844), Arabic and English display
language, on the Arabic demo store: \`offers-list\`, \`create-dialog\` (All types, seven cards), one editor per kind
(\`editor-quantity\` of the saved three-tier offer with a preselected tier and free delivery on the top tier,
\`editor-free_delivery\`, \`editor-product_discount\`, \`editor-discount_codes\`, \`editor-bxgy\` of the saved buy 2 get 1,
\`editor-order_discount\`, \`editor-addon\` of the saved add-on), \`arabic-preview\` (the quantity editor's order-form preview
and summary), \`codes-panel\` (the codes offer with its codes) and \`product-offers-block\` (the 4,900 product's Offers
block). $shot_count files.

## Browser assertions in \`scripts/evidence/P2.S5-screens.mjs\`

Each line below is a failing assertion in the script if it does not hold.

$(command sed -E 's/^/- /' <(command grep -v '^shot ' "$work/screens.log"))

README
  command cat scripts/evidence/P2.S5-seen.md
} >"$out/README.md"

# --- placeholders, sizes and redaction ------------------------------------------------------------
for t in "$out"/api/*.md; do normalise_file "$t"; done
if command grep -rqE '^HTTP/1\.1 [^0-9]' "$out/api"; then fail "a placeholder corrupted a status line"; fi
if command grep -rqE '^HTTP/1\.1 [0-9]{3}[^ 0-9]' "$out/api"; then fail "a placeholder corrupted a status line"; fi
for f in "$out"/screens/*.png; do
  (($(command stat -c %s "$f") <= 300 * 1024)) || fail "$f is over 300 KB"
done
if command grep -rEn 'qt1\.[^.]+\.[A-Za-z0-9_-]{20,}' "$out"; then fail 'token signature in evidence'; fi
((${#session_tokens[@]} >= 3)) || fail "the redaction check would be vacuous"
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
