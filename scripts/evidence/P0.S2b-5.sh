#!/usr/bin/env bash
# Proof-of-working evidence for P0.S2b-5 (CLAUDE.md §3a.14): runs the storefront role of the real compose stack
# under its own project (cod-evidence, every *_HOST_PORT shifted by 20000), screenshots the host-resolved hello
# page in Chromium on desktop and mobile, records live API transcripts (/livez, /readyz with Valkey stopped,
# host routing) into docs/evidence/P0.S2b-5/, and tears the stack down. Never touches `cod` or `cod-verify`.
#
#   scripts/evidence/P0.S2b-5.sh   # always rebuilds cod-platform:local first (the layer cache keeps that cheap)
#
# The browser work is scripts/evidence/storefront-screens.mjs; transcripts are formatted by transcript.mjs.
# Data is synthetic (.env placeholders, the storefront's stub stores).
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

# --- the storefront's stub stores and page markers, mirrored once ---------------------------
# From apps/storefront: STUB_STORES (src/tenancy/stub-store-resolver.ts), the tenant page heading and
# app/not-found.tsx. Every check below and storefront-screens.mjs use these; the .mjs fails the run when they
# no longer match the storefront source.
export DEMO_STORE_ID=demo DEMO_STORE_NAME='Demo Store' DEMO_STORE_HOST=demo.localhost DEMO_STORE_LOCALE=ar
export SECOND_STORE_ID=second SECOND_STORE_NAME='Second Store' SECOND_STORE_HOST=second.localhost SECOND_STORE_LOCALE=fr
export UNKNOWN_HOST=nope.localhost
export STORE_NAME_TEST_ID=store-name NOT_FOUND_TEST_ID=not-found NOT_FOUND_TEXT='Page not found'
# The storefront's container port; a Host with it and an IP address belongs to no store.
STOREFRONT_CONTAINER_PORT=3001
NO_STORE_HOST="10.0.0.5:$STOREFRONT_CONTAINER_PORT"
# Upper bound of every cache key's TTL (CACHE_ENTRY_MAX_TTL_SECONDS in apps/storefront/cache/constants.ts).
CACHE_ENTRY_MAX_TTL_SECONDS=21600

out=docs/evidence/P0.S2b-5
site="http://127.0.0.1:$STOREFRONT_HOST_PORT"
work=$(mktemp -d)

fail() {
  echo "EVIDENCE FAILED: $*" >&2
  exit 1
}

on_exit() {
  local status=$?
  if ((status != 0)); then
    docker compose ps -a >&2 || true
    docker compose logs --no-color --tail=60 storefront valkey >&2 || true
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

# Secrets from .env that must not appear in any output file; the two the checks rely on must be set.
[[ -n "${SUPERADMIN_PASSWORD:-}" ]] || fail "SUPERADMIN_PASSWORD is empty; the redaction check would be vacuous"
[[ -n "${COOKIE_SECRET:-}" ]] || fail "COOKIE_SECRET is empty; the redaction check would be vacuous"
secret_values=()
while IFS='=' read -r name value; do
  value=${value%\"}
  value=${value#\"}
  [[ -n "$value" ]] && secret_values+=("$value")
done < <(command grep -E '^(export[[:space:]]+)?[A-Z0-9_]*(PASSWORD|SECRET|TOKEN|_KEY)=' .env)
((${#secret_values[@]} >= 2)) || fail "found fewer than 2 non-empty secret values in .env"

# The README states which commit the image was built from, so the image is always built here, from a tree
# that matches that commit everywhere except the evidence folders and the SDD notes (which the image does
# not need). The commit is the last one that touched anything else.
image_inputs=(. ':!docs/evidence' ':!scripts/evidence' ':!.superpowers')
dirty=$(git status --porcelain -- "${image_inputs[@]}")
[[ -z "$dirty" ]] || fail "uncommitted changes outside the evidence folders; commit or stash them first:
$dirty"
image_commit=$(git log -1 --format=%H -- "${image_inputs[@]}")
[[ -n "$image_commit" ]] || fail "no commit touches the image inputs; nothing to attribute the image to"
head_before=$(git rev-parse HEAD)

# The deployment id is the commit, marked dirty like scripts/verify-stack.sh does (the check above makes the
# image inputs clean). It is the image commit rather than HEAD: committing this folder moves HEAD without
# changing the image, and a HEAD-based id would make every re-run after that commit differ.
NEXT_DEPLOYMENT_ID="$(git rev-parse --short "$image_commit")"
[[ -z "$(git status --porcelain -- "${image_inputs[@]}")" ]] || NEXT_DEPLOYMENT_ID+="-dirty"
export NEXT_DEPLOYMENT_ID

docker compose down -v --remove-orphans
started=$SECONDS
docker compose build migrate
echo "image built in $((SECONDS - started))s"
built_image_id=$(docker image inspect -f '{{.Id}}' "$APP_IMAGE")

# The build takes minutes: the image must still match the commit the README names.
[[ "$(git rev-parse HEAD)" == "$head_before" ]] || fail "HEAD moved during the image build"
dirty=$(git status --porcelain -- "${image_inputs[@]}")
[[ -z "$dirty" ]] || fail "the tree changed during the image build:
$dirty"

# Only the storefront and the Valkey it depends on are needed.
docker compose up -d storefront
wait_healthy storefront
wait_http 200 "$site/livez" 60 || fail "storefront /livez"
wait_http 200 "$site/readyz" 60 || fail "storefront /readyz"
deployment_id=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$(container_of storefront)" | command grep '^NEXT_DEPLOYMENT_ID=' | command cut -d= -f2-)
[[ "$deployment_id" == "$NEXT_DEPLOYMENT_ID" ]] ||
  fail "the storefront container's NEXT_DEPLOYMENT_ID is '$deployment_id', expected '$NEXT_DEPLOYMENT_ID'"
running_image_id=$(docker inspect -f '{{.Image}}' "$(container_of storefront)")
[[ "$running_image_id" == "$built_image_id" ]] ||
  fail "the storefront container runs image $running_image_id, not the freshly built $APP_IMAGE ($built_image_id)"

rm -rf "$out/api"
mkdir -p "$out/api"

# --- API transcripts ---------------------------------------------------------------------
# record <file> <title> <path> <status> <must-contain|-> <must-not-contain|-> <trim-pattern|-> <header>...
# GET <path> on the storefront with the given request headers (each "Name: value", sent and shown as is).
# Fails unless the status matches and the body contains / lacks the given text. With a trim pattern (a grep -E
# expression) the transcript shows only the matching part of the body, so large HTML pages show the one
# element that proves the point; the checks always run on the whole body. A connection failure aborts the run.
record() {
  local file=$1 title=$2 path=$3 want_status=$4 contains=$5 absent=$6 trim=$7
  shift 7
  local -a curl_args=(-sS -X GET -D "$work/h" -o "$work/b" --max-time 20)
  local hdr status
  for hdr in "$@"; do curl_args+=(-H "$hdr"); done
  status=$(curl "${curl_args[@]}" -w '%{http_code}' "$site$path") || status=000
  [[ "$status" != 000 ]] || fail "$title: no HTTP answer from $site$path"
  [[ "$status" == "$want_status" ]] || fail "$title: status $status, expected $want_status"
  if [[ "$contains" != - ]]; then
    command grep -qF -- "$contains" "$work/b" || fail "$title: body lacks '$contains'"
  fi
  if [[ "$absent" != - ]]; then
    ! command grep -qF -- "$absent" "$work/b" || fail "$title: body contains '$absent'"
  fi
  if [[ "$trim" != - ]]; then
    command grep -oE -- "$trim" "$work/b" >"$work/b.trim" || fail "$title: body has nothing matching '$trim'"
    command mv "$work/b.trim" "$work/b"
  fi
  SHOWN_HEADERS=$(printf '%s\n' "$@") SHOWN_BODY=- \
    TITLE=$title METHOD=GET URL="$site$path" node scripts/evidence/transcript.mjs "$work/h" "$work/b" "$file"
}

begin() { # begin <file> <heading> <intro>
  printf '# %s\n\n%s\n\n' "$2" "$3" >"$1"
}

store_h1="<h1 data-testid=\"$STORE_NAME_TEST_ID\">[^<]*</h1>"
not_found_main="<main data-testid=\"$NOT_FOUND_TEST_ID\""
second_internal_path="/_t/$SECOND_STORE_ID/$SECOND_STORE_LOCALE"
second_encoded_internal_path="/%5Ft/$SECOND_STORE_ID/$SECOND_STORE_LOCALE"
# RF3: the host is matched case-insensitively, without a trailing dot and port (DEMO.localhost.:3001).
demo_host_variant="${DEMO_STORE_HOST/#$DEMO_STORE_ID/${DEMO_STORE_ID^^}}.:$STOREFRONT_CONTAINER_PORT"

begin "$out/api/livez.md" "Storefront liveness" "\`GET /livez\` on the storefront role (container port $STOREFRONT_CONTAINER_PORT, published on \`$STOREFRONT_HOST_PORT\`) with a host that belongs to no store: liveness does not depend on the Host header."
record "$out/api/livez.md" "GET /livez with Host: $NO_STORE_HOST" /livez 200 - - - "Host: $NO_STORE_HOST"

begin "$out/api/readyz.md" "Storefront readiness" "\`GET /readyz\` is always 200 and carries the Valkey check in the body (the shared cache is an optimisation: with Valkey down the storefront serves uncached). \`cache-control: no-store\`. Per-check \`durationMs\` values are dropped by the transcript script so re-runs regenerate identical files."
readyz_nostore() { command grep -qi '^cache-control: no-store' "$work/h" || fail "/readyz lacks cache-control: no-store"; }
record "$out/api/readyz.md" "Valkey running: GET /readyz" /readyz 200 '"ok":true' '"ok":false' - "Host: $NO_STORE_HOST"
readyz_nostore
docker compose stop valkey
until_redis() { # until_redis <true|false>: polls /readyz until checks.redis.ok has that value
  local deadline=$((SECONDS + 60))
  while ((SECONDS < deadline)); do
    curl -s --max-time 5 "$site/readyz" | command grep -qF "\"ok\":$1" && return 0
    sleep 1
  done
  return 1
}
until_redis false || fail "/readyz never reported redis.ok false with Valkey stopped"
record "$out/api/readyz.md" "Valkey stopped: GET /readyz (still 200)" /readyz 200 '"ok":false' '"ok":true' - "Host: $NO_STORE_HOST"
readyz_nostore
docker compose start valkey
until_redis true || fail "/readyz never recovered to redis.ok true after Valkey started"
record "$out/api/readyz.md" "Valkey started again: GET /readyz" /readyz 200 '"ok":true' '"ok":false' - "Host: $NO_STORE_HOST"
readyz_nostore

begin "$out/api/host-routing.md" "Storefront host routing" "\`GET /\` on the storefront, the store chosen only by the \`Host\` header (the proxy rewrites to the internal \`/_t/{storeId}/{locale}\` route). Each body is trimmed by the script to the one element that identifies the page (the store heading or the not-found marker); the status and the absence of the other store's name are checked on the whole body."
record "$out/api/host-routing.md" "Host: $DEMO_STORE_HOST" / 200 "$DEMO_STORE_NAME" "$SECOND_STORE_NAME" "$store_h1" "Host: $DEMO_STORE_HOST"
record "$out/api/host-routing.md" "Host: $SECOND_STORE_HOST" / 200 "$SECOND_STORE_NAME" "$DEMO_STORE_NAME" "$store_h1" "Host: $SECOND_STORE_HOST"
record "$out/api/host-routing.md" "Host: $demo_host_variant (upper case, trailing dot and port: the same store)" / 200 "$DEMO_STORE_NAME" "$SECOND_STORE_NAME" "$store_h1" "Host: $demo_host_variant"
record "$out/api/host-routing.md" "Host: $UNKNOWN_HOST (unknown host)" / 404 "$NOT_FOUND_TEXT" - "$not_found_main" "Host: $UNKNOWN_HOST"
record "$out/api/host-routing.md" "Host: $DEMO_STORE_HOST, path $second_internal_path (internal path, not reachable directly)" "$second_internal_path" 404 "$NOT_FOUND_TEXT" "$SECOND_STORE_NAME" "$not_found_main" "Host: $DEMO_STORE_HOST"
record "$out/api/host-routing.md" "Host: $DEMO_STORE_HOST, path $second_encoded_internal_path (the same internal path percent-encoded)" "$second_encoded_internal_path" 404 "$NOT_FOUND_TEXT" "$SECOND_STORE_NAME" "$not_found_main" "Host: $DEMO_STORE_HOST"
record "$out/api/host-routing.md" "Host: $UNKNOWN_HOST with X-Forwarded-Host: $DEMO_STORE_HOST (the forwarded header is ignored)" / 404 "$NOT_FOUND_TEXT" "$DEMO_STORE_NAME" "$not_found_main" "Host: $UNKNOWN_HOST" "X-Forwarded-Host: $DEMO_STORE_HOST"

# --- screenshots -------------------------------------------------------------------------
started=$SECONDS
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/evidence/storefront-screens.mjs "$STOREFRONT_HOST_PORT" "$out/screens" "$work/screens-table.md"
echo "screenshots taken in $((SECONDS - started))s"

# --- cache keys --------------------------------------------------------------------------
# After the page requests above, the keys the storefront wrote to Valkey. SCAN order is arbitrary, so they are
# sorted; runs of 32 or more hex digits (Next's route-cache hashes and 'use cache' function ids, which change
# with the build) are replaced by <hash>. The deployment id is the commit, so it stays as is.
valkey_cli() { docker compose exec -T valkey valkey-cli "$@"; }
normalise_keys() { command sed -E 's/[0-9a-f]{32,}/<hash>/g' | LC_ALL=C sort; }
valkey_cli --scan --pattern 'next:*' | LC_ALL=C sort >"$work/keys"
entry_key=$(command grep -m1 -F "next:$NEXT_DEPLOYMENT_ID:uc:" "$work/keys") || fail "no 'use cache' entry key in Valkey"
tag_key=$(command grep -m1 -F 'next:tag:' "$work/keys") || fail "no tag index key in Valkey"
command grep -qF "\"storeId\":\"$DEMO_STORE_ID\"" "$work/keys" || fail "no 'use cache' entry for the $DEMO_STORE_ID store"
command grep -qF "\"storeId\":\"$SECOND_STORE_ID\"" "$work/keys" || fail "no 'use cache' entry for the $SECOND_STORE_ID store"
check_ttl() { # check_ttl <key>: 0 < TTL <= CACHE_ENTRY_MAX_TTL_SECONDS (-1 would mean no expiry)
  local ttl
  ttl=$(valkey_cli TTL "$1")
  ((ttl > 0 && ttl <= CACHE_ENTRY_MAX_TTL_SECONDS)) || fail "TTL of $1 is $ttl, expected 1..$CACHE_ENTRY_MAX_TTL_SECONDS"
}
check_ttl "$entry_key"
check_ttl "$tag_key"
{
  printf '# Storefront cache keys\n\n'
  printf 'The keys in Valkey after the requests of `host-routing.md` and the screenshots, read with `valkey-cli` in the `valkey` container. Entries are namespaced by the deployment id (`next:%s:isr:` and `next:%s:uc:`); the tag indexes (`next:tag:`) are shared by every deployment. Sorted; runs of 32 or more hex digits replaced by `<hash>`.\n\n' "$NEXT_DEPLOYMENT_ID" "$NEXT_DEPLOYMENT_ID"
  printf '## `valkey-cli --scan --pattern '"'"'next:*'"'"'`\n\n```text\n'
  normalise_keys <"$work/keys"
  printf '```\n\n## TTLs\n\n'
  printf 'The script fails unless both are above 0 and at most %s seconds (6 h, `CACHE_ENTRY_MAX_TTL_SECONDS`): the cache shares a `noeviction` Valkey with BullMQ. The value counts down, so it is not printed.\n\n' "$CACHE_ENTRY_MAX_TTL_SECONDS"
  printf -- '- `TTL %s`: 1..%s\n' "$(normalise_keys <<<"$entry_key")" "$CACHE_ENTRY_MAX_TTL_SECONDS"
  printf -- '- `TTL %s`: 1..%s\n' "$(normalise_keys <<<"$tag_key")" "$CACHE_ENTRY_MAX_TTL_SECONDS"
} >"$out/api/cache-keys.md"

# --- README ------------------------------------------------------------------------------
cat >"$out/README.md" <<README
# Evidence for P0.S2b-5 (storefront)

Screenshots and request/response transcripts of the real storefront (Next.js 16, \`apps/storefront\`) running as the
\`storefront\` role of the compose stack (CLAUDE.md §3a.14). Produced by \`scripts/evidence/P0.S2b-5.sh\`; nothing here is
hand-written. Data is synthetic: the storefront's two stub stores (placeholders from \`.env.example\` for the rest).

- Image: \`cod-platform:local\`, built by that run (\`docker compose build migrate\`) from a working tree with no uncommitted
  change outside the evidence folders, whose last image-relevant commit is \`$image_commit\`.
- \`NEXT_DEPLOYMENT_ID\` of the running container: \`$deployment_id\`, the short id of that commit (it namespaces the shared cache
  keys and the assets). The script exports it before the build and asserts that the running \`storefront\` container has it and
  runs the image id the build just produced.
- Stack: compose project \`cod-evidence\`; only \`storefront\` and the \`valkey\` it depends on are started. Host port
  \`$STOREFRONT_HOST_PORT\` (container port 3001).

## Screenshots

Viewport screenshots (not full page), \`reducedMotion: reduce\`, taken after the page loaded and two animation frames. Chromium
resolves \`*.localhost\` to the loopback address, so the store is chosen by the \`Host\` header the browser sends. Before each
shot the script asserts the status of the main document, that it was not redirected (the final URL is the one requested), that the
marker element is visible with the expected text and that the other stores' names are absent from the page.

| File | URL | Viewport | Status | Asserted |
| --- | --- | --- | --- | --- |
$(command cat "$work/screens-table.md")

The pages are intentionally bare: P0 only proves that the store is resolved from the host. The store locale (\`ar\` for the
demo store, \`fr\` for the second) is data of the store; the P0 page does not translate or mirror yet (the document is
\`lang="en"\`).

## API transcripts

| File | Shows |
| --- | --- |
| [\`api/livez.md\`](api/livez.md) | \`GET /livez\` with an arbitrary Host: 200 |
| [\`api/readyz.md\`](api/readyz.md) | \`GET /readyz\`: Valkey running (200, \`checks.redis.ok: true\`), Valkey stopped (still 200, \`ok: false\`), Valkey started again (200, \`ok: true\`); \`cache-control: no-store\` each time |
| [\`api/host-routing.md\`](api/host-routing.md) | \`GET /\` by Host: $DEMO_STORE_HOST, $SECOND_STORE_HOST (200, own heading, the other store's name absent), \`$demo_host_variant\` (200, $DEMO_STORE_NAME), $UNKNOWN_HOST (404), the internal \`$second_internal_path\` path and its encoded form \`$second_encoded_internal_path\` on $DEMO_STORE_HOST (404, no $SECOND_STORE_NAME), and \`X-Forwarded-Host\` ignored (404) |
| [\`api/cache-keys.md\`](api/cache-keys.md) | The \`next:*\` keys in Valkey after those requests (sorted, hex hashes normalised to \`<hash>\`), and the TTL of one entry key and one tag key: both asserted to be at most $CACHE_ENTRY_MAX_TTL_SECONDS s |

Only the headers \`content-type\`, \`cache-control\` and the ones the script shows are printed (so no \`date\` or request id), the
per-check \`durationMs\` is dropped, and HTML bodies are cut to the identifying element by the script; the checks run on the whole
body. The same input therefore regenerates the same files.

## Checks (the script fails otherwise)

- Every transcript's status and body text as listed above; \`/readyz\` carries \`cache-control: no-store\` in all three states.
- The running container's deployment id and image id are the ones just built; both stores have a \`'use cache'\` entry; the TTLs
  are within bounds.
- Exactly 6 PNGs, each at most 300 KB.
- No value of a password, secret, token or key from \`.env\` appears anywhere in this folder.

## Re-run

\`\`\`bash
cp .env.example .env   # once; the script needs the root .env
scripts/evidence/P0.S2b-5.sh
\`\`\`

It uses its own compose project (\`cod-evidence\`, host ports shifted by 20000), always rebuilds the image first (the layer
cache keeps that cheap), refuses to run on a working tree with uncommitted changes outside the evidence folders, and removes the
stack and its volumes on exit.
README

# --- size and redaction checks -----------------------------------------------------------
for f in "$out"/screens/*.png; do
  (($(command stat -c %s "$f") <= 300 * 1024)) || fail "$f is over 300 KB"
done
for secret in "${secret_values[@]}"; do
  if command grep -rqaF -- "$secret" "$out"; then
    fail "a raw .env secret value appears in $out"
  fi
done
echo "redaction check: none of ${#secret_values[@]} .env secret values in $out"
echo "EVIDENCE-OK"
