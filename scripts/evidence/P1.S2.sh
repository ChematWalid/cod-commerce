#!/usr/bin/env bash
# Proof-of-working evidence for P1.S2 (CLAUDE.md §3a.14): runs the real compose stack under its own project (cod-evidence,
# host ports +20000), a second api container with the OAuth flag on against a mock provider, records every auth endpoint
# (also 429, replay and cross-tenant), the emails Mailpit received, and browser screenshots, into docs/evidence/P1.S2/,
# then tears the stack down. Never touches `cod` or `cod-verify`.
#
#   timeout 1200 scripts/evidence/P1.S2.sh   # always builds cod-platform:local first
#
# AUTH_TOKEN_SECRET comes from the environment or .env, or a synthetic default. Data is synthetic. Tokens and OTPs are
# replaced by placeholders after their use is asserted; passwords and session tokens are never written.
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
# Synthetic; never printed (transcripts show [REDACTED]).
export EV_PASSWORD=evidence-owner-password-one EV_NEW_PASSWORD=evidence-owner-password-two EV_RESET_PASSWORD=evidence-owner-password-three
export EV_RUN=${EV_RUN:-1}
export EV_OAUTH_EMAIL=oauth-owner-$EV_RUN@evidence.example.test

API2_PORT=23101 API2_NAME=cod-evidence-oauth-api MOCK_PORT=23102 MOCK_NAME=cod-evidence-oauth-mock
OAUTH_SECRET=evidence-oauth-client-secret-synthetic
out=docs/evidence/P1.S2
api="http://127.0.0.1:$API_HOST_PORT"
api2="http://127.0.0.1:$API2_PORT"
admin="$api/admin-api?languageCode=en"
mailpit="http://127.0.0.1:$MAILPIT_UI_HOST_PORT"
work=$(mktemp -d)
SNOWFLAKE_RE='^[1-9][0-9]{0,18}$'
OTP_WRONG=000000

fail() { echo "EVIDENCE FAILED: $*" >&2; exit 1; }
on_exit() {
  local status=$?
  if ((status != 0)); then
    docker compose ps -a >&2 || true
    docker compose logs --no-color --tail=30 migrate api worker >&2 || true
    docker logs --tail=30 "$API2_NAME" >&2 || true
  fi
  docker rm -f "$API2_NAME" "$MOCK_NAME" >/dev/null 2>&1 || true
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
docker compose down -v --remove-orphans
docker compose build migrate
docker compose up -d api worker storefront mailpit
wait_healthy api worker storefront
wait_http 200 "$api/readyz" 120 || fail "api /readyz"
wait_http 200 "$api/dashboard/" 60 || fail "api /dashboard/"
wait_http 200 "$mailpit/api/v1/info" 60 || fail "mailpit api"
docker compose run --rm --no-deps -e DEMO_OWNER_PASSWORD --entrypoint node migrate apps/server/dist/main-seed-demo.js >"$work/seed.log" 2>&1 ||
  fail "the demo seed failed: $(command tail -20 "$work/seed.log")"

# --- flag-on api process and the mock provider ----------------------------------------------
docker compose run -d --no-deps --name "$MOCK_NAME" -p "127.0.0.1:$MOCK_PORT:4000" -e MOCK_EMAIL="$EV_OAUTH_EMAIL" \
  -v "$PWD/scripts/evidence/P1.S2-oauth-mock.mjs:/tmp/oauth-mock.mjs:ro" --entrypoint node api /tmp/oauth-mock.mjs >/dev/null
docker compose run -d --no-deps --name "$API2_NAME" -p "127.0.0.1:$API2_PORT:3000" \
  -e AUTH_OAUTH_ENABLED=true -e AUTH_DASHBOARD_URL="$api2/dashboard" \
  -e GOOGLE_OAUTH_CLIENT_ID=evidence-google-client -e GOOGLE_OAUTH_CLIENT_SECRET="$OAUTH_SECRET" \
  -e FACEBOOK_OAUTH_CLIENT_ID=evidence-facebook-client -e FACEBOOK_OAUTH_CLIENT_SECRET="$OAUTH_SECRET" \
  -e GOOGLE_OAUTH_AUTHORIZE_URL="http://127.0.0.1:$MOCK_PORT/authorize" \
  -e GOOGLE_OAUTH_TOKEN_URL="http://$MOCK_NAME:4000/token" \
  -e GOOGLE_OAUTH_USERINFO_URL="http://$MOCK_NAME:4000/userinfo" api >/dev/null
wait_http 200 "$api2/readyz" 240 || fail "oauth api /readyz"

reset_limits() { # Between phases only: every call from this host shares one client address.
  docker compose exec -T valkey sh -c "valkey-cli --scan --pattern 'rl:*' | xargs -r valkey-cli del" >/dev/null
}

rm -rf "$out/api" "$out/emails" "$out/screens"
mkdir -p "$out/api" "$out/emails" "$out/screens"

# --- helpers --------------------------------------------------------------------------------
js() { node -e 'const b=JSON.parse(require("fs").readFileSync(process.argv[2],"utf8")); const r=eval(process.argv[1]); console.log(typeof r==="string"?r:JSON.stringify(r))' "$1" "$2"; }
assert_js() { [[ "$(js "$2" "$3")" == true ]] || fail "$1: '$2' is not true for $(command cat "$3")"; }

# Literal generated values -> placeholder, longest first so a token never leaves a fragment behind.
declare -A PLACEHOLDERS=()
# Values are replaced anywhere in a transcript, so a short one would corrupt status codes and other digits.
MIN_PLACEHOLDER_VALUE_LENGTH=16
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
  status=$(curl "${args[@]}" -w '%{http_code}' "$admin") || status=000
  [[ "$status" != 000 ]] || fail "no HTTP answer from $admin"
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
  SHOWN_HEADERS=$(shown_headers "$5" "$6") SHOWN_BODY=$shown_body TITLE=$2 METHOD=POST URL="$admin" \
    node scripts/evidence/transcript.mjs "$work/h" "$work/b" "$1"
}
rest() { # rest <method> <url> <body|-> <session|-> -> $status, $work/h, $work/b
  local -a args=(-sS -X "$1" -D "$work/h" -o "$work/b" --max-time 30)
  [[ "$3" != - ]] && args+=(-H "$json" --data "$3")
  [[ "$4" != - ]] && args+=(-H "Authorization: Bearer $4")
  [[ -n "${REST_COOKIE:-}" ]] && args+=(-H "Cookie: $REST_COOKIE")
  status=$(curl "${args[@]}" -w '%{http_code}' "$2") || status=000
  [[ "$status" != 000 ]] || fail "no HTTP answer from $2"
}
emit_rest() { # emit_rest <file> <title> <method> <shown-url> <shown-body|-> <session|->
  local headers=""
  [[ "$6" != - ]] && headers="Authorization: Bearer [REDACTED]"
  [[ -n "${REST_COOKIE:-}" ]] && headers+=$'\nCookie: [REDACTED]'
  SHOWN_HEADERS=$headers SHOWN_BODY=$5 TITLE=$2 METHOD=$3 URL="$4" node scripts/evidence/transcript.mjs "$work/h" "$work/b" "$1"
}
expect_status() { [[ "$status" == "$2" ]] || fail "$1: HTTP $status, wanted $2: $(command cat "$work/b")"; }
expect_code() { assert_js "$1" "JSON.stringify(b.errors||[]).includes('$2')" "$work/b"; }

session_tokens=() cookies=()
header_token() { command grep -i '^vendure-auth-token:' "$work/h" | command head -1 | command tr -d '\r' | command awk '{print $2}'; }
Q_LOGIN='mutation ($username: String!, $password: String!) { login(username: $username, password: $password) { __typename ... on CurrentUser { identifier } ... on ErrorResult { errorCode message } } }'
creds() { U="$1" P="$2" node -e 'console.log(JSON.stringify({username:process.env.U,password:process.env.P}))'; }
SHOWN_CREDS() { U="$1" node -e 'console.log(JSON.stringify({username:process.env.U,password:"[REDACTED]"}))'; }
login() { # login <user> <password> -> $LAST_TOKEN
  gql "$Q_LOGIN" "$(creds "$1" "$2")" - -
  assert_js "login $1" 'b.data.login.__typename==="CurrentUser"' "$work/b"
  LAST_TOKEN=$(header_token)
  [[ -n "$LAST_TOKEN" ]] || fail "login $1: no auth token header"
  session_tokens+=("$LAST_TOKEN")
  while read -r c; do [[ -n "$c" ]] && cookies+=("$c"); done < <(command grep -i '^set-cookie:' "$work/h" | command sed -E 's/^[^=]+=([^;[:space:]]+).*/\1/')
}

mail_tokens=() otps=()
mail_secrets() { # mail_secrets <to> <contains> <min-count> -> $MAIL_TOKEN, $MAIL_CODE
  local lines
  lines=$(node scripts/evidence/P1.S2-mailpit.mjs secrets "$mailpit" "$1" "$2" "$3")
  MAIL_TOKEN=$(printf '%s\n' "$lines" | command sed -n 1p)
  MAIL_CODE=$(printf '%s\n' "$lines" | command sed -n 2p)
  [[ -z "$MAIL_TOKEN" ]] || mail_tokens+=("$MAIL_TOKEN")
  [[ -z "$MAIL_CODE" ]] || otps+=("$MAIL_CODE")
}
dump_mail() { # dump_mail <file> <to> <contains> <title>
  node scripts/evidence/P1.S2-mailpit.mjs dump "$mailpit" "$2" "$3" 1 "$1" "$4"
}

Q_REGISTER='mutation ($input: RegisterMerchantInput!) { registerMerchant(input: $input) { businessId storeId verificationEmailSent signInTicket } }'
Q_CONFIG='query { authPublicConfig { oauthEnabled oauthProviders challengeUrl platformDomain } }'
Q_STATUS='query { accountStatus { emailVerified verificationRequired resendAvailableAt pendingEmail } }'
Q_PROFILE='query { accountProfile { firstName lastName emailAddress phone avatarUrl emailVerified } }'
Q_VERIFY='mutation ($token: String!) { verifyEmail(token: $token) { success } }'
Q_OTP='mutation ($code: String!) { verifyEmailOtp(code: $code) { success } }'
Q_RESEND='mutation { resendEmailVerification { sentAt nextAllowedAt } }'
Q_FORGOT='mutation ($emailAddress: String!) { requestPasswordReset(emailAddress: $emailAddress) { __typename ... on Success { success } } }'
Q_RESET='mutation ($token: String!, $password: String!) { resetPassword(token: $token, password: $password) { __typename ... on CurrentUser { identifier } ... on ErrorResult { errorCode message } } }'
Q_CHANGE_PW='mutation ($currentPassword: String!, $newPassword: String!) { changeAccountPassword(currentPassword: $currentPassword, newPassword: $newPassword) { success } }'
Q_REQ_EMAIL='mutation ($newEmail: String!, $currentPassword: String!) { requestEmailChange(newEmail: $newEmail, currentPassword: $currentPassword) { success } }'
Q_CONFIRM='mutation ($token: String!) { confirmEmailChange(token: $token) { success } }'
Q_UPDATE_PROFILE='mutation ($input: UpdateAccountProfileInput!) { updateAccountProfile(input: $input) { firstName lastName phone emailAddress } }'
Q_STOCK_UPDATE='mutation ($input: UpdateActiveAdministratorInput!) { updateActiveAdministrator(input: $input) { id } }'
Q_LOGOUT='mutation { logout { success } }'
Q_ME='query { me { channels { token } } }'
Q_STORES='query { stores { id subdomain } }'
Q_STORE='query ($id: String!) { store(id: $id) { id subdomain } }'
Q_UPDATE_STORE='mutation ($id: String!, $input: UpdateStoreInput!) { updateStore(id: $id, input: $input) { id } }'
Q_SUB='query ($subdomain: String!) { subdomainAvailability(subdomain: $subdomain) { subdomain status reason reasonCode } }'

reg_input() { # reg_input <email> <subdomain> <password> [locale]
  E="$1" S="$2" P="$3" L="${4:-en}" node -e 'console.log(JSON.stringify({email:process.env.E,password:process.env.P,firstName:"Api",lastName:"Owner",businessName:"Api Business",storeName:"Api Store",subdomain:process.env.S,storeLanguage:"ar",emailLocale:process.env.L}))'
}
as_input() { node -e 'console.log(JSON.stringify({input:JSON.parse(process.argv[1])}))' "$1"; }
redact_pw() { node -e 'const o=JSON.parse(process.argv[1]); o.password="[REDACTED]"; console.log(JSON.stringify(o))' "$1"; }
register() { # register <email> <subdomain> -> $status etc; asserts success
  gql "$Q_REGISTER" "$(as_input "$(reg_input "$1" "$2" "$EV_PASSWORD")")" - -
  assert_js "register $1" '!b.errors && b.data.registerMerchant.verificationEmailSent===true' "$work/b"
}
own_channel() { gql "$Q_ME" '{}' "$1" -; js 'b.data.me.channels[0].token' "$work/b"; }

mail_of() { echo "api-$1-$EV_RUN@evidence.example.test"; }
A=$(mail_of a) B=$(mail_of b) C=$(mail_of c) D=$(mail_of d) E=$(mail_of e)
A_NEW=$(mail_of a-new) C_NEW=$(mail_of c-new)

# --- config.md --------------------------------------------------------------------------------
reset_limits
f="$out/api/config.md"
begin "$f" "Public configuration, flag off" "Anonymous. With AUTH_OAUTH_ENABLED off the provider routes do not exist."
rest GET "$api/auth/config" - -; expect_status config 200; assert_js config 'b.oauthEnabled===false && b.platformDomain==="localhost"' "$work/b"
emit_rest "$f" "GET /auth/config" GET "$api/auth/config" - -
gql "$Q_CONFIG" '{}' - -; assert_js config-gql 'b.data.authPublicConfig.oauthEnabled===false' "$work/b"
emit "$f" "authPublicConfig" "$Q_CONFIG" '{}' - -
rest GET "$api/auth/oauth/google/start" - -; expect_status oauth-off 404
emit_rest "$f" "GET /auth/oauth/google/start with the flag off: 404" GET "$api/auth/oauth/google/start" - -

# --- register.md ------------------------------------------------------------------------------
f="$out/api/register.md"
begin "$f" "Registration" "Anonymous. Creates the user, business and first store in one transaction; a verification email goes out. Passwords redacted, ids are placeholders."
for who in a b c d e; do
  input=$(reg_input "$(mail_of "$who")" "api-$who-$EV_RUN" "$EV_PASSWORD")
  gql "$Q_REGISTER" "$(as_input "$input")" - -
  assert_js "register $who" '!b.errors && b.data.registerMerchant.verificationEmailSent===true' "$work/b"
  remember_id "BUSINESS_$who" "$(js 'b.data.registerMerchant.businessId' "$work/b")"
  remember_id "STORE_$who" "$(js 'b.data.registerMerchant.storeId' "$work/b")"
  declare "STORE_ID_$who=$(js 'b.data.registerMerchant.storeId' "$work/b")"
  [[ $who == a ]] && emit "$f" "registerMerchant" "$Q_REGISTER" "$(as_input "$(redact_pw "$input")")" - -
done
input=$(reg_input "$A" "api-other-$EV_RUN" "$EV_PASSWORD")
gql "$Q_REGISTER" "$(as_input "$input")" - -; expect_code "taken email" auth.email-taken
emit "$f" "Taken email: disclosed, by D27" "$Q_REGISTER" "$(as_input "$(redact_pw "$input")")" - -
input=$(reg_input "api-short-$EV_RUN@evidence.example.test" "api-short-$EV_RUN" short)
gql "$Q_REGISTER" "$(as_input "$input")" - -; expect_code "weak password" auth.password-policy
emit "$f" "Password under the policy minimum" "$Q_REGISTER" "$(as_input "$(redact_pw "$input")")" - -
input=$(reg_input "api-sub-$EV_RUN@evidence.example.test" demo "$EV_PASSWORD")
gql "$Q_REGISTER" "$(as_input "$input")" - -; assert_js "taken subdomain" 'b.errors.length===1' "$work/b"
emit "$f" "Taken subdomain" "$Q_REGISTER" "$(as_input "$(redact_pw "$input")")" - -
input=$(reg_input "api-rest-$EV_RUN@evidence.example.test" "api-rest-$EV_RUN" "$EV_PASSWORD")
rest POST "$api/auth/register" "$input" -; [[ "$status" == 200 || "$status" == 201 ]] || fail "rest register: $status"
assert_js "rest register" 'b.verificationEmailSent===true' "$work/b"
remember_id BUSINESS_rest "$(js 'b.businessId' "$work/b")"; remember_id STORE_rest "$(js 'b.storeId' "$work/b")"
emit_rest "$f" "POST /auth/register" POST "$api/auth/register" "$(redact_pw "$input")" -

# --- login.md ---------------------------------------------------------------------------------
f="$out/api/login.md"
begin "$f" "Login and logout" "The same answer for a wrong password and an unknown email. Logout ends only the calling session (D22)."
gql "$Q_LOGIN" "$(creds "$A" wrong-password-value)" - -; assert_js "wrong login" 'b.data.login.__typename==="InvalidCredentialsError"' "$work/b"
emit "$f" "login: wrong password" "$Q_LOGIN" "$(SHOWN_CREDS "$A")" - -
gql "$Q_LOGIN" "$(creds "nobody-$EV_RUN@evidence.example.test" wrong-password-value)" - -; assert_js "unknown login" 'b.data.login.__typename==="InvalidCredentialsError"' "$work/b"
emit "$f" "login: unknown email, the same answer" "$Q_LOGIN" "$(SHOWN_CREDS "nobody-$EV_RUN@evidence.example.test")" - -
login "$A" "$EV_PASSWORD"; a_session=$LAST_TOKEN
emit "$f" "login" "$Q_LOGIN" "$(SHOWN_CREDS "$A")" - -
login "$A" "$EV_PASSWORD"; a_other=$LAST_TOKEN
gql "$Q_LOGOUT" '{}' "$a_other" -; assert_js logout 'b.data.logout.success===true' "$work/b"
emit "$f" "logout" "$Q_LOGOUT" '{}' "$a_other" -
gql "$Q_STATUS" '{}' "$a_session" -; assert_js "other session alive" '!b.errors' "$work/b"
emit "$f" "The account's other session still works" "$Q_STATUS" '{}' "$a_session" -
gql "$Q_STATUS" '{}' "$a_other" -; assert_js "logged out" 'b.errors.length===1' "$work/b"
emit "$f" "The ended session no longer works" "$Q_STATUS" '{}' "$a_other" -
body=$(creds "$B" "$EV_PASSWORD"); shown=$(SHOWN_CREDS "$B")
rest POST "$api/auth/login" "$body" -; expect_status "rest login" 200; b_rest=$(header_token); session_tokens+=("$b_rest")
emit_rest "$f" "POST /auth/login" POST "$api/auth/login" "$shown" -
rest POST "$api/auth/login" "$(creds "$B" wrong-password-value)" -; expect_status "rest wrong login" 401
emit_rest "$f" "POST /auth/login, wrong password" POST "$api/auth/login" "$shown" -
rest POST "$api/auth/logout" - "$b_rest"; expect_status "rest logout" 200
emit_rest "$f" "POST /auth/logout" POST "$api/auth/logout" - "$b_rest"

# --- verify.md --------------------------------------------------------------------------------
f="$out/api/verify.md"
begin "$f" "Email verification" "Link and code. A GET on the link route spends nothing (Review Focus 1). Tokens and codes are redacted."
gql "$Q_STATUS" '{}' "$a_session" -; assert_js status 'b.data.accountStatus.emailVerified===false && b.data.accountStatus.verificationRequired===true' "$work/b"
emit "$f" "accountStatus before verifying" "$Q_STATUS" '{}' "$a_session" -
mail_secrets "$A" /verify-email 1; a_token=$MAIL_TOKEN; remember VERIFY_TOKEN_A "$a_token"
rest GET "$api/auth/verify-email/$a_token" - -; expect_status "scanner GET" 404
emit_rest "$f" "A GET on the token route, as a mail scanner would: nothing spent" GET "$api/auth/verify-email/<VERIFY_TOKEN_A>" - -
gql "$Q_VERIFY" "$(vars "{token:'$a_token'}")" - -; assert_js verify 'b.data.verifyEmail.success===true' "$work/b"
emit "$f" "verifyEmail with the link's token, after that GET" "$Q_VERIFY" '{"token":"[REDACTED]"}' - -
gql "$Q_VERIFY" "$(vars "{token:'$a_token'}")" - -; expect_code replay auth.invalid-token
emit "$f" "Replay of a spent link" "$Q_VERIFY" '{"token":"[REDACTED]"}' - -
gql "$Q_STATUS" '{}' "$a_session" -; assert_js status2 'b.data.accountStatus.emailVerified===true' "$work/b"
emit "$f" "accountStatus after verifying" "$Q_STATUS" '{}' "$a_session" -
mail_secrets "$C" /verify-email 1; c_token=$MAIL_TOKEN; remember VERIFY_TOKEN_C "$c_token"
rest POST "$api/auth/verify-email/$c_token" - -; expect_status "rest verify" 200
emit_rest "$f" "POST /auth/verify-email/:token" POST "$api/auth/verify-email/<VERIFY_TOKEN_C>" - -
rest POST "$api/auth/verify-email/$c_token" - -; [[ "$status" != 200 ]] || fail "rest replay: 200"
emit_rest "$f" "The same POST again: refused" POST "$api/auth/verify-email/<VERIFY_TOKEN_C>" - -
login "$B" "$EV_PASSWORD"; b_session=$LAST_TOKEN
gql "$Q_OTP" "$(vars "{code:'$OTP_WRONG'}")" "$b_session" -; expect_code "wrong otp" auth.otp-invalid
emit "$f" "verifyEmailOtp, wrong code" "$Q_OTP" '{"code":"[REDACTED]"}' "$b_session" -
gql "$Q_RESEND" '{}' "$b_session" -; expect_code cooldown auth.cooldown
emit "$f" "resendEmailVerification inside the 60 s cooldown" "$Q_RESEND" '{}' "$b_session" -
sleep 61
gql "$Q_RESEND" '{}' "$b_session" -; assert_js resend '!b.errors && !!b.data.resendEmailVerification.nextAllowedAt' "$work/b"
emit "$f" "resendEmailVerification after the cooldown" "$Q_RESEND" '{}' "$b_session" -
mail_secrets "$B" /verify-email 2
gql "$Q_OTP" "$(vars "{code:'$MAIL_CODE'}")" "$b_session" -; assert_js otp 'b.data.verifyEmailOtp.success===true' "$work/b"
emit "$f" "verifyEmailOtp with the newest code" "$Q_OTP" '{"code":"[REDACTED]"}' "$b_session" -
login "$D" "$EV_PASSWORD"; d_session=$LAST_TOKEN
mail_secrets "$D" /verify-email 1
rest POST "$api/auth/verify-email-otp" "$(vars "{code:'$MAIL_CODE'}")" "$d_session"; expect_status "rest otp" 200
emit_rest "$f" "POST /auth/verify-email-otp" POST "$api/auth/verify-email-otp" '{"code":"[REDACTED]"}' "$d_session"

# --- password.md ------------------------------------------------------------------------------
f="$out/api/password.md"
begin "$f" "Forgot, reset and change password" "Forgot answers the same for an unknown email. Tokens and passwords redacted; a spent token is refused."
gql "$Q_FORGOT" "$(vars "{emailAddress:'$A'}")" - -; assert_js forgot 'b.data.requestPasswordReset.success===true' "$work/b"
emit "$f" "requestPasswordReset, known email" "$Q_FORGOT" "$(vars "{emailAddress:'$A'}")" - -
gql "$Q_FORGOT" "$(vars "{emailAddress:'nobody-$EV_RUN@evidence.example.test'}")" - -; assert_js forgot2 'b.data.requestPasswordReset.success===true' "$work/b"
emit "$f" "requestPasswordReset, unknown email: the same answer, no email" "$Q_FORGOT" "$(vars "{emailAddress:'nobody-$EV_RUN@evidence.example.test'}")" - -
mail_secrets "$A" /reset-password 1; a_reset=$MAIL_TOKEN
reset_vars() { T="$1" P="$2" node -e 'console.log(JSON.stringify({token:process.env.T,password:process.env.P}))'; }
SHOWN_RESET='{"token":"[REDACTED]","password":"[REDACTED]"}'
gql "$Q_RESET" "$(reset_vars "$a_reset" "$EV_NEW_PASSWORD")" - -; assert_js reset 'b.data.resetPassword.__typename==="CurrentUser"' "$work/b"
session_tokens+=("$(header_token)")
emit "$f" "resetPassword: signs the owner in" "$Q_RESET" "$SHOWN_RESET" - -
gql "$Q_RESET" "$(reset_vars "$a_reset" "$EV_RESET_PASSWORD")" - -; assert_js replay-reset 'b.data.resetPassword.__typename==="PasswordResetTokenInvalidError"' "$work/b"
emit "$f" "Replay of a spent reset token" "$Q_RESET" "$SHOWN_RESET" - -
login "$A" "$EV_NEW_PASSWORD"; a_session=$LAST_TOKEN
cp_vars() { C_="$1" N="$2" node -e 'console.log(JSON.stringify({currentPassword:process.env.C_,newPassword:process.env.N}))'; }
SHOWN_CP='{"currentPassword":"[REDACTED]","newPassword":"[REDACTED]"}'
gql "$Q_CHANGE_PW" "$(cp_vars wrong-password-value "$EV_RESET_PASSWORD")" "$a_session" -; expect_code "wrong current" auth.current-password-wrong
emit "$f" "changeAccountPassword, wrong current password" "$Q_CHANGE_PW" "$SHOWN_CP" "$a_session" -
login "$A" "$EV_NEW_PASSWORD"; a_second=$LAST_TOKEN
gql "$Q_CHANGE_PW" "$(cp_vars "$EV_NEW_PASSWORD" "$EV_RESET_PASSWORD")" "$a_session" -; assert_js change-pw 'b.data.changeAccountPassword.success===true' "$work/b"
emit "$f" "changeAccountPassword" "$Q_CHANGE_PW" "$SHOWN_CP" "$a_session" -
gql "$Q_STATUS" '{}' "$a_second" -; assert_js "other session gone" 'b.errors.length===1' "$work/b"
emit "$f" "Another session of that account: ended at once (Review Focus 3)" "$Q_STATUS" '{}' "$a_second" -
gql "$Q_STATUS" '{}' "$a_session" -; assert_js "current session kept" '!b.errors' "$work/b"
emit "$f" "The session that changed it: kept" "$Q_STATUS" '{}' "$a_session" -
input=$(P="$EV_NEW_PASSWORD" node -e 'console.log(JSON.stringify({input:{password:process.env.P}}))')
gql "$Q_STOCK_UPDATE" "$input" "$a_session" -; expect_code "stock update" auth.use-account-security
emit "$f" "The stock updateActiveAdministrator cannot change a password (D21)" "$Q_STOCK_UPDATE" '{"input":{"password":"[REDACTED]"}}' "$a_session" -
rest POST "$api/auth/forgot-password" "$(vars "{email:'$E'}")" -; expect_status "rest forgot" 200
emit_rest "$f" "POST /auth/forgot-password" POST "$api/auth/forgot-password" "$(vars "{email:'$E'}")" -
mail_secrets "$E" /reset-password 1
body=$(T="$MAIL_TOKEN" P="$EV_NEW_PASSWORD" node -e 'console.log(JSON.stringify({token:process.env.T,password:process.env.P}))')
rest POST "$api/auth/reset-password" "$body" -; expect_status "rest reset" 200
session_tokens+=("$(header_token)")
emit_rest "$f" "POST /auth/reset-password" POST "$api/auth/reset-password" '{"token":"[REDACTED]","password":"[REDACTED]"}' -
login "$E" "$EV_NEW_PASSWORD"; e_session=$LAST_TOKEN
rest POST "$api/auth/change-password" "$(cp_vars "$EV_NEW_PASSWORD" "$EV_RESET_PASSWORD")" "$e_session"; expect_status "rest change" 200
emit_rest "$f" "POST /auth/change-password" POST "$api/auth/change-password" "$SHOWN_CP" "$e_session"

# --- email-change.md --------------------------------------------------------------------------
f="$out/api/email-change.md"
begin "$f" "Email change" "Needs the current password; nothing switches until the new address confirms. Tokens and passwords redacted."
ec_vars() { N="$1" P="$2" node -e 'console.log(JSON.stringify({newEmail:process.env.N,currentPassword:process.env.P}))'; }
shown_ec() { N="$1" node -e 'console.log(JSON.stringify({newEmail:process.env.N,currentPassword:"[REDACTED]"}))'; }
gql "$Q_REQ_EMAIL" "$(ec_vars "$A_NEW" wrong-password-value)" "$a_session" -; expect_code "wrong pw email" auth.current-password-wrong
emit "$f" "requestEmailChange, wrong password" "$Q_REQ_EMAIL" "$(shown_ec "$A_NEW")" "$a_session" -
gql "$Q_REQ_EMAIL" "$(ec_vars "$A_NEW" "$EV_RESET_PASSWORD")" "$a_session" -; assert_js req-email 'b.data.requestEmailChange.success===true' "$work/b"
emit "$f" "requestEmailChange" "$Q_REQ_EMAIL" "$(shown_ec "$A_NEW")" "$a_session" -
gql "$Q_STATUS" '{}' "$a_session" -; assert_js pending "b.data.accountStatus.pendingEmail==='$A_NEW'" "$work/b"
emit "$f" "accountStatus: pending" "$Q_STATUS" '{}' "$a_session" -
mail_secrets "$A_NEW" /confirm-email-change 1; confirm=$MAIL_TOKEN
gql "$Q_CONFIRM" "$(vars "{token:'$confirm'}")" - -; assert_js confirm 'b.data.confirmEmailChange.success===true' "$work/b"
emit "$f" "confirmEmailChange" "$Q_CONFIRM" '{"token":"[REDACTED]"}' - -
gql "$Q_CONFIRM" "$(vars "{token:'$confirm'}")" - -; expect_code "replay confirm" auth.invalid-token
emit "$f" "Replay of a spent confirmation" "$Q_CONFIRM" '{"token":"[REDACTED]"}' - -
gql "$Q_LOGIN" "$(creds "$A" "$EV_RESET_PASSWORD")" - -; assert_js "old email login" 'b.data.login.__typename==="InvalidCredentialsError"' "$work/b"
emit "$f" "login with the old email: refused" "$Q_LOGIN" "$(SHOWN_CREDS "$A")" - -
login "$A_NEW" "$EV_RESET_PASSWORD"; a_session=$LAST_TOKEN
emit "$f" "login with the new email" "$Q_LOGIN" "$(SHOWN_CREDS "$A_NEW")" - -
login "$C" "$EV_PASSWORD"; c_session=$LAST_TOKEN
rest POST "$api/auth/change-email-request" "$(ec_vars "$C_NEW" "$EV_PASSWORD")" "$c_session"; expect_status "rest email" 200
emit_rest "$f" "POST /auth/change-email-request" POST "$api/auth/change-email-request" "$(shown_ec "$C_NEW")" "$c_session"
mail_secrets "$C_NEW" /confirm-email-change 1
rest POST "$api/auth/confirm-email-change" "$(vars "{token:'$MAIL_TOKEN'}")" -; expect_status "rest confirm" 200
emit_rest "$f" "POST /auth/confirm-email-change" POST "$api/auth/confirm-email-change" '{"token":"[REDACTED]"}' -

# --- profile.md -------------------------------------------------------------------------------
f="$out/api/profile.md"
begin "$f" "Profile and logo" "The owner's own record only: no handler takes a user id. A real upload stores the logo on the active store's channel."
channel_a=$(own_channel "$a_session"); remember CHANNEL_TOKEN_A "$channel_a"
gql "$Q_PROFILE" '{}' "$a_session" "$channel_a"; assert_js profile "b.data.accountProfile.emailAddress==='$A_NEW'" "$work/b"
emit "$f" "accountProfile" "$Q_PROFILE" '{}' "$a_session" "$channel_a"
input='{"input":{"firstName":"Amina","phone":"0555123456"}}'
gql "$Q_UPDATE_PROFILE" "$input" "$a_session" "$channel_a"; assert_js update-profile 'b.data.updateAccountProfile.phone==="+213555123456"' "$work/b"
emit "$f" "updateAccountProfile: a local phone number is stored as E.164" "$Q_UPDATE_PROFILE" "$input" "$a_session" "$channel_a"
rest GET "$api/auth/profile" - "$a_session"; expect_status "rest profile" 200
emit_rest "$f" "GET /auth/profile" GET "$api/auth/profile" - "$a_session"
rest PATCH "$api/auth/profile" '{"lastName":"Haddad"}' "$a_session"; expect_status "rest patch" 200; assert_js patch 'b.lastName==="Haddad"' "$work/b"
emit_rest "$f" "PATCH /auth/profile" PATCH "$api/auth/profile" '{"lastName":"Haddad"}' "$a_session"
gql "$Q_PROFILE" '{}' - -; assert_js "anon profile" 'b.errors[0].extensions.code==="FORBIDDEN"' "$work/b"
emit "$f" "accountProfile, anonymous: FORBIDDEN" "$Q_PROFILE" '{}' - -
rest GET "$api/auth/profile" - -; expect_status "anon rest" 403
emit_rest "$f" "GET /auth/profile, anonymous: 403" GET "$api/auth/profile" - -
node -e 'require("fs").writeFileSync(process.argv[1],Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==","base64"))' "$work/logo.png"
Q_UPLOAD='mutation ($file: Upload!) { uploadBusinessLogo(file: $file) { assetId } }'
upload() { # upload <session> <channel>
  status=$(curl -sS -X POST -D "$work/h" -o "$work/b" --max-time 30 -H "Authorization: Bearer $1" -H "vendure-token: $2" \
    -F "operations=$(Q="$Q_UPLOAD" node -e 'console.log(JSON.stringify({query:process.env.Q,variables:{file:null}}))')" \
    -F 'map={"0":["variables.file"]}' -F "0=@$work/logo.png;type=image/png" -w '%{http_code}' "$admin")
}
upload "$a_session" "$channel_a"; assert_js upload '!b.errors && !!b.data.uploadBusinessLogo.assetId' "$work/b"
SHOWN_HEADERS=$(printf 'Content-Type: multipart/form-data\nAuthorization: Bearer [REDACTED]\nvendure-token: [REDACTED]') SHOWN_BODY="(multipart: a 1x1 PNG as variables.file) $Q_UPLOAD" \
  TITLE="uploadBusinessLogo" METHOD=POST URL="$admin" node scripts/evidence/transcript.mjs "$work/h" "$work/b" "$f"

# --- isolation.md -----------------------------------------------------------------------------
f="$out/api/isolation.md"
begin "$f" "Two businesses: cross-tenant" "A's owner holds a session of A and B's ids and channel token. Reads are null or FORBIDDEN, writes refused; the account endpoints only ever show the caller."
channel_b=$(own_channel "$b_session"); remember CHANNEL_TOKEN_B "$channel_b"
store_b=$STORE_ID_b
gql "$Q_STORES" '{}' "$a_session" "$channel_b"; assert_js "A on B channel" 'b.errors[0].extensions.code==="FORBIDDEN"' "$work/b"
emit "$f" "A's owner on B's channel: stores FORBIDDEN" "$Q_STORES" '{}' "$a_session" "$channel_b"
gql "$Q_STORE" "$(vars "{id:'$store_b'}")" "$a_session" "$channel_a"; assert_js "A reads B store" 'b.data.store===null && !b.errors' "$work/b"
emit "$f" "A: store(B's id) is null" "$Q_STORE" '{"id":"<STORE_b>"}' "$a_session" "$channel_a"
gql "$Q_UPDATE_STORE" "$(vars "{id:'$store_b',input:{description:'x'}}")" "$a_session" "$channel_a"; assert_js "A writes B" 'b.errors.length===1 && !b.data' "$work/b"
emit "$f" "A: updateStore on B's store is not found" "$Q_UPDATE_STORE" '{"id":"<STORE_b>","input":{"description":"x"}}' "$a_session" "$channel_a"
upload "$a_session" "$channel_b"; assert_js "A uploads to B" 'b.errors[0].extensions.code==="FORBIDDEN"' "$work/b"
SHOWN_HEADERS=$(printf 'Content-Type: multipart/form-data\nAuthorization: Bearer [REDACTED]\nvendure-token: [REDACTED]') SHOWN_BODY="(multipart: a 1x1 PNG as variables.file) $Q_UPLOAD" \
  TITLE="A's owner uploads a logo on B's channel: FORBIDDEN" METHOD=POST URL="$admin" node scripts/evidence/transcript.mjs "$work/h" "$work/b" "$f"
gql "$Q_PROFILE" '{}' "$b_session" "$channel_b"; assert_js "B profile is B" "b.data.accountProfile.emailAddress==='$B'" "$work/b"
emit "$f" "B: accountProfile shows B alone" "$Q_PROFILE" '{}' "$b_session" "$channel_b"

# --- rate-limit.md ----------------------------------------------------------------------------
drain() { # drain <method> <url> <body|-> <max>: until the first 429
  local i=0
  while ((i < $4)); do
    rest "$1" "$2" "$3" -
    [[ "$status" == 429 ]] && return 0
    i=$((i + 1))
  done
  fail "$2: no 429 after $4 requests"
}
reset_limits
f="$out/api/rate-limit.md"
begin "$f" "Rate limits" "Real answers from a burst from one address (D29, D30). REST: 429 with Retry-After; GraphQL: code RATE_LIMITED, retryAfterSeconds and Retry-After on a 200."
url="$api/stores/subdomain-availability?subdomain=limit-probe"
drain GET "$url" - 70
retry=$(command grep -i '^retry-after:' "$work/h" | command tr -d '\r' | command awk '{print $2}'); [[ "$retry" =~ ^[0-9]+$ ]] || fail "no Retry-After on the 429"
emit_rest "$f" "subdomain availability past 60 requests a minute: 429" GET "$url" - -
gql "$Q_SUB" '{"subdomain":"limit-probe"}' - -; expect_code "gql limit" RATE_LIMITED
emit "$f" "The GraphQL subdomainAvailability over the same limit" "$Q_SUB" '{"subdomain":"limit-probe"}' - -
reset_limits
i=0
while ((i < 12)); do
  gql "$Q_LOGIN" "$(creds "$D" wrong-password-value)" - -
  [[ "$(js "JSON.stringify(b.errors||[]).includes('RATE_LIMITED')" "$work/b")" == true ]] && break
  i=$((i + 1))
done
expect_code "login limit" RATE_LIMITED
emit "$f" "Repeated failed logins for one email: RATE_LIMITED" "$Q_LOGIN" "$(SHOWN_CREDS "$D")" - -
reset_limits
drain POST "$api/auth/forgot-password" "$(vars "{email:'nobody-$EV_RUN@evidence.example.test'}")" 70
emit_rest "$f" "POST /auth/forgot-password past 60 requests a minute: 429" POST "$api/auth/forgot-password" "$(vars "{email:'nobody-$EV_RUN@evidence.example.test'}")" -
reset_limits

# --- oauth.md ---------------------------------------------------------------------------------
f="$out/api/oauth.md"
begin "$f" "OAuth with the flag on, against a mock provider" "A second api process with AUTH_OAUTH_ENABLED=true; the provider is a local mock, no real provider is contacted. Cookies, state and codes are not shown."
rest GET "$api2/auth/config" - -; expect_status "oauth config" 200
assert_js "oauth config" 'b.oauthEnabled===true && JSON.stringify(b.oauthProviders)==="[\"google\",\"facebook\"]"' "$work/b"
emit_rest "$f" "GET /auth/config: both providers offered" GET "$api2/auth/config" - -
rest GET "$api2/auth/oauth/google/start" - -; expect_status "oauth start" 302
location=$(command grep -i '^location:' "$work/h" | command tr -d '\r' | command awk '{print $2}')
[[ "$location" == "http://127.0.0.1:$MOCK_PORT/authorize?"* && "$location" == *code_challenge=* && "$location" == *state=* ]] || fail "oauth start location: $location"
while read -r c; do [[ -n "$c" ]] && cookies+=("$c"); done < <(command grep -i '^set-cookie:' "$work/h" | command sed -E 's/^[^=]+=([^;[:space:]]+).*/\1/')
query_param() { node -p 'new URL(process.argv[1]).searchParams.get(process.argv[2]) ?? ""' "$1" "$2"; }
oauth_state=$(query_param "$location" state)
remember OAUTH_STATE "$oauth_state"
remember OAUTH_CODE_CHALLENGE "$(query_param "$location" code_challenge)"
remember OAUTH_CODE evidence-mock-code
secret_values+=("$oauth_state")
binding_cookie=$(command grep -i '^set-cookie:' "$work/h" | command tr -d '\r' | command sed -E 's/^[^:]+:[[:space:]]*([^;]+).*/\1/')
[[ "$binding_cookie" == *=* ]] || fail "oauth start: no binding cookie"
emit_rest "$f" "GET /auth/oauth/google/start: 302 to the mock provider, with PKCE; state and challenge are placeholders; binding cookie set" GET "$api2/auth/oauth/google/start" - -
rest GET "$api2/auth/oauth/google/callback?state=forged&code=forged" - -; expect_status "forged callback" 302
location=$(command grep -i '^location:' "$work/h" | command tr -d '\r' | command awk '{print $2}')
[[ "$location" == *"/oauth-complete?error="* && "$location" != *ticket=* ]] || fail "forged callback location: $location"
emit_rest "$f" "A forged callback with no binding cookie: back to the dashboard with an error code, no ticket (asserted)" GET "$api2/auth/oauth/google/callback?state=forged&code=forged" - -
rest GET "$api2/auth/oauth/twitter/start" - -; expect_status "unknown provider" 404
emit_rest "$f" "An unknown provider: 404" GET "$api2/auth/oauth/twitter/start" - -
callback_url="$api2/auth/oauth/google/callback?state=$oauth_state&code=evidence-mock-code"
REST_COOKIE=$binding_cookie rest GET "$callback_url" - -; expect_status "oauth callback" 302
location=$(command grep -i '^location:' "$work/h" | command tr -d '\r' | command awk '{print $2}')
[[ "$location" == */register?ticket=* ]] || fail "oauth callback location: $location"
oauth_ticket=$(query_param "$location" ticket)
remember OAUTH_TICKET "$oauth_ticket"
secret_values+=("$oauth_ticket")
REST_COOKIE=$binding_cookie emit_rest "$f" "The callback of the browser that started the flow: a new identity goes to registration with a ticket" GET "$callback_url" - -
REST_COOKIE=$binding_cookie rest POST "$api2/auth/oauth/ticket" "$(vars "{ticket:'$oauth_ticket'}")" -; expect_status "oauth ticket" 200
assert_js "oauth ticket" "b.email==='$EV_OAUTH_EMAIL' && b.provider==='google' && b.emailVerified===true" "$work/b"
REST_COOKIE=$binding_cookie emit_rest "$f" "POST /auth/oauth/ticket: what the ticket holds, for its own browser; spends nothing" POST "$api2/auth/oauth/ticket" "$(vars "{ticket:'$oauth_ticket'}")" -
rest POST "$api2/auth/oauth/ticket" "$(vars "{ticket:'$oauth_ticket'}")" -; expect_status "oauth ticket, other browser" 400
emit_rest "$f" "POST /auth/oauth/ticket from a browser without the binding cookie: refused" POST "$api2/auth/oauth/ticket" "$(vars "{ticket:'$oauth_ticket'}")" -

# --- shop-guards.md ---------------------------------------------------------------------------
Q_SHOP_PASSWORD='mutation ($current: String!, $next: String!) { updateCustomerPassword(currentPassword: $current, newPassword: $next) { __typename } }'
Q_SHOP_EMAIL='mutation ($password: String!, $email: String!) { requestUpdateCustomerEmailAddress(password: $password, newEmailAddress: $email) { __typename } }'
Q_SHOP_FORGOT='mutation ($email: String!) { requestPasswordReset(emailAddress: $email) { __typename ... on Success { success } } }'
f="$out/api/shop-guards.md"
begin "$f" "The Shop API refuses an administrator" "An administrator's session also works on the Shop API, so its account mutations are shadowed (D21). Passwords redacted."
reset_limits
G=shop-guard-$EV_RUN@evidence.example.test
gql "$Q_REGISTER" "$(as_input "$(reg_input "$G" "shop-guard-$EV_RUN" "$EV_PASSWORD")")" - -
assert_js "shop guard owner" '(b.errors||[]).length===0' "$work/b"
login "$G" "$EV_PASSWORD"; shop_session=$LAST_TOKEN
admin_url=$admin
admin="$api/shop-api?languageCode=en"
shown_password="$(vars "{current:'[REDACTED]',next:'[REDACTED]'}")"
gql "$Q_SHOP_PASSWORD" "$(C="$EV_PASSWORD" N="$EV_NEW_PASSWORD" node -p 'JSON.stringify({current:process.env.C,next:process.env.N})')" "$shop_session" -
expect_code "shop password" auth.use-account-security
emit "$f" "updateCustomerPassword as an administrator: refused" "$Q_SHOP_PASSWORD" "$shown_password" "$shop_session" -
target="$(vars "{password:'[REDACTED]',email:'moved-$EV_RUN@evidence.example.test'}")"
gql "$Q_SHOP_EMAIL" "$(P="$EV_PASSWORD" E="moved-$EV_RUN@evidence.example.test" node -p 'JSON.stringify({password:process.env.P,email:process.env.E})')" "$shop_session" -
expect_code "shop email" auth.use-account-security
emit "$f" "requestUpdateCustomerEmailAddress as an administrator: refused before the password is looked at" "$Q_SHOP_EMAIL" "$target" "$shop_session" -
gql "$Q_SHOP_FORGOT" "$(vars "{email:'$G'}")" - -
assert_js "shop forgot" 'b.data.requestPasswordReset.success===true' "$work/b"
emit "$f" "requestPasswordReset with an administrator's email: the answer an unknown email gets, and no token is stored" "$Q_SHOP_FORGOT" "$(vars "{email:'$G'}")" - -
admin=$admin_url

# --- screens and the flows the browser proves ---------------------------------------------------
reset_limits
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/evidence/P1.S2-screens.mjs "$api/dashboard" "$api2/dashboard" "$mailpit" "$work/shots" >"$work/shots.txt" 2> >(command tee "$work/screens.log" >&2)
command cp "$work"/shots/*.png "$out/screens/"

# --- emails -------------------------------------------------------------------------------------
owner_ar=owner-ar-$EV_RUN@evidence.example.test owner_en=owner-en-$EV_RUN@evidence.example.test
new_ar=owner-ar-new-$EV_RUN@evidence.example.test new_en=owner-en-new-$EV_RUN@evidence.example.test
AR_VER='تأكيد بريدك' AR_RESET='إعادة تعيين' AR_CHANGED='تم تغيير كلمة' AR_CONFIRM='تأكيد عنوان' AR_NOTICE='طلب تغيير'
EN_VER='Confirm your email' EN_RESET='Reset your' EN_CHANGED='password was changed' EN_CONFIRM='Confirm your new email' EN_NOTICE='Email change requested'
for pair in "verification:$AR_VER:$EN_VER:$owner_ar:$owner_en" "password-reset:$AR_RESET:$EN_RESET:$new_ar:$new_en" \
  "password-changed:$AR_CHANGED:$EN_CHANGED:$owner_ar:$owner_en" "email-change-confirm:$AR_CONFIRM:$EN_CONFIRM:$new_ar:$new_en" \
  "email-change-notice:$AR_NOTICE:$EN_NOTICE:$owner_ar:$owner_en"; do
  IFS=: read -r name ar_sub en_sub ar_to en_to <<<"$pair"
  mf="$out/emails/$name.md"
  begin "$mf" "$name" "As Mailpit received them, one per language. The link token and code are redacted."
  dump_mail "$mf" "$ar_to" "$ar_sub" "Arabic"
  dump_mail "$mf" "$en_to" "$en_sub" "English"
done

# --- README -------------------------------------------------------------------------------------
{
  cat <<README
# Evidence for P1.S2 (accounts and auth)

Transcripts, emails and screenshots from a live stack (CLAUDE.md §3a.14), produced by \`scripts/evidence/P1.S2.sh\`. Data is
synthetic. Image built from a tree with no uncommitted change outside the evidence folders and browser tests, last
image-relevant commit \`$image_commit\`. Compose project \`cod-evidence\`; a second api container on port $API2_PORT runs with
\`AUTH_OAUTH_ENABLED=true\` against a mock provider (\`scripts/evidence/P1.S2-oauth-mock.mjs\`).

## API transcripts

| File | Shows |
| --- | --- |
| [\`api/config.md\`](api/config.md) | Public configuration; flag off answers 404 |
| [\`api/register.md\`](api/register.md) | \`registerMerchant\`, \`POST /auth/register\`, taken email, weak password, taken subdomain |
| [\`api/login.md\`](api/login.md) | Login (wrong password equals unknown email), \`POST /auth/login\`, \`POST /auth/logout\`, logout ends one session |
| [\`api/verify.md\`](api/verify.md) | \`verifyEmail\`, a scanner's GET spends nothing, replay, OTP wrong and right, resend cooldown, both REST routes |
| [\`api/password.md\`](api/password.md) | Forgot, reset, replay, change (other sessions end, this one stays), the stock mutation refused |
| [\`api/email-change.md\`](api/email-change.md) | Request, confirm, replay, old email refused, new email signs in, both REST routes |
| [\`api/profile.md\`](api/profile.md) | \`accountProfile\`, \`updateAccountProfile\`, REST GET and PATCH, anonymous 403, \`uploadBusinessLogo\` |
| [\`api/isolation.md\`](api/isolation.md) | Cross-tenant: A's owner on B's channel and B's ids |
| [\`api/rate-limit.md\`](api/rate-limit.md) | Real 429 with Retry-After, \`RATE_LIMITED\` on GraphQL, login throttle |
| [\`api/oauth.md\`](api/oauth.md) | Flag on against the mock: providers, 302 with PKCE, forged callback, unknown provider, the success callback issuing a ticket, \`POST /auth/oauth/ticket\` for its browser and refused for another |
| [\`api/shop-guards.md\`](api/shop-guards.md) | Shop API with an administrator's session: password change and email change refused, forgot-password answers as for an unknown email |

## Emails

[\`emails/\`](emails/): verification, password reset, password changed, email change confirmation and notice, one Arabic and one
English each, read from the Mailpit API. Tokens and codes redacted. Ids and channel tokens in the transcripts are placeholders;
every assertion ran on the real values.

## Browser flows proved by \`scripts/evidence/P1.S2-screens.mjs\`

Every line below is a failing assertion in the script if it does not hold; the shots are in \`screens/\`.

$(command sed -E 's/^/- /' <(command grep -v '^shot ' "$work/screens.log"))

README
  command cat scripts/evidence/P1.S2-seen.md
} >"$out/README.md"

# --- placeholders, sizes and redaction ------------------------------------------------------------
for t in "$out"/api/*.md; do normalise_file "$t"; done
# The engine's own asset id is a small integer: only this JSON field is replaced.
command sed -i -E 's/"assetId": "[0-9]+"/"assetId": "<ASSET_ID>"/' "$out/api/profile.md"
command grep -q '"assetId": "<ASSET_ID>"' "$out/api/profile.md" || fail "assetId placeholder missing"
if command grep -rqE '^HTTP/1\.1 [^0-9]' "$out/api"; then fail "a placeholder corrupted a status line"; fi
if command grep -rqE '^HTTP/1\.1 [0-9]{3}[^ 0-9]' "$out/api"; then fail "a placeholder corrupted a status line"; fi
for f in "$out"/screens/*.png; do
  (($(command stat -c %s "$f") <= 300 * 1024)) || fail "$f is over 300 KB"
done
((${#session_tokens[@]} >= 3 && ${#mail_tokens[@]} >= 3 && ${#otps[@]} >= 3)) || fail "the redaction check would be vacuous"
for secret in "${secret_values[@]}" "$AUTH_TOKEN_SECRET" "$DEMO_OWNER_PASSWORD" "$EV_PASSWORD" "$EV_NEW_PASSWORD" "$EV_RESET_PASSWORD" "$OAUTH_SECRET" \
  "${session_tokens[@]}" "${cookies[@]}" "${mail_tokens[@]}" wrong-password-value evidence-mock-access-token evidence-mock-code; do
  if command grep -rqaF -- "$secret" "$out"; then fail "a raw secret or token appears in $out"; fi
done
for code in "${otps[@]}"; do
  if command grep -rqawF -- "$code" "$out/api" "$out/emails"; then fail "a raw code appears in $out"; fi
done
echo "EVIDENCE-OK"
