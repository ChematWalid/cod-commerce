#!/usr/bin/env bash
# Proof-of-working evidence for P2.S4 (CLAUDE.md §3a.14, D2432): runs the real compose stack under its own project
# (cod-evidence, host ports +20000), which migrates the database and boots the api with the offers plugin, seeds the demo
# businesses, adds the products the quotes price over the catalog Admin API, then runs scripts/evidence/P2.S4-quote.ts on
# the host against the stack's Postgres, Valkey and object storage. That script calls the scoped PricingService core in
# process (there is no pricing HTTP route before P3.S3) and writes the transcripts. Never touches `cod` or `cod-verify`.
#
#   flock -w 3600 /tmp/cod-heavy-jobs.lock timeout 2400 scripts/evidence/P2.S4.sh
#   EV_SKIP_BUILD=1 flock -w 3600 /tmp/cod-heavy-jobs.lock timeout 2400 scripts/evidence/P2.S4.sh
#
# It builds cod-platform:local unless EV_SKIP_BUILD=1 and cod-platform:evidence-<last image commit> exists (an image an
# evidence script built from the same commit), which it then reuses.
#
# Data is synthetic and no phone is sent. Business, store and offer ids are placeholders in the transcripts; quote tokens
# keep their payload and lose their signature; passwords, session tokens, channel tokens and keys are never written.
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

out=docs/evidence/P2.S4
api="http://127.0.0.1:$API_HOST_PORT"
work=$(mktemp -d)
SNOWFLAKE_RE='^[1-9][0-9]{15,18}$'
TRANSCRIPT_COUNT=14
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
# try leaves containers whose names block the next, so they are removed before it. No storefront: nothing here has a UI.
APP_SERVICES=(api worker mailpit)
timeout 300 docker compose up -d postgres
wait_healthy postgres
if ! timeout 480 docker compose up -d "${APP_SERVICES[@]}"; then
  timeout 300 docker compose rm -fsv "${APP_SERVICES[@]}" migrate pgbouncer
  timeout 480 docker compose up -d "${APP_SERVICES[@]}"
fi
wait_healthy api worker
# The api boots only when every plugin does, the offers plugin and its quote key ring included.
wait_http 200 "$api/readyz" 120 || fail "api /readyz"

timeout 300 docker compose run --rm --no-deps -e DEMO_OWNER_PASSWORD --entrypoint node migrate apps/server/dist/main-seed-demo.js \
  >"$work/seed.log" 2>&1 || fail "the demo seed failed: $(command tail -20 "$work/seed.log")"

reset_limits() { # Every call from this host shares one client address.
  timeout 30 docker compose exec -T valkey sh -c "valkey-cli --scan --pattern 'rl:*' | xargs -r valkey-cli del" >/dev/null
}

# --- helpers (as in P2.S1.sh) ------------------------------------------------------------------
js() { node -e 'const b=JSON.parse(require("fs").readFileSync(process.argv[2],"utf8")); const r=eval(process.argv[1]); console.log(typeof r==="string"?r:JSON.stringify(r))' "$1" "$2"; }
assert_js() { [[ "$(js "$2" "$3")" == true ]] || fail "$1: '$2' is not true for $(command cat "$3")"; }
vars() { node -e 'console.log(JSON.stringify(eval("("+process.argv[1]+")")))' "$1"; }
json='Content-Type: application/json'

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
expect_ok() { assert_js "$1" '!b.errors' "$work/b"; }

session_tokens=()
header_token() { command grep -i '^vendure-auth-token:' "$work/h" | command head -1 | command tr -d '\r' | command awk '{print $2}'; }
Q_LOGIN='mutation ($username: String!, $password: String!) { login(username: $username, password: $password) { __typename ... on CurrentUser { identifier } ... on ErrorResult { errorCode message } } }'
login() { # login <user> -> $LAST_TOKEN
  gql "$Q_LOGIN" "$(U="$1" P="$DEMO_OWNER_PASSWORD" node -e 'console.log(JSON.stringify({username:process.env.U,password:process.env.P}))')" - -
  assert_js "login $1" 'b.data.login.__typename==="CurrentUser"' "$work/b"
  LAST_TOKEN=$(header_token)
  [[ -n "$LAST_TOKEN" ]] || fail "login $1: no auth token header"
  session_tokens+=("$LAST_TOKEN")
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

Q_CREATE_PRODUCT='mutation ($input: CreateCatalogProductInput!) { createCatalogProduct(input: $input) { warnings product { id status variants { id price } } } }'
core_id() { js "String($1).replace(/^T_/,'')" "$work/b"; }
create_product() { # create_product <label> <session> <channel> <input-js> -> $work/b
  gql "$Q_CREATE_PRODUCT" "$(vars "{input:$4}")" "$2" "$3"
  expect_ok "create $1"
}

# --- stores and catalog -----------------------------------------------------------------------
reset_limits
login "$OWNER"; owner=$LAST_TOKEN
login "$SECOND_OWNER"; second_owner=$LAST_TOKEN
channel_tokens=()
for spec in "a1 $owner demo" "a2 $owner demo2" "b $second_owner second"; do
  read -r key session subdomain <<<"$spec"
  printf -v "store_$key" '%s' "$(store_field "$session" "$subdomain" id)"
  printf -v "channel_$key" '%s' "$(store_field "$session" "$subdomain" channelToken)"
  printf -v "business_$key" '%s' "$(store_field "$session" "$subdomain" businessId)"
done
for id in "$store_a1" "$store_a2" "$store_b" "$business_a1" "$business_b"; do
  [[ "$id" =~ $SNOWFLAKE_RE ]] || fail "not a snowflake id: $id"
done
[[ "$business_a2" == "$business_a1" && "$business_b" != "$business_a1" ]] || fail "demo2 is not a store of business demo"
channel_tokens=("$channel_a1" "$channel_a2" "$channel_b")

create_product main "$owner" "$channel_a1" "{title:'منتج العروض للأدلة',status:'active',price:4900,sku:'EVQTY',optionGroups:[{name:'اللون',values:['أحمر','أزرق']}]}"
assert_js "two variants at 4900" 'b.data.createCatalogProduct.product.variants.map((v)=>v.price).join()==="4900,4900"' "$work/b"
product=$(core_id 'b.data.createCatalogProduct.product.id')
red=$(core_id 'b.data.createCatalogProduct.product.variants[0].id')
blue=$(core_id 'b.data.createCatalogProduct.product.variants[1].id')
create_product schedule "$owner" "$channel_a1" "{title:'منتج الجدولة للأدلة',status:'active',price:3000}"
schedule_product=$(core_id 'b.data.createCatalogProduct.product.id')
schedule_variant=$(core_id 'b.data.createCatalogProduct.product.variants[0].id')
create_product codes "$owner" "$channel_a1" "{title:'منتج الرموز للأدلة',status:'active',price:2500}"
codes_product=$(core_id 'b.data.createCatalogProduct.product.id')
codes_variant=$(core_id 'b.data.createCatalogProduct.product.variants[0].id')
create_product draft "$owner" "$channel_a1" "{title:'منتج مسودة للأدلة',status:'draft',price:1000}"
assert_js "draft" 'b.data.createCatalogProduct.product.status==="draft"' "$work/b"
draft_variant=$(core_id 'b.data.createCatalogProduct.product.variants[0].id')
create_product b "$second_owner" "$channel_b" "{title:'Produit des offres B',status:'active',price:2000}"
b_product=$(core_id 'b.data.createCatalogProduct.product.id')

# Ids and channel tokens stay in the scratch folder, never in docs/.
world="$work/p2s4-world.json"
W_BUSINESS_A=$business_a1 W_A1=$store_a1 W_A1_TOKEN=$channel_a1 W_A2=$store_a2 W_A2_TOKEN=$channel_a2 \
  W_BUSINESS_B=$business_b W_B=$store_b W_B_TOKEN=$channel_b \
  W_CATALOG="$product $red $blue $schedule_product $schedule_variant $codes_product $codes_variant $draft_variant $b_product" \
  node -e '
const e = process.env;
const [product, red, blue, scheduleProduct, scheduleVariant, codesProduct, codesVariant, draftVariant, bProduct] = e.W_CATALOG.split(" ");
const store = (id, channelToken) => ({ id, channelToken });
const world = {
  a: { businessId: e.W_BUSINESS_A, a1: store(e.W_A1, e.W_A1_TOKEN), a2: store(e.W_A2, e.W_A2_TOKEN) },
  b: { businessId: e.W_BUSINESS_B, store: store(e.W_B, e.W_B_TOKEN) },
  catalog: { product, red, blue, scheduleProduct, scheduleVariant, codesProduct, codesVariant, draftVariant, bProduct },
};
require("fs").writeFileSync(process.argv[1], JSON.stringify(world));' "$world"

# --- pricing transcripts, in process on the host ------------------------------------------------
rm -rf "$out/api"
mkdir -p "$out/api"
pg_password=$(P="$POSTGRES_PASSWORD" node -e 'process.stdout.write(encodeURIComponent(process.env.P))')
db_url="postgresql://$POSTGRES_USER:$pg_password@127.0.0.1:$POSTGRES_HOST_PORT/$POSTGRES_DB"
(
  # The host process reaches the stack through its published ports; every other key is what the containers get.
  export ROLE=migrate TZ=UTC APP_ENV=development DATABASE_URL="$db_url" DATABASE_URL_DIRECT="$db_url"
  export REDIS_URL="redis://127.0.0.1:$VALKEY_HOST_PORT" S3_ENDPOINT="http://127.0.0.1:$GARAGE_S3_HOST_PORT"
  export SMTP_HOST=127.0.0.1 SMTP_PORT=$MAILPIT_SMTP_HOST_PORT
  cd apps/server
  timeout 600 pnpm exec node --conditions=@cod/source -r ts-node/register/transpile-only \
    ../../scripts/evidence/P2.S4-quote.ts "$world" "../../$out/api"
) >"$work/quote.log" 2>&1 || fail "P2.S4-quote.ts failed: $(command tail -40 "$work/quote.log")"
command grep -q '"event":"p2s4-quote.done"' "$work/quote.log" || fail "P2.S4-quote.ts did not finish: $(command tail -20 "$work/quote.log")"
transcripts=$(command ls "$out"/api/*.md | command wc -l)
((transcripts == TRANSCRIPT_COUNT)) || fail "$transcripts transcripts, wanted $TRANSCRIPT_COUNT"

# --- README -------------------------------------------------------------------------------------
command cat >"$out/README.md" <<README
# Evidence for P2.S4 (pricing and offer engine core)

Transcripts from a live stack (CLAUDE.md §3a.14, D2432), produced by \`scripts/evidence/P2.S4.sh\`. The compose project
\`cod-evidence\` migrates the database and boots the api with the offers plugin (\`/readyz\` 200); the demo seed adds two
synthetic businesses; the script adds four products in store A1 (one at 4,900 DZD with a red and a blue variant, one for
the schedule cases, one for the codes, one draft) and one in business B over the catalog Admin API. Then
\`scripts/evidence/P2.S4-quote.ts\` boots the server's Vendure app on the host against the stack's database, seeds the offers
and codes through \`OfferAdminService\`, registers a synthetic fee table (home 800, stop desk 500, Algiers) on
\`SHIPPING_QUOTE_REGISTRAR\` and calls the scoped \`PricingService\` core on each store's own channel (D2408). There is no
pricing HTTP route before P3.S3, so each transcript shows the in-process call, its input and its output: no status line,
no headers. Image built from a tree with no uncommitted change outside the evidence folders and browser tests, last
image-relevant commit \`$image_commit\`. No screenshots: P2.S4 has no screen.

Offers of store A1: a quantity offer on the 4,900 product (2 pieces 10 % off, 3 pieces 15 % off with free delivery; the
15 % is the fixture assumption of the research's elided figure), two product discounts outside their schedule, two code
offers on the codes product (\`WELCOME10\` 10 %, \`USEDUP15\` 15 % with a usage limit of 1 already reached) and two order
discounts by code that do not combine (\`ORDER10\` 10 %, \`SAVE1000\` 1,000 DZD). Business B has one code offer
(\`BONLY20\`).

| File | Shows |
| --- | --- |
| [\`api/quote-1-piece-home.md\`](api/quote-1-piece-home.md) | 4,900 + 800 = 5,700; nudge: 1 more unit saves 980 (AC1, AC2) |
| [\`api/quote-2-pieces-home.md\`](api/quote-2-pieces-home.md) | red + blue count as 2 pieces: 8,820 + 800 = 9,620 (AC1, D2410) |
| [\`api/quote-3-pieces-free-delivery.md\`](api/quote-3-pieces-free-delivery.md) | 3 × 4,165 = 12,495, delivery waived, no nudge at the top tier |
| [\`api/quote-desk.md\`](api/quote-desk.md) | one piece to a stop desk: 5,400 |
| [\`api/quote-schedule-skipped.md\`](api/quote-schedule-skipped.md) | \`skipped\`: \`not_started\` and \`ended\` (AC3) |
| [\`api/quote-codes.md\`](api/quote-codes.md) | \`WELCOME10\` applied; \`duplicate\`, \`not_found\`, \`code_limit\` rejected (AC4) |
| [\`api/quote-not-combinable.md\`](api/quote-not-combinable.md) | two order discounts that do not combine: 1,000 applies, 10 % rejected \`not_combinable\` (AC5) |
| [\`api/quote-unavailable-variant.md\`](api/quote-unavailable-variant.md) | a draft product's variant: \`available: false\`, no token (D2425) |
| [\`api/verify-round-trip.md\`](api/verify-round-trip.md) | the 2-piece token with its cart: \`ok\` (AC7) |
| [\`api/verify-tampered-total.md\`](api/verify-tampered-total.md) | total rewritten in the payload: \`bad_signature\` |
| [\`api/verify-other-store.md\`](api/verify-other-store.md) | A1's token in store A2: \`store_mismatch\` |
| [\`api/verify-expired.md\`](api/verify-expired.md) | the plugin's clock set to the token's \`exp\`: \`expired\` |
| [\`api/reprice-1-to-2.md\`](api/reprice-1-to-2.md) | an order of 1 piece changed to 2: 5,700 → 9,620, delta 3,920 (D2427) |
| [\`api/isolation-b-code-in-a.md\`](api/isolation-b-code-in-a.md) | business B's code in store A1: \`not_found\`, no B offer in the quote |

Every number above is asserted by \`P2.S4-quote.ts\` before its transcript is written. Business, store and offer ids are
placeholders (\`<STORE_A1>\`, \`<OFFER_QUANTITY>\`, …); product and variant ids are the engine's small integers. Each
\`quoteToken\` is cut to \`qt1.<payload>.[REDACTED]\` by the script (the payload is what the token commits to; its base64url
still holds the real ids). \`P2.S4.sh\` refuses to finish when a token signature (\`qt1.<payload>.<20+ base64url chars>\`),
a key, a password, a session or channel token, or a banned name appears here.
README

# --- redaction and branding ----------------------------------------------------------------------
if command grep -rEn 'qt1\.[^.]+\.[A-Za-z0-9_-]{20,}' "$out"; then fail 'token signature in evidence'; fi
((${#session_tokens[@]} >= 2)) || fail "the redaction check would be vacuous"
for secret in "${secret_values[@]}" "$AUTH_TOKEN_SECRET" "$DEMO_OWNER_PASSWORD" "$SUPERADMIN_PASSWORD" "${session_tokens[@]}" "${channel_tokens[@]}"; do
  if command grep -rqaF -- "$secret" "$out/api" "$out/README.md"; then fail "a raw secret or token appears in $out"; fi
done
for id in "$store_a1" "$store_a2" "$store_b" "$business_a1" "$business_b"; do
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
