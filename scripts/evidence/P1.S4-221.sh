#!/usr/bin/env bash
# Proof for issue #221 (the account-menu close hang in general-settings at 390 px RTL, CLAUDE.md §3a.14): runs the real compose
# stack under its own project (cod-evidence, host ports +20000), seeds the demo, then runs the changed browser specs in a loop
# against it (general-settings "right to left" and the account-menu closing cases), a few more loops under CDP CPU throttling,
# and every caller file of the menu helpers once. Writes the counts, the Chromium version and the log of every failed run to
# docs/evidence/P1.S4-221/<label>.md, then tears everything down. Never touches `cod` or `cod-verify`.
#
#   timeout 2400 scripts/evidence/P1.S4-221.sh                          # label "after": any failure fails the script
#   EV_LABEL=before EV_TESTS_FROM=8fa54c1 timeout 2400 scripts/evidence/P1.S4-221.sh  # a red run with the old helpers
#
# EV_TESTS_FROM=<rev> runs the browser files that the #221 commits after <rev> changed at their <rev> version: they are swapped in after the
# image is built (the build context holds apps/server/tests, so a swap before the build busts the image cache and the
# rebuild alone outlasts its timeout) and put back on exit. EV_LOOPS and EV_THROTTLED_LOOPS set the loop counts (after: 6
# and 2; before: 3 and 1, no caller files), EV_CALLERS=0|1 the caller-file run, BROWSER_CPU_THROTTLE_RATE the slowdown (4).
# Budgets: EV_RUN_BUDGET_S per spec run (360; a green run takes under a minute, a red one about 45 s per failed case),
# EV_CALLERS_BUDGET_S for the caller files (900), and EV_BUDGET_S for the whole script (2100, under the 2400 s wrapper
# with room for the teardown). A run that would end past EV_BUDGET_S is skipped and recorded; "after" fails on a skip.
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
if [[ "$label" == before ]]; then
  loops=${EV_LOOPS:-3} throttled_loops=${EV_THROTTLED_LOOPS:-1} run_callers=${EV_CALLERS:-0}
else
  loops=${EV_LOOPS:-6} throttled_loops=${EV_THROTTLED_LOOPS:-2} run_callers=${EV_CALLERS:-1}
fi
run_budget=${EV_RUN_BUDGET_S:-360} callers_budget=${EV_CALLERS_BUDGET_S:-900}
deadline=$((SECONDS + ${EV_BUDGET_S:-2100}))
tests_from=${EV_TESTS_FROM:-}
for number in "$loops" "$throttled_loops" "$run_budget" "$callers_budget" "${EV_BUDGET_S:-2100}"; do
  [[ "$number" =~ ^[0-9]+$ ]] || { echo "evidence: loop counts and budgets must be whole numbers" >&2; exit 1; }
done
swapped=() swap_back=""
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
  if ((${#swapped[@]} > 0)); then
    git checkout "$swap_back" -- "${swapped[@]}" || echo "evidence: could not put back ${swapped[*]} from $swap_back" >&2
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
if [[ -n "$tests_from" ]]; then
  [[ -z "$tests_dirty" ]] || fail "EV_TESTS_FROM needs a clean apps/server/tests/browser (the swap is undone by a checkout)"
  tests_from=$(git rev-parse --verify --quiet "$tests_from^{commit}") || fail "EV_TESTS_FROM is not a commit"
fi
NEXT_DEPLOYMENT_ID="$(git rev-parse --short "$image_commit")"
export NEXT_DEPLOYMENT_ID
timeout 300 docker compose down -v --remove-orphans
# EV_SKIP_BUILD=1 reuses cod-platform:local already built from this tree (a separate locked build, as P1-isolation.sh
# does): on a loaded host the layer export alone can outlast the job's time limit. Honoured only while the image exists.
if [[ "${EV_SKIP_BUILD:-0}" == 1 ]] && docker image inspect cod-platform:local >/dev/null 2>&1; then
  echo "reusing cod-platform:local (EV_SKIP_BUILD=1)"
else
  timeout 600 docker compose build migrate
fi
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
# The settings store answers only on a channel where the caller holds Authenticated: the owner's role sits on the store
# channels and never on the default channel (vendure-channel-provisioner.ts createOwnerRole, channelIds: []), so a call
# without a vendure-token is FORBIDDEN. Like the dashboard, the calls carry the token of one of the owner's store channels;
# `vendure.dashboard.userSettings` is user-scoped, so any of them reaches the same value.
reset_owner_language() {
  OWNER_EMAIL=$OWNER timeout 60 node -e '
const [api] = process.argv.slice(1);
const key = "vendure.dashboard.userSettings";
const defaultChannel = "__default_channel__";
const call = async (session, query, variables) => {
  const headers = { "content-type": "application/json" };
  if (session) Object.assign(headers, { authorization: `Bearer ${session.token}`, "vendure-token": session.channel });
  const response = await fetch(`${api}/admin-api`, { method: "POST", headers, body: JSON.stringify({ query, variables }) });
  const body = await response.json();
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  return { body, token: response.headers.get("vendure-auth-token") };
};
(async () => {
  const login = await call(null, `mutation ($u: String!, $p: String!) { login(username: $u, password: $p) {
    __typename ... on CurrentUser { channels { code token permissions } } } }`,
    { u: process.env.OWNER_EMAIL, p: process.env.DEMO_OWNER_PASSWORD });
  if (login.body.data.login.__typename !== "CurrentUser" || !login.token) throw new Error("owner sign-in failed");
  const store = login.body.data.login.channels
    .find((channel) => channel.code !== defaultChannel && channel.permissions.includes("Authenticated"));
  if (!store) throw new Error("the owner holds no store channel");
  const session = { token: login.token, channel: store.token };
  const read = await call(session, "query ($key: String!) { getSettingsStoreValue(key: $key) }", { key });
  const value = { ...(read.body.data.getSettingsStoreValue ?? {}), displayLanguage: "en" };
  const saved = await call(session, "mutation ($input: SettingsStoreInput!) { setSettingsStoreValue(input: $input) { result error } }",
    { input: { key, value } });
  const { result, error } = saved.body.data.setSettingsStoreValue;
  if (!result) throw new Error(`storing the display language failed: ${error ?? "no reason given"}`);
})().catch((error) => { console.error(error.message); process.exit(1); });' "$api" || fail "could not put the owner back on English"
}

chromium_version=$(cd apps/server && timeout 60 node -e '
require("playwright-core").chromium.launch().then(async (browser) => { console.log(browser.version()); await browser.close(); });')
[[ -n "$chromium_version" ]] || fail "no Chromium version"

# --- the browser files under test, after the image is built ------------------------------------
if [[ -n "$tests_from" ]]; then
  swap_back=$(git rev-parse HEAD)
  # Only the files the #221 commits changed, minus the run harness (the throttle config and setup): a merge of main
  # brings other browser files that differ from <rev>, and their old versions would not match today's dashboard.
  while IFS= read -r file; do
    [[ -n "$file" && "$file" != *vitest.config.ts && "$file" != *cpu-throttle-setup.ts ]] || continue
    [[ " ${swapped[*]} " == *" $file "* ]] && continue
    git cat-file -e "$tests_from:$file" 2>/dev/null && swapped+=("$file")
  done < <(git log --format= --name-only --grep='(#221)' "$tests_from..$swap_back" -- apps/server/tests/browser)
  ((${#swapped[@]} > 0)) || fail "no browser file differs from $tests_from"
  git checkout "$tests_from" -- "${swapped[@]}"
  tests_commit="$tests_from (${swapped[*]##*/}; the rest at $swap_back)"
  echo "evidence: running ${swapped[*]} at $tests_from" >&2
fi

# --- the runs ------------------------------------------------------------------------------------
rm -rf "${out:?}/$label"
mkdir -p "$out/$label"
rows=() runs=0 failures=0 skipped=0
strip_ansi() { command sed -E 's/\x1b\[[0-9;]*[A-Za-z]//g'; }
# browser_run <name> <budget s> <config> <vitest args...>: one vitest invocation, recorded as a row; a failure keeps its
# log. A run that could end past the script deadline is skipped (and recorded) rather than cut by the outer wrapper.
browser_run() {
  local name=$1 budget=$2 config=$3 started=$SECONDS result=pass log="$work/run.log"
  shift 3
  runs=$((runs + 1))
  if ((SECONDS + budget + 60 > deadline)); then
    skipped=$((skipped + 1))
    rows+=("| $runs | $name | skipped | the script budget left no room for a ${budget} s run | 0 s |")
    echo "run $runs $name: skipped (budget)" >&2
    return 0
  fi
  reset_limits
  reset_owner_language
  if ! DASHBOARD_URL=$api/dashboard MAILPIT_URL=$mailpit SCREENSHOT_DIR=$work/shots \
    timeout "$budget" pnpm --filter @cod/server exec vitest run --configLoader runner -c "$config" "$@" >"$log" 2>&1; then
    result=fail failures=$((failures + 1))
    strip_ansi <"$log" >"$out/$label/run-$runs-$name.log"
  fi
  local tests
  tests=$(strip_ansi <"$log" | command grep -E '^ *Tests ' | command sed -E 's/^ +Tests +//' || true)
  rows+=("| $runs | $name | $result | ${tests:-no summary} | $((SECONDS - started)) s |")
  echo "run $runs $name: $result (${tests:-no summary})" >&2
}

# The caller files first: the longest run, and the one a late skip would cost the most.
if [[ "$run_callers" == 1 ]]; then
  browser_run callers "$callers_budget" "$PLAIN_CONFIG" "${CALLER_FILES[@]/#/tests/browser/}"
fi
for ((i = 1; i <= loops; i++)); do
  browser_run general-settings-rtl "$run_budget" "$PLAIN_CONFIG" "${GENERAL_SETTINGS[@]}"
  browser_run account-menu-close "$run_budget" "$PLAIN_CONFIG" "${ACCOUNT_MENU_CLOSE[@]}"
done
for ((i = 1; i <= throttled_loops; i++)); do
  browser_run general-settings-rtl-throttled "$run_budget" "$THROTTLED_CONFIG" "${GENERAL_SETTINGS[@]}"
  browser_run account-menu-close-throttled "$run_budget" "$THROTTLED_CONFIG" "${ACCOUNT_MENU_CLOSE[@]}"
done

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
| Budgets | ${run_budget} s per spec run, ${callers_budget} s for the caller files, ${EV_BUDGET_S:-2100} s in all |
| **Runs / failures** | **$runs / $failures** |
| Skipped for time | $skipped |

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
if [[ "$label" != before ]] && ((skipped > 0)); then fail "$skipped of $runs runs were skipped for time; see $out/$label.md"; fi
echo "runs=$runs failures=$failures skipped=$skipped"
echo "EVIDENCE-OK"
