#!/usr/bin/env bash
# Proof-of-working evidence for P1.S4 (CLAUDE.md §3a.14): runs the real compose stack under its own project (cod-evidence, host
# ports +20000), records every Team endpoint (invite, the mailed invitation, preview, accept, resend, revoke, the members list
# per tab, every member action, salary, order managers, commission configs) plus the refusals, the cross-tenant cases and the
# rate limits, takes the screenshots, runs the browser suite against this stack, and tears the project down. Never touches
# the `cod` project.
#
#   flock -w 3600 /tmp/cod-heavy-jobs.lock timeout 1800 scripts/evidence/P1.S4.sh
#   EV_SKIP_BUILD=1 flock -w 3600 /tmp/cod-heavy-jobs.lock timeout 1800 scripts/evidence/P1.S4.sh
#
# It builds cod-platform:local unless EV_SKIP_BUILD=1 and cod-platform:evidence-<last image commit> exists (an image this
# script built from the same commit), which it then reuses; the skip keeps a rerun inside the 1800 s cap.
#
# Data is synthetic. Ids are placeholders after their use is asserted; invitation tokens, passwords, session tokens and
# channel tokens are never written. The script fails if a 43-character token, a `token=` value or a password survives.
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
# Teardown removes this project's volumes: refuse to run under any other project name.
[[ "$COMPOSE_PROJECT_NAME" == cod-evidence ]] || { echo "evidence: wrong compose project" >&2; exit 1; }

out=docs/evidence/P1.S4
api="http://127.0.0.1:$API_HOST_PORT"
mailpit="http://127.0.0.1:$MAILPIT_UI_HOST_PORT"
work=$(mktemp -d)
SNOWFLAKE_RE='^[1-9][0-9]{15,18}$'
# Values are replaced anywhere in a transcript, so a short one would corrupt status codes and other digits.
MIN_PLACEHOLDER_VALUE_LENGTH=16
# The invitation token: 32 random bytes in base64url (D205).
TOKEN_RE='[A-Za-z0-9_-]{43}'
# The resend cooldown (INVITATION_RESEND_COOLDOWN_MS) and one second of margin.
RESEND_COOLDOWN_SECONDS=61
# The rate-limit budgets (plugins/rate-limit/domain/constants.ts) the refusals spend.
ACCEPT_IP_BUDGET=60 INVITE_ACTOR_BUDGET=30

OWNER=owner@demo.example.test SECOND_OWNER=owner@second.example.test
LIMITED=limited@demo.example.test ORDERS=orders@demo.example.test
AMINA=amina@invitee.example.test KARIM=karim@invitee.example.test
PENDING=pending@invitee.example.test S2ONLY=second-store@invitee.example.test
INVITEE_PASSWORD=synthetic-invitee-pass

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
# EV_SKIP_BUILD=1 reuses an image this script built from the same commit (tagged below); anything else builds.
built_tag="cod-platform:evidence-$NEXT_DEPLOYMENT_ID"
if [[ "${EV_SKIP_BUILD:-}" == 1 && "$APP_IMAGE" == cod-platform:local ]] && docker image inspect "$built_tag" >/dev/null 2>&1; then
  docker tag "$built_tag" "$APP_IMAGE"
else
  timeout 900 docker compose build migrate
  docker tag "$APP_IMAGE" "$built_tag"
fi
# A fresh Postgres volume can outlast its healthcheck on a loaded host: start it alone and wait for it first.
timeout 120 docker compose up -d postgres valkey mailpit
wait_healthy postgres valkey
timeout 300 docker compose up -d api worker storefront mailpit || timeout 300 docker compose up -d api worker storefront mailpit
wait_healthy api worker storefront
wait_http 200 "$api/readyz" 120 || fail "api /readyz"
wait_http 200 "$api/dashboard/" 60 || fail "api /dashboard/"

seed() { timeout 180 docker compose run --rm --no-deps -e DEMO_OWNER_PASSWORD --entrypoint node migrate apps/server/dist/main-seed-demo.js; }
seed >"$work/seed.log" 2>&1 || fail "the demo seed failed: $(command tail -20 "$work/seed.log")"
command grep -q 'limited@demo.example.test' "$work/seed.log" || fail "the seed did not create the members"
# The seed adds members through rbac outside Team; the migrate role's converge gives each a member row (D215).
timeout 180 docker compose run --rm --no-deps migrate >"$work/converge.log" 2>&1 || fail "the converge failed: $(command tail -20 "$work/converge.log")"

reset_limits() { # Between phases only: every call from this host shares one client address.
  timeout 30 docker compose exec -T valkey sh -c "valkey-cli --scan --pattern 'rl:*' | xargs -r valkey-cli del" >/dev/null
}
psql_value() { timeout 30 docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "$1"' _ "$1"; }

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
shown_headers() { # shown_headers <session|-> <channel|-> <has-body>
  local -a shown=()
  [[ "$3" == yes ]] && shown+=("$json")
  [[ "$1" != - ]] && shown+=("Authorization: Bearer [REDACTED]")
  [[ "$2" != - ]] && shown+=("vendure-token: [REDACTED]")
  ((${#shown[@]} == 0)) || printf '%s\n' "${shown[@]}"
}
emit() { # emit <file> <title> <query> <shown-vars> <session|-> <channel|->
  local shown_body
  shown_body=$(Q="$3" V="$4" node -e 'console.log(JSON.stringify({query:process.env.Q,variables:JSON.parse(process.env.V)}))')
  SHOWN_HEADERS=$(shown_headers "$5" "$6" yes) SHOWN_BODY=$shown_body TITLE=$2 METHOD=POST URL="$api/admin-api?languageCode=en" \
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
  local has_body=no
  [[ "$5" != - ]] && has_body=yes
  SHOWN_HEADERS=$(shown_headers "$LAST_SESSION" "$LAST_CHANNEL" "$has_body") SHOWN_BODY=$5 TITLE=$2 METHOD=$3 URL="$api$4" \
    node scripts/evidence/transcript.mjs "$work/h" "$work/b" "$1"
}
expect_status() { [[ "$status" == "$2" ]] || fail "$1: HTTP $status, wanted $2: $(command cat "$work/b")"; }
expect_created() { [[ "$status" == 200 || "$status" == 201 ]] || fail "$1: HTTP $status: $(command cat "$work/b")"; }
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

# Invitation links: the token is read from Mailpit into a variable, used, and only ever written as [REDACTED].
invitation_tokens=()
invitation_token() { # invitation_token <to> <min-count> -> $LAST_INVITATION_TOKEN
  LAST_INVITATION_TOKEN=$(node scripts/evidence/P1.S2-mailpit.mjs secrets "$mailpit" "$1" /accept-invitation "$2" | command head -1)
  [[ "$LAST_INVITATION_TOKEN" =~ ^$TOKEN_RE$ ]] || fail "no invitation token for $1"
  invitation_tokens+=("$LAST_INVITATION_TOKEN")
}
dump_mail() { node scripts/evidence/P1.S2-mailpit.mjs dump "$mailpit" "$2" /accept-invitation "$3" "$1" "$4"; }
accept_body() { # accept_body <token> <first> <last> <password>
  T="$1" F="$2" L="$3" P="$4" node -e 'console.log(JSON.stringify({token:process.env.T,firstName:process.env.F,lastName:process.env.L,password:process.env.P}))'
}
PREVIEW_SHOWN='/team/invitations/preview?token=[REDACTED]'
ACCEPT_SHOWN_BODY() { printf '{"token":"[REDACTED]","firstName":"%s","lastName":"%s","password":"[REDACTED]"}' "$1" "$2"; }

Q_ME='query { me { channels { token } } }'
Q_STORES='query { stores { id subdomain channelToken } }'
Q_ROLES='query { businessRoles { id name builtInKey } }'
Q_UPDATE_ROLE='mutation ($id: String!, $input: UpdateBusinessRoleInput!) { updateBusinessRole(id: $id, input: $input) { id permissionCount } }'
Q_TEAM_MEMBERS='query ($input: TeamMembersInput) { teamMembers(input: $input) { items { id email name status tab invitationExpired roles { name } storeAccess storeNames baseSalary ordersCount } counts { all active pending inactive } total } }'

# --- sign-ins, stores, roles and the seeded members ------------------------------------------
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

role_where() { # role_where <session> <channel> <js-predicate on r>
  gql "$Q_ROLES" '{}' "$1" "$2"
  js "b.data.businessRoles.find((r)=>$3).id" "$work/b"
}
om_role=$(role_where "$owner" "$demo" "r.builtInKey==='order-manager'"); viewer_role=$(role_where "$owner" "$demo" "r.name==='Demo viewer'")
second_om_role=$(role_where "$second_owner" "$second" "r.builtInKey==='order-manager'")
remember_id ROLE_ORDER_MANAGER "$om_role"; remember_id ROLE_DEMO_VIEWER "$viewer_role"; remember_id ROLE_ORDER_MANAGER_OF_B "$second_om_role"

member_of() { # member_of <session> <channel> <email>: the member id in the "all" tab
  rest GET '/employees?tab=all' - "$1" "$2"; expect_status "list for $3" 200
  js "b.items.find((m)=>m.email==='$3').id" "$work/b"
}
owner_member=$(member_of "$owner" "$demo" "$OWNER"); remember_id MEMBER_OWNER "$owner_member"
assert_js "converged members" 'b.counts.all>=6 && b.counts.active>=6' "$work/b"
second_owner_member=$(member_of "$second_owner" "$second" "$SECOND_OWNER"); remember_id MEMBER_OWNER_OF_B "$second_owner_member"

invite_body() { # invite_body <email> <role> <storeAccess> <storeIds-js-array> <salary> <locale>
  vars "{email:'$1',roleIds:['$2'],storeAccess:'$3',storeIds:$4,baseSalary:$5,locale:'$6'}"
}
mail_count() { # mail_count <to>: the messages Mailpit holds for that address
  node -e 'fetch(process.argv[1]+"/api/v1/search?query="+encodeURIComponent("to:\""+process.argv[2]+"\"")).then((r)=>r.json()).then((b)=>console.log(b.messages.length))' "$mailpit" "$1"
}
# Invitation mail leaves through a queue after the commit, so a count taken right after a refused call could miss a
# mail queued wrongly. A control invite sent after that call, once its own mail is in Mailpit (bounded wait), shows the
# queue went past the refused call; the control member is then revoked so no lists or counts change.
await_mail_queue() { # await_mail_queue <tag>
  local control="control-$1-$EV_RUN@invitee.example.test" control_id
  rest POST /employees "$(invite_body "$control" "$om_role" all '[]' 1 en)" "$owner" "$demo"; expect_created "control $1"
  control_id=$(js 'b.id' "$work/b")
  timeout 60 node scripts/evidence/P1.S2-mailpit.mjs secrets "$mailpit" "$control" /accept-invitation 1 >/dev/null ||
    fail "control $1: its invitation mail did not arrive"
  rest POST "/employees/$control_id/revoke-invitation" - "$owner" "$demo"; expect_status "control $1 revoke" 200
}

# --- invite.md --------------------------------------------------------------------------------
f="$out/api/invite.md"
begin "$f" "Invite" "The owner invites by email with a role, store access and a base salary in whole DZD. The member is listed as pending; the invitation mail arrives in Mailpit in the chosen language. The link's token is redacted below; the server stores only its SHA-256 (D205)."
body=$(invite_body "$AMINA" "$om_role" all '[]' 30000 en)
rest POST /employees "$body" "$owner" "$demo"; expect_created invite
assert_js invite "b.status==='invited' && b.administratorId===null && b.email==='$AMINA' && b.baseSalary===30000" "$work/b"
amina=$(js 'b.id' "$work/b"); remember_id MEMBER_AMINA "$amina"
emit_rest "$f" "POST /employees: all stores, English mail" POST /employees "$body"
dump_mail "$f" "$AMINA" 1 "The English invitation mail in Mailpit"
body=$(invite_body "$KARIM" "$om_role" selected "['$demo_store']" 25000 ar)
rest POST /employees "$body" "$owner" "$demo"; expect_created "invite karim"
karim=$(js 'b.id' "$work/b"); remember_id MEMBER_KARIM "$karim"
emit_rest "$f" "POST /employees: one store, Arabic mail" POST /employees "$body"
dump_mail "$f" "$KARIM" 1 "The Arabic invitation mail in Mailpit"
body=$(invite_body "$PENDING" "$om_role" all '[]' 20000 en)
rest POST /employees "$body" "$owner" "$demo"; expect_created "invite pending"
pending=$(js 'b.id' "$work/b"); remember_id MEMBER_PENDING "$pending"; pending_invited_at=$SECONDS
body=$(invite_body "$S2ONLY" "$om_role" selected "['$demo2_store']" 20000 en)
rest POST /employees "$body" "$owner" "$demo"; expect_created "invite s2only"
s2only=$(js 'b.id' "$work/b"); remember_id MEMBER_SECOND_STORE_ONLY "$s2only"
emit_rest "$f" "POST /employees: the second store only (used by the store-reach refusal)" POST /employees "$body"
token_count=$(psql_value "select count(*) from invitation where \"tokenHash\" ~ '^[0-9a-f]{64}\$'" | command tr -d '\r\n')
((token_count >= 4)) || fail "invitation rows do not hold a SHA-256 hex hash: $token_count"
printf 'Database check: %s invitation rows, each `tokenHash` is 64 hex characters (a SHA-256); no column holds the raw token.\n\n' "$token_count" >>"$f"

# --- accept.md --------------------------------------------------------------------------------
f="$out/api/accept.md"
begin "$f" "Preview and accept" "Public REST routes (D205): no session, the token in the query or body (redacted here), never cached nor referred. The password is redacted. A used link answers the same opaque refusal as an unknown one."
invitation_token "$AMINA" 1; amina_token=$LAST_INVITATION_TOKEN
rest GET "/team/invitations/preview?token=$amina_token" - - -; expect_status preview 200
assert_js preview "b.email==='$AMINA' && b.businessName==='Demo' && !JSON.stringify(b).includes('$amina_token')" "$work/b"
command grep -qi '^cache-control: no-store' "$work/h" || fail "preview is cacheable"
command grep -qi '^referrer-policy: no-referrer' "$work/h" || fail "preview has no referrer policy"
emit_rest "$f" "GET /team/invitations/preview" GET "$PREVIEW_SHOWN" -
rest POST /team/invitations/accept "$(accept_body "$amina_token" Amina Saadi "$INVITEE_PASSWORD")" - -; expect_status accept 200
demo_business=$(js 'b.businessId' "$work/b"); remember_id BUSINESS_DEMO "$demo_business"
emit_rest "$f" "POST /team/invitations/accept" POST /team/invitations/accept "$(ACCEPT_SHOWN_BODY Amina Saadi)"
rest GET "/team/invitations/preview?token=$amina_token" - - -; expect_rest_code "used preview" 400 team.invitation-invalid
emit_rest "$f" "The used link, previewed again: the generic refusal" GET "$PREVIEW_SHOWN" -
rest POST /team/invitations/accept "$(accept_body "$amina_token" Amina Saadi "$INVITEE_PASSWORD")" - -; expect_rest_code "used accept" 400 team.invitation-invalid
emit_rest "$f" "The used link, accepted again: refused, no second account" POST /team/invitations/accept "$(ACCEPT_SHOWN_BODY Amina Saadi)"
accounts=$(psql_value "select count(*) from administrator where \"emailAddress\" = '$AMINA' and \"deletedAt\" is null" | command tr -d '\r\n')
[[ "$accounts" == 1 ]] || fail "accept left $accounts administrators"
printf 'Database check: one administrator for %s.\n\n' "$AMINA" >>"$f"
invitation_token "$KARIM" 1
rest POST /team/invitations/accept "$(accept_body "$LAST_INVITATION_TOKEN" Karim Haddad "$INVITEE_PASSWORD")" - -; expect_status "accept karim" 200

# --- members.md -------------------------------------------------------------------------------
f="$out/api/members.md"
begin "$f" "Members list and one member" "Tabs All, Active, Pending and Inactive with their counts, search, one member's details, and the GraphQL query. The seeded members came in through the converge (D215)."
for tab in all active pending inactive; do
  rest GET "/employees?tab=$tab" - "$owner" "$demo"; expect_status "list $tab" 200
  assert_js "list $tab" "b.items.every((m)=>'$tab'==='all'||m.tab==='$tab') && b.total===b.counts['$tab']" "$work/b"
  emit_rest "$f" "GET /employees?tab=$tab" GET "/employees?tab=$tab" -
done
rest GET '/employees?tab=pending' - "$owner" "$demo"
assert_js "pending tab" "b.items.some((m)=>m.id==='$pending') && b.items.some((m)=>m.id==='$s2only') && !b.items.some((m)=>m.id==='$amina')" "$work/b"
rest GET '/employees?tab=all&search=amina' - "$owner" "$demo"; expect_status search 200
assert_js search "b.items.length===1 && b.items[0].id==='$amina'" "$work/b"
emit_rest "$f" "GET /employees?tab=all&search=amina" GET '/employees?tab=all&search=amina' -
rest GET "/employees/$amina" - "$owner" "$demo"; expect_status "get amina" 200
assert_js "get amina" "b.status==='active' && b.name==='Amina Saadi' && b.storeAccess==='all' && b.baseSalary===30000" "$work/b"
emit_rest "$f" "GET /employees/:id: the accepted member is active on all stores" GET "/employees/$amina" -
input=$(vars "{input:{tab:'pending'}}")
gql "$Q_TEAM_MEMBERS" "$input" "$owner" "$demo"; expect_ok "gql members"; assert_js "gql members" 'b.data.teamMembers.items.every((m)=>m.tab==="pending")' "$work/b"
emit "$f" "teamMembers (GraphQL), the Pending tab" "$Q_TEAM_MEMBERS" "$input" "$owner" "$demo"

# --- member-actions.md ------------------------------------------------------------------------
f="$out/api/member-actions.md"
begin "$f" "Member actions" "Edit, limit, stop and resume receiving orders, deactivate and reactivate, pay salary, order managers and remove. Pay salary is a placeholder: it books one row and writes \`salary.paid\` to the outbox in the same transaction (P6.S4 books the ledger)."
body='{"baseSalary":32000}'
rest PATCH "/employees/$amina" "$body" "$owner" "$demo"; expect_status edit 200; assert_js edit 'b.baseSalary===32000' "$work/b"
emit_rest "$f" "PATCH /employees/:id: the base salary" PATCH "/employees/$amina" "$body"
body='{"maxOpenOrders":20}'
rest POST "/employees/$amina/limit" "$body" "$owner" "$demo"; expect_status limit 200; assert_js limit 'b.maxOpenOrders===20' "$work/b"
emit_rest "$f" "POST /employees/:id/limit" POST "/employees/$amina/limit" "$body"
body='{"receivingOrders":false}'
rest POST "/employees/$amina/receiving" "$body" "$owner" "$demo"; expect_status stop 200; assert_js stop 'b.receivingOrders===false && b.status==="active"' "$work/b"
emit_rest "$f" "POST /employees/:id/receiving: stop receiving orders (the status stays active)" POST "/employees/$amina/receiving" "$body"
rest GET /employees/order-managers - "$owner" "$demo"; expect_status "managers stopped" 200
assert_js "managers stopped" "!b.some((m)=>m.id==='$amina')" "$work/b"
emit_rest "$f" "GET /employees/order-managers: a member who stopped receiving is not offered" GET /employees/order-managers -
body='{"receivingOrders":true}'
rest POST "/employees/$amina/receiving" "$body" "$owner" "$demo"; expect_status resume 200; assert_js resume 'b.receivingOrders===true' "$work/b"
emit_rest "$f" "POST /employees/:id/receiving: resume" POST "/employees/$amina/receiving" "$body"
rest GET /employees/order-managers - "$owner" "$demo"; expect_status managers 200
assert_js managers "b.some((m)=>m.id==='$amina' && m.maxOpenOrders===20)" "$work/b"
emit_rest "$f" "GET /employees/order-managers: active members receiving orders, with their limit (D209)" GET /employees/order-managers -
rest POST "/employees/$karim/deactivate" - "$owner" "$demo"; expect_status deactivate 200; assert_js deactivate 'b.status==="inactive"' "$work/b"
emit_rest "$f" "POST /employees/:id/deactivate" POST "/employees/$karim/deactivate" -
karim_roles=$(psql_value "select count(*) from member_role_assignment a join administrator d on d.id = a.\"administratorId\" where d.\"emailAddress\" = '$KARIM'" | command tr -d '\r\n')
[[ "$karim_roles" == 0 ]] || fail "a deactivated member still holds $karim_roles role assignments"
printf 'Database check: the deactivated member holds no role assignment (D204).\n\n' >>"$f"
rest GET '/employees?tab=inactive' - "$owner" "$demo"; assert_js "inactive tab" "b.items.length===1 && b.items[0].id==='$karim'" "$work/b"
emit_rest "$f" "GET /employees?tab=inactive" GET '/employees?tab=inactive' -
rest POST "/employees/$karim/reactivate" - "$owner" "$demo"; expect_status reactivate 200; assert_js reactivate 'b.status==="active"' "$work/b"
emit_rest "$f" "POST /employees/:id/reactivate: the roles and stores held before come back" POST "/employees/$karim/reactivate" -
rest GET "/employees/$karim" - "$owner" "$demo"; assert_js "karim back" "b.storeAccess==='selected' && b.storeIds.length===1 && b.roles.length===1" "$work/b"
pay_key="evidence-pay-$EV_RUN"
body="{\"idempotencyKey\":\"$pay_key\"}"
rest POST "/employees/$amina/pay" "$body" "$owner" "$demo"; expect_status pay 200; assert_js pay "b.amount===32000 && b.memberId==='$amina'" "$work/b"
payment=$(js 'b.id' "$work/b"); remember_id PAYMENT "$payment"
emit_rest "$f" "POST /employees/:id/pay: the base salary, once" POST "/employees/$amina/pay" "$body"
rest DELETE "/employees/$karim" - "$owner" "$demo"; expect_status remove 200; assert_js remove 'b.success===true' "$work/b"
emit_rest "$f" "DELETE /employees/:id" DELETE "/employees/$karim" -
rest GET "/employees/$karim" - "$owner" "$demo"; expect_rest_code "removed get" 404 team.member-not-found
emit_rest "$f" "GET /employees/:id of the removed member: not found" GET "/employees/$karim" -
deleted=$(psql_value "select count(*) from administrator where \"emailAddress\" = '$KARIM' and \"deletedAt\" is not null" | command tr -d '\r\n')
[[ "$deleted" == 1 ]] || fail "the removed member's account is not soft-deleted"
printf 'Database check: the removed member'"'"'s administrator is soft-deleted.\n\n' >>"$f"

# --- commissions.md ---------------------------------------------------------------------------
f="$out/api/commissions.md"
begin "$f" "Commission configs" "Structure only (P7.S1 calculates). A percent value is in basis points, a fixed one in whole DZD. A config given to a member cannot be deleted."
rest GET /commissions/configs/actions - "$owner" "$demo"; expect_status actions 200; assert_js actions 'b.length===2 && b.every((x)=>x.labels.ar && x.labels.en)' "$work/b"
emit_rest "$f" "GET /commissions/configs/actions: the bases, labelled in Arabic and English" GET /commissions/configs/actions -
body='{"name":"Confirmed order bonus","basis":"per-confirmed-order","valueKind":"fixed","value":150,"scope":"all"}'
rest POST /commissions/configs "$body" "$owner" "$demo"; expect_created "create commission"
commission=$(js 'b.id' "$work/b"); remember_id COMMISSION_FIXED "$commission"
emit_rest "$f" "POST /commissions/configs: 150 DZD per confirmed order" POST /commissions/configs "$body"
body="{\"name\":\"Delivered share\",\"basis\":\"per-delivered-order\",\"valueKind\":\"percent\",\"value\":250,\"scope\":\"selected\",\"storeIds\":[\"$demo_store\"]}"
rest POST /commissions/configs "$body" "$owner" "$demo"; expect_created "create percent"
percent=$(js 'b.id' "$work/b"); remember_id COMMISSION_PERCENT "$percent"
emit_rest "$f" "POST /commissions/configs: 2.5 % per delivered order, one store" POST /commissions/configs "$body"
rest GET /commissions/configs - "$owner" "$demo"; expect_status "list commissions" 200; assert_js "list commissions" 'b.length===2' "$work/b"
emit_rest "$f" "GET /commissions/configs" GET /commissions/configs -
rest GET "/commissions/configs/$commission" - "$owner" "$demo"; expect_status "get commission" 200
emit_rest "$f" "GET /commissions/configs/:id" GET "/commissions/configs/$commission" -
body='{"value":200}'
rest PATCH "/commissions/configs/$commission" "$body" "$owner" "$demo"; expect_status "patch commission" 200; assert_js "patch commission" 'b.value===200' "$work/b"
emit_rest "$f" "PATCH /commissions/configs/:id" PATCH "/commissions/configs/$commission" "$body"
body="{\"commissionConfigIds\":[\"$commission\"]}"
rest PATCH "/employees/$amina" "$body" "$owner" "$demo"; expect_status "give commission" 200
emit_rest "$f" "PATCH /employees/:id: the member gets the commission" PATCH "/employees/$amina" "$body"
rest DELETE "/commissions/configs/$commission" - "$owner" "$demo"; expect_rest_code "in use" 409 team.commission-in-use
emit_rest "$f" "DELETE /commissions/configs/:id while a member has it: refused" DELETE "/commissions/configs/$commission" -
rest PATCH "/employees/$amina" '{"commissionConfigIds":[]}' "$owner" "$demo"; expect_status "take commission" 200
rest DELETE "/commissions/configs/$commission" - "$owner" "$demo"; expect_status "delete commission" 200; assert_js "delete commission" 'b.success===true' "$work/b"
emit_rest "$f" "DELETE /commissions/configs/:id once no member has it" DELETE "/commissions/configs/$commission" -

# --- resend-revoke.md -------------------------------------------------------------------------
f="$out/api/resend-revoke.md"
begin "$f" "Resend and revoke" "A resend mails a new link and kills the old one (the hash is replaced). A second resend inside the minute is refused. A revoked link stops working."
invitation_token "$PENDING" 1; old_token=$LAST_INVITATION_TOKEN
wait_left=$((RESEND_COOLDOWN_SECONDS - (SECONDS - pending_invited_at)))
((wait_left <= 0)) || sleep "$wait_left"
body="{\"memberId\":\"$pending\"}"
rest POST /employees/resend-invitation "$body" "$owner" "$demo"; expect_status resend 200; assert_js resend 'b.status==="invited"' "$work/b"
emit_rest "$f" "POST /employees/resend-invitation" POST /employees/resend-invitation "$body"
dump_mail "$f" "$PENDING" 2 "The second mail in Mailpit"
invitation_token "$PENDING" 2; new_token=$LAST_INVITATION_TOKEN
[[ "$new_token" != "$old_token" ]] || fail "resend kept the token"
rest GET "/team/invitations/preview?token=$old_token" - - -; expect_rest_code "old link" 400 team.invitation-invalid
emit_rest "$f" "The first link after the resend: refused" GET "$PREVIEW_SHOWN" -
rest GET "/team/invitations/preview?token=$new_token" - - -; expect_status "new link" 200
emit_rest "$f" "The new link: answered" GET "$PREVIEW_SHOWN" -
rest POST /employees/resend-invitation "$body" "$owner" "$demo"; expect_rest_code cooldown 429 team.resend-cooldown
emit_rest "$f" "A second resend inside the minute: refused, no mail" POST /employees/resend-invitation "$body"
rest POST "/employees/$pending/revoke-invitation" - "$owner" "$demo"; expect_status revoke 200; assert_js revoke 'b.success===true' "$work/b"
emit_rest "$f" "POST /employees/:id/revoke-invitation" POST "/employees/$pending/revoke-invitation" -
rest GET "/team/invitations/preview?token=$new_token" - - -; expect_rest_code "revoked link" 400 team.invitation-invalid
emit_rest "$f" "The revoked link: the generic refusal" GET "$PREVIEW_SHOWN" -
await_mail_queue resend
mails=$(mail_count "$PENDING")
[[ "$mails" == 2 ]] || fail "the refused resend mailed: $mails messages"
printf 'Mailpit check: %s received exactly 2 messages (the refused resend sent none), counted once a control invite sent after it had its mail.\n\n' "$PENDING" >>"$f"

# --- refusals.md ------------------------------------------------------------------------------
f="$out/api/refusals.md"
begin "$f" "Refusals" "A duplicate email, the owner, a missing permission, anonymous, paying yourself, a double pay, a member outside a selected-store actor's reach, and the rate limits."
body=$(invite_body "AMINA@invitee.example.test " "$om_role" all '[]' 1 en)
rest POST /employees "$body" "$owner" "$demo"; expect_rest_code duplicate 409 team.email-already-member
emit_rest "$f" "Inviting a member's email again (other case, trailing space): refused" POST /employees "$body"
rest DELETE "/employees/$owner_member" - "$owner" "$demo"; expect_rest_code "owner remove" 403 team.owner-protected
emit_rest "$f" "Removing the business owner: refused" DELETE "/employees/$owner_member" -
body="{\"idempotencyKey\":\"evidence-self-$EV_RUN\"}"
rest POST "/employees/$owner_member/pay" "$body" "$owner" "$demo"; expect_rest_code "self pay" 403 team.self-action
emit_rest "$f" "Paying your own member row: refused" POST "/employees/$owner_member/pay" "$body"
body="{\"idempotencyKey\":\"$pay_key\"}"
rest POST "/employees/$amina/pay" "$body" "$owner" "$demo"; expect_status "double pay" 200; assert_js "double pay" "b.id==='$payment'" "$work/b"
emit_rest "$f" "The same payment again (same idempotency key): the first payment, nothing new" POST "/employees/$amina/pay" "$body"
payments=$(psql_value "select count(*) from salary_payment where \"memberId\" = $amina" | command tr -d '\r\n')
[[ "$payments" == 1 ]] || fail "the double pay booked $payments rows"
printf 'Database check: one `salary_payment` row for the member after both calls.\n\n' >>"$f"
salary_events=$(psql_value "select count(*) from outbox_event where topic = 'salary.paid' and payload->>'memberId' = '$amina'" | command tr -d '\r\n')
[[ "$salary_events" == 1 ]] || fail "the double pay wrote $salary_events salary.paid outbox rows"
printf 'Database check: one `salary.paid` row in `outbox_event` for the member after both calls (D222).\n\n' >>"$f"
rest GET /employees - "$orders" "$demo"; expect_status "no view" 403
emit_rest "$f" "GET /employees without team.members.view: 403" GET /employees -
body=$(invite_body "nobody@invitee.example.test" "$om_role" all '[]' 1 en)
rest POST /employees "$body" "$orders" "$demo"; expect_status "no invite" 403
emit_rest "$f" "POST /employees without team.members.invite: 403" POST /employees "$body"
rest GET /employees - - -; [[ "$status" == 401 || "$status" == 403 ]] || fail "anonymous list: $status"
emit_rest "$f" "GET /employees, anonymous" GET /employees -
# Store reach (D211): the read-only role may see and edit members for a moment, on its one selected store.
gql "$Q_UPDATE_ROLE" "$(vars "{id:'$viewer_role',input:{grants:['team.members.view','team.members.edit']}}")" "$owner" "$demo"; expect_ok "grant team view"
rest GET '/employees?tab=all' - "$limited" "$demo"; expect_status "reach list" 200
assert_js "reach list" "!b.items.some((m)=>m.id==='$s2only' || m.id==='$owner_member') && b.items.every((m)=>m.storeAccess==='selected')" "$work/b"
emit_rest "$f" "A member on the first store only lists members: those on the second store or on all stores are not shown (D211)" GET '/employees?tab=all' -
rest GET "/employees/$s2only" - "$limited" "$demo"; expect_rest_code "reach get" 404 team.member-not-found
emit_rest "$f" "The same member opens one invited onto the second store: not found" GET "/employees/$s2only" -
body='{"maxOpenOrders":3}'
rest POST "/employees/$amina/limit" "$body" "$limited" "$demo"; expect_rest_code "reach limit" 404 team.member-not-found
emit_rest "$f" "The same member limits one who works on all stores: not found" POST "/employees/$amina/limit" "$body"
gql "$Q_UPDATE_ROLE" "$(vars "{id:'$viewer_role',input:{revokes:['team.members.view','team.members.edit']}}")" "$owner" "$demo"; expect_ok "revoke team view"
# Rate limits: the budgets are spent by refused calls, so no mail is sent and no account is made.
reset_limits
# The bucket refills one token a second, also while it is drained: previews go on until one is refused (bounded, so a
# budget that never runs out still fails), then the accept goes straight after it, and both are written after.
body=$(accept_body unknown-token Late Comer "$INVITEE_PASSWORD")
preview_status=
for ((i = 0; i < 2 * ACCEPT_IP_BUDGET; i++)); do
  rest GET "/team/invitations/preview?token=unknown-$i" - - -
  [[ "$status" == 429 ]] && { preview_status=$status; break; }
  [[ "$status" == 400 ]] || fail "accept ip drain $i: preview answered $status"
done
[[ "$preview_status" == 429 ]] || fail "accept ip limit: no preview refused after $((2 * ACCEPT_IP_BUDGET))"
command cp "$work/h" "$work/preview-h"; command cp "$work/b" "$work/preview-b"
rest POST /team/invitations/accept "$body" - -; expect_status "accept limit" 429
command cp "$work/h" "$work/accept-h"; command cp "$work/b" "$work/accept-b"
command cp "$work/preview-h" "$work/h"; command cp "$work/preview-b" "$work/b"
emit_rest "$f" "Preview past the per-address budget ($ACCEPT_IP_BUDGET a minute): 429" GET '/team/invitations/preview?token=[REDACTED]' -
command cp "$work/accept-h" "$work/h"; command cp "$work/accept-b" "$work/b"
emit_rest "$f" "Accept from the same address, at once: 429" POST /team/invitations/accept "$(ACCEPT_SHOWN_BODY Late Comer)"
reset_limits
for ((i = 0; i < INVITE_ACTOR_BUDGET; i++)); do
  rest POST /employees "$(invite_body "drain-$i@invitee.example.test" "$om_role" all '[]' 1 en)" "$second_owner" "$second"
  [[ "$status" == 404 ]] || fail "drain invite $i: $status"
done
body=$(invite_body "late@invitee.example.test" "$second_om_role" all '[]' 1 en)
rest POST /employees "$body" "$second_owner" "$second"; expect_status "invite limit" 429
assert_js "invite limit" 'b.statusCode===429 && b.retryAfterSeconds>0' "$work/b"
emit_rest "$f" "Business B's owner after $INVITE_ACTOR_BUDGET invites this hour (each refused, so none mailed): 429" POST /employees "$body"
reset_limits
await_mail_queue invite-limit
late_mails=$(mail_count late@invitee.example.test)
[[ "$late_mails" == 0 ]] || fail "the refused invite mailed"

# --- isolation.md -----------------------------------------------------------------------------
f="$out/api/isolation.md"
begin "$f" "Two businesses: cross-tenant" "Business B's owner with A's ids, and A's owner with B's store. A foreign id is not found; a foreign store token is refused. The same email may be invited by both; only the second accept is refused, naming no business (D201)."
rest GET '/employees?tab=all' - "$second_owner" "$second"; expect_status "B list" 200
assert_js "B list" "b.counts.all===1 && !JSON.stringify(b).includes('$amina') && !JSON.stringify(b).includes('$AMINA')" "$work/b"
emit_rest "$f" "B lists its members: only its owner" GET '/employees?tab=all' -
rest GET "/employees/$amina" - "$second_owner" "$second"; expect_rest_code "B get" 404 team.member-not-found
emit_rest "$f" "B reads A's member: not found" GET "/employees/$amina" -
body='{"baseSalary":0}'
rest PATCH "/employees/$amina" "$body" "$second_owner" "$second"; expect_rest_code "B edit" 404 team.member-not-found
emit_rest "$f" "B edits A's member: not found" PATCH "/employees/$amina" "$body"
body="{\"idempotencyKey\":\"evidence-b-$EV_RUN\"}"
rest POST "/employees/$amina/pay" "$body" "$second_owner" "$second"; expect_rest_code "B pay" 404 team.member-not-found
emit_rest "$f" "B pays A's member: not found" POST "/employees/$amina/pay" "$body"
rest DELETE "/employees/$amina" - "$second_owner" "$second"; expect_rest_code "B remove" 404 team.member-not-found
emit_rest "$f" "B removes A's member: not found" DELETE "/employees/$amina" -
rest GET "/commissions/configs/$percent" - "$second_owner" "$second"; expect_rest_code "B commission" 404 team.commission-not-found
emit_rest "$f" "B reads A's commission: not found" GET "/commissions/configs/$percent" -
body=$(invite_body "foreign-role@invitee.example.test" "$om_role" all '[]' 1 en)
rest POST /employees "$body" "$second_owner" "$second"; expect_rest_code "B foreign role" 404 rbac.role-not-found
emit_rest "$f" "B invites with A's role: not found, nothing stored, no mail" POST /employees "$body"
rest GET '/employees?tab=all' - "$owner" "$second"; expect_status "A on B's store" 403
emit_rest "$f" "A's owner with B's store token: 403" GET '/employees?tab=all' -
body=$(invite_body "$AMINA" "$second_om_role" all '[]' 1000 en)
rest POST /employees "$body" "$second_owner" "$second"; expect_created "B invites amina"
emit_rest "$f" "B invites the email A's member uses: allowed, invitations are per business (D201)" POST /employees "$body"
invitation_token "$AMINA" 2
rest POST /team/invitations/accept "$(accept_body "$LAST_INVITATION_TOKEN" Amina Saadi "$INVITEE_PASSWORD")" - -; expect_rest_code elsewhere 409 team.account-elsewhere
assert_js elsewhere "!JSON.stringify(b).includes('Demo') && !JSON.stringify(b).includes('$demo_business')" "$work/b"
emit_rest "$f" "Accepting B's invitation with that email: refused, naming no business (D201)" POST /team/invitations/accept "$(ACCEPT_SHOWN_BODY Amina Saadi)"
rest GET "/employees/$amina" - "$owner" "$demo"; assert_js "A untouched" "b.status==='active' && b.baseSalary===32000" "$work/b"

# --- screens and the flows the browser proves ---------------------------------------------------
reset_limits
invitation_token "$S2ONLY" 1
EV_PREVIEW_TOKEN=$LAST_INVITATION_TOKEN EV_MAIL_EN=$PENDING EV_MAIL_AR=$KARIM EV_ACTIVE_EMAIL=$AMINA \
  timeout 900 node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/evidence/P1.S4-screens.mjs "$api/dashboard" "$mailpit" "$work/shots" \
  > "$work/shots.txt" 2> >(command tee "$work/screens.log" >&2)
command cp "$work"/shots/*.png "$out/screens/"

# --- the browser suite, on this stack (browser.yml does not run on pull requests) -------------
reset_limits
DASHBOARD_URL=$api/dashboard MAILPIT_URL=$mailpit SCREENSHOT_DIR=$work/browser-shots \
  DATABASE_URL_DIRECT="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@127.0.0.1:$POSTGRES_HOST_PORT/$POSTGRES_DB" \
  timeout 600 pnpm --filter @cod/server test:browser >"$work/browser.log" 2>&1 || fail "browser suite: $(command tail -40 "$work/browser.log")"
browser_summary=$(command grep -E '^ *(Test Files|Tests) ' "$work/browser.log" | command sed -E 's/\x1b\[[0-9;]*m//g; s/^ +//')

# --- README -------------------------------------------------------------------------------------
{
  cat <<README
# Evidence for P1.S4 (team members and invitations)

Transcripts and screenshots from a live stack (CLAUDE.md §3a.14), produced by \`scripts/evidence/P1.S4.sh\`. Data is synthetic. Image
built from a tree with no uncommitted change outside the evidence folders and browser tests, last image-relevant commit
\`$image_commit\`. Compose project \`cod-evidence\`.

## API transcripts

| File | Shows |
| --- | --- |
| [\`api/invite.md\`](api/invite.md) | \`POST /employees\` (all stores, one store, the second store), both invitation mails as Mailpit received them, the hash-only token column |
| [\`api/accept.md\`](api/accept.md) | Public preview and accept (\`no-store\`, \`no-referrer\`), a used link refused on preview and accept, one account |
| [\`api/members.md\`](api/members.md) | \`GET /employees\` per tab with counts, search, \`GET /employees/:id\`, the \`teamMembers\` query |
| [\`api/member-actions.md\`](api/member-actions.md) | Edit, limit, stop and resume receiving, order managers, deactivate (no role left) and reactivate, pay, remove |
| [\`api/commissions.md\`](api/commissions.md) | \`GET /commissions/configs/actions\` and the configs CRUD, a config in use refused |
| [\`api/resend-revoke.md\`](api/resend-revoke.md) | Resend (new mail, old link dead), the cooldown refusal, revoke |
| [\`api/refusals.md\`](api/refusals.md) | Duplicate email, owner remove, self-pay, a double pay answering the first payment, 403 without the permission, anonymous, store reach (D211), 429 on preview, accept and invite |
| [\`api/isolation.md\`](api/isolation.md) | B's owner on A's member and commission, A's role in B's invite, A on B's store, the same email in both businesses (D201) |

Ids this run acted on (stores, roles, members, commissions, the payment, the business) and channel tokens are placeholders; every
assertion ran on the real values. Invitation tokens and passwords are written \`[REDACTED]\`; session tokens and cookies never appear.
Administrator ids are the engine's small integers.

\`salary.paid\` is written to the outbox in the paying transaction (\`plugins/team/infrastructure/salary-paid.outbox.ts\`, D222);
no consumer subscribes to it until the ledger (P6.S4). The database checks in \`refusals.md\` show one booked \`salary_payment\`
row and one \`salary.paid\` outbox row for the member after the pay and the repeated pay.

## Browser suite

Run on this stack, since \`browser.yml\` does not run on pull requests: \`pnpm --filter @cod/server test:browser\`.

$browser_summary

## Browser flows proved by \`scripts/evidence/P1.S4-screens.mjs\`

Every line below is a failing assertion in the script if it does not hold; the shots are in \`screens/\` (desktop 1440x900, mobile
390x844, Arabic and English).

$(command sed -E 's/^/- /' <(command grep -v '^shot ' "$work/screens.log"))

README
  if [[ -f scripts/evidence/P1.S4-seen.md ]]; then command cat scripts/evidence/P1.S4-seen.md; fi
} >"$out/README.md"

# --- placeholders, sizes and redaction ------------------------------------------------------------
for t in "$out"/api/*.md; do normalise_file "$t"; done
if command grep -rqE '^HTTP/1\.1 [^0-9]' "$out/api"; then fail "a placeholder corrupted a status line"; fi
if command grep -rqE '^HTTP/1\.1 [0-9]{3}[^ 0-9]' "$out/api"; then fail "a placeholder corrupted a status line"; fi
for f in "$out"/screens/*.png; do
  (($(command stat -c %s "$f") <= 300 * 1024)) || fail "$f is over 300 KB"
done
((${#session_tokens[@]} >= 4)) || fail "the redaction check would be vacuous"
((${#invitation_tokens[@]} >= 6)) || fail "the token check would be vacuous"
for secret in "${secret_values[@]}" "$AUTH_TOKEN_SECRET" "$DEMO_OWNER_PASSWORD" "$INVITEE_PASSWORD" "${session_tokens[@]}" "${cookies[@]}" \
  "${invitation_tokens[@]}" "$demo" "$demo2" "$second"; do
  if command grep -rqaF -- "$secret" "$out"; then fail "a raw secret or token appears in $out"; fi
done
if command grep -rqE "(^|[^A-Za-z0-9_-])$TOKEN_RE([^A-Za-z0-9_-]|\$)" "$out/api" "$out/README.md"; then fail "a 43-character token appears in $out"; fi
if command grep -rqE 'token=[^[]' "$out/api" "$out/README.md"; then fail "a token= value is not redacted in $out"; fi
if command grep -rqiE '"?password"?[[:space:]]*[:=][[:space:]]*"?[^"[[:space:]]' "$out/api"; then fail "a password value is not redacted in $out"; fi
node --input-type=module -e '
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { findBrandingViolations } from "./packages/config/gates/branding.ts";
const dir = process.argv[1];
const files = [join(dir, "README.md"), ...readdirSync(join(dir, "api")).map((n) => join(dir, "api", n))];
const bad = findBrandingViolations(files.map((path) => ({ path, content: readFileSync(path, "utf8") })));
if (bad.length > 0) { console.error(bad.join("\n")); process.exit(1); }' "$out" || fail "a banned name appears in $out"
echo "EVIDENCE-OK"
