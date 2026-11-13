#!/usr/bin/env bash
# Proof for issue #221 (the account-menu close hang in general-settings at 390 px RTL, CLAUDE.md §3a.14): runs the real compose
# stack under its own project (cod-evidence, host ports +20000), seeds the demo, then runs the changed browser specs in a loop
# against it (general-settings "right to left" and the account-menu closing cases), a few more loops under CDP CPU throttling,
# and every caller file of the menu helpers once. Writes the counts, the Chromium version and the log of every failed run to
# docs/evidence/P1.S4-221/<label>.md, then tears everything down. Never touches `cod` or `cod-verify`.
#
#   timeout 2400 scripts/evidence/P1.S4-221.sh                         # label "after": any failure fails the script
#   EV_LABEL=before EV_CALLERS=0 timeout 2400 scripts/evidence/P1.S4-221.sh  # record a red run, failures expected
#
# EV_LOOPS (default 10) and EV_THROTTLED_LOOPS (default 2) set the loop counts, BROWSER_CPU_THROTTLE_RATE the slowdown (4).
# Data is synthetic. Passwords and session tokens are never written.
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
export POSTGRES_HOST_PORT=25433 PGBOUNCER_HOST_PORT=26432 VALKEY_HOST_PORT=26380 GARAGE_S3_HOST_PORT=23900
export MAILPIT_SMTP_HOST_PORT=21026 MAILPIT_UI_HOST_PORT=28026 API_HOST_PORT=23100 WORKER_HEALTH_HOST_PORT=23020
export STOREFRONT_HOST_PORT=23001 PLATFORM_DOMAIN=localhost
export APP_IMAGE=${APP_IMAGE:-cod-platform:local}
export AUTH_TOKEN_SECRET=${AUTH_TOKEN_SECRET:-evidence-auth-token-secret-synthetic-0123456789}
export SMTP_HOST=mailpit SMTP_PORT=1025 SMTP_FROM=no-reply@localhost AUTH_DASHBOARD_URL=http://127.0.0.1:$API_HOST_PORT/dashboard
# Set, not unset: compose would otherwise read a Gmail block from a local .env and require TLS from Mailpit.
export SMTP_TLS=none SMTP_USERNAME='' SMTP_PASSWORD=''
export DEMO_OWNER_PASSWORD=${DEMO_OWNER_PASSWORD:-evidence-demo-owner-password}
export BROWSER_CPU_THROTTLE_RATE=${BROWSER_CPU_THROTTLE_RATE:-4}

label=${EV_LABEL:-after}
[[ "$label" =~ ^[a-z0-9-]+$ ]] || { echo "evidence: EV_LABEL must be lower-case letters, digits and dashes" >&2; exit 1; }
loops=${EV_LOOPS:-10} throttled_loops=${EV_THROTTLED_LOOPS:-2} run_callers=${EV_CALLERS:-1}
out=docs/evidence/P1.S4-221
api="http://127.0.0.1:$API_HOST_PORT"
mailpit="http://127.0.0.1:$MAILPIT_UI_HOST_PORT"
work=$(mktemp -d)
OWNER=owner@demo.example.test

PLAIN_CONFIG=vitest.browser.config.ts
THROTTLED_CONFIG=tests/browser/cpu-throttle.vitest.config.ts
GENERAL_SETTINGS=(tests/browser/general-settings.browser.test.ts -t 'right to left')
ACCOUNT_MENU_CLOSE=(tests/browser/account-menu-close.browser.test.ts)
# Every file that reaches the account-menu close step: setDisplayLanguage (merchant path) and chooseTheme.
CALLER_FILES=(general-settings account-menu account-menu-close shell-appearance shell-nav store-create dashboard-rtl dashboard-arabic roles platform-flags)

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

# --- image, from a tree that matches the commit the record names --------------------------------
# Browser tests and the workflow do not reach the image's build output; the evidence folders never do.
image_inputs=(. ':!docs/evidence' ':!scripts/evidence' ':!.superpowers' ':!apps/server/tests/browser' ':!.github/workflows/browser.yml')
dirty=$(git status --porcelain -- "${image_inputs[@]}")
[[ -z "$dirty" ]] || fail "uncommitted changes outside the evidence folders:
$dirty"
image_commit=$(git log -1 --format=%H -- "${image_inputs[@]}")
tests_commit=$(git log -1 --format=%H -- apps/server/tests/browser)
tests_dirty=$(git status --porcelain -- apps/server/tests/browser)
NEXT_DEPLOYMENT_ID="$(git rev-parse --short "$image_commit")"
export NEXT_DEPLOYMENT_ID
timeout 300 docker compose down -v --remove-orphans
timeout 600 docker compose build migrate
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

timeout 180 docker compose run --rm --no-deps -e DEMO_OWNER_PASSWORD --entrypoint node migrate apps/server/dist/main-seed-demo.js \
  >"$work/seed.log" 2>&1 || fail "the demo seed failed: $(command tail -20 "$work/seed.log")"

reset_limits() { # Every sign-in from this host shares one client address.
  timeout 30 docker compose exec -T valkey sh -c "valkey-cli --scan --pattern 'rl:*' | xargs -r valkey-cli del" >/dev/null
}

# A red run can stop with the owner's stored display language on Arabic; the next run must start from English.
reset_owner_language() {
  OWNER_EMAIL=$OWNER timeout 60 node -e '
const [api] = process.argv.slice(1);
const key = "vendure.dashboard.userSettings";
const call = async (token, query, variables) => {
  const headers = { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) };
  const response = await fetch(`${api}/admin-api`, { method: "POST", headers, body: JSON.stringify({ query, variables }) });
  const body = await response.json();
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  return { body, token: response.headers.get("vendure-auth-token") };
};
(async () => {
  const login = await call(null, "mutation ($u: String!, $p: String!) { login(username: $u, password: $p) { __typename } }",
    { u: process.env.OWNER_EMAIL, p: process.env.DEMO_OWNER_PASSWORD });
  if (login.body.data.login.__typename !== "CurrentUser" || !login.token) throw new Error("owner sign-in failed");
  const read = await call(login.token, "query ($key: String!) { getSettingsStoreValue(key: $key) }", { key });
  const value = { ...(read.body.data.getSettingsStoreValue ?? {}), displayLanguage: "en" };
  const saved = await call(login.token, "mutation ($input: SettingsStoreInput!) { setSettingsStoreValue(input: $input) { result } }",
    { input: { key, value } });
  if (!saved.body.data.setSettingsStoreValue.result) throw new Error("storing the display language failed");
})().catch((error) => { console.error(error.message); process.exit(1); });' "$api" || fail "could not put the owner back on English"
}

chromium_version=$(cd apps/server && timeout 60 node -e '
require("playwright-core").chromium.launch().then(async (browser) => { console.log(browser.version()); await browser.close(); });')
[[ -n "$chromium_version" ]] || fail "no Chromium version"

# --- the runs ------------------------------------------------------------------------------------
rm -rf "${out:?}/$label"
mkdir -p "$out/$label"
rows=() runs=0 failures=0
strip_ansi() { command sed -E 's/\x1b\[[0-9;]*[A-Za-z]//g'; }
# browser_run <name> <config> <vitest args...>: one vitest invocation, recorded as a row; a failure keeps its log.
browser_run() {
  local name=$1 config=$2 started=$SECONDS result=pass log="$work/run.log"
  shift 2
  reset_limits
  reset_owner_language
  runs=$((runs + 1))
  if ! DASHBOARD_URL=$api/dashboard MAILPIT_URL=$mailpit SCREENSHOT_DIR=$work/shots \
    timeout 900 pnpm --filter @cod/server exec vitest run --configLoader runner -c "$config" "$@" >"$log" 2>&1; then
    result=fail failures=$((failures + 1))
    strip_ansi <"$log" >"$out/$label/run-$runs-$name.log"
  fi
  local tests
  tests=$(strip_ansi <"$log" | command grep -E '^ *Tests ' | command sed -E 's/^ +Tests +//' || true)
  rows+=("| $runs | $name | $result | ${tests:-no summary} | $((SECONDS - started)) s |")
  echo "run $runs $name: $result (${tests:-no summary})" >&2
}

for ((i = 1; i <= loops; i++)); do
  browser_run general-settings-rtl "$PLAIN_CONFIG" "${GENERAL_SETTINGS[@]}"
  browser_run account-menu-close "$PLAIN_CONFIG" "${ACCOUNT_MENU_CLOSE[@]}"
done
for ((i = 1; i <= throttled_loops; i++)); do
  browser_run general-settings-rtl-throttled "$THROTTLED_CONFIG" "${GENERAL_SETTINGS[@]}"
  browser_run account-menu-close-throttled "$THROTTLED_CONFIG" "${ACCOUNT_MENU_CLOSE[@]}"
done
if [[ "$run_callers" == 1 ]]; then
  browser_run callers "$PLAIN_CONFIG" "${CALLER_FILES[@]/#/tests/browser/}"
fi

# --- the record ----------------------------------------------------------------------------------
{
  cat <<RECORD
# #221 browser runs: \`$label\`

Produced by \`scripts/evidence/P1.S4-221.sh\` on a live compose stack (project \`cod-evidence\`, demo seed). Each row is one
\`vitest run\` of the browser config against that stack; a failed row keeps its log next to this file as \`run-<n>-<name>.log\`.

| | |
| --- | --- |
| Browser tests at | \`$tests_commit\`$([[ -n "$tests_dirty" ]] && echo ' plus uncommitted changes') |
| Image from | \`$image_commit\` |
| Chromium | $chromium_version (playwright-core $(node -p 'require("./apps/server/node_modules/playwright-core/package.json").version')) |
| Plain loops | $loops × (general-settings "right to left", account-menu-close) |
| Throttled loops | $throttled_loops × the same, CDP CPU throttling ×$BROWSER_CPU_THROTTLE_RATE |
| Caller files | $([[ "$run_callers" == 1 ]] && echo "${CALLER_FILES[*]}" || echo 'not run') |
| **Runs / failures** | **$runs / $failures** |

| Run | Spec | Result | Tests | Time |
| --- | --- | --- | --- | --- |
RECORD
  printf '%s\n' "${rows[@]}"
} >"$out/$label.md"

{
  cat <<README
# Evidence for #221 (the account-menu close hang)

Runs of the browser specs that close the account menu, from \`scripts/evidence/P1.S4-221.sh\` on a live stack. No screen
changed, so there are no screenshots; what was seen is in [\`scripts/evidence/P1.S4-221-seen.md\`](../../../scripts/evidence/P1.S4-221-seen.md).

README
  for record in "$out"/*.md; do
    [[ "$(basename "$record")" == README.md ]] && continue
    echo "- [\`$(basename "$record")\`]($(basename "$record")): $(command grep -F '**Runs / failures**' "$record" | command sed -E 's/.*\*\*Runs \/ failures\*\* \| \*\*(.*)\*\* \|/\1 runs \/ failures/')"
  done
} >"$out/README.md"

for secret in "${secret_values[@]}" "$AUTH_TOKEN_SECRET" "$DEMO_OWNER_PASSWORD" "$SUPERADMIN_PASSWORD"; do
  if command grep -rqaF -- "$secret" "$out"; then fail "a raw secret appears in $out"; fi
done
if [[ "$label" != before ]] && ((failures > 0)); then fail "$failures of $runs runs failed; see $out/$label"; fi
echo "runs=$runs failures=$failures"
echo "EVIDENCE-OK"
