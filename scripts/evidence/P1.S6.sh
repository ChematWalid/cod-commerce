#!/usr/bin/env bash
# Proof-of-working evidence for P1.S6 (CLAUDE.md §3a.14): runs the real compose stack under its own project (cod-evidence,
# host ports +20000) with demo handlers on, records the inbound webhook gateway (signed, repeated, refused), the internal-only
# guard on four hosts and its tamper matrix, the operational flags, the envelope-encrypted tenant secrets, the jobs health
# and scheduled tasks, and the partitioned append-only activity log; takes the staff flags screen screenshots; tears
# everything down. Never touches `cod` or `cod-verify`.
#
#   flock -w 3600 /tmp/cod-heavy-jobs.lock timeout 2400 scripts/evidence/P1.S6.sh   # always builds cod-platform:local first
#
# Data is synthetic. Ids and channel tokens are placeholders after their use is asserted; passwords, session tokens, signing
# keys, key-encryption keys, secret values and request signatures are never written.
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
# The api is published as 127.0.0.1:$API_HOST_PORT:${COMPOSE_API_PORT:-3000} by docker-compose.yml (D98).
export AUTH_TOKEN_SECRET=${AUTH_TOKEN_SECRET:-evidence-auth-token-secret-synthetic-0123456789}
export SMTP_HOST=mailpit SMTP_PORT=1025 SMTP_FROM=no-reply@localhost AUTH_DASHBOARD_URL=http://127.0.0.1:$API_HOST_PORT/dashboard
# Set, not unset: compose would otherwise read a Gmail block from a local .env and require TLS from Mailpit (D96).
export SMTP_TLS=none SMTP_USERNAME='' SMTP_PASSWORD=''
# The new keys: synthetic values of this run's own, never the developer's. Two internal keys so the signer uses the active one.
export INTERNAL_HMAC_KEYS=${EV_INTERNAL_HMAC_KEYS:-k1:evidence-internal-hmac-key-synthetic-0000000001,k2:evidence-internal-hmac-key-synthetic-0000000002}
export INTERNAL_HMAC_ACTIVE_KID=k2
export TENANT_SECRET_KEKS=${EV_TENANT_SECRET_KEKS:-k1:3a5c7e9f1b2d4f60718293a4b5c6d7e8f9a0b1c2d3e4f5061728394a5b6c7d8e}
export TENANT_SECRET_ACTIVE_KID=k1
export PLATFORM_DEMO_HANDLERS=true
export WORKER_ACTIVE_QUEUES=''
export DEMO_OWNER_PASSWORD=${DEMO_OWNER_PASSWORD:-evidence-demo-owner-password}
EV_DEMO_SECRET_A=evidence-demo-signing-secret-for-business-a-0001
EV_DEMO_SECRET_A2=evidence-demo-signing-secret-for-business-a-0002
EV_DEMO_SECRET_B=evidence-demo-signing-secret-for-business-b-0001

out=docs/evidence/P1.S6
api="http://127.0.0.1:$API_HOST_PORT"
site="http://127.0.0.1:$STOREFRONT_HOST_PORT"
work=$(mktemp -d)
SNOWFLAKE_RE='^[1-9][0-9]{15,18}$'
# Values are replaced anywhere in a transcript, so a short one would corrupt status codes and other digits.
MIN_PLACEHOLDER_VALUE_LENGTH=16

OWNER=owner@demo.example.test SECOND_OWNER=owner@second.example.test LIMITED=limited@demo.example.test
HOSTS=(api.localhost app.localhost demo.localhost evil.example)

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
# This run's own synthetic secrets: the internal keys' secrets, the key-encryption key, every demo secret value.
run_secrets=("$EV_DEMO_SECRET_A" "$EV_DEMO_SECRET_A2" "$EV_DEMO_SECRET_B")
IFS=',' read -ra _entries <<<"$INTERNAL_HMAC_KEYS"
for e in "${_entries[@]}"; do run_secrets+=("${e#*:}"); done
IFS=',' read -ra _entries <<<"$TENANT_SECRET_KEKS"
for e in "${_entries[@]}"; do run_secrets+=("${e#*:}"); done

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
timeout 1500 docker compose build migrate
# A fresh Postgres volume can outlast its healthcheck on a loaded host, so it starts alone and is waited for; the second
# `up` try covers what is left. A try cut short leaves half-created containers whose names block the next, so they are removed.
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

# --- helpers (as in P1.S5.sh) ----------------------------------------------------------------
js() { node -e 'const b=JSON.parse(require("fs").readFileSync(process.argv[2],"utf8")); const r=eval(process.argv[1]); console.log(typeof r==="string"?r:JSON.stringify(r))' "$1" "$2"; }
assert_js() { [[ "$(js "$2" "$3")" == true ]] || fail "$1: '$2' is not true for $(command head -c 600 "$3")"; }

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

session_tokens=() cookies=() signatures=()
header_token() { command grep -i '^vendure-auth-token:' "$work/h" | command head -1 | command tr -d '\r' | command awk '{print $2}'; }
Q_LOGIN='mutation ($username: String!, $password: String!) { login(username: $username, password: $password) { __typename ... on CurrentUser { identifier } ... on ErrorResult { errorCode message } } }'
login_as() { # login_as <user> <password> -> $LAST_TOKEN
  gql "$Q_LOGIN" "$(U="$1" P="$2" node -e 'console.log(JSON.stringify({username:process.env.U,password:process.env.P}))')" - -
  assert_js "login $1" 'b.data.login.__typename==="CurrentUser"' "$work/b"
  LAST_TOKEN=$(header_token)
  [[ -n "$LAST_TOKEN" ]] || fail "login $1: no auth token header"
  session_tokens+=("$LAST_TOKEN")
  while read -r c; do [[ -n "$c" ]] && cookies+=("$c"); done < <(command grep -i '^set-cookie:' "$work/h" | command sed -E 's/^[^=]+=([^;[:space:]]+).*/\1/')
}
login() { login_as "$1" "$DEMO_OWNER_PASSWORD"; }

# --- the signer and raw HTTP calls ---------------------------------------------------------------
signer() { (cd apps/server && timeout 120 pnpm exec node --conditions=@cod/source -r ts-node/register/transpile-only ../../scripts/evidence/P1.S6-sign.ts "$@"); }
sign_headers() { # sign_headers <json-request> -> "name: value" lines
  printf '[%s]' "$1" | signer internal | node -e 'const h=JSON.parse(require("fs").readFileSync(0,"utf8"))[0]; for (const [k,v] of Object.entries(h)) console.log(k+": "+v)'
}

RAW_SHOWN=() RAW_BODY=-
raw() { # raw <method> <path> <host> <body-file|-> <sign-json|-> [extra header]... -> $status, $work/h, $work/b, RAW_SHOWN
  local method=$1 path=$2 host=$3 body=$4 sign=$5
  shift 5
  RAW_SHOWN=("Host: $host")
  local -a args=(-sS -X "$method" -D "$work/h" -o "$work/b" --max-time 30 -H "Host: $host")
  local line name
  local -A header_of=()
  local -a order=()
  if [[ "$sign" != - ]]; then
    while IFS= read -r line; do
      [[ -n "$line" ]] || continue
      name=${line%%:*}
      header_of[$name]=$line
      order+=("$name")
      [[ "$name" != x-internal-sig ]] || signatures+=("${line#*: }")
    done < <(sign_headers "$sign")
  fi
  # A header given by the caller replaces the signed one of the same name (the tamper rows change one in flight).
  for line in "$@"; do
    name=${line%%:*}
    [[ -n "${header_of[$name]:-}" ]] || order+=("$name")
    header_of[$name]=$line
  done
  for name in "${order[@]}"; do
    line=${header_of[$name]}
    args+=(-H "$line")
    case "$name" in
      x-internal-sig) RAW_SHOWN+=("x-internal-sig: [REDACTED]") ;;
      x-internal-ts) RAW_SHOWN+=("x-internal-ts: <unix seconds>") ;;
      *) RAW_SHOWN+=("$line") ;;
    esac
  done
  if [[ "$body" != - ]]; then
    args+=(-H "$json" --data-binary "@$body")
    RAW_SHOWN+=("$json")
  fi
  status=$(curl "${args[@]}" -w '%{http_code}' "$api$path") || status=000
  [[ "$status" != 000 ]] || fail "no HTTP answer from $api$path"
}
emit_raw() { # emit_raw <file> <title> <method> <path> [shown-body]
  SHOWN_HEADERS=$(printf '%s\n' "${RAW_SHOWN[@]}") SHOWN_BODY=${5:--} TITLE=$2 METHOD=$3 URL="$api$4" \
    node scripts/evidence/transcript.mjs "$work/h" "$work/b" "$1"
}
want_status() { [[ "$status" == "$2" ]] || fail "$1: HTTP $status, wanted $2 ($(command head -c 300 "$work/b"))"; }

psql_run() { timeout 30 docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "$1" 2>&1' _ "$1" | command tr -d '\r' || true; }
psql_value() { timeout 30 docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "$1"' _ "$1" | command tr -d '\r\n'; }
SQL_OUT=
emit_sql() { # emit_sql <file> <title> <sql> -> $SQL_OUT (the transcript block is the live psql output)
  SQL_OUT=$(psql_run "$3")
  printf '### %s\n\n```sql\n%s\n```\n\n```text\n%s\n```\n\n' "$2" "$3" "$SQL_OUT" >>"$1"
}
await_sql() { # await_sql <description> <sql> <wanted> [seconds]
  local deadline=$((SECONDS + ${4:-90})) got
  while ((SECONDS < deadline)); do
    got=$(psql_value "$2")
    [[ "$got" == "$3" ]] && return 0
    sleep 2
  done
  fail "$1: '$got' after ${4:-90}s, wanted '$3'"
}

# --- sign-ins and ids ------------------------------------------------------------------------
reset_limits
login "$OWNER"; owner=$LAST_TOKEN
login "$SECOND_OWNER"; second_owner=$LAST_TOKEN
login_as "$SUPERADMIN_USERNAME" "$SUPERADMIN_PASSWORD"; staff=$LAST_TOKEN

Q_ME='query { me { channels { token } } }'
Q_STORES='query { stores { id subdomain channelToken } }'
Q_SWITCHABLE='query { switchableStores { platformDomain stores { id businessId subdomain } } }'
store_field() { # store_field <session> <subdomain> <field>
  local any
  gql "$Q_ME" '{}' "$1" -
  any=$(js 'b.data.me.channels[0].token' "$work/b")
  gql "$Q_STORES" '{}' "$1" "$any"
  js "b.data.stores.find((s)=>s.subdomain==='$2').$3" "$work/b"
}
demo=$(store_field "$owner" demo channelToken); second=$(store_field "$second_owner" second channelToken)
remember CHANNEL_DEMO "$demo"; remember CHANNEL_SECOND "$second"
demo_store=$(store_field "$owner" demo id); second_store=$(store_field "$second_owner" second id)
remember_id STORE_DEMO "$demo_store"; remember_id STORE_SECOND "$second_store"
gql "$Q_SWITCHABLE" '{}' "$owner" "$demo"; business_demo=$(js 'b.data.switchableStores.stores[0].businessId' "$work/b")
gql "$Q_SWITCHABLE" '{}' "$second_owner" "$second"; business_second=$(js 'b.data.switchableStores.stores[0].businessId' "$work/b")
remember_id BUSINESS_DEMO "$business_demo"; remember_id BUSINESS_SECOND "$business_second"
[[ "$business_demo" != "$business_second" ]] || fail "both businesses have one id"

# --- secrets.md (first: the webhook gateway needs the demo secret) -----------------------------------
Q_SET='mutation ($input: SetTenantSecretInput!) { setTenantSecret(input: $input) { id provider ref last4 updatedAt } }'
Q_LIST='query { tenantSecrets { id provider ref last4 } }'
Q_DELETE='mutation ($id: String!) { deleteTenantSecret(id: $id) }'
set_secret() { # set_secret <session> <channel> <value> -> $work/b
  gql "$Q_SET" "$(V="$3" node -e 'console.log(JSON.stringify({input:{provider:"demo-webhook",ref:"signing",value:process.env.V}}))')" "$1" "$2"
}
SHOWN_SET='{"input":{"provider":"demo-webhook","ref":"signing","value":"[REDACTED]"}}'

f="$out/api/webhook-gateway.md"
begin "$f" "The inbound webhook gateway" "\`POST /webhooks/:provider/:accountKey\` is public; the provider's signature is the authentication (D109). The demo provider \`demo\` takes a store's subdomain as the account key and verifies the HMAC-SHA-256 of the raw body under the business's own \`demo-webhook\`/\`signing\` secret (D110)."
set_secret "$owner" "$demo" "$EV_DEMO_SECRET_A"; expect_ok "set demo secret"
secret_a_id=$(js 'b.data.setTenantSecret.id' "$work/b"); remember_id SECRET_A "$secret_a_id"
emit "$f" "The owner of A stores the demo signing secret (the value is write-only)" "$Q_SET" "$SHOWN_SET" "$owner" "$demo"

printf '%s' '{"event":"evidence.order.created","n":1}' >"$work/wh1.json"
wh_sig() { EV_DEMO_SECRET=$1 signer demo "$2"; }
wh_post() { # wh_post <provider> <account> <body-file> <signature> [extra header]...
  local provider=$1 account=$2 body=$3 sig=$4
  shift 4
  raw POST "/webhooks/$provider/$account" api.localhost "$body" - "x-demo-signature: $sig" "$@"
}
shown_sig='x-demo-signature'
redact_sig() { local i; for i in "${!RAW_SHOWN[@]}"; do [[ "${RAW_SHOWN[$i]}" == ${shown_sig}:* ]] && RAW_SHOWN[$i]="$shown_sig: [REDACTED]"; done; return 0; }
sig_a=$(wh_sig "$EV_DEMO_SECRET_A" "$work/wh1.json"); signatures+=("$sig_a")
reset_limits
wh_post demo demo "$work/wh1.json" "$sig_a"; want_status "signed webhook" 200; redact_sig
emit_raw "$f" "A signed POST: 200" POST "/webhooks/demo/demo" "$(command cat "$work/wh1.json")"
wh_post demo demo "$work/wh1.json" "$sig_a"; want_status "same webhook again" 200; redact_sig
emit_raw "$f" "The same body again: 200, nothing is processed twice" POST "/webhooks/demo/demo" "$(command cat "$work/wh1.json")"

await_sql "inbound processed" "select count(*) from inbound_webhook where provider = 'demo' and status = 'processed'" 1
await_sql "demo-log done" "select count(*) from outbox_delivery where consumer = 'demo-log' and status = 'done'" 1
emit_sql "$f" "One dedupe key" "select provider, \"accountId\", count(*) as keys from inbound_webhook_key where provider = 'demo' group by 1, 2;"
dedupe_keys=$(psql_value "select count(*) from inbound_webhook_key where provider = 'demo'")
[[ "$dedupe_keys" == 1 ]] || fail "dedupe key count: $dedupe_keys"
emit_sql "$f" "One stored webhook, processed" "select provider, status, attempts, \"businessId\" = $business_demo as \"is business A\", count(*) as rows from inbound_webhook where provider = 'demo' group by 1, 2, 3, 4;"
[[ "$SQL_OUT" == *processed* && "$SQL_OUT" == *"(1 row)"* ]] || fail "inbound rows: $SQL_OUT"
emit_sql "$f" "The outbox event the handler wrote, relayed" "select topic, status, count(*) as events from outbox_event where topic = 'platform.demo' group by 1, 2;"
[[ "$SQL_OUT" == *relayed* && "$SQL_OUT" == *"(1 row)"* ]] || fail "outbox rows: $SQL_OUT"
emit_sql "$f" "The demo-log consumer finished its delivery" "select consumer, status, attempts, count(*) as deliveries from outbox_delivery where consumer = 'demo-log' group by 1, 2, 3;"
[[ "$SQL_OUT" == *done* && "$SQL_OUT" == *"(1 row)"* ]] || fail "delivery rows: $SQL_OUT"

wh_post demo demo "$work/wh1.json" "sha256=$(printf '0%.0s' {1..64})"; want_status "bad signature" 401; redact_sig
emit_raw "$f" "A wrong signature: 401, nothing stored" POST "/webhooks/demo/demo" "$(command cat "$work/wh1.json")"
wh_post demo no-such-store "$work/wh1.json" "$sig_a"; want_status "unknown account" 404; redact_sig
emit_raw "$f" "An account that does not exist: 404" POST "/webhooks/demo/no-such-store" "$(command cat "$work/wh1.json")"
wh_post no-such-provider demo "$work/wh1.json" "$sig_a"; want_status "unknown provider" 404; redact_sig
emit_raw "$f" "A provider that does not exist: 404" POST "/webhooks/no-such-provider/demo" "$(command cat "$work/wh1.json")"
node -e 'process.stdout.write("x".repeat(262145))' >"$work/big.json"
[[ $(command stat -c %s "$work/big.json") == 262145 ]] || fail "the oversize body is $(command stat -c %s "$work/big.json") bytes"
wh_post demo demo "$work/big.json" "$sig_a"; want_status "oversize" 413; redact_sig
emit_raw "$f" "A body of 262 145 bytes (one over the 262 144 limit): 413" POST "/webhooks/demo/demo" "(262145 bytes, not shown)"
emit_sql "$f" "Still one dedupe key and one stored webhook after the refusals" "select (select count(*) from inbound_webhook_key where provider = 'demo') as keys, (select count(*) from inbound_webhook where provider = 'demo') as webhooks;"
after_keys=$(psql_value "select count(*) from inbound_webhook_key where provider = 'demo'")
after_hooks=$(psql_value "select count(*) from inbound_webhook where provider = 'demo'")
[[ "$after_keys" == 1 && "$after_hooks" == 1 ]] || fail "counts after refusals: keys=$after_keys webhooks=$after_hooks"

# --- secrets.md ----------------------------------------------------------------------------------
f="$out/api/secrets.md"
begin "$f" "Envelope-encrypted tenant secrets" "A secret is encrypted under the business's own data key, itself wrapped by the key-encryption key from the environment (D114). The value is write-only: no field returns it, only its last four characters."
set_secret "$owner" "$demo" "$EV_DEMO_SECRET_A2"; expect_ok "replace secret"
assert_js "same id" "b.data.setTenantSecret.id==='$secret_a_id' && b.data.setTenantSecret.last4==='0002'" "$work/b"
emit "$f" "setTenantSecret again for the same provider and ref: the id is kept, last4 follows the new value" "$Q_SET" "$SHOWN_SET" "$owner" "$demo"
gql "$Q_LIST" '{}' "$owner" "$demo"; expect_ok "list A"
assert_js "list A" "b.data.tenantSecrets.length===1 && b.data.tenantSecrets[0].id==='$secret_a_id' && b.data.tenantSecrets[0].last4==='0002'" "$work/b"
emit "$f" "tenantSecrets of A: one secret, last4 only" "$Q_LIST" '{}' "$owner" "$demo"
gql "$Q_LIST" '{}' "$second_owner" "$second"; expect_ok "list B before"
assert_js "list B before" "b.data.tenantSecrets.length===0" "$work/b"
emit "$f" "tenantSecrets of B: empty, A's secret is not visible" "$Q_LIST" '{}' "$second_owner" "$second"
set_secret "$second_owner" "$second" "$EV_DEMO_SECRET_B"; expect_ok "set B"
secret_b_id=$(js 'b.data.setTenantSecret.id' "$work/b"); remember_id SECRET_B "$secret_b_id"
[[ "$secret_b_id" != "$secret_a_id" ]] || fail "both businesses share a secret id"
emit "$f" "B stores its own secret under the same provider and ref" "$Q_SET" "$SHOWN_SET" "$second_owner" "$second"
gql "$Q_LIST" '{}' "$second_owner" "$second"; expect_ok "list B after"
assert_js "list B after" "b.data.tenantSecrets.length===1 && b.data.tenantSecrets[0].id==='$secret_b_id'" "$work/b"
emit "$f" "tenantSecrets of B: only B's own" "$Q_LIST" '{}' "$second_owner" "$second"
gql "$Q_DELETE" "$(vars "{id:'$secret_a_id'}")" "$second_owner" "$second"
assert_js "foreign delete" "(b.errors||[]).length===1 && !(b.data && b.data.deleteTenantSecret)" "$work/b"
emit "$f" "B deletes A's secret id: not found" "$Q_DELETE" '{"id":"<SECRET_A>"}' "$second_owner" "$second"
gql "$Q_LIST" '{}' "$owner" "$demo"
assert_js "A survives" "b.data.tenantSecrets.length===1 && b.data.tenantSecrets[0].id==='$secret_a_id'" "$work/b"
emit "$f" "tenantSecrets of A afterwards: A's secret survived" "$Q_LIST" '{}' "$owner" "$demo"
emit_sql "$f" "At rest: ciphertext, iv and tag only, no plaintext column (lengths shown, never bytes)" "select provider, ref, last4, length(iv) as iv_bytes, length(ciphertext) as ciphertext_bytes, length(tag) as tag_bytes from tenant_secret order by \"businessId\";"
[[ "$SQL_OUT" == *"(2 rows)"* ]] || fail "tenant_secret rows: $SQL_OUT"

# --- flags.md ------------------------------------------------------------------------------------
f="$out/api/flags.md"
begin "$f" "Operational feature flags" "Platform staff list, change and override flags; a flag answers by store, then business, then plan override, then rollout and default (D116). Merchants have no access."
Q_FLAGS='query { featureFlags { key description defaultEnabled rolloutPercent overrides { scope scopeId enabled } } }'
Q_UPDATE='mutation ($input: UpdateFeatureFlagInput!) { updateFeatureFlag(input: $input) { key defaultEnabled rolloutPercent } }'
Q_OVERRIDE='mutation ($input: FeatureFlagOverrideInput!) { setFeatureFlagOverride(input: $input) { key overrides { scope scopeId enabled } } }'
Q_EVAL='query ($key: String!, $businessId: String) { evaluateFeatureFlag(key: $key, businessId: $businessId) }'
reset_limits
gql "$Q_FLAGS" '{}' "$staff" -; expect_ok "flags list"
assert_js "four seeds" "b.data.featureFlags.map((f)=>f.key).sort().join()==='ai.enabled,capi.enabled,inbound-webhooks.enabled,intake.spool.enabled'" "$work/b"
emit "$f" "featureFlags (superadmin): the four seeds" "$Q_FLAGS" '{}' "$staff" -
upd=$(vars "{input:{key:'ai.enabled',defaultEnabled:false}}")
gql "$Q_UPDATE" "$upd" "$staff" -; expect_ok "update"
assert_js "update" 'b.data.updateFeatureFlag.defaultEnabled===false' "$work/b"
emit "$f" "updateFeatureFlag: ai.enabled off by default" "$Q_UPDATE" "$upd" "$staff" -
for biz in "DEMO:$business_demo:A" "SECOND:$business_second:B"; do
  IFS=: read -r tag id label <<<"$biz"
  gql "$Q_EVAL" "$(vars "{key:'ai.enabled',businessId:'$id'}")" "$staff" -; expect_ok "eval $label"
  assert_js "eval $label before" 'b.data.evaluateFeatureFlag===false' "$work/b"
  emit "$f" "evaluateFeatureFlag ai.enabled for business $label, before the override: false" "$Q_EVAL" "{\"key\":\"ai.enabled\",\"businessId\":\"<BUSINESS_$tag>\"}" "$staff" -
done
ovr=$(vars "{input:{key:'ai.enabled',scope:'BUSINESS',scopeId:'$business_demo',enabled:true}}")
gql "$Q_OVERRIDE" "$ovr" "$staff" -; expect_ok "override"
emit "$f" "setFeatureFlagOverride: ai.enabled on for business A only" "$Q_OVERRIDE" "$ovr" "$staff" -
gql "$Q_EVAL" "$(vars "{key:'ai.enabled',businessId:'$business_demo'}")" "$staff" -
assert_js "eval A after" 'b.data.evaluateFeatureFlag===true' "$work/b"
emit "$f" "evaluateFeatureFlag for business A: true" "$Q_EVAL" '{"key":"ai.enabled","businessId":"<BUSINESS_DEMO>"}' "$staff" -
gql "$Q_EVAL" "$(vars "{key:'ai.enabled',businessId:'$business_second'}")" "$staff" -
assert_js "eval B after" 'b.data.evaluateFeatureFlag===false' "$work/b"
emit "$f" "evaluateFeatureFlag for business B: still false" "$Q_EVAL" '{"key":"ai.enabled","businessId":"<BUSINESS_SECOND>"}' "$staff" -
gql "$Q_FLAGS" '{}' "$owner" "$demo"; expect_code "merchant flags" FORBIDDEN
emit "$f" "The merchant owner asks for featureFlags: FORBIDDEN" "$Q_FLAGS" '{}' "$owner" "$demo"
gql "$Q_UPDATE" "$upd" "$owner" "$demo"; expect_code "merchant update" FORBIDDEN
emit "$f" "The merchant owner tries updateFeatureFlag: FORBIDDEN" "$Q_UPDATE" "$upd" "$owner" "$demo"

# --- jobs.md -------------------------------------------------------------------------------------
f="$out/api/jobs.md"
begin "$f" "Jobs health and scheduled tasks" "\`platformJobsHealth\` is staff-only (D120): the outbox backlog and the age of each platform task's last success. \`runScheduledTask\` runs the sweeper and the reconciler on demand."
Q_JOBS='query { platformJobsHealth { outboxPending outboxOldestPendingAgeSeconds tasks { id lastSuccessAgeSeconds } } }'
Q_RUN='mutation ($id: String!) { runScheduledTask(id: $id) { success } }'
reset_limits
gql "$Q_JOBS" '{}' "$staff" -; expect_ok "jobs before"
assert_js "jobs before" 'b.data.platformJobsHealth.outboxPending===0' "$work/b"
emit "$f" "platformJobsHealth before running the tasks" "$Q_JOBS" '{}' "$staff" -
gql "$Q_JOBS" '{}' "$owner" "$demo"; expect_code "merchant jobs" FORBIDDEN
emit "$f" "The merchant owner asks for platformJobsHealth: FORBIDDEN" "$Q_JOBS" '{}' "$owner" "$demo"
for task in outbox-sweeper job-reconciler; do
  gql "$Q_RUN" "$(vars "{id:'$task'}")" "$staff" -; expect_ok "run $task"
  assert_js "run $task" 'b.data.runScheduledTask.success===true' "$work/b"
  emit "$f" "runScheduledTask $task" "$Q_RUN" "$(vars "{id:'$task'}")" "$staff" -
done
deadline=$((SECONDS + 90)); fresh=false
while ((SECONDS < deadline)); do
  gql "$Q_JOBS" '{}' "$staff" -
  if [[ "$(js "['outbox-sweeper','job-reconciler'].every((id)=>{const t=b.data.platformJobsHealth.tasks.find((x)=>x.id===id); return t&&t.lastSuccessAgeSeconds!==null&&t.lastSuccessAgeSeconds<=30})" "$work/b")" == true ]]; then fresh=true; break; fi
  sleep 3
done
[[ "$fresh" == true ]] || fail "the tasks show no recent success: $(command head -c 600 "$work/b")"
emit "$f" "platformJobsHealth after: both tasks report a success within the last 30 seconds" "$Q_JOBS" '{}' "$staff" -

# --- activity-log.md -----------------------------------------------------------------------------
f="$out/api/activity-log.md"
begin "$f" "The partitioned, append-only activity log" "\`activity_log\` is range-partitioned by month on \`createdAt\` with its partitions kept ahead by the maintenance task (D123); a row trigger refuses \`UPDATE\` and \`DELETE\`. The activity API reads across the partitions unchanged."
Q_ROLE='mutation ($input: CreateBusinessRoleInput!) { createBusinessRole(input: $input) { id name } }'
Q_ACTIVITY='query { activityLog(input: { first: 20 }) { items { action summary createdAt } nextCursor } }'
reset_limits
gql "$Q_ROLE" '{"input":{"name":"Evidence role"}}' "$owner" "$demo"; expect_ok "create role"
emit_sql "$f" "The partitions, from the catalog (none is a DEFAULT partition)" "select c.relname as partition, pg_get_expr(c.relpartbound, c.oid) as bounds from pg_inherits i join pg_class c on c.oid = i.inhrelid where i.inhparent = 'activity_log'::regclass order by 1;"
[[ "$SQL_OUT" != *DEFAULT* && "$SQL_OUT" == *activity_log_p* ]] || fail "partitions: $SQL_OUT"
parts=$(psql_value "select count(*) from pg_inherits where inhparent = 'activity_log'::regclass")
((parts >= 4)) || fail "only $parts activity_log partitions"
emit_sql "$f" "A row in a later month's partition (the current month plus three are already made)" "insert into activity_log (\"businessId\", \"storeId\", id, \"actorAdministratorId\", action, \"entityType\", \"entityId\", summary, diff, ip, \"userAgent\", \"createdAt\") select \"businessId\", \"storeId\", id + 1, \"actorAdministratorId\", 'evidence.later-month', \"entityType\", \"entityId\", 'A row in the next month''s partition', diff, ip, \"userAgent\", date_trunc('month', now()) + interval '1 month 3 days' from activity_log order by id desc limit 1;"
[[ "$SQL_OUT" == "INSERT 0 1" ]] || fail "insert into a later partition: $SQL_OUT"
emit_sql "$f" "Which partition holds each row" "select tableoid::regclass as partition, action, summary from activity_log order by \"createdAt\", id;"
distinct_parts=$(psql_value "select count(distinct tableoid) from activity_log")
((distinct_parts >= 2)) || fail "rows sit in $distinct_parts partitions"
emit_sql "$f" "UPDATE is refused" "update activity_log set summary = 'tampered';"
[[ "$SQL_OUT" == *"activity_log is append-only"* ]] || fail "update was not refused: $SQL_OUT"
emit_sql "$f" "DELETE is refused" "delete from activity_log;"
[[ "$SQL_OUT" == *"activity_log is append-only"* ]] || fail "delete was not refused: $SQL_OUT"
gql "$Q_ACTIVITY" '{}' "$owner" "$demo"; expect_ok "activity api"
assert_js "activity api" "b.data.activityLog.items.some((i)=>i.action==='evidence.later-month') && b.data.activityLog.items.length>=2" "$work/b"
emit "$f" "activityLog (owner of A): lists the rows of both partitions" "$Q_ACTIVITY" '{}' "$owner" "$demo"
gql "$Q_ACTIVITY" '{}' "$second_owner" "$second"; expect_ok "activity api B"
assert_js "activity api B" "!b.data.activityLog.items.some((i)=>i.action==='evidence.later-month')" "$work/b"
emit "$f" "activityLog (owner of B): none of A's rows" "$Q_ACTIVITY" '{}' "$second_owner" "$second"

# --- internal-guard.md ---------------------------------------------------------------------------
f="$out/api/internal-guard.md"
begin "$f" "The internal-only guard" "\`/shop-api\`, \`/store/*\` and \`/_internal/*\` answer only signed requests (HMAC over method, path with query, body, store, client address and country, within 60 seconds), on every host; a refusal is a 404 with an empty body (D111, D112). Signatures are shown as [REDACTED]."
printf '%s' '{"query":"{ activeChannel { code } }"}' >"$work/shop.json"
printf '%s' '{"query":"mutation { logout { success } }"}' >"$work/logout.json"
RESOLVE="/store/resolve?host=demo.localhost"
for host in "${HOSTS[@]}"; do
  reset_limits
  for call in "POST /shop-api" "POST /shop-api?x=1" "GET $RESOLVE" "GET /STORE/resolve?host=demo.localhost" "GET /store/resolve/?host=demo.localhost" "GET /_internal" "GET /_internal/revalidate"; do
    method=${call%% *} path=${call#* }
    if [[ "$method" == POST ]]; then raw POST "$path" "$host" "$work/shop.json" -; else raw GET "$path" "$host" - -; fi
    want_status "unsigned $method $path on $host" 404
    [[ ! -s "$work/b" ]] || fail "unsigned $method $path on $host: the refusal has a body"
    emit_raw "$f" "Unsigned $method $path, Host $host: 404, empty body" "$method" "$path" "$([[ $method == POST ]] && command cat "$work/shop.json" || echo -)"
  done
done
reset_limits
sreq() { printf '{"method":"%s","path":"%s"%s}' "$1" "$2" "${3:-}"; } # sreq <method> <path> [,"extra":json...]
raw GET "$RESOLVE" api.localhost - "$(sreq GET "$RESOLVE")"; want_status "signed resolve" 200
assert_js "signed resolve" "b.storeId==='$demo_store' && b.primaryHost==='demo.localhost'" "$work/b"
emit_raw "$f" "Signed GET /store/resolve for demo.localhost: 200 (the signature covers the full path)" GET "$RESOLVE"
raw POST /shop-api api.localhost "$work/shop.json" "$(sreq POST /shop-api ',"bodyFile":"'"$work/shop.json"'"')"
want_status "signed shop-api" 200; assert_js "signed shop-api" 'b.data.activeChannel.code==="__default_channel__"' "$work/b"
emit_raw "$f" "Signed POST /shop-api { activeChannel { code } }: 200" POST /shop-api "$(command cat "$work/shop.json")"
signed_store=',"storeId":"'"$demo_store"'"'
raw GET "$RESOLVE" api.localhost - "$(sreq GET "$RESOLVE" "$signed_store")"; want_status "signed with store" 200
emit_raw "$f" "Signed with x-store-id: 200" GET "$RESOLVE"
raw GET "$RESOLVE" api.localhost - "$(sreq GET "$RESOLVE" "$signed_store")" "x-store-id: ${demo_store}0"; want_status "changed store" 404
emit_raw "$f" "The same signature with a changed x-store-id: 404" GET "$RESOLVE"
raw GET "$RESOLVE&x=1" api.localhost - "$(sreq GET "$RESOLVE")"; want_status "changed query" 404
emit_raw "$f" "The same signature with one more query parameter: 404" GET "$RESOLVE&x=1"
raw POST "$RESOLVE" api.localhost - "$(sreq GET "$RESOLVE")"; want_status "changed method" 404
emit_raw "$f" "A signed GET sent as a POST: 404" POST "$RESOLVE"
raw POST /shop-api api.localhost "$work/logout.json" "$(sreq POST /shop-api ',"bodyFile":"'"$work/shop.json"'"')"; want_status "changed body" 404
emit_raw "$f" "A signed body replaced by another: 404" POST /shop-api "$(command cat "$work/logout.json")"
raw GET "$RESOLVE" api.localhost - "$(sreq GET "$RESOLVE" ',"tsOffset":-61')"; want_status "stale" 404
emit_raw "$f" "A signature 61 seconds old: 404" GET "$RESOLVE"
raw GET "$RESOLVE" api.localhost - "$(sreq GET "$RESOLVE" ',"tsOffset":-59')"; want_status "fresh enough" 200
emit_raw "$f" "A signature 59 seconds old: 200" GET "$RESOLVE"
node -e 'process.stdout.write(JSON.stringify({query:"{ activeChannel { code } }",padding:"x".repeat(101*1024)}))' >"$work/huge.json"
raw POST /shop-api api.localhost "$work/huge.json" "$(sreq POST /shop-api ',"bodyFile":"'"$work/huge.json"'"')"; want_status "oversize signed" 413
emit_raw "$f" "A signed body of 101 KB: 413" POST /shop-api "(about 101 KB of JSON, not shown)"
for host in "${HOSTS[@]}"; do
  reset_limits
  raw GET "/stores/subdomain-availability?subdomain=free-name" "$host" - -; want_status "availability on $host" 200
  emit_raw "$f" "Unsigned GET /stores/subdomain-availability, Host $host: 200 (public)" GET "/stores/subdomain-availability?subdomain=free-name"
done
# The storefront signs its own calls: the demo store renders through the guarded api.
status=$(curl -sS -D "$work/h" -o "$work/b" --max-time 30 -H 'Host: demo.localhost' -w '%{http_code}' "$site/") || status=000
want_status "storefront demo.localhost" 200
command grep -q 'Demo Store' "$work/b" || fail "the storefront at demo.localhost does not show the demo store"
command grep -oE '<title>[^<]*</title>' "$work/b" >"$work/b.trim" && command mv "$work/b.trim" "$work/b"
SHOWN_HEADERS='Host: demo.localhost' SHOWN_BODY=- TITLE='The storefront at demo.localhost renders the demo store through the signed client (only the <title> is shown)' \
  METHOD=GET URL="$site/" node scripts/evidence/transcript.mjs "$work/h" "$work/b" "$f"
status=$(curl -sS -o /dev/null --max-time 30 -H 'Host: nobody.localhost' -w '%{http_code}' "$site/") || status=000
[[ "$status" == 404 ]] || fail "an unknown store host answered $status on the storefront"

# --- screens ----------------------------------------------------------------------------------
reset_limits
EV_BUSINESS_ID=$business_demo timeout 900 node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/evidence/P1.S6-screens.mjs \
  "$api/dashboard" "$work/shots" >"$work/shots.txt" 2> >(command tee "$work/screens.log" >&2)
command cp "$work"/shots/*.png "$out/screens/"
shot_count=$(command ls "$out"/screens/*.png | command wc -l)
((shot_count == 8)) || fail "$shot_count screenshots, wanted 8"

# --- README -------------------------------------------------------------------------------------
{
  cat <<README
# Evidence for P1.S6 (platform plumbing)

Transcripts and screenshots from a live stack (CLAUDE.md §3a.14), produced by \`scripts/evidence/P1.S6.sh\`. Data is synthetic. Image
built from a tree with no uncommitted change outside the evidence folders and browser tests, last image-relevant commit
\`$image_commit\`. Compose project \`cod-evidence\`, \`PLATFORM_DEMO_HANDLERS=true\`.

## API transcripts

| File | Shows |
| --- | --- |
| [\`api/webhook-gateway.md\`](api/webhook-gateway.md) | A signed demo webhook (200), the same body again (200), the database counts (one key, one stored webhook \`processed\`, the outbox event \`platform.demo\` relayed, \`demo-log\` \`done\`), a bad signature 401, an unknown account 404, an unknown provider 404, 262 145 bytes 413 |
| [\`api/internal-guard.md\`](api/internal-guard.md) | Seven unsigned requests on four hosts (404, empty), signed resolve and Shop API (200), each tamper (store, query, method, body, 61 s old) 404, 101 KB 413, the public availability check on four hosts, the storefront rendering the demo store through the signed client |
| [\`api/flags.md\`](api/flags.md) | Staff \`featureFlags\`, \`updateFeatureFlag\`, a business override and \`evaluateFeatureFlag\` for both businesses, the merchant owner FORBIDDEN |
| [\`api/secrets.md\`](api/secrets.md) | \`setTenantSecret\` (value redacted), \`tenantSecrets\` with \`last4\`, the second business not seeing it, deleting another business's id not found, the ciphertext-only table |
| [\`api/jobs.md\`](api/jobs.md) | \`platformJobsHealth\` before and after \`runScheduledTask\` of \`outbox-sweeper\` and \`job-reconciler\` |
| [\`api/activity-log.md\`](api/activity-log.md) | The \`activity_log\` partitions from the catalog, a row in a later partition, \`UPDATE\` and \`DELETE\` refused, the activity API across partitions |

Store, business and secret ids and channel tokens are placeholders; every assertion ran on the real values. Request signatures and
secret values are \`[REDACTED]\` or absent. The host's one client address shares the rate limits, so the script clears the \`rl:*\`
keys of its own Valkey between groups.

## Screenshots

\`screens/flags-<lang>-<viewport>.png\` is the staff flags screen (\`/platform/flags\`) and
\`screens/flags-override-dialog-<lang>-<viewport>.png\` its Add override dialog, for desktop (1280 px) and mobile (390 px), Arabic and
English. $shot_count files.

## Browser assertions in \`scripts/evidence/P1.S6-screens.mjs\`

Each line below is a failing assertion in the script if it does not hold.

$(command sed -E 's/^/- /' <(command grep -v '^shot ' "$work/screens.log"))

README
  command cat scripts/evidence/P1.S6-seen.md
} >"$out/README.md"

# --- placeholders, sizes and redaction ------------------------------------------------------------
for t in "$out"/api/*.md; do normalise_file "$t"; done
if command grep -rqE '^HTTP/1\.1 [^0-9]' "$out/api"; then fail "a placeholder corrupted a status line"; fi
if command grep -rqE '^HTTP/1\.1 [0-9]{3}[^ 0-9]' "$out/api"; then fail "a placeholder corrupted a status line"; fi
for f in "$out"/screens/*.png; do
  (($(command stat -c %s "$f") <= 300 * 1024)) || fail "$f is over 300 KB"
done
((${#session_tokens[@]} >= 3 && ${#signatures[@]} >= 10)) || fail "the redaction check would be vacuous"
for secret in "${secret_values[@]}" "${run_secrets[@]}" "$AUTH_TOKEN_SECRET" "$DEMO_OWNER_PASSWORD" "$SUPERADMIN_PASSWORD" "${session_tokens[@]}" "${cookies[@]}" "${signatures[@]}" "$demo" "$second"; do
  if command grep -rqaF -- "$secret" "$out/api" "$out/README.md"; then fail "a raw secret, token or signature appears in $out"; fi
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
