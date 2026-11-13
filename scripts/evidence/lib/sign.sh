#!/usr/bin/env bash
# Signs calls to the api's internal-only routes (`/store/*`, `/shop-api`, `/_internal/*`; ADR 0008, D111) for the evidence
# scripts that predate the guard. Needs INTERNAL_HMAC_KEYS and INTERNAL_HMAC_ACTIVE_KID in the environment and node 24 and
# pnpm on PATH; signing goes through scripts/evidence/P1.S6-sign.ts and takes a few seconds, so a caller that polls signs
# once with `presign_get` and reuses the headers (a signature is accepted for 60 seconds).
#
#   . scripts/evidence/lib/sign.sh
#   sign_args POST "$url" "$body_file"   # a body is signed too: pass the file curl sends with --data-binary @file
#   sign_args GET "$url"      # sets SIGN_ARGS to curl -H arguments, SIGN_SHOWN to the redacted header lines for a transcript
#   presign_get "$url"        # the same, cached until `SIGN_CACHE=()`

declare -A SIGN_CACHE=()
SIGN_ARGS=()
SIGN_SHOWN=""

_sign_lines() { # _sign_lines <method> <path> [body-file] -> "name: value" lines
  if [[ -n "${3:-}" ]]; then printf '[{"method":"%s","path":"%s","bodyFile":"%s"}]' "$1" "$2" "$(realpath "$3")"
  else printf '[{"method":"%s","path":"%s"}]' "$1" "$2"; fi |
    (cd apps/server && timeout 120 pnpm exec node --conditions=@cod/source -r ts-node/register/transpile-only ../../scripts/evidence/P1.S6-sign.ts internal) |
    node -e 'const h=JSON.parse(require("fs").readFileSync(0,"utf8"))[0]; for (const [k,v] of Object.entries(h)) console.log(k+": "+v)'
}

_path_of() { local rest=${1#*://}; printf '/%s' "${rest#*/}"; }

presign_get() { # presign_get <url>
  SIGN_CACHE[$1]=$(_sign_lines GET "$(_path_of "$1")")
}

sign_args() { # sign_args <method> <url> [body-file]: a POST must pass the exact bytes it sends, which the signature covers
  local method=$1 url=$2 lines line
  if [[ "$method" == GET && -n "${SIGN_CACHE[$url]:-}" ]]; then lines=${SIGN_CACHE[$url]}; else lines=$(_sign_lines "$method" "$(_path_of "$url")" "${3:-}"); fi
  SIGN_ARGS=()
  while IFS= read -r line; do [[ -n "$line" ]] && SIGN_ARGS+=(-H "$line"); done <<<"$lines"
  SIGN_SHOWN=$'x-internal-kid: '"${INTERNAL_HMAC_ACTIVE_KID}"$'\nx-internal-ts: <unix seconds>\nx-internal-sig: [REDACTED]'
}

is_guarded_url() { local path; path=$(_path_of "$1"); [[ "$path" == /store/* || "$path" == /store?* || "$path" == /shop-api* || "$path" == /_internal* ]]; }
