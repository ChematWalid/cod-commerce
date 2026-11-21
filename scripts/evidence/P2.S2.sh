#!/usr/bin/env bash
# Proof-of-working evidence for P2.S2 (CLAUDE.md §3a.14): runs the real compose stack under its own project (cod-evidence, host
# ports +20000), seeds the demo businesses, sets the private bucket's CORS on Garage, records every pack, bulk edit, export,
# spreadsheet import and link import operation over GraphQL and REST (with the presigned PUT to the real Garage and its
# refusal of a larger body than signed), the refusals and the cross-business cells, takes the dashboard screenshots and
# tears the project down. Never touches `cod` or `cod-verify`. Copied from P2.S1.sh.
#
#   flock -w 3600 /tmp/cod-heavy-jobs.lock timeout 2400 scripts/evidence/P2.S2.sh
#   EV_SKIP_BUILD=1 flock -w 3600 /tmp/cod-heavy-jobs.lock timeout 2400 scripts/evidence/P2.S2.sh
#
# It builds cod-platform:local unless EV_SKIP_BUILD=1 and cod-platform:evidence-<last image commit> exists (an image this
# script built from the same commit), which it then reuses.
#
# Data is synthetic. Snowflake ids are placeholders after their use is asserted (Vendure's product and variant ids are small
# integers and stay); passwords, session tokens, channel tokens and presigned URL signatures are never written.
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
: "${QUOTE_HMAC_KEYS:=k1:change-me-quote-hmac-00000000000000000000000000}"
: "${QUOTE_HMAC_ACTIVE_KID:=k1}"
export QUOTE_HMAC_KEYS QUOTE_HMAC_ACTIVE_KID
export POSTGRES_HOST_PORT=25433 PGBOUNCER_HOST_PORT=26432 VALKEY_HOST_PORT=26380 GARAGE_S3_HOST_PORT=23900
export MAILPIT_SMTP_HOST_PORT=21026 MAILPIT_UI_HOST_PORT=28026 API_HOST_PORT=23100 WORKER_HEALTH_HOST_PORT=23020
export STOREFRONT_HOST_PORT=23001 PLATFORM_DOMAIN=localhost
# The dashboard and curl on this host reach Garage here; the roles sign upload and download links for it (D2208).
export S3_PUBLIC_ENDPOINT=http://127.0.0.1:$GARAGE_S3_HOST_PORT LINK_IMPORT_SCRAPER=fixture
export APP_IMAGE=${APP_IMAGE:-cod-platform:local}
export AUTH_TOKEN_SECRET=${AUTH_TOKEN_SECRET:-evidence-auth-token-secret-synthetic-0123456789}
export SMTP_HOST=mailpit SMTP_PORT=1025 SMTP_FROM=no-reply@localhost AUTH_DASHBOARD_URL=http://127.0.0.1:$API_HOST_PORT/dashboard
# Set, not unset: compose would otherwise read a Gmail block from a local .env and require TLS from Mailpit.
export SMTP_TLS=none SMTP_USERNAME='' SMTP_PASSWORD=''
export DEMO_OWNER_PASSWORD=${DEMO_OWNER_PASSWORD:-evidence-demo-owner-password}
export EV_RUN=${EV_RUN:-$(date +%s)}
# Teardown removes this project's volumes: refuse to run under any other project name.
[[ "$COMPOSE_PROJECT_NAME" == cod-evidence ]] || { echo "evidence: wrong compose project" >&2; exit 1; }

out=docs/evidence/P2.S2
api="http://127.0.0.1:$API_HOST_PORT"
work=$(mktemp -d)
SNOWFLAKE_RE='^[1-9][0-9]{15,18}$'
# Values are replaced anywhere in a transcript, so a short one would corrupt status codes and other digits.
MIN_PLACEHOLDER_VALUE_LENGTH=16
# Above EXPORT_SYNC_MAX_ROWS (500, D2211): the filtered export becomes a job.
JOB_EXPORT_PRODUCTS=520
# IMPORT_MAX_ROWS (5 000, D2209) and one row more.
TOO_MANY_ROWS=5001
SCREEN_COUNT=48

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
# EV_SKIP_BUILD=1 reuses an image this script built from the same commit (tagged below); anything else builds.
built_tag="cod-platform:evidence-$NEXT_DEPLOYMENT_ID"
if [[ "${EV_SKIP_BUILD:-}" == 1 && "$APP_IMAGE" == cod-platform:local ]] && docker image inspect "$built_tag" >/dev/null 2>&1; then
  echo "reusing $built_tag (EV_SKIP_BUILD=1)"
  docker tag "$built_tag" "$APP_IMAGE"
else
  timeout 1500 docker compose build migrate
  docker tag "$APP_IMAGE" "$built_tag"
fi
# A fresh Postgres volume can outlast its healthcheck on a loaded host, so it starts alone and is waited for; a half-created
# try leaves containers whose names block the next, so they are removed before it.
APP_SERVICES=(api worker storefront mailpit)
timeout 300 docker compose up -d postgres
wait_healthy postgres
if ! timeout 480 docker compose up -d "${APP_SERVICES[@]}"; then
  timeout 300 docker compose rm -fsv "${APP_SERVICES[@]}" migrate pgbouncer
  timeout 480 docker compose up -d "${APP_SERVICES[@]}"
fi
wait_healthy api worker storefront garage
S3_ENDPOINT=$S3_PUBLIC_ENDPOINT timeout 60 node scripts/garage-cors.mjs >"$work/cors.log" 2>&1 ||
  fail "garage CORS: $(command cat "$work/cors.log")"
command grep -q '^GARAGE-CORS-OK http://127.0.0.1:23100$' "$work/cors.log" || fail "garage CORS: $(command cat "$work/cors.log")"
wait_http 200 "$api/readyz" 120 || fail "api /readyz"
wait_http 200 "$api/dashboard/" 60 || fail "api /dashboard/"

timeout 300 docker compose run --rm --no-deps -e DEMO_OWNER_PASSWORD --entrypoint node migrate apps/server/dist/main-seed-demo.js \
  >"$work/seed.log" 2>&1 || fail "the demo seed failed: $(command tail -20 "$work/seed.log")"

reset_limits() { # Every call from this host shares one client address.
  timeout 30 docker compose exec -T valkey sh -c "valkey-cli --scan --pattern 'rl:*' | xargs -r valkey-cli del" >/dev/null
}

rm -rf "$out/api" "$out/screens"
mkdir -p "$out/api" "$out/screens"

# --- helpers (as in P1.S4.sh) ----------------------------------------------------------------
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
MULTIPART_MAP='{"0":["variables.file"]}'
upload() { # upload <query> <file> <claimed-type> <name> <session> <channel> -> $status, $work/h, $work/b (graphql-multipart-request-spec)
  local operations
  operations=$(Q="$1" node -e 'console.log(JSON.stringify({query:process.env.Q,variables:{file:null}}))')
  status=$(curl -sS -X POST -D "$work/h" -o "$work/b" --max-time 60 -H "Authorization: Bearer $5" -H "vendure-token: $6" \
    -H 'apollo-require-preflight: true' -F "operations=$operations" -F "map=$MULTIPART_MAP" \
    -F "0=@$2;type=$3;filename=$4" -w '%{http_code}' "$api/admin-api?languageCode=en") || status=000
  [[ "$status" != 000 ]] || fail "no HTTP answer from $api (upload)"
}
emit_upload() { # emit_upload <file> <title> <query> <file-description>
  local operations
  operations=$(Q="$3" node -e 'console.log(JSON.stringify({query:process.env.Q,variables:{file:null}}))')
  SHOWN_HEADERS=$(printf '%s\n' 'Content-Type: multipart/form-data; boundary=[…]' 'Authorization: Bearer [REDACTED]' \
    'vendure-token: [REDACTED]' 'apollo-require-preflight: true') \
    SHOWN_BODY=$(printf 'operations: %s\nmap: %s\n0: %s' "$operations" "$MULTIPART_MAP" "$4") \
    TITLE=$2 METHOD=POST URL="$api/admin-api?languageCode=en" node scripts/evidence/transcript.mjs "$work/h" "$work/b" "$1"
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
Q_STORES='query { stores { id subdomain channelToken } }'
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

# shellcheck source=P2.S2-api.sh
. scripts/evidence/P2.S2-api.sh

# --- screens ----------------------------------------------------------------------------------
reset_limits
EV_PACK_PRODUCT_ID=$pack_id EV_UPDATE_SKU=$screen_update_sku timeout 1500 \
  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/evidence/P2.S2-screens.mjs \
  "$api/dashboard" "$work/shots" >"$work/shots.txt" 2> >(command tee "$work/screens.log" >&2)
command cp "$work"/shots/*.png "$out/screens/"
shot_count=$(command ls "$out"/screens/*.png | command wc -l)
((shot_count == SCREEN_COUNT)) || fail "$shot_count screenshots, wanted $SCREEN_COUNT"

# --- README -------------------------------------------------------------------------------------
{
  command cat <<README
# Evidence for P2.S2 (packs, import and export)

Transcripts and screenshots from a live stack (CLAUDE.md §3a.14), produced by \`scripts/evidence/P2.S2.sh\`. Data is synthetic
(the demo seed, plus what the script creates and imports). Image built from a tree with no uncommitted change outside the
evidence folders and browser tests, last image-relevant commit \`$image_commit\`. Compose project \`cod-evidence\`; the
roles sign upload and download links for Garage at \`$S3_PUBLIC_ENDPOINT\`, whose bucket CORS \`scripts/garage-cors.mjs\`
set for the dashboard's origin; link imports use the fixture scraper (\`LINK_IMPORT_SCRAPER=fixture\`, host
\`shop.example.test\` only, D2214).

## API transcripts

| File | Shows |
| --- | --- |
| [\`api/packs.md\`](api/packs.md) | \`catalogPack\`, \`saveCatalogPack\`, \`previewCatalogPack\` and \`GET\`/\`PUT /catalog/packs/:productId\`, \`POST /catalog/packs/preview\`: a 10 % off pack of two products (3 150 DZD), fixed price and weight; a pack of a physical product and a pack inside a pack refused |
| [\`api/bulk-edit.md\`](api/bulk-edit.md) | \`bulkEditCatalogProducts\` and \`POST /catalog/products/bulk-edit\`: a dry run that writes nothing, status, brand, tags and +10 % prices, a partial failure (one unknown product), B's brand refused (\`taxonomy-not-found\`) |
| [\`api/export.md\`](api/export.md) | \`catalogImportFields\`, \`catalogImportFormats\` and their REST routes, \`exportCatalogProducts\` of selected products (written at once, the CSV downloaded through its presigned link), a filtered export of $JOB_EXPORT_PRODUCTS+ products as a job read until done (\`catalogExport\`, \`GET …/exports/:id\`, the xlsx downloaded). Those products were imported through the same flow, quietly; it took $job_import_attempts attempt(s) of the same file (a failed attempt is the worker's database pool running dry under the pack recompute deliveries, issue #260) |
| [\`api/import.md\`](api/import.md) | \`createCatalogImportUpload\` (presigned PUT, exact size and type signed), the PUT to Garage, \`analyzeCatalogImport\`, \`previewCatalogImport\` (with a mapping override), \`catalogImportPreview\`, \`confirmCatalogImport\`, \`catalogImport\` with its error report link, and every REST route of the import |
| [\`api/import-refusals.md\`](api/import-refusals.md) | A larger body than signed: 403 from Garage, nothing stored; a PNG sent as CSV (\`file-type\`); an object whose size differs from the declared one (\`file-too-large\`); $TOO_MANY_ROWS rows (\`too-many-rows\`); a create-only member's update rows (\`update-forbidden\`); a second confirm (\`job-state\`); 429 with \`Retry-After\` past the import budget |
| [\`api/link-import.md\`](api/link-import.md) | \`createCatalogLinkImport\`, \`catalogLinkImport\`, \`polishCatalogProduct\` and \`POST /catalog/scrape/import-job\`, \`GET /catalog/scrape/import-jobs/:id\`, \`POST /catalog/scrape/products/:id/polish\`; loopback, private and unknown hosts refused alike (\`link-refused\`) |
| [\`api/isolation.md\`](api/isolation.md) | Business A on B's pack, import, export and link import ids: not found over GraphQL, 404 over REST, a bulk edit and an export naming B's products touch nothing of B; A's session on B's channel FORBIDDEN; no session refused |

Store, business, brand, tag and job ids and channel tokens are placeholders; every assertion ran on the real values.
Product and variant ids are the engine's small integers. In every upload and download link the signature, credential and
session token are \`[REDACTED]\` (the link's path and expiry stay); spreadsheet bodies are shown as \`<xlsx, N bytes>\`.

## Screenshots

\`screens/<screen>-<lang>-<viewport>.png\`, desktop (1280 × 800) and mobile (390 × 844), Arabic and English display
language, on the Arabic demo store: \`product-create-type\` (the new product editor's Product type choice, Physical product
or Pack), \`pack-form\` (the pack block of a saved 10 % off pack of two products), \`product-list-actions\` (two products
ticked, the action menu open on Import, Export and Bulk edit), \`bulk-edit\` (the dialog with a status and a price change),
\`bulk-edit-result\` (the dry run's per-product result), \`export-dialog\` (selected products, CSV), \`export-job\` (a filtered
export of more than 500 products: the job's progress; the dashboard's reads of the job are held back for the shot so the
worker cannot finish first), \`import-upload\` (a CSV chosen), \`import-analyze\` (a PNG renamed \`.csv\`: the analysis
refuses it, toast), \`import-mapping\` (the analyzed columns, one ignored), \`import-preview\` (rows to create, to update and
in error with their reasons) and \`import-confirm\` (after Confirm: rows created, updated and failed, the error report).
$shot_count files.

## Browser assertions in \`scripts/evidence/P2.S2-screens.mjs\`

Each line below is a failing assertion in the script if it does not hold.

$(command sed -E 's/^/- /' <(command grep -v '^shot ' "$work/screens.log"))

README
  command cat scripts/evidence/P2.S2-seen.md
} >"$out/README.md"

# --- placeholders, sizes and redaction ------------------------------------------------------------
for t in "$out"/api/*.md; do normalise_file "$t"; done
if command grep -rqE '^HTTP/1\.1 [^0-9]' "$out/api"; then fail "a placeholder corrupted a status line"; fi
if command grep -rqE '^HTTP/1\.1 [0-9]{3}[^ 0-9]' "$out/api"; then fail "a placeholder corrupted a status line"; fi
for f in "$out"/screens/*.png; do
  (($(command stat -c %s "$f") <= 300 * 1024)) || fail "$f is over 300 KB"
done
((${#session_tokens[@]} >= 2)) || fail "the redaction check would be vacuous"
if command grep -rqaE 'X-Amz-(Signature|Credential|Security-Token)=[^[]' "$out"; then fail "a presigned URL secret appears in $out"; fi
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
