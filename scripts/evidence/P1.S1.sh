#!/usr/bin/env bash
# Proof-of-working evidence for P1.S1 (CLAUDE.md §3a.14): runs the real compose stack under its own project (cod-evidence,
# host ports +20000), plus a second api container of the same image, seeds the demo businesses and records live
# transcripts of every new tenancy operation and REST route (cross-tenant not-found, FORBIDDEN, anonymous availability,
# a subdomain change seen by both api processes within 1 s) and screenshots of the storefront and dashboard into
# docs/evidence/P1.S1/, then tears the stack down. Never touches `cod` or `cod-verify`.
#
#   scripts/evidence/P1.S1.sh   # always rebuilds cod-platform:local first (the layer cache keeps that cheap)
#
# Data is synthetic. Generated ids and channel tokens are replaced by placeholders after their use is asserted.
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
# Synthetic; never printed (transcripts show [REDACTED]).
export DEMO_OWNER_PASSWORD=${DEMO_OWNER_PASSWORD:-evidence-demo-owner-password}
THIRD_OWNER_PASSWORD=evidence-third-owner-password

OWNER_A=owner@demo.example.test OWNER_B=owner@second.example.test
API2_PORT=23101 API2_NAME=cod-evidence-api2
MAX_PROPAGATION_MS=1000
SNOWFLAKE_RE='^[1-9][0-9]{0,18}$'

out=docs/evidence/P1.S1
api="http://127.0.0.1:$API_HOST_PORT"
api2="http://127.0.0.1:$API2_PORT"
admin="$api/admin-api?languageCode=en"
work=$(mktemp -d)

fail() { echo "EVIDENCE FAILED: $*" >&2; exit 1; }
on_exit() {
  local status=$?
  if ((status != 0)); then
    docker compose ps -a >&2 || true
    docker compose logs --no-color --tail=40 migrate api >&2 || true
  fi
  docker rm -f "$API2_NAME" >/dev/null 2>&1 || true
  docker compose down -v --remove-orphans >/dev/null 2>&1 || true
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

[[ -n "${SUPERADMIN_PASSWORD:-}" && -n "${COOKIE_SECRET:-}" ]] || fail "SUPERADMIN_PASSWORD or COOKIE_SECRET is empty"
secret_values=()
while IFS='=' read -r _ value; do
  value=${value%\"}; value=${value#\"}
  [[ -n "$value" ]] && secret_values+=("$value")
done < <(command grep -E '^(export[[:space:]]+)?[A-Z0-9_]*(PASSWORD|SECRET|TOKEN|_KEY)=' .env)
((${#secret_values[@]} >= 2)) || fail "fewer than 2 secret values in .env"

# --- image, from a tree that matches the commit the README names ---------------------------
image_inputs=(. ':!docs/evidence' ':!scripts/evidence' ':!.superpowers')
dirty=$(git status --porcelain -- "${image_inputs[@]}")
[[ -z "$dirty" ]] || fail "uncommitted changes outside the evidence folders:
$dirty"
image_commit=$(git log -1 --format=%H -- "${image_inputs[@]}")
NEXT_DEPLOYMENT_ID="$(git rev-parse --short "$image_commit")"
export NEXT_DEPLOYMENT_ID
docker compose down -v --remove-orphans
# EVIDENCE_REUSE_IMAGE=1 skips the rebuild while iterating on this script: scripts/evidence is in the build context,
# so every edit here would rebuild an image whose inputs did not change.
[[ "${EVIDENCE_REUSE_IMAGE:-}" == 1 ]] || docker compose build migrate
docker compose up -d api worker storefront
wait_healthy api worker storefront
wait_http 200 "$api/readyz" 120 || fail "api /readyz"
wait_http 200 "$api/dashboard/" 60 || fail "api /dashboard/"

# --- demo seed, twice: the second run changes nothing -----------------------------------------
seed() {
  docker compose run --rm --no-deps -e DEMO_OWNER_PASSWORD --entrypoint node migrate apps/server/dist/main-seed-demo.js >"$work/seed.log" 2>&1 ||
    fail "the demo seed failed: $(command tail -20 "$work/seed.log")"
  command grep '"seed-demo.done"' "$work/seed.log" || fail "the demo seed printed no result: $(command tail -20 "$work/seed.log")"
}
first=$(seed); second=$(seed)
[[ "$first" == '{"event":"seed-demo.done","created":["demo","demo2","second","second2"]}' ]] || fail "first seed: $first"
[[ "$second" == '{"event":"seed-demo.done","created":[]}' ]] || fail "second seed: $second"

# --- the second api process -----------------------------------------------------------------
docker compose run -d --no-deps --name "$API2_NAME" -p "127.0.0.1:$API2_PORT:3000" api >/dev/null
wait_http 200 "$api2/readyz" 240 || fail "second api /readyz"

rm -rf "$out/api"
mkdir -p "$out/api"

# --- helpers --------------------------------------------------------------------------------
js() { node -e 'const b=JSON.parse(require("fs").readFileSync(process.argv[2],"utf8")); const r=eval(process.argv[1]); console.log(typeof r==="string"?r:JSON.stringify(r))' "$1" "$2"; }
assert_js() { [[ "$(js "$2" "$3")" == true ]] || fail "$1: '$2' is not true for $(command cat "$3")"; }

# Literal generated values -> placeholder, longest first so a token never leaves a fragment behind.
declare -A PLACEHOLDERS=()
remember() { [[ -n "$2" && "$2" != undefined ]] || fail "remember $1: empty"; PLACEHOLDERS[$2]=$1; }
remember_id() { [[ "$2" =~ $SNOWFLAKE_RE ]] || fail "$1: '$2' is not a snowflake id"; remember "$1" "$2"; }
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
gql() { # gql <query> <vars-json> <session|-> <channel|->
  local body status
  body=$(Q="$1" V="$2" node -e 'console.log(JSON.stringify({query:process.env.Q,variables:JSON.parse(process.env.V)}))')
  local -a args=(-sS -X POST -D "$work/h" -o "$work/b" --max-time 30 -H "$json" --data "$body")
  [[ "$3" != - ]] && args+=(-H "Authorization: Bearer $3")
  [[ "$4" != - ]] && args+=(-H "vendure-token: $4")
  status=$(curl "${args[@]}" -w '%{http_code}' "$admin") || status=000
  [[ "$status" != 000 ]] || fail "no HTTP answer from $admin"
}
emit() { # emit <file> <title> <query> <shown-vars> <session|-> <channel|->
  local -a shown=("$json")
  [[ "$5" != - ]] && shown+=("Authorization: Bearer [REDACTED]")
  [[ "$6" != - ]] && shown+=("vendure-token: [REDACTED]")
  local shown_body
  shown_body=$(Q="$3" V="$4" node -e 'console.log(JSON.stringify({query:process.env.Q,variables:JSON.parse(process.env.V)}))')
  SHOWN_HEADERS=$(printf '%s\n' "${shown[@]}") SHOWN_BODY=$shown_body TITLE=$2 METHOD=POST URL="$admin" \
    node scripts/evidence/transcript.mjs "$work/h" "$work/b" "$1"
}
rest() { # rest <url> -> status in $status, body in $work/b
  status=$(curl -sS -D "$work/h" -o "$work/b" --max-time 30 -w '%{http_code}' "$1") || status=000
  [[ "$status" != 000 ]] || fail "no HTTP answer from $1"
}
emit_rest() { SHOWN_HEADERS="" SHOWN_BODY=- TITLE=$2 METHOD=GET URL="$3" node scripts/evidence/transcript.mjs "$work/h" "$work/b" "$1"; }
begin() { printf '# %s\n\n%s\n\n' "$2" "$3" >"$1"; }
vars() { node -e 'console.log(JSON.stringify(eval("("+process.argv[1]+")")))' "$1"; }

login_tokens=() cookies=()
Q_LOGIN='mutation ($username: String!, $password: String!) { login(username: $username, password: $password) { __typename ... on CurrentUser { identifier } ... on ErrorResult { errorCode message } } }'
login() { # login <user> <password> -> $LAST_TOKEN
  gql "$Q_LOGIN" "$(U="$1" P="$2" node -e 'console.log(JSON.stringify({username:process.env.U,password:process.env.P}))')" - -
  assert_js "login $1" 'b.data.login.__typename==="CurrentUser"' "$work/b"
  LAST_TOKEN=$(command grep -i '^vendure-auth-token:' "$work/h" | command head -1 | command tr -d '\r' | command awk '{print $2}')
  [[ -n "$LAST_TOKEN" ]] || fail "login $1: no auth token header"
  login_tokens+=("$LAST_TOKEN")
  while read -r c; do [[ -n "$c" ]] && cookies+=("$c"); done < <(command grep -i '^set-cookie:' "$work/h" | command sed -E 's/^[^=]+=([^;[:space:]]+).*/\1/')
}

STORE_FIELDS='id businessId name description language subdomain soldOutBehavior showAddressField status'
Q_ACTIVE_BUSINESS='query { activeBusiness { id name status } }'
Q_BUSINESS='query ($id: String!) { business(id: $id) { id name status } }'
Q_STORES="query { stores { $STORE_FIELDS channelToken } }"
Q_STORE="query (\$id: String!) { store(id: \$id) { $STORE_FIELDS } }"
Q_SUB='query ($subdomain: String!) { subdomainAvailability(subdomain: $subdomain) { subdomain status reason } }'
Q_PROVISION='mutation ($input: ProvisionBusinessInput!) { provisionBusiness(input: $input) { business { id name status } store { id subdomain language status } administratorId } }'
Q_UPDATE_BUSINESS='mutation ($input: UpdateBusinessInput!) { updateBusiness(input: $input) { id name status } }'
Q_CREATE_STORE="mutation (\$input: CreateStoreInput!) { createStore(input: \$input) { $STORE_FIELDS } }"
Q_UPDATE_STORE="mutation (\$id: String!, \$input: UpdateStoreInput!) { updateStore(id: \$id, input: \$input) { $STORE_FIELDS } }"
Q_ARCHIVE='mutation ($id: String!) { archiveStore(id: $id) { id subdomain status } }'
Q_CHANGE='mutation ($id: String!, $subdomain: String!) { changeStoreSubdomain(id: $id, subdomain: $subdomain) { id subdomain status } }'
Q_CHANNELS='query { channels { items { id code token } } }'
Q_ACTIVE_CHANNEL='query { activeChannel { code } }'
Q_NOTE='mutation ($input: CreateTemplateNoteInput!) { createTemplateNote(input: $input) { id } }'
Q_NOTES='query { templateNotes(take: 10) { id title } }'

# --- sessions, ids and tokens (setup) -------------------------------------------------------------
login "$SUPERADMIN_USERNAME" "$SUPERADMIN_PASSWORD"; super=$LAST_TOKEN
login "$OWNER_A" "$DEMO_OWNER_PASSWORD"; owner_a=$LAST_TOKEN
login "$OWNER_B" "$DEMO_OWNER_PASSWORD"; owner_b=$LAST_TOKEN

store_of() { # store_of <json-file> <subdomain> <field>
  js "b.data.stores.find(s=>s.subdomain==='$2').$3" "$1"
}
Q_ME='query { me { channels { token } } }'
# The owner holds no default-channel role, so the first tenant request needs one of the owner's own channel tokens.
own_token() { gql "$Q_ME" '{}' "$1" -; js 'b.data.me.channels[0].token' "$work/b"; }
gql_stores_of() { local token; token=$(own_token "$1"); gql "$Q_STORES" '{}' "$1" "$token"; }
gql_stores_of "$owner_a"
assert_js "A's stores" 'b.data.stores.length===2' "$work/b"
command cp "$work/b" "$work/a-stores"
TOKEN_A=$(store_of "$work/a-stores" demo channelToken); TOKEN_A2=$(store_of "$work/a-stores" demo2 channelToken)
STORE_A=$(store_of "$work/a-stores" demo id); STORE_A2=$(store_of "$work/a-stores" demo2 id); BUSINESS_A=$(store_of "$work/a-stores" demo businessId)
gql_stores_of "$owner_b"
command cp "$work/b" "$work/b-stores"
TOKEN_B=$(store_of "$work/b-stores" second channelToken); STORE_B=$(store_of "$work/b-stores" second id); BUSINESS_B=$(store_of "$work/b-stores" second businessId)
remember CHANNEL_TOKEN_A "$TOKEN_A"; remember CHANNEL_TOKEN_A2 "$TOKEN_A2"; remember CHANNEL_TOKEN_B "$TOKEN_B"
remember_id STORE_A_ID "$STORE_A"; remember_id STORE_A2_ID "$STORE_A2"; remember_id STORE_B_ID "$STORE_B"
remember_id BUSINESS_A_ID "$BUSINESS_A"; remember_id BUSINESS_B_ID "$BUSINESS_B"
gql "$Q_ACTIVE_CHANNEL" '{}' "$owner_a" "$TOKEN_A"
CODE_A=$(js 'b.data.activeChannel.code' "$work/b")

# Notes for the dashboard shots (setup).
TITLE_A1='Call supplier' TITLE_A2='مكالمة المورد' TITLE_B1="B's private note"
note() { gql "$Q_NOTE" "$(T="$1" node -e 'console.log(JSON.stringify({input:{title:process.env.T,body:"evidence"}}))')" "$2" "$3"; assert_js "note $1" '!b.errors' "$work/b"; }
note "$TITLE_A1" "$owner_a" "$TOKEN_A"; note "$TITLE_A2" "$owner_a" "$TOKEN_A"; note "$TITLE_B1" "$owner_b" "$TOKEN_B"

# --- provision.md ----------------------------------------------------------------------------
f="$out/api/provision.md"
begin "$f" "provisionBusiness" "SuperAdmin-only (D5). Creates the Seller, Business, Owner role, Channel and first Store in one transaction. Ids are placeholders; the password is redacted."
real=$(P="$THIRD_OWNER_PASSWORD" node -e 'console.log(JSON.stringify({input:{name:"Third",owner:{emailAddress:"owner@third.example.test",firstName:"Third",lastName:"Owner",password:process.env.P},store:{name:"Third Store",subdomain:"third",language:"ar"}}}))')
shown=$(node -e 'console.log(JSON.stringify({input:{name:"Third",owner:{emailAddress:"owner@third.example.test",firstName:"Third",lastName:"Owner",password:"[REDACTED]"},store:{name:"Third Store",subdomain:"third",language:"ar"}}}))')
gql "$Q_PROVISION" "$real" "$super" -
assert_js provision '!b.errors && b.data.provisionBusiness.store.subdomain==="third"' "$work/b"
remember_id BUSINESS_C_ID "$(js 'b.data.provisionBusiness.business.id' "$work/b")"
remember_id STORE_C_ID "$(js 'b.data.provisionBusiness.store.id' "$work/b")"
remember ADMIN_C_ID "$(js 'b.data.provisionBusiness.administratorId' "$work/b")"
emit "$f" "Superadmin provisions a business" "$Q_PROVISION" "$shown" "$super" -

# --- business.md -----------------------------------------------------------------------------
f="$out/api/business.md"
begin "$f" "Business queries and updateBusiness" "The demo owner, on the Arabic store's channel."
gql "$Q_ACTIVE_BUSINESS" '{}' "$owner_a" "$TOKEN_A"
assert_js activeBusiness "b.data.activeBusiness.id==='$BUSINESS_A' && b.data.activeBusiness.name==='Demo'" "$work/b"
emit "$f" "activeBusiness" "$Q_ACTIVE_BUSINESS" '{}' "$owner_a" "$TOKEN_A"
gql "$Q_BUSINESS" "$(vars "{id:'$BUSINESS_A'}")" "$owner_a" "$TOKEN_A"
assert_js business "b.data.business.id==='$BUSINESS_A'" "$work/b"
emit "$f" "business(id) of the caller's own business" "$Q_BUSINESS" '{"id":"<BUSINESS_A_ID>"}' "$owner_a" "$TOKEN_A"
gql "$Q_UPDATE_BUSINESS" '{"input":{"name":"Demo"}}' "$owner_a" "$TOKEN_A"
assert_js updateBusiness '!b.errors && b.data.updateBusiness.name==="Demo"' "$work/b"
emit "$f" "updateBusiness" "$Q_UPDATE_BUSINESS" '{"input":{"name":"Demo"}}' "$owner_a" "$TOKEN_A"

# --- stores.md -------------------------------------------------------------------------------
f="$out/api/stores.md"
begin "$f" "Store queries and mutations" "The demo owner, on the Arabic store's channel. Channel tokens and ids are placeholders."
gql "$Q_STORES" '{}' "$owner_a" "$TOKEN_A"
assert_js stores "JSON.stringify(b.data.stores.map(s=>s.subdomain).sort())==='[\"demo\",\"demo2\"]'" "$work/b"
emit "$f" "stores: the two stores of the business" "$Q_STORES" '{}' "$owner_a" "$TOKEN_A"
gql "$Q_STORE" "$(vars "{id:'$STORE_A'}")" "$owner_a" "$TOKEN_A"
assert_js store "b.data.store.language==='ar' && b.data.store.subdomain==='demo'" "$work/b"
emit "$f" "store(id)" "$Q_STORE" '{"id":"<STORE_A_ID>"}' "$owner_a" "$TOKEN_A"
create='{"input":{"name":"Demo Store 3","subdomain":"demo3","language":"fr"}}'
gql "$Q_CREATE_STORE" "$create" "$owner_a" "$TOKEN_A"
assert_js createStore '!b.errors && b.data.createStore.subdomain==="demo3"' "$work/b"
STORE_A3=$(js 'b.data.createStore.id' "$work/b"); remember_id STORE_A3_ID "$STORE_A3"
emit "$f" "createStore" "$Q_CREATE_STORE" "$create" "$owner_a" "$TOKEN_A"
gql "$Q_CREATE_STORE" "$create" "$owner_a" "$TOKEN_A"
assert_js "createStore taken" 'b.errors.length===1 && !b.data' "$work/b"
emit "$f" "createStore with a taken subdomain: a typed error, nothing created" "$Q_CREATE_STORE" "$create" "$owner_a" "$TOKEN_A"
patch='{"description":"Evidence store","soldOutBehavior":"hide"}'
gql "$Q_UPDATE_STORE" "$(vars "{id:'$STORE_A3',input:$patch}")" "$owner_a" "$TOKEN_A"
assert_js updateStore 'b.data.updateStore.soldOutBehavior==="hide"' "$work/b"
emit "$f" "updateStore" "$Q_UPDATE_STORE" "{\"id\":\"<STORE_A3_ID>\",\"input\":$patch}" "$owner_a" "$TOKEN_A"
gql "$Q_ARCHIVE" "$(vars "{id:'$STORE_A3'}")" "$owner_a" "$TOKEN_A"
assert_js archiveStore 'b.data.archiveStore.status==="archived"' "$work/b"
emit "$f" "archiveStore" "$Q_ARCHIVE" '{"id":"<STORE_A3_ID>"}' "$owner_a" "$TOKEN_A"
rest "$api/store/resolve?host=demo3.localhost"
[[ "$status" == 404 ]] || fail "archived store's host answered $status"
emit_rest "$f" "The archived store's host no longer resolves" "$api/store/resolve?host=demo3.localhost"

# --- availability.md (anonymous) --------------------------------------------------------------
f="$out/api/availability.md"
begin "$f" "Subdomain availability, anonymous" "No session and no channel token: the sign-up wizard has neither. Same answer from REST and GraphQL."
check_rest() { # check_rest <subdomain> <expected status>
  local url="$api/stores/subdomain-availability?subdomain=$1"
  rest "$url"
  [[ "$status" == 200 ]] || fail "availability $1: HTTP $status"
  assert_js "availability $1" "b.status==='$2'" "$work/b"
  emit_rest "$f" "GET availability of '$1': $2" "$url"
}
check_rest fresh-name available; check_rest demo taken; check_rest demo3 taken; check_rest admin reserved; check_rest 'A!' invalid
gql "$Q_SUB" '{"subdomain":"demo"}' - -
assert_js "gql availability" 'b.data.subdomainAvailability.status==="taken"' "$work/b"
emit "$f" "GraphQL subdomainAvailability, anonymous" "$Q_SUB" '{"subdomain":"demo"}' - -

# --- resolve.md -------------------------------------------------------------------------------
f="$out/api/resolve.md"
begin "$f" "Store resolution (public REST)" "What the storefront asks on each request. Only public fields leave; an unknown host is a 404, never a 500."
rest "$api/store/resolve?host=demo.localhost"
[[ "$status" == 200 ]] || fail "resolve demo: $status"
assert_js "resolve fields" "Object.keys(b).sort().join()==='businessId,language,logo,name,primaryHost,status,storeId' && b.storeId==='$STORE_A'" "$work/b"
emit_rest "$f" "resolve demo.localhost" "$api/store/resolve?host=demo.localhost"
rest "$api/store/resolve?host=DEMO.Localhost:3001"
[[ "$status" == 200 ]] || fail "normalised host: $status"
emit_rest "$f" "resolve an unusual host form (case and port)" "$api/store/resolve?host=DEMO.Localhost:3001"
rest "$api/store/resolve?host=nope.localhost"
[[ "$status" == 404 ]] || fail "unknown host: $status"
emit_rest "$f" "resolve an unknown host" "$api/store/resolve?host=nope.localhost"
rest "$api/store/by-id/$STORE_B"
[[ "$status" == 200 ]] || fail "by-id: $status"
assert_js "by-id" "b.name==='Second Store'" "$work/b"
emit_rest "$f" "by-id of the second store" "$api/store/by-id/<STORE_B_ID>"
rest "$api/store/by-id/1"
[[ "$status" == 404 ]] || fail "by-id unknown: $status"
emit_rest "$f" "by-id of an unknown store" "$api/store/by-id/1"

# --- isolation.md -----------------------------------------------------------------------------
f="$out/api/isolation.md"
begin "$f" "Cross-tenant not-found" "The owner of Demo (A), on A's channel, asks for ids of Second (B). Reads answer null, writes answer a not-found error; B's data never appears."
gql "$Q_BUSINESS" "$(vars "{id:'$BUSINESS_B'}")" "$owner_a" "$TOKEN_A"
assert_js "business of B" 'b.data.business===null && !b.errors' "$work/b"
emit "$f" "A: business(id of B) is null" "$Q_BUSINESS" '{"id":"<BUSINESS_B_ID>"}' "$owner_a" "$TOKEN_A"
gql "$Q_STORE" "$(vars "{id:'$STORE_B'}")" "$owner_a" "$TOKEN_A"
assert_js "store of B" 'b.data.store===null && !b.errors' "$work/b"
emit "$f" "A: store(id of B's store) is null" "$Q_STORE" '{"id":"<STORE_B_ID>"}' "$owner_a" "$TOKEN_A"
refused() { # refused <title> <query> <real-vars> <shown-vars>
  gql "$2" "$3" "$owner_a" "$TOKEN_A"
  assert_js "$1" "b.errors.length===1 && !b.data && !JSON.stringify(b).includes('Second') && /not.found/i.test(b.errors[0].extensions.code)" "$work/b"
  emit "$f" "$1" "$2" "$4" "$owner_a" "$TOKEN_A"
}
refused "A: updateStore on B's store" "$Q_UPDATE_STORE" "$(vars "{id:'$STORE_B',input:{description:'x'}}")" '{"id":"<STORE_B_ID>","input":{"description":"x"}}'
refused "A: archiveStore on B's store" "$Q_ARCHIVE" "$(vars "{id:'$STORE_B'}")" '{"id":"<STORE_B_ID>"}'
refused "A: changeStoreSubdomain on B's store" "$Q_CHANGE" "$(vars "{id:'$STORE_B',subdomain:'stolen'}")" '{"id":"<STORE_B_ID>","subdomain":"stolen"}'
gql "$Q_NOTES" '{}' "$owner_a" "$TOKEN_A"
assert_js "A's notes" "!JSON.stringify(b).includes(\"B's private\") && b.data.templateNotes.length===2" "$work/b"
remember NOTE_A2_ID "$(js 'b.data.templateNotes[0].id' "$work/b")"; remember NOTE_A1_ID "$(js 'b.data.templateNotes[1].id' "$work/b")"
emit "$f" "A: templateNotes lists A's notes only" "$Q_NOTES" '{}' "$owner_a" "$TOKEN_A"

# --- forbidden.md -----------------------------------------------------------------------------
f="$out/api/forbidden.md"
begin "$f" "FORBIDDEN" "Permission refusals. Another business's channel token is Vendure's FORBIDDEN at the auth guard (D8); the owner role holds no ReadChannel, so \`channels\` cannot list every store's token (A1)."
forbid() { # forbid <title> <query> <vars> <session> <channel> [shown-vars]
  gql "$2" "$3" "$4" "$5"
  assert_js "$1" 'b.errors.length===1 && b.errors[0].extensions.code==="FORBIDDEN"' "$work/b"
  emit "$f" "$1" "$2" "${6:-$3}" "$4" "$5"
}
forbid "A's owner on B's channel: stores" "$Q_STORES" '{}' "$owner_a" "$TOKEN_B"
forbid "A's owner: channels" "$Q_CHANNELS" '{}' "$owner_a" "$TOKEN_A"
forbid "A's owner: provisionBusiness (SuperAdmin only)" "$Q_PROVISION" "$real" "$owner_a" "$TOKEN_A" "$shown"
forbid "Anonymous: stores" "$Q_STORES" '{}' - -
forbid "Superadmin on the default channel: templateNotes (no tenant)" "$Q_NOTES" '{}' "$super" -

# --- subdomain-change.md: both processes ------------------------------------------------------
f="$out/api/subdomain-change.md"
begin "$f" "Subdomain change seen by two api processes" "Two api processes of the same image (ports $API_HOST_PORT and $API2_PORT). Both answer for the old host, so each has it in memory; one process changes the subdomain; the script asserts that both stop resolving the old host and resolve the new one within ${MAX_PROPAGATION_MS} ms, measured from the mutation's response."
for base in "$api" "$api2"; do
  rest "$base/store/resolve?host=demo2.localhost"
  [[ "$status" == 200 ]] || fail "priming $base: $status"
  emit_rest "$f" "Before: old host on $base" "$base/store/resolve?host=demo2.localhost"
done
gql "$Q_CHANGE" "$(vars "{id:'$STORE_A2',subdomain:'demo2-new'}")" "$owner_a" "$TOKEN_A"
changed_at=$(date +%s%3N)
assert_js "change" 'b.data.changeStoreSubdomain.subdomain==="demo2-new"' "$work/b"
emit "$f" "changeStoreSubdomain on the first process" "$Q_CHANGE" '{"id":"<STORE_A2_ID>","subdomain":"demo2-new"}' "$owner_a" "$TOKEN_A"
await_status() { # await_status <url> <status>: waits until the url answers status, else fails after the budget
  local url=$1 want=$2 elapsed code
  while :; do
    code=$(curl -s -o /dev/null --max-time 2 -w '%{http_code}' "$url")
    elapsed=$(($(date +%s%3N) - changed_at))
    [[ "$code" == "$want" ]] && { echo "$elapsed"; return 0; }
    ((elapsed < MAX_PROPAGATION_MS)) || fail "$url answered $code after ${elapsed} ms, wanted $want"
  done
}
for base in "$api" "$api2"; do
  await_status "$base/store/resolve?host=demo2.localhost" 404 >/dev/null
  await_status "$base/store/resolve?host=demo2-new.localhost" 200 >/dev/null
  rest "$base/store/resolve?host=demo2.localhost"; emit_rest "$f" "After: old host on $base" "$base/store/resolve?host=demo2.localhost"
  rest "$base/store/resolve?host=demo2-new.localhost"; emit_rest "$f" "After: new host on $base" "$base/store/resolve?host=demo2-new.localhost"
done
gql "$Q_CHANGE" "$(vars "{id:'$STORE_A2',subdomain:'demo2'}")" "$owner_a" "$TOKEN_A"
assert_js "change back" '!b.errors' "$work/b"

# --- screenshots ------------------------------------------------------------------------------
export DEMO_STORE_NAME='Demo Store' DEMO_STORE_LOCALE=ar DEMO_STORE_HOST=demo.localhost
export SECOND_STORE_NAME='Second Store' SECOND_STORE_LOCALE=fr SECOND_STORE_HOST=second.localhost
export STORE_NAME_TEST_ID=store-name NOT_FOUND_TEST_ID=not-found NOT_FOUND_TEXT='Page not found' UNKNOWN_HOST=nope.localhost
node scripts/evidence/storefront-screens.mjs "$STOREFRONT_HOST_PORT" "$work/shots-store" "$work/store-table.md"
OWNER_EMAIL_A=$OWNER_A OWNER_EMAIL_B=$OWNER_B CHANNEL_CODE_A=$CODE_A CHANNEL_TOKEN_A=$TOKEN_A \
  NOTE_TITLES="$TITLE_A1|$TITLE_A2" OTHER_BUSINESS_TITLE="$TITLE_B1" \
  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/evidence/template-screens.mjs "$api/dashboard" "$work/shots-dash" "$work/dash-table.md"
rm -rf "$out/screens"
mkdir -p "$out/screens"
command cp "$work"/shots-store/*.png "$work"/shots-dash/*.png "$out/screens/"

# --- README, with what a person saw in the shots -----------------------------------------------
{
  cat <<README
# Evidence for P1.S1 (tenancy)

Transcripts and screenshots from a live stack (CLAUDE.md §3a.14), produced by \`scripts/evidence/P1.S1.sh\`. Data is synthetic
(demo seed, placeholders from \`.env.example\`). Image built from a tree with no uncommitted change outside the evidence
folders, last image-relevant commit \`$image_commit\`. Compose project \`cod-evidence\`, with a second api container on port $API2_PORT.
The demo seed ran twice; the second run created nothing.

## API transcripts

| File | Shows |
| --- | --- |
| [\`api/provision.md\`](api/provision.md) | \`provisionBusiness\` |
| [\`api/business.md\`](api/business.md) | \`activeBusiness\`, \`business\`, \`updateBusiness\` |
| [\`api/stores.md\`](api/stores.md) | \`stores\`, \`store\`, \`createStore\` (also taken), \`updateStore\`, \`archiveStore\` and the archived host's 404 |
| [\`api/availability.md\`](api/availability.md) | Anonymous availability: available, taken (also an archived store's), reserved, invalid; REST and GraphQL |
| [\`api/resolve.md\`](api/resolve.md) | \`GET /store/resolve\` and \`GET /store/by-id/:id\`, including 404s |
| [\`api/isolation.md\`](api/isolation.md) | Cross-tenant not-found: A's owner on B's ids |
| [\`api/forbidden.md\`](api/forbidden.md) | FORBIDDEN: B's channel token, \`channels\`, \`provisionBusiness\`, anonymous, superadmin without a tenant |
| [\`api/subdomain-change.md\`](api/subdomain-change.md) | \`changeStoreSubdomain\`: both api processes drop the old host and serve the new one within ${MAX_PROPAGATION_MS} ms |

Ids and channel tokens are replaced by placeholders after every assertion ran on the real values. Session tokens, cookies and
passwords are redacted.

## Screenshots

Storefront:

| File | URL | Viewport | Status | Asserted |
| --- | --- | --- | --- | --- |
$(command cat "$work/store-table.md")

Dashboard, signed in as the demo owner on the Arabic store:

| File | URL | Viewport | Language | \`dir\` / \`lang\` asserted |
| --- | --- | --- | --- | --- |
$(command cat "$work/dash-table.md")
| [\`dashboard-content-language-ar-desktop.png\`](screens/dashboard-content-language-ar-desktop.png) | \`/dashboard/template-notes\`, channel switcher open | desktop 1280x800 | ar | content language asserted \`ar\` |

README
  [[ -f scripts/evidence/P1.S1-seen.md ]] && command cat scripts/evidence/P1.S1-seen.md
} >"$out/README.md"

# --- placeholders, sizes and redaction ------------------------------------------------------------
for t in "$out"/api/*.md; do normalise_file "$t"; done
for f in "$out"/screens/*.png; do
  (($(command stat -c %s "$f") <= 300 * 1024)) || fail "$f is over 300 KB"
done
(($(command ls "$out"/screens/*.png | command wc -l) == 11)) || fail "expected 11 PNGs"
((${#login_tokens[@]} >= 3 && ${#cookies[@]} >= 1)) || fail "the redaction check would be vacuous"
for secret in "${secret_values[@]}" "$DEMO_OWNER_PASSWORD" "$THIRD_OWNER_PASSWORD" "${login_tokens[@]}" "${cookies[@]}" "$TOKEN_A" "$TOKEN_A2" "$TOKEN_B"; do
  if command grep -rqaF -- "$secret" "$out"; then fail "a raw secret or token appears in $out"; fi
done
echo "EVIDENCE-OK"
