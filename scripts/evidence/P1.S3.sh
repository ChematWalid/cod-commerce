#!/usr/bin/env bash
# Proof-of-working evidence for P1.S3 (CLAUDE.md §3a.14): runs the real compose stack under its own project (cod-evidence, host
# ports +20000), a second api process on the same Valkey and Postgres, records every RBAC endpoint plus the refusals, the
# cross-tenant cases and a permission removed mid-session, takes the screenshots, runs the browser suite against this stack, and
# tears everything down. Never touches `cod` or `cod-verify`.
#
#   timeout 1500 scripts/evidence/P1.S3.sh   # always builds cod-platform:local first
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
export DEMO_OWNER_PASSWORD=${DEMO_OWNER_PASSWORD:-evidence-demo-owner-password}
export EV_RUN=${EV_RUN:-$(date +%s)}

API2_PORT=23101 API2_NAME=cod-evidence-second-api
out=docs/evidence/P1.S3
api="http://127.0.0.1:$API_HOST_PORT"
api2="http://127.0.0.1:$API2_PORT"
mailpit="http://127.0.0.1:$MAILPIT_UI_HOST_PORT"
work=$(mktemp -d)
SNOWFLAKE_RE='^[1-9][0-9]{15,18}$'
# Values are replaced anywhere in a transcript, so a short one would corrupt status codes and other digits.
MIN_PLACEHOLDER_VALUE_LENGTH=16

OWNER=owner@demo.example.test SECOND_OWNER=owner@second.example.test
LIMITED=limited@demo.example.test ORDERS=orders@demo.example.test

fail() { echo "EVIDENCE FAILED: $*" >&2; exit 1; }
on_exit() {
  local status=$?
  if ((status != 0)); then
    docker compose ps -a >&2 || true
    docker compose logs --no-color --tail=30 migrate api worker >&2 || true
    docker logs --tail=30 "$API2_NAME" >&2 || true
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
# Browser tests and the workflow do not reach the image's build output; the evidence folders never do.
image_inputs=(. ':!docs/evidence' ':!scripts/evidence' ':!.superpowers' ':!apps/server/tests/browser' ':!.github/workflows/browser.yml')
dirty=$(git status --porcelain -- "${image_inputs[@]}")
[[ -z "$dirty" ]] || fail "uncommitted changes outside the evidence folders:
$dirty"
image_commit=$(git log -1 --format=%H -- "${image_inputs[@]}")
NEXT_DEPLOYMENT_ID="$(git rev-parse --short "$image_commit")"
export NEXT_DEPLOYMENT_ID
timeout 120 docker compose down -v --remove-orphans
timeout 600 docker compose build migrate
# A fresh Postgres volume can outlast its healthcheck on a loaded host; the second try finds it ready.
timeout 300 docker compose up -d api worker storefront mailpit || timeout 300 docker compose up -d api worker storefront mailpit
wait_healthy api worker storefront
wait_http 200 "$api/readyz" 120 || fail "api /readyz"
wait_http 200 "$api/dashboard/" 60 || fail "api /dashboard/"

seed() { timeout 180 docker compose run --rm --no-deps -e DEMO_OWNER_PASSWORD --entrypoint node migrate apps/server/dist/main-seed-demo.js; }
seed >"$work/seed.log" 2>&1 || fail "the demo seed failed: $(command tail -20 "$work/seed.log")"
command grep -q 'limited@demo.example.test' "$work/seed.log" || fail "the seed did not create the members"
seed >"$work/seed2.log" 2>&1 || fail "the second seed failed: $(command tail -20 "$work/seed2.log")"
command grep -q '"created":\[\]' "$work/seed2.log" || fail "the second seed changed something: $(command tail -3 "$work/seed2.log")"

# --- a second api process on the same Valkey and Postgres ----------------------------------
timeout 60 docker compose run -d --no-deps --name "$API2_NAME" -p "127.0.0.1:$API2_PORT:3000" -e AUTH_DASHBOARD_URL="$api2/dashboard" api >/dev/null
wait_http 200 "$api2/readyz" 240 || fail "second api /readyz"

reset_limits() { # Between phases only: every call from this host shares one client address.
  timeout 30 docker compose exec -T valkey sh -c "valkey-cli --scan --pattern 'rl:*' | xargs -r valkey-cli del" >/dev/null
}
psql_value() { timeout 30 docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "$1"' _ "$1"; }

rm -rf "$out/api" "$out/screens"
mkdir -p "$out/api" "$out/screens"

# --- helpers (as in P1.S2.sh) ----------------------------------------------------------------
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
target=$api
gql() { # gql <query> <vars-json> <session|-> <channel|-> -> $status, $work/h, $work/b
  local body
  body=$(Q="$1" V="$2" node -e 'console.log(JSON.stringify({query:process.env.Q,variables:JSON.parse(process.env.V)}))')
  local -a args=(-sS -X POST -D "$work/h" -o "$work/b" --max-time 30 -H "$json" --data "$body")
  [[ "$3" != - ]] && args+=(-H "Authorization: Bearer $3")
  [[ "$4" != - ]] && args+=(-H "vendure-token: $4")
  status=$(curl "${args[@]}" -w '%{http_code}' "$target/admin-api?languageCode=en") || status=000
  [[ "$status" != 000 ]] || fail "no HTTP answer from $target"
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
  SHOWN_HEADERS=$(shown_headers "$5" "$6") SHOWN_BODY=$shown_body TITLE=$2 METHOD=POST URL="$target/admin-api?languageCode=en" \
    node scripts/evidence/transcript.mjs "$work/h" "$work/b" "$1"
}
rest() { # rest <method> <path> <body|-> <session> <channel> -> $status, $work/h, $work/b
  local -a args=(-sS -X "$1" -D "$work/h" -o "$work/b" --max-time 30 -H "Authorization: Bearer $4" -H "vendure-token: $5")
  [[ "$3" != - ]] && args+=(-H "$json" --data "$3")
  status=$(curl "${args[@]}" -w '%{http_code}' "$target$2") || status=000
  [[ "$status" != 000 ]] || fail "no HTTP answer from $target$2"
}
emit_rest() { # emit_rest <file> <title> <method> <path> <shown-body|->
  SHOWN_HEADERS=$(printf 'Authorization: Bearer [REDACTED]\nvendure-token: [REDACTED]') SHOWN_BODY=$5 TITLE=$2 METHOD=$3 URL="$target$4" \
    node scripts/evidence/transcript.mjs "$work/h" "$work/b" "$1"
}
expect_status() { [[ "$status" == "$2" ]] || fail "$1: HTTP $status, wanted $2: $(command cat "$work/b")"; }
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

ROLE_FIELDS='id name description builtInKey isBuiltIn permissionCount memberCount areaLevels { area level }'
Q_ROLES="query { businessRoles { $ROLE_FIELDS } }"
Q_ROLE="query (\$id: String!) { businessRole(id: \$id) { $ROLE_FIELDS } }"
Q_CREATE="mutation (\$input: CreateBusinessRoleInput!) { createBusinessRole(input: \$input) { $ROLE_FIELDS } }"
Q_UPDATE="mutation (\$id: String!, \$input: UpdateBusinessRoleInput!) { updateBusinessRole(id: \$id, input: \$input) { $ROLE_FIELDS } }"
Q_DELETE='mutation ($id: String!) { deleteBusinessRole(id: $id) { success } }'
Q_DUPLICATE="mutation (\$id: String!, \$locale: String) { duplicateBusinessRole(id: \$id, locale: \$locale) { $ROLE_FIELDS } }"
Q_CATALOG='query { permissionCatalog { areas { id order label { en ar fr } } permissions { key area level sensitive label { en ar fr } } } }'
Q_EFFECTIVE='query { effectivePermissions { storeId permissions storeAccess } }'
Q_MEMBER='query ($administratorId: String!) { memberAccess(administratorId: $administratorId) { administratorId roles { id name } storeAccess storeIds } }'
Q_SET_MEMBER='mutation ($input: SetMemberAccessInput!) { setMemberAccess(input: $input) { administratorId roles { id name } storeAccess storeIds } }'
Q_ACTIVITY='query ($input: ActivityLogInput) { activityLog(input: $input) { items { id action entityType entityId summary diff actor { id name } storeId createdAt } nextCursor } }'
Q_ME='query { me { channels { token } } }'
Q_STORES='query { stores { id subdomain channelToken } }'

# --- sign-ins, stores and role ids -----------------------------------------------------------
reset_limits
login "$OWNER"; owner=$LAST_TOKEN
login "$SECOND_OWNER"; second_owner=$LAST_TOKEN
login "$LIMITED"; limited=$LAST_TOKEN
login "$ORDERS"; orders=$LAST_TOKEN

store_field() { # store_field <session> <subdomain> <field>
  local any
  gql "$Q_ME" '{}' "$1" -
  any=$(js 'b.data.me.channels[0].token' "$work/b")
  gql "$Q_STORES" '{}' "$1" "$any"
  js "b.data.stores.find((s)=>s.subdomain==='$2').$3" "$work/b"
}
demo=$(store_field "$owner" demo channelToken); demo2=$(store_field "$owner" demo2 channelToken); second=$(store_field "$second_owner" second channelToken)
[[ "$demo" != "$demo2" ]] || fail "both Demo stores resolved to one channel"
remember CHANNEL_DEMO "$demo"; remember CHANNEL_DEMO2 "$demo2"; remember CHANNEL_SECOND "$second"
demo_store=$(store_field "$owner" demo id); demo2_store=$(store_field "$owner" demo2 id); second_store=$(store_field "$second_owner" second id)
remember_id STORE_DEMO "$demo_store"; remember_id STORE_DEMO2 "$demo2_store"; remember_id STORE_SECOND "$second_store"

role_id() { # role_id <session> <channel> <name>
  gql "$Q_ROLES" '{}' "$1" "$2"
  js "b.data.businessRoles.find((r)=>r.name==='$3').id" "$work/b"
}
viewer_role=$(role_id "$owner" "$demo" 'Demo viewer'); clerk_role=$(role_id "$owner" "$demo" 'Demo orders clerk')
owner_role=$(role_id "$owner" "$demo" Owner); second_owner_role=$(role_id "$second_owner" "$second" Owner)
remember_id ROLE_VIEWER "$viewer_role"; remember_id ROLE_CLERK "$clerk_role"; remember_id ROLE_OWNER "$owner_role"; remember_id ROLE_OTHER_BUSINESS "$second_owner_role"
admin_id() { psql_value "select id from administrator where \"emailAddress\" = '$1'" | command tr -d '\r\n'; }
limited_admin=$(admin_id "$LIMITED"); owner_admin=$(admin_id "$OWNER"); second_admin=$(admin_id "$SECOND_OWNER")
[[ "$limited_admin" =~ ^[0-9]+$ && "$owner_admin" =~ ^[0-9]+$ && "$second_admin" =~ ^[0-9]+$ ]] || fail "administrator ids"

# --- catalog.md -------------------------------------------------------------------------------
f="$out/api/catalog.md"
begin "$f" "Permission catalog" "Every signed-in member reads it. 94 permissions in 12 areas."
gql "$Q_CATALOG" '{}' "$limited" "$demo"; expect_ok catalog; assert_js catalog 'b.data.permissionCatalog.permissions.length===94 && b.data.permissionCatalog.areas.length===12' "$work/b"
emit "$f" "permissionCatalog" "$Q_CATALOG" '{}' "$limited" "$demo"
rest GET /permissions/catalog - "$limited" "$demo"; expect_status "rest catalog" 200; assert_js "rest catalog" 'b.permissions.length===94' "$work/b"
emit_rest "$f" "GET /permissions/catalog" GET /permissions/catalog -

# --- effective.md -----------------------------------------------------------------------------
f="$out/api/effective.md"
begin "$f" "Effective permissions" "What the caller holds on the active store. The dashboard hides controls from this answer and enforces nothing."
gql "$Q_EFFECTIVE" '{}' "$owner" "$demo"; expect_ok effective; assert_js effective 'b.data.effectivePermissions.permissions.length===94 && b.data.effectivePermissions.storeAccess==="all"' "$work/b"
emit "$f" "effectivePermissions, the owner" "$Q_EFFECTIVE" '{}' "$owner" "$demo"
gql "$Q_EFFECTIVE" '{}' "$limited" "$demo"; expect_ok effective2; assert_js effective2 'b.data.effectivePermissions.permissions.length===2 && b.data.effectivePermissions.storeAccess==="selected"' "$work/b"
emit "$f" "effectivePermissions, a limited member on a selected store" "$Q_EFFECTIVE" '{}' "$limited" "$demo"
rest GET /permissions - "$limited" "$demo"; expect_status "rest effective" 200; assert_js "rest effective" 'b.permissions.length===2' "$work/b"
emit_rest "$f" "GET /permissions" GET /permissions -

# --- roles.md ---------------------------------------------------------------------------------
activity_of() { # activity_of <entity-id> <action> <file> <title>
  local input
  input=$(vars "{input:{entityId:'$1'}}")
  gql "$Q_ACTIVITY" "$input" "$owner" "$demo"; expect_ok "activity $2"
  assert_js "activity $2" "b.data.activityLog.items[0].action==='$2'" "$work/b"
  emit "$3" "$4" "$Q_ACTIVITY" "$input" "$owner" "$demo"
}
f="$out/api/roles.md"
begin "$f" "Roles" "GraphQL and REST for create, read, update, duplicate and delete, each followed by the activity row it wrote."
gql "$Q_ROLES" '{}' "$owner" "$demo"; expect_ok roles; assert_js roles 'b.data.businessRoles.filter((r)=>r.isBuiltIn).length===7' "$work/b"
emit "$f" "businessRoles: 7 built-ins and the seeded custom roles" "$Q_ROLES" '{}' "$owner" "$demo"
rest GET /roles - "$owner" "$demo"; expect_status "rest roles" 200
emit_rest "$f" "GET /roles" GET /roles -
gql "$Q_ROLE" "$(vars "{id:'$viewer_role'}")" "$owner" "$demo"; expect_ok role; assert_js role "b.data.businessRole.name==='Demo viewer'" "$work/b"
emit "$f" "businessRole" "$Q_ROLE" "$(vars "{id:'$viewer_role'}")" "$owner" "$demo"
rest GET "/roles/$viewer_role" - "$owner" "$demo"; expect_status "rest role" 200
emit_rest "$f" "GET /roles/:id" GET "/roles/$viewer_role" -

input=$(vars "{input:{name:'Evidence role',areaLevels:[{area:'orders',level:'view'}],grants:['orders.cancel']}}")
gql "$Q_CREATE" "$input" "$owner" "$demo"; expect_ok create; assert_js create 'b.data.createBusinessRole.permissionCount===4' "$work/b"
created=$(js 'b.data.createBusinessRole.id' "$work/b"); remember_id ROLE_CREATED "$created"
emit "$f" "createBusinessRole: Orders at View plus one sensitive grant" "$Q_CREATE" "$input" "$owner" "$demo"
activity_of "$created" rbac.role.created "$f" "activityLog: the row of that create"
input=$(vars "{id:'$created',input:{name:'Evidence role renamed',revokes:['orders.cancel']}}")
gql "$Q_UPDATE" "$input" "$owner" "$demo"; expect_ok update; assert_js update 'b.data.updateBusinessRole.permissionCount===3' "$work/b"
emit "$f" "updateBusinessRole" "$Q_UPDATE" "$input" "$owner" "$demo"
activity_of "$created" rbac.role.updated "$f" "activityLog: the row of that update"
input=$(vars "{id:'$created',locale:'en'}")
gql "$Q_DUPLICATE" "$input" "$owner" "$demo"; expect_ok duplicate; assert_js duplicate "b.data.duplicateBusinessRole.name==='Evidence role renamed (copy)'" "$work/b"
copy=$(js 'b.data.duplicateBusinessRole.id' "$work/b"); remember_id ROLE_COPY "$copy"
emit "$f" "duplicateBusinessRole" "$Q_DUPLICATE" "$input" "$owner" "$demo"
activity_of "$copy" rbac.role.duplicated "$f" "activityLog: the row of that duplicate"
gql "$Q_DELETE" "$(vars "{id:'$copy'}")" "$owner" "$demo"; expect_ok delete; assert_js delete 'b.data.deleteBusinessRole.success===true' "$work/b"
emit "$f" "deleteBusinessRole" "$Q_DELETE" "$(vars "{id:'$copy'}")" "$owner" "$demo"
activity_of "$copy" rbac.role.deleted "$f" "activityLog: the row of that delete"
gql "$Q_DELETE" "$(vars "{id:'$created'}")" "$owner" "$demo"; expect_ok delete2

body='{"name":"Evidence rest role","areaLevels":[{"area":"finance","level":"view"}]}'
rest POST /roles "$body" "$owner" "$demo"; [[ "$status" == 200 || "$status" == 201 ]] || fail "rest create: $status"
rest_role=$(js 'b.id' "$work/b"); remember_id ROLE_REST "$rest_role"
emit_rest "$f" "POST /roles" POST /roles "$body"
body='{"description":"Changed through REST"}'
rest PATCH "/roles/$rest_role" "$body" "$owner" "$demo"; expect_status "rest patch" 200
emit_rest "$f" "PATCH /roles/:id" PATCH "/roles/$rest_role" "$body"
rest POST "/roles/$rest_role/duplicate" '{}' "$owner" "$demo"; [[ "$status" == 200 || "$status" == 201 ]] || fail "rest duplicate: $status"
rest_copy=$(js 'b.id' "$work/b"); remember_id ROLE_REST_COPY "$rest_copy"
emit_rest "$f" "POST /roles/:id/duplicate" POST "/roles/$rest_role/duplicate" '{}'
rest DELETE "/roles/$rest_copy" - "$owner" "$demo"; expect_status "rest delete" 200
emit_rest "$f" "DELETE /roles/:id" DELETE "/roles/$rest_copy" -
rest DELETE "/roles/$rest_role" - "$owner" "$demo"; expect_status "rest delete 2" 200

# --- members.md -------------------------------------------------------------------------------
f="$out/api/members.md"
begin "$f" "Member access" "One role set and one store access per member. Administrator ids are the engine's small integers and are shown as they are."
gql "$Q_MEMBER" "$(vars "{administratorId:'$limited_admin'}")" "$owner" "$demo"; expect_ok member; assert_js member 'b.data.memberAccess.storeAccess==="selected" && b.data.memberAccess.storeIds.length===1' "$work/b"
emit "$f" "memberAccess" "$Q_MEMBER" "$(vars "{administratorId:'$limited_admin'}")" "$owner" "$demo"
input=$(vars "{input:{administratorId:'$limited_admin',roleIds:['$viewer_role','$clerk_role'],storeAccess:'selected',storeIds:['$demo_store']}}")
gql "$Q_SET_MEMBER" "$input" "$owner" "$demo"; expect_ok set-member; assert_js set-member 'b.data.setMemberAccess.roles.length===2' "$work/b"
emit "$f" "setMemberAccess: a second role" "$Q_SET_MEMBER" "$input" "$owner" "$demo"
activity_of "$limited_admin" rbac.member-access.changed "$f" "activityLog: the row of that change"
input=$(vars "{input:{administratorId:'$limited_admin',roleIds:['$viewer_role'],storeAccess:'selected',storeIds:['$demo_store']}}")
gql "$Q_SET_MEMBER" "$input" "$owner" "$demo"; expect_ok set-member2

# --- activity.md ------------------------------------------------------------------------------
f="$out/api/activity.md"
begin "$f" "Activity log" "Newest first, with a cursor. A limited member with settings.activity-log.view sees the rows of the stores they can reach."
input=$(vars "{input:{first:5}}")
gql "$Q_ACTIVITY" "$input" "$owner" "$demo"; expect_ok activity; assert_js activity 'b.data.activityLog.items.length===5 && !!b.data.activityLog.nextCursor' "$work/b"
cursor=$(js 'b.data.activityLog.nextCursor' "$work/b"); remember_id ACTIVITY_CURSOR "$cursor"
emit "$f" "activityLog, first page" "$Q_ACTIVITY" "$input" "$owner" "$demo"
input=$(vars "{input:{first:5,after:'$cursor'}}")
gql "$Q_ACTIVITY" "$input" "$owner" "$demo"; expect_ok activity2
emit "$f" "activityLog, next page" "$Q_ACTIVITY" "$input" "$owner" "$demo"
gql "$Q_ACTIVITY" '{}' "$limited" "$demo"; expect_ok "limited activity"
assert_js "limited activity" "b.data.activityLog.items.length>0 && b.data.activityLog.items.every((i)=>i.storeId===null||i.storeId==='$demo_store')" "$work/b"
emit "$f" "activityLog, a limited member on one selected store: only that store's rows and business-wide rows" "$Q_ACTIVITY" '{}' "$limited" "$demo"
gql "$Q_ACTIVITY" '{}' "$orders" "$demo"; expect_code "orders activity" FORBIDDEN
emit "$f" "activityLog without the permission: FORBIDDEN" "$Q_ACTIVITY" '{}' "$orders" "$demo"

# --- refusals.md ------------------------------------------------------------------------------
f="$out/api/refusals.md"
begin "$f" "Refusals" "FORBIDDEN for a missing permission, a refused escalation, the built-in rule, self-assignment and a store outside the member's list."
gql "$Q_ROLES" '{}' "$orders" "$demo"; expect_code "no view" FORBIDDEN
emit "$f" "businessRoles without team.roles.view: FORBIDDEN" "$Q_ROLES" '{}' "$orders" "$demo"
rest GET /roles - "$orders" "$demo"; expect_status "rest no view" 403
emit_rest "$f" "GET /roles without team.roles.view: 403" GET /roles -
input=$(vars "{input:{name:'Refused'}}")
gql "$Q_CREATE" "$input" "$limited" "$demo"; expect_code "no create" FORBIDDEN
emit "$f" "createBusinessRole by a read-only member: FORBIDDEN" "$Q_CREATE" "$input" "$limited" "$demo"
gql "$Q_ROLES" '{}' - -; expect_code "anonymous" FORBIDDEN
emit "$f" "businessRoles, anonymous: FORBIDDEN" "$Q_ROLES" '{}' - -
gql "$Q_ROLES" '{}' "$limited" "$demo2"; expect_code "other store" FORBIDDEN
emit "$f" "A selected-store member with the other store's token: FORBIDDEN" "$Q_ROLES" '{}' "$limited" "$demo2"
rest GET /permissions - "$limited" "$demo2"; expect_status "rest other store" 403
emit_rest "$f" "GET /permissions with the other store's token: 403" GET /permissions -
input=$(vars "{id:'$owner_role',input:{name:'Renamed owner'}}")
gql "$Q_UPDATE" "$input" "$owner" "$demo"; expect_code "built-in" rbac.built-in-immutable
emit "$f" "Editing a built-in role" "$Q_UPDATE" "$input" "$owner" "$demo"
gql "$Q_DELETE" "$(vars "{id:'$viewer_role'}")" "$owner" "$demo"; expect_code "in use" rbac.role-in-use
emit "$f" "Deleting a role that still has a member" "$Q_DELETE" "$(vars "{id:'$viewer_role'}")" "$owner" "$demo"
input=$(vars "{input:{administratorId:'$owner_admin',roleIds:['$viewer_role'],storeAccess:'all'}}")
gql "$Q_SET_MEMBER" "$input" "$owner" "$demo"; expect_code "self" rbac.self-assignment
emit "$f" "Changing your own access" "$Q_SET_MEMBER" "$input" "$owner" "$demo"
# Escalation: the member may create roles for a moment, and asks for more than they hold.
grant=$(vars "{id:'$viewer_role',input:{grants:['team.roles.create']}}")
gql "$Q_UPDATE" "$grant" "$owner" "$demo"; expect_ok "grant create"
input=$(vars "{input:{name:'Escalation',areaLevels:[{area:'orders',level:'full'}]}}")
gql "$Q_CREATE" "$input" "$limited" "$demo"; expect_code escalation rbac.privilege-exceeded
emit "$f" "A member who may create roles asks for permissions they do not hold: refused" "$Q_CREATE" "$input" "$limited" "$demo"
gql "$Q_UPDATE" "$(vars "{id:'$viewer_role',input:{revokes:['team.roles.create']}}")" "$owner" "$demo"; expect_ok "revoke create"

# --- isolation.md -----------------------------------------------------------------------------
f="$out/api/isolation.md"
begin "$f" "Two businesses: cross-tenant" "A's owner with B's ids and B's channel token. A foreign id is not found; a foreign token is FORBIDDEN."
gql "$Q_ROLES" '{}' "$owner" "$second"; expect_code "foreign token" FORBIDDEN
emit "$f" "A's owner on B's channel: FORBIDDEN" "$Q_ROLES" '{}' "$owner" "$second"
gql "$Q_ROLE" "$(vars "{id:'$second_owner_role'}")" "$owner" "$demo"; expect_ok "foreign role"; assert_js "foreign role" 'b.data.businessRole===null' "$work/b"
emit "$f" "A reads B's role id: null" "$Q_ROLE" "$(vars "{id:'$second_owner_role'}")" "$owner" "$demo"
input=$(vars "{id:'$second_owner_role',input:{name:'Taken over'}}")
gql "$Q_UPDATE" "$input" "$owner" "$demo"; expect_code "foreign update" rbac.role-not-found
emit "$f" "A updates B's role: not found" "$Q_UPDATE" "$input" "$owner" "$demo"
gql "$Q_DELETE" "$(vars "{id:'$second_owner_role'}")" "$owner" "$demo"; expect_code "foreign delete" rbac.role-not-found
emit "$f" "A deletes B's role: not found" "$Q_DELETE" "$(vars "{id:'$second_owner_role'}")" "$owner" "$demo"
rest GET "/roles/$second_owner_role" - "$owner" "$demo"; expect_status "rest foreign role" 404
emit_rest "$f" "GET /roles/:id with B's id: 404" GET "/roles/$second_owner_role" -
gql "$Q_MEMBER" "$(vars "{administratorId:'$second_admin'}")" "$owner" "$demo"; expect_ok "foreign member"; assert_js "foreign member" 'b.data.memberAccess===null' "$work/b"
emit "$f" "A reads B's member: null" "$Q_MEMBER" "$(vars "{administratorId:'$second_admin'}")" "$owner" "$demo"
input=$(vars "{input:{administratorId:'$second_admin',roleIds:['$viewer_role'],storeAccess:'all'}}")
gql "$Q_SET_MEMBER" "$input" "$owner" "$demo"; expect_code "foreign set" rbac.member-not-found
emit "$f" "A changes B's member: not found" "$Q_SET_MEMBER" "$input" "$owner" "$demo"
input=$(vars "{input:{administratorId:'$limited_admin',roleIds:['$viewer_role'],storeAccess:'selected',storeIds:['$second_store']}}")
gql "$Q_SET_MEMBER" "$input" "$owner" "$demo"; [[ "$(js 'b.errors[0].extensions.code' "$work/b")" == rbac.store-* ]] || fail "foreign store: $(command cat "$work/b")"
emit "$f" "A gives a member B's store: refused" "$Q_SET_MEMBER" "$input" "$owner" "$demo"
gql "$Q_ACTIVITY" '{}' "$second_owner" "$second"; expect_ok "B activity"
assert_js "B activity" "!JSON.stringify(b).includes('$viewer_role') && !JSON.stringify(b).includes('$demo_store')" "$work/b"
emit "$f" "B's activity log holds nothing of A's (asserted on the real ids)" "$Q_ACTIVITY" '{}' "$second_owner" "$second"

# --- live-revoke.md ---------------------------------------------------------------------------
# The owner writes through the first process, the member reads through the second: the two share only Valkey and Postgres.
f="$out/api/live-revoke.md"
begin "$f" "A change takes effect on the member's next request, on another api process" "The owner's writes go to port $API_HOST_PORT, the member's reads to the separately running process on port $API2_PORT. Each read is the first request after the write, with no wait."
target=$api2
gql "$Q_ROLES" '{}' "$limited" "$demo"; expect_ok "before revoke"
emit "$f" "Second api, before: the member reads roles (their session is now cached)" "$Q_ROLES" '{}' "$limited" "$demo"
target=$api
input=$(vars "{id:'$viewer_role',input:{revokes:['team.roles.view']}}")
gql "$Q_UPDATE" "$input" "$owner" "$demo"; expect_ok revoke
emit "$f" "First api: the owner removes team.roles.view from the role" "$Q_UPDATE" "$input" "$owner" "$demo"
target=$api2
gql "$Q_ROLES" '{}' "$limited" "$demo"; expect_code "after revoke" FORBIDDEN
emit "$f" "Second api, next request: FORBIDDEN" "$Q_ROLES" '{}' "$limited" "$demo"
target=$api
input=$(vars "{id:'$viewer_role',input:{grants:['team.roles.view']}}")
gql "$Q_UPDATE" "$input" "$owner" "$demo"; expect_ok restore
emit "$f" "First api: the owner gives it back" "$Q_UPDATE" "$input" "$owner" "$demo"
target=$api2
gql "$Q_ROLES" '{}' "$limited" "$demo"; expect_ok "after restore"
emit "$f" "Second api, next request: answered" "$Q_ROLES" '{}' "$limited" "$demo"
# An assignment change fires no core cache clear at all, so only the plugin's own flush can end this session's rights.
target=$api
input=$(vars "{input:{administratorId:'$limited_admin',roleIds:['$clerk_role'],storeAccess:'selected',storeIds:['$demo_store']}}")
gql "$Q_SET_MEMBER" "$input" "$owner" "$demo"; expect_ok swap
emit "$f" "First api: the member is moved to a role without team.roles.view" "$Q_SET_MEMBER" "$input" "$owner" "$demo"
target=$api2
gql "$Q_ROLES" '{}' "$limited" "$demo"; expect_code "after swap" FORBIDDEN
emit "$f" "Second api, next request: FORBIDDEN" "$Q_ROLES" '{}' "$limited" "$demo"
target=$api
input=$(vars "{input:{administratorId:'$limited_admin',roleIds:['$viewer_role'],storeAccess:'selected',storeIds:['$demo_store']}}")
gql "$Q_SET_MEMBER" "$input" "$owner" "$demo"; expect_ok "swap back"
target=$api2
gql "$Q_ROLES" '{}' "$limited" "$demo"; expect_ok "after swap back"
target=$api

# --- screens and the flows the browser proves ---------------------------------------------------
reset_limits
EV_OTHER_STORE_TOKEN=$demo2 timeout 420 node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/evidence/P1.S3-screens.mjs "$api/dashboard" "$api2/dashboard" "$work/shots" \
  > "$work/shots.txt" 2> >(command tee "$work/screens.log" >&2)
command cp "$work"/shots/*.png "$out/screens/"

# --- the browser suite, on this stack (browser.yml does not run on pull requests) -------------
reset_limits
DASHBOARD_URL=$api/dashboard MAILPIT_URL=$mailpit SCREENSHOT_DIR=$work/browser-shots \
  timeout 420 pnpm --filter @cod/server test:browser >"$work/browser.log" 2>&1 || fail "browser suite: $(command tail -40 "$work/browser.log")"
browser_summary=$(command grep -E '^ *(Test Files|Tests) ' "$work/browser.log" | command sed -E 's/\x1b\[[0-9;]*m//g; s/^ +//')

# --- README -------------------------------------------------------------------------------------
{
  cat <<README
# Evidence for P1.S3 (permissions and roles)

Transcripts and screenshots from a live stack (CLAUDE.md §3a.14), produced by \`scripts/evidence/P1.S3.sh\`. Data is synthetic. Image
built from a tree with no uncommitted change outside the evidence folders and browser tests, last image-relevant commit
\`$image_commit\`. Compose project \`cod-evidence\`; a second api container on port $API2_PORT shares only Valkey and Postgres with the first.

## API transcripts

| File | Shows |
| --- | --- |
| [\`api/catalog.md\`](api/catalog.md) | \`permissionCatalog\`, \`GET /permissions/catalog\` |
| [\`api/effective.md\`](api/effective.md) | \`effectivePermissions\` for an owner and a limited member, \`GET /permissions\` |
| [\`api/roles.md\`](api/roles.md) | Every role operation in GraphQL and REST, and the activity row after create, update, duplicate and delete |
| [\`api/members.md\`](api/members.md) | \`memberAccess\`, \`setMemberAccess\` and its activity row |
| [\`api/activity.md\`](api/activity.md) | \`activityLog\` pages and the cursor, FORBIDDEN without the permission |
| [\`api/refusals.md\`](api/refusals.md) | FORBIDDEN (REST and GraphQL, anonymous, a store outside the member's list), a built-in edit, a role in use, self-assignment, a refused escalation |
| [\`api/isolation.md\`](api/isolation.md) | Cross-tenant: B's channel token, B's role, member and store ids |
| [\`api/live-revoke.md\`](api/live-revoke.md) | A removed permission and a changed assignment stop working on the next request on a second api process, and a restored one works again |

The ids this run acted on (stores, the roles it used or created, the activity cursor) and channel tokens are placeholders; every assertion ran on the real values. Other built-in role ids in the listings are synthetic and left as they are. Administrator ids are the engine's small integers.

## Browser suite

Run on this stack, since \`browser.yml\` does not run on pull requests: \`pnpm --filter @cod/server test:browser\`.

$browser_summary

## Browser flows proved by \`scripts/evidence/P1.S3-screens.mjs\`

Every line below is a failing assertion in the script if it does not hold; the shots are in \`screens/\`.

$(command sed -E 's/^/- /' <(command grep -v '^shot ' "$work/screens.log"))

README
  command cat scripts/evidence/P1.S3-seen.md
} >"$out/README.md"

# --- placeholders, sizes and redaction ------------------------------------------------------------
for t in "$out"/api/*.md; do normalise_file "$t"; done
if command grep -rqE '^HTTP/1\.1 [^0-9]' "$out/api"; then fail "a placeholder corrupted a status line"; fi
if command grep -rqE '^HTTP/1\.1 [0-9]{3}[^ 0-9]' "$out/api"; then fail "a placeholder corrupted a status line"; fi
for f in "$out"/screens/*.png; do
  (($(command stat -c %s "$f") <= 300 * 1024)) || fail "$f is over 300 KB"
done
((${#session_tokens[@]} >= 4)) || fail "the redaction check would be vacuous"
for secret in "${secret_values[@]}" "$AUTH_TOKEN_SECRET" "$DEMO_OWNER_PASSWORD" "${session_tokens[@]}" "${cookies[@]}" "$demo" "$demo2" "$second"; do
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
