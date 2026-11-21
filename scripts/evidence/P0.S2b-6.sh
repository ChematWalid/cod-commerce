#!/usr/bin/env bash
# The screenshots are historical: scripts/evidence/template-screens.mjs drove the template's dashboard route that P2.S1
# removed (D2111), so a re-run skips that step and keeps the committed shots. The API transcripts still re-run; they need
# APP_ENV development or test (the .env.example default), where the template plugin is registered.
# Proof-of-working evidence for P0.S2b-6 (CLAUDE.md §3a.14): runs the real compose stack under its own project
# (cod-evidence, every *_HOST_PORT shifted by 20000), records live Admin API transcripts of the plugin template
# (create/read, typed error, FORBIDDEN, two-business isolation, input shape) and screenshots its dashboard page
# (Arabic RTL and English, desktop and mobile) into docs/evidence/P0.S2b-6/, then tears the stack down.
# Never touches `cod` or `cod-verify`.
#
#   scripts/evidence/P0.S2b-6.sh   # always rebuilds cod-platform:local first (the layer cache keeps that cheap)
#
# The browser work is scripts/evidence/template-screens.mjs; transcripts are formatted by transcript.mjs.
# Data is synthetic (.env placeholders, two generated businesses). Generated note ids and timestamps are
# replaced by placeholders after their format is asserted, so re-runs regenerate identical files.
set -euo pipefail
cd "$(dirname "$0")/../.."
# shellcheck source=../lib/wait-http.sh
. scripts/lib/wait-http.sh

if [[ ! -f .env ]]; then
  echo "evidence: .env is missing; copy .env.example to .env first (cp .env.example .env)" >&2
  exit 1
fi
set -a
. ./.env
set +a
export COMPOSE_PROJECT_NAME=cod-evidence
export POSTGRES_HOST_PORT=25433 PGBOUNCER_HOST_PORT=26432 VALKEY_HOST_PORT=26380 GARAGE_S3_HOST_PORT=23900
export MAILPIT_SMTP_HOST_PORT=21026 MAILPIT_UI_HOST_PORT=28026 API_HOST_PORT=23100 WORKER_HEALTH_HOST_PORT=23020
export STOREFRONT_HOST_PORT=23001
export APP_IMAGE=${APP_IMAGE:-cod-platform:local}

# --- synthetic data, mirrored once -------------------------------------------------------
# Channel codes/tokens of the two businesses (as plugins/_template/tests/integration/template-note.isolation.int.test.ts),
# the unknown token of RF1, and the notes. Notes of A: an English one and an Arabic one (the dashboard shots).
CODE_A=business-a TOKEN_A=business-a-token CODE_B=business-b TOKEN_B=business-b-token UNKNOWN_TOKEN=nope
TITLE_A1='Call supplier' BODY_A1='About the late order'
TITLE_A2='مكالمة المورد' BODY_A2='بخصوص الطلبية المتأخرة'
TITLE_B1="B's private note" BODY_B1='Only business B sees this'
READER_CODE=catalog-reader READER_EMAIL=catalog-reader@example.test
# The password of the synthetic administrator without ReadTemplateNote; never printed (transcripts show [REDACTED]).
READER_PASSWORD=evidence-reader-password
SNOWFLAKE_RE='^[1-9][0-9]{0,18}$'

out=docs/evidence/P0.S2b-6
api="http://127.0.0.1:$API_HOST_PORT"
admin="$api/admin-api?languageCode=en"
work=$(mktemp -d)

fail() {
  echo "EVIDENCE FAILED: $*" >&2
  exit 1
}

on_exit() {
  local status=$?
  if ((status != 0)); then
    docker compose ps -a >&2 || true
    docker compose logs --no-color --tail=60 migrate api worker >&2 || true
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

[[ -n "${SUPERADMIN_PASSWORD:-}" ]] || fail "SUPERADMIN_PASSWORD is empty; the redaction check would be vacuous"
[[ -n "${COOKIE_SECRET:-}" ]] || fail "COOKIE_SECRET is empty; the redaction check would be vacuous"
secret_values=()
while IFS='=' read -r name value; do
  value=${value%\"}
  value=${value#\"}
  [[ -n "$value" ]] && secret_values+=("$value")
done < <(command grep -E '^(export[[:space:]]+)?[A-Z0-9_]*(PASSWORD|SECRET|TOKEN|_KEY)=' .env)
((${#secret_values[@]} >= 2)) || fail "found fewer than 2 non-empty secret values in .env"

# --- image: always built here, from a tree that matches the commit the README names -------------
image_inputs=(. ':!docs/evidence' ':!scripts/evidence' ':!.superpowers')
dirty=$(git status --porcelain -- "${image_inputs[@]}")
[[ -z "$dirty" ]] || fail "uncommitted changes outside the evidence folders; commit or stash them first:
$dirty"
image_commit=$(git log -1 --format=%H -- "${image_inputs[@]}")
[[ -n "$image_commit" ]] || fail "no commit touches the image inputs; nothing to attribute the image to"
head_before=$(git rev-parse HEAD)
NEXT_DEPLOYMENT_ID="$(git rev-parse --short "$image_commit")"
export NEXT_DEPLOYMENT_ID

docker compose down -v --remove-orphans
started=$SECONDS
docker compose build migrate
echo "image built in $((SECONDS - started))s"
built_image_id=$(docker image inspect -f '{{.Id}}' "$APP_IMAGE")
[[ "$(git rev-parse HEAD)" == "$head_before" ]] || fail "HEAD moved during the image build"
dirty=$(git status --porcelain -- "${image_inputs[@]}")
[[ -z "$dirty" ]] || fail "the tree changed during the image build:
$dirty"

docker compose up -d api worker
wait_healthy api worker
wait_http 200 "$api/readyz" 60 || fail "api /readyz"
wait_http 200 "$api/dashboard/" 60 || fail "api /dashboard/"
deployment_id=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$(container_of api)" | command grep '^NEXT_DEPLOYMENT_ID=' | command cut -d= -f2-)
[[ "$deployment_id" == "$NEXT_DEPLOYMENT_ID" ]] || fail "the api container's NEXT_DEPLOYMENT_ID is '$deployment_id', expected '$NEXT_DEPLOYMENT_ID'"
running_image_id=$(docker inspect -f '{{.Image}}' "$(container_of api)")
[[ "$running_image_id" == "$built_image_id" ]] || fail "the api container runs image $running_image_id, not the freshly built $APP_IMAGE ($built_image_id)"

rm -rf "$out/api"
mkdir -p "$out/api"

# --- helpers -----------------------------------------------------------------------------
# js <expr> <file>: evaluates a JS expression with `b` = the parsed JSON file; prints the result (strings raw).
js() { node -e 'const b=JSON.parse(require("fs").readFileSync(process.argv[2],"utf8")); const r=eval(process.argv[1]); console.log(typeof r==="string"?r:JSON.stringify(r))' "$1" "$2"; }
# assert_js <label> <expr> <file>: fails unless the expression is true for the parsed JSON file.
assert_js() { [[ "$(js "$2" "$3")" == true ]] || fail "$1: '$2' is not true for $(command cat "$3")"; }

declare -A NOTE_IDS=() # placeholder name -> generated id, filled by capture_id
capture_id() { # capture_id <NAME> <json-expr>: asserts the id format, remembers it for normalisation
  local id
  id=$(js "$2" "$work/b")
  [[ "$id" =~ $SNOWFLAKE_RE ]] || fail "$1: '$id' is not a positive 63-bit decimal id"
  NOTE_IDS[$1]=$id
}

# Replaces the generated ids by <NAME_ID> placeholders and every createdAt by <TIMESTAMP>, in $work/b.
# Every createdAt must be an ISO timestamp and every note id must be a known one, or the run fails.
normalise_body() {
  local map=""
  for k in "${!NOTE_IDS[@]}"; do map+="$k=${NOTE_IDS[$k]},"; done
  IDMAP=$map node -e '
const fs = require("fs");
const file = process.argv[1];
const byId = new Map(process.env.IDMAP.split(",").filter(Boolean).map((p) => p.split("=").reverse()));
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const walk = (v) => {
  if (Array.isArray(v)) return v.map(walk);
  if (v === null || typeof v !== "object") return v;
  const o = {};
  const isNote = "title" in v && "createdAt" in v && "id" in v;
  for (const [k, x] of Object.entries(v)) {
    if (k === "createdAt") {
      if (!ISO.test(x)) throw new Error("createdAt is not ISO: " + x);
      o[k] = "<TIMESTAMP>";
    } else if (isNote && k === "id") {
      if (!byId.has(x)) throw new Error("unknown note id " + x);
      o[k] = "<" + byId.get(x) + "_ID>";
    } else o[k] = walk(x);
  }
  return o;
};
let text = fs.readFileSync(file, "utf8");
let parsed;
try { parsed = JSON.parse(text); } catch { process.exit(0); }
fs.writeFileSync(file, JSON.stringify(walk(parsed)));
' "$work/b"
}

json='Content-Type: application/json'
# gql <query> <variables-json> <session-token|-> <channel-token|->
# POST to the Admin API. Leaves the raw response in $work/raw, the normalised one in $work/b.
gql() {
  local query=$1 vars=$2 session=$3 channel=$4
  local body
  body=$(Q="$query" V="$vars" node -e 'console.log(JSON.stringify({query:process.env.Q,variables:JSON.parse(process.env.V)}))')
  local -a args=(-sS -X POST -D "$work/h" -o "$work/b" --max-time 30 -H "$json" --data "$body")
  [[ "$session" != - ]] && args+=(-H "Authorization: Bearer $session")
  [[ "$channel" != - ]] && args+=(-H "vendure-token: $channel")
  local status
  status=$(curl "${args[@]}" -w '%{http_code}' "$admin") || status=000
  [[ "$status" != 000 ]] || fail "no HTTP answer from $admin"
  command cp "$work/b" "$work/raw"
}
# emit <file> <title> <shown-vars|-> : normalises $work/b and appends the transcript (the request shows the same
# variables the call sent, with placeholders substituted by the caller where an id was sent).
emit() {
  local file=$1 title=$2 query=$3 shown_vars=$4 session=$5 channel=$6
  normalise_body
  local -a shown=("$json")
  [[ "$session" != - ]] && shown+=("Authorization: Bearer [REDACTED]")
  [[ "$channel" != - ]] && shown+=("vendure-token: $channel")
  local shown_body
  shown_body=$(Q="$query" V="$shown_vars" node -e 'console.log(JSON.stringify({query:process.env.Q,variables:JSON.parse(process.env.V)}))')
  SHOWN_HEADERS=$(printf '%s\n' "${shown[@]}") SHOWN_BODY=$shown_body \
    TITLE=$title METHOD=POST URL="$admin" node scripts/evidence/transcript.mjs "$work/h" "$work/b" "$file"
}
begin() { printf '# %s\n\n%s\n\n' "$2" "$3" >"$1"; }
login_tokens=() cookies=()
remember_login() { # remember_login: token and cookie values of the last login, for the final redaction check
  local t
  t=$(command grep -i '^vendure-auth-token:' "$work/h" | command head -1 | node -e 'console.log(require("fs").readFileSync(0,"utf8").split(":")[1].trim())')
  [[ -n "$t" ]] || fail "login returned no vendure-auth-token header"
  login_tokens+=("$t")
  local c
  c=$(command grep -i '^set-cookie:' "$work/h" | node -e 'for (const l of require("fs").readFileSync(0,"utf8").split("\n")) { const m = /^set-cookie:\s*[^=]+=([^;\s]+)/i.exec(l); if (m) console.log(m[1]); }')
  [[ -z "$c" ]] || cookies+=($c)
  LAST_TOKEN=$t
}

# --- queries -----------------------------------------------------------------------------
Q_LOGIN='mutation Login($username: String!, $password: String!) { login(username: $username, password: $password) { __typename ... on CurrentUser { identifier } ... on ErrorResult { errorCode message } } }'
Q_ZONES='query { zones { items { id name } } }'
Q_CHANNEL='mutation ($input: CreateChannelInput!) { createChannel(input: $input) { __typename ... on Channel { id code token } ... on ErrorResult { errorCode message } } }'
Q_ACTIVE='query { activeChannel { id code } }'
Q_CREATE='mutation ($input: CreateTemplateNoteInput!) { createTemplateNote(input: $input) { id title body createdAt } }'
Q_NOTE='query ($id: String!) { templateNote(id: $id) { id title body createdAt } }'
Q_NOTES='query ($take: Int, $skip: Int) { templateNotes(take: $take, skip: $skip) { id title body createdAt } }'
Q_ROLE='mutation ($input: CreateRoleInput!) { createRole(input: $input) { id code permissions } }'
Q_ADMIN='mutation ($input: CreateAdministratorInput!) { createAdministrator(input: $input) { id emailAddress } }'
Q_INPUT='query { __type(name: "CreateTemplateNoteInput") { name inputFields { name type { kind name ofType { name } } } } }'

vars_json() { node -e 'console.log(JSON.stringify(JSON.parse(process.argv[1])))' "$1"; }
login_vars() { U="$1" P="$2" node -e 'console.log(JSON.stringify({username:process.env.U,password:process.env.P}))'; }
login_shown() { U="$1" node -e 'console.log(JSON.stringify({username:process.env.U,password:"[REDACTED]"}))'; }

# --- superadmin session and the two businesses (setup, not transcripts) -----------------------
gql "$Q_LOGIN" "$(login_vars "$SUPERADMIN_USERNAME" "$SUPERADMIN_PASSWORD")" - -
assert_js "superadmin login" 'b.data.login.__typename==="CurrentUser"' "$work/b"
remember_login
super=$LAST_TOKEN
gql "$Q_ZONES" '{}' "$super" -
zone_id=$(js '(b.data.zones.items.find(z=>z.name==="Algeria")||{}).id' "$work/b")
[[ -n "$zone_id" && "$zone_id" != undefined ]] || fail "no Algeria zone in the seed: $(command cat "$work/b")"

create_channel() { # create_channel <code> <token>
  local vars
  vars=$(Z="$zone_id" C="$1" T="$2" node -e 'console.log(JSON.stringify({input:{code:process.env.C,token:process.env.T,defaultLanguageCode:"en",pricesIncludeTax:true,defaultCurrencyCode:"DZD",defaultTaxZoneId:process.env.Z,defaultShippingZoneId:process.env.Z}}))')
  gql "$Q_CHANNEL" "$vars" "$super" -
  assert_js "createChannel $1" 'b.data.createTemplateNote===undefined&&b.data.createChannel.__typename==="Channel"' "$work/b"
}
create_channel "$CODE_A" "$TOKEN_A"
create_channel "$CODE_B" "$TOKEN_B"

# --- create-note.md ----------------------------------------------------------------------
begin "$out/api/create-note.md" "createTemplateNote" "\`createTemplateNote\` on the Admin API (\`POST /admin-api\`), superadmin session (bearer token, redacted), in the channel of business A (\`vendure-token: $TOKEN_A\`). The business is the channel the request runs in; the input has no business field. The generated id is a positive 63-bit decimal string (format asserted by the script) and is shown as a placeholder, as are the timestamps."
create_note() { # create_note <file> <title> <name> <token> <note-title> <note-body>
  local vars
  vars=$(T="$5" B="$6" node -e 'console.log(JSON.stringify({input:{title:process.env.T,body:process.env.B}}))')
  gql "$Q_CREATE" "$vars" "$super" "$4"
  assert_js "$2" "!b.errors && b.data.createTemplateNote.title === $(node -e 'console.log(JSON.stringify(process.argv[1]))' "$5") && b.data.createTemplateNote.createdAt.length > 0" "$work/b"
  capture_id "$3" 'b.data.createTemplateNote.id'
  [[ -z "$1" ]] || { emit "$1" "$2" "$Q_CREATE" "$vars" "$super" "$4"; }
}
create_note "$out/api/create-note.md" "Business A: create an English note" NOTE_A1 "$TOKEN_A" "$TITLE_A1" "$BODY_A1"
sleep 0.2
create_note "$out/api/create-note.md" "Business A: create an Arabic note" NOTE_A2 "$TOKEN_A" "$TITLE_A2" "$BODY_A2"
sleep 0.2
create_note "" "Business B: create a note" NOTE_B1 "$TOKEN_B" "$TITLE_B1" "$BODY_B1"

# --- read-notes.md -----------------------------------------------------------------------
begin "$out/api/read-notes.md" "templateNote and templateNotes" "Reading business A's notes: \`templateNote(id)\` and the newest-first page \`templateNotes(take, skip)\`, same session and channel as \`create-note.md\`. Ids and timestamps are placeholders (\`<NOTE_A1_ID>\` is the English note, \`<NOTE_A2_ID>\` the Arabic one)."
id_vars() { ID="$1" node -e 'console.log(JSON.stringify({id:process.env.ID}))' ; }
gql "$Q_NOTE" "$(id_vars "${NOTE_IDS[NOTE_A1]}")" "$super" "$TOKEN_A"
assert_js "templateNote in A" "b.data.templateNote.id === '${NOTE_IDS[NOTE_A1]}' && b.data.templateNote.title === '$TITLE_A1'" "$work/b"
emit "$out/api/read-notes.md" "Business A: templateNote(id) of the English note" "$Q_NOTE" "$(id_vars '<NOTE_A1_ID>')" "$super" "$TOKEN_A"
page_vars='{"take":10,"skip":0}'
gql "$Q_NOTES" "$page_vars" "$super" "$TOKEN_A"
assert_js "templateNotes in A" "JSON.stringify(b.data.templateNotes.map(n=>n.id)) === JSON.stringify(['${NOTE_IDS[NOTE_A2]}','${NOTE_IDS[NOTE_A1]}'])" "$work/b"
emit "$out/api/read-notes.md" "Business A: templateNotes(take: 10, skip: 0), newest first" "$Q_NOTES" "$page_vars" "$super" "$TOKEN_A"
gql "$Q_NOTES" '{"take":1,"skip":1}' "$super" "$TOKEN_A"
assert_js "templateNotes skip" "b.data.templateNotes.length === 1 && b.data.templateNotes[0].id === '${NOTE_IDS[NOTE_A1]}'" "$work/b"
emit "$out/api/read-notes.md" "Business A: templateNotes(take: 1, skip: 1), the second page" "$Q_NOTES" '{"take":1,"skip":1}' "$super" "$TOKEN_A"

# --- typed-error.md ----------------------------------------------------------------------
begin "$out/api/typed-error.md" "Typed domain error" "\`createTemplateNote\` with a blank title is refused by the domain with a typed error: \`extensions.code\` is \`TEMPLATE_NOTE_INVALID_TITLE\` and no data is returned."
empty_vars='{"input":{"title":"   ","body":""}}'
gql "$Q_CREATE" "$empty_vars" "$super" "$TOKEN_A"
assert_js "typed error" 'b.errors.length===1 && b.errors[0].extensions.code==="TEMPLATE_NOTE_INVALID_TITLE" && !b.data' "$work/b"
emit "$out/api/typed-error.md" "Business A: createTemplateNote with a blank title" "$Q_CREATE" "$empty_vars" "$super" "$TOKEN_A"

# --- forbidden.md ------------------------------------------------------------------------
begin "$out/api/forbidden.md" "Permission check" "An administrator whose only role grants \`ReadCatalog\` (plus the implicit \`Authenticated\`; created below through the Admin API, synthetic data) cannot read notes: \`templateNotes\` answers \`FORBIDDEN\`. The password of that account is redacted by the script."
role_vars=$(C="$READER_CODE" node -e 'console.log(JSON.stringify({input:{code:process.env.C,description:process.env.C,permissions:["ReadCatalog"]}}))')
gql "$Q_ROLE" "$role_vars" "$super" -
assert_js "createRole" 'b.data.createRole.permissions.includes("ReadCatalog") && !b.data.createRole.permissions.some(p=>/TemplateNote/.test(p))' "$work/b"
role_id=$(js 'b.data.createRole.id' "$work/b")
command cp "$work/raw" "$work/role.raw"
emit "$out/api/forbidden.md" "Superadmin: create a role with only ReadCatalog" "$Q_ROLE" "$role_vars" "$super" -
admin_vars() { E="$READER_EMAIL" P="$1" R="$role_id" node -e 'console.log(JSON.stringify({input:{firstName:"Catalog",lastName:"Reader",emailAddress:process.env.E,password:process.env.P,roleIds:[process.env.R]}}))'; }
gql "$Q_ADMIN" "$(admin_vars "$READER_PASSWORD")" "$super" -
assert_js "createAdministrator" "b.data.createAdministrator.emailAddress==='$READER_EMAIL'" "$work/b"
emit "$out/api/forbidden.md" "Superadmin: create an administrator with that role" "$Q_ADMIN" "$(admin_vars '[REDACTED]')" "$super" -
gql "$Q_LOGIN" "$(login_vars "$READER_EMAIL" "$READER_PASSWORD")" - -
assert_js "reader login" 'b.data.login.__typename==="CurrentUser"' "$work/b"
remember_login
reader=$LAST_TOKEN
emit "$out/api/forbidden.md" "The catalog reader signs in" "$Q_LOGIN" "$(login_shown "$READER_EMAIL")" - -
gql "$Q_NOTES" '{"take":10,"skip":0}' "$reader" -
assert_js "forbidden" 'b.errors.length===1 && b.errors[0].extensions.code==="FORBIDDEN" && !b.data' "$work/b"
emit "$out/api/forbidden.md" "The catalog reader: templateNotes" "$Q_NOTES" '{"take":10,"skip":0}' "$reader" -

# --- isolation.md ------------------------------------------------------------------------
begin "$out/api/isolation.md" "Two-business isolation" "Business A (\`$CODE_A\`, token \`$TOKEN_A\`) and business B (\`$CODE_B\`, token \`$TOKEN_B\`) are two Vendure channels created through the Admin API (ADR 0002: one channel per business; neither is the platform's default channel). Each has notes; the same superadmin session reads from both by switching only the \`vendure-token\` header. A never reads B's note by id nor in its list, and the converse; an unknown channel token is refused instead of falling back to the default channel. Note ids and timestamps are placeholders; the script asserts each result on the real ids."
gql "$Q_ACTIVE" '{}' "$super" "$TOKEN_A"
chan_a=$(js 'b.data.activeChannel.id' "$work/b")
assert_js "A channel" "b.data.activeChannel.code === '$CODE_A'" "$work/b"
emit "$out/api/isolation.md" "Token $TOKEN_A resolves to channel $CODE_A" "$Q_ACTIVE" '{}' "$super" "$TOKEN_A"
gql "$Q_ACTIVE" '{}' "$super" "$TOKEN_B"
chan_b=$(js 'b.data.activeChannel.id' "$work/b")
assert_js "B channel" "b.data.activeChannel.code === '$CODE_B'" "$work/b"
emit "$out/api/isolation.md" "Token $TOKEN_B resolves to channel $CODE_B" "$Q_ACTIVE" '{}' "$super" "$TOKEN_B"
gql "$Q_ACTIVE" '{}' "$super" -
assert_js "default channel" 'b.data.activeChannel.code==="__default_channel__"' "$work/b"
[[ "$chan_a" != "$chan_b" ]] || fail "A and B resolved to the same channel"
emit "$out/api/isolation.md" "No token resolves to the platform's default channel, which is neither A nor B" "$Q_ACTIVE" '{}' "$super" -

read_note() { # read_note <title> <token> <name-for-sent-id> <expect-null:true|false> <expected-title>
  gql "$Q_NOTE" "$(id_vars "${NOTE_IDS[$3]}")" "$super" "$2"
  if [[ "$4" == true ]]; then
    assert_js "$1" 'b.data.templateNote === null && !b.errors' "$work/b"
  else
    assert_js "$1" "b.data.templateNote.id === '${NOTE_IDS[$3]}' && b.data.templateNote.title === $(node -e 'console.log(JSON.stringify(process.argv[1]))' "$5")" "$work/b"
  fi
  emit "$out/api/isolation.md" "$1" "$Q_NOTE" "$(id_vars "<${3}_ID>")" "$super" "$2"
}
list_notes() { # list_notes <title> <token> <expected ids JSON array of names>
  gql "$Q_NOTES" '{"take":10,"skip":0}' "$super" "$2"
  local expected="" n
  for n in $3; do expected+="'${NOTE_IDS[$n]}',"; done
  assert_js "$1" "JSON.stringify(b.data.templateNotes.map(n=>n.id).sort()) === JSON.stringify([${expected}].sort())" "$work/b"
  emit "$out/api/isolation.md" "$1" "$Q_NOTES" '{"take":10,"skip":0}' "$super" "$2"
}
read_note "In B: templateNote(id of A's English note) is null" "$TOKEN_B" NOTE_A1 true ""
read_note "In B: templateNote(id of B's own note) is found" "$TOKEN_B" NOTE_B1 false "$TITLE_B1"
list_notes "In B: templateNotes lists only B's note" "$TOKEN_B" "NOTE_B1"
read_note "In A: templateNote(id of B's note) is null" "$TOKEN_A" NOTE_B1 true ""
list_notes "In A: templateNotes lists only A's two notes" "$TOKEN_A" "NOTE_A1 NOTE_A2"
list_notes "On the platform (default channel): templateNotes is empty" - ""

gql "$Q_NOTES" '{"take":10,"skip":0}' "$super" "$UNKNOWN_TOKEN"
assert_js "unknown token" 'b.errors.length===1 && b.errors[0].extensions.code==="CHANNEL_NOT_FOUND" && !b.data' "$work/b"
emit "$out/api/isolation.md" "Unknown channel token '$UNKNOWN_TOKEN': refused, no data" "$Q_NOTES" '{"take":10,"skip":0}' "$super" "$UNKNOWN_TOKEN"

# --- input-shape.md ----------------------------------------------------------------------
begin "$out/api/input-shape.md" "CreateTemplateNoteInput" "Introspection of the mutation's input type: it has \`body\` and \`title\` only. There is no business or channel field, so a caller cannot choose the tenant (it comes from the request's channel)."
gql "$Q_INPUT" '{}' "$super" -
assert_js "input shape" 'JSON.stringify(b.data.__type.inputFields.map(f=>f.name).sort())==="[\"body\",\"title\"]"' "$work/b"
emit "$out/api/input-shape.md" "Introspect CreateTemplateNoteInput" "$Q_INPUT" '{}' "$super" -

# --- screenshots -------------------------------------------------------------------------
# The dashboard route these drove was removed in P2.S1 (D2111): skipped, the committed shots stay.
echo "evidence: skipping the screenshots (template route removed in P2.S1, D2111); the committed ones stay" >&2

# --- README ------------------------------------------------------------------------------
cat >"$out/README.md" <<README
# Evidence for P0.S2b-6 (plugin template)

Request/response transcripts and screenshots of the real \`plugins/_template\` ("notes" feature) running inside the
platform image (CLAUDE.md §3a.14). Produced by \`scripts/evidence/P0.S2b-6.sh\`; nothing here is hand-written. Data is
synthetic: two generated businesses (channels \`$CODE_A\`, \`$CODE_B\`) and the placeholders from \`.env.example\`.

- Image: \`cod-platform:local\`, built by that run (\`docker compose build migrate\`) from a working tree with no uncommitted
  change outside the evidence folders, whose last image-relevant commit is \`$image_commit\`.
- \`NEXT_DEPLOYMENT_ID\` of the running \`api\` container: \`$deployment_id\`, the short id of that commit. The script asserts that
  it and the container's image id are the ones just built. Stack: compose project \`cod-evidence\`, \`api\` on host port $API_HOST_PORT.

## API transcripts (Admin API, \`POST /admin-api\`)

| File | Shows |
| --- | --- |
| [\`api/create-note.md\`](api/create-note.md) | \`createTemplateNote\` in business A's channel (an English and an Arabic note); ids are 63-bit decimal strings |
| [\`api/read-notes.md\`](api/read-notes.md) | \`templateNote(id)\` and \`templateNotes(take, skip)\` in A: A's notes, newest first, and the second page |
| [\`api/typed-error.md\`](api/typed-error.md) | A blank title: \`extensions.code: TEMPLATE_NOTE_INVALID_TITLE\`, no data |
| [\`api/forbidden.md\`](api/forbidden.md) | A role with only \`ReadCatalog\` and its administrator: \`templateNotes\` answers \`FORBIDDEN\` |
| [\`api/isolation.md\`](api/isolation.md) | Two businesses: in B, A's note by id is \`null\` and the list holds only B's note; the converse in A; the platform channel lists nothing; unknown token \`$UNKNOWN_TOKEN\` gives \`CHANNEL_NOT_FOUND\` and no data |
| [\`api/input-shape.md\`](api/input-shape.md) | \`CreateTemplateNoteInput\` has the fields \`body\` and \`title\` only (no business id) |

**Normalisation.** The generated note ids and \`createdAt\` values change on every run. The script first asserts their
format (every id matches \`$SNOWFLAKE_RE\`, every \`createdAt\` is an ISO timestamp, every id in a response is one it created)
and runs every other assertion on the real values; only then it replaces ids by \`<NOTE_A1_ID>\`, \`<NOTE_A2_ID>\`, \`<NOTE_B1_ID>\` and
timestamps by \`<TIMESTAMP>\` in the transcripts. Per-run session tokens, cookies and the passwords are redacted
(\`[REDACTED]\`); the \`vendure-token\` channel tokens are synthetic and shown. The same input regenerates the same files.

## Screenshots (historical)

Taken before P2.S1 removed the template's dashboard route (D2111); a re-run keeps these files and does not retake them.
The template's dashboard page \`/dashboard/template-notes\` (test id \`template-notes-page\`), signed in as the superadmin with
business A selected as the dashboard's channel, listing A's two notes. Viewport screenshots (not full page),
\`reducedMotion: reduce\`, taken after \`networkidle\` and \`document.fonts.ready\`. Sign-in and language switch use the Task 14
helpers (\`apps/server/tests/browser/dashboard-session.ts\`) in a desktop-sized context whose storage state opens the phone context.

Files: \`screens/template-notes-{ar,en}-{desktop,mobile}.png\`.

## Checks (the script fails otherwise)

- Every transcript's status and body as listed above, asserted on the real values before normalisation.
- Each page (when the shots were taken): \`dir\`/\`lang\` match the language, the \`template-notes-page\` marker is visible with both note titles and no alert;
  Arabic pages: the IBM Plex Sans Arabic face is loaded and in the body font.
- Exactly 4 PNGs, each at most 300 KB.
- No value of a password, secret, token or key from \`.env\`, and no session token or cookie value of the runs, appears in this folder.

## Re-run

\`\`\`bash
cp .env.example .env   # once; the script needs the root .env
scripts/evidence/P0.S2b-6.sh
\`\`\`

It uses its own compose project (\`cod-evidence\`, host ports shifted by 20000), always rebuilds the image first (the layer
cache keeps that cheap), refuses to run on a working tree with uncommitted changes outside the evidence folders, and removes the
stack and its volumes on exit.
README

# --- size and redaction checks -----------------------------------------------------------
for f in "$out"/screens/*.png; do
  (($(command stat -c %s "$f") <= 300 * 1024)) || fail "$f is over 300 KB"
done
((${#login_tokens[@]} == 2)) || fail "expected 2 login tokens, have ${#login_tokens[@]}"
((${#cookies[@]} >= 1)) || fail "no Set-Cookie values; the redaction check would be vacuous"
for secret in "${secret_values[@]}" "$READER_PASSWORD" "${login_tokens[@]}" "${cookies[@]}"; do
  if command grep -rqaF -- "$secret" "$out"; then
    fail "a raw secret appears in $out"
  fi
done
echo "redaction check: none of ${#secret_values[@]} .env secret values, the reader password, ${#login_tokens[@]} tokens and ${#cookies[@]} cookies in $out"
echo "EVIDENCE-OK"
