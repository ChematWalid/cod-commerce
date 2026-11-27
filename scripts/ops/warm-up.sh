#!/usr/bin/env bash
# Warms a fresh storefront deployment: for each store host, its home page, then the pages of its top-N listed
# products (newest first; there is no popularity signal yet), so the first buyers after a deploy hit the shared
# cache instead of rendering cold.
#
#   WARMUP_HOSTS="demo.localhost second.localhost" [WARMUP_ORIGIN=http://127.0.0.1:3000] [WARMUP_TOP_N=10] \
#     scripts/ops/warm-up.sh
#
# WARMUP_ORIGIN is the storefront itself (a node's published port or the local compose port), never the edge:
# each request carries the store host in `Host`, so the storefront resolves the store as it does behind
# Cloudflare and the CDN is left alone. The product list comes from the storefront's same-origin store api
# (`/api/store/products`), the route the store's own pages use; the api's `/store/*` routes accept only
# HMAC-signed calls and stay unreachable through the edge (D3515). Exits 1 when any page does not answer 200.
set -euo pipefail

readonly EX_USAGE=64
readonly ORIGIN=${WARMUP_ORIGIN:-http://127.0.0.1:3000}
readonly TOP_N=${WARMUP_TOP_N:-10}
readonly REQUEST_TIMEOUT_S=30

[[ -n "${WARMUP_HOSTS:-}" ]] || { echo "warm-up: set WARMUP_HOSTS to the store hosts to warm" >&2; exit "$EX_USAGE"; }
[[ "$TOP_N" =~ ^[0-9]{1,3}$ ]] || { echo "warm-up: WARMUP_TOP_N must be a number up to 999" >&2; exit "$EX_USAGE"; }
[[ "$ORIGIN" =~ ^https?://[A-Za-z0-9.-]+(:[0-9]{1,5})?$ ]] ||
  { echo "warm-up: WARMUP_ORIGIN must be http(s)://host[:port]" >&2; exit "$EX_USAGE"; }

body=$(mktemp)
trap 'rm -f "$body"' EXIT
failures=0

# fetch <host> <path>: GETs the path as that host into $body, logs status and time; returns 1 unless 200.
fetch() {
  local host=$1 path=$2 result status
  result=$(curl -s -o "$body" --max-time "$REQUEST_TIMEOUT_S" -H "Host: $host" -w '%{http_code} %{time_total}' \
    "$ORIGIN$path" || true)
  status=${result%% *}
  echo "warm-up: $status ${result#* }s $host $path"
  [[ "$status" == 200 ]] && return 0
  echo "warm-up: $host $path answered ${status:-no response}" >&2
  failures=$((failures + 1))
  return 1
}

# The product paths of a store api page in $body, one per line, slugs percent-encoded.
product_paths() {
  # shellcheck disable=SC2016 # JavaScript, not shell.
  node -e '
    const page = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
    for (const { slug } of page.items) console.log(`/product/${encodeURIComponent(slug)}`);
  ' "$body"
}

for host in $WARMUP_HOSTS; do
  fetch "$host" / || continue
  fetch "$host" "/api/store/products?take=$TOP_N" || continue
  mapfile -t paths < <(product_paths)
  for path in "${paths[@]}"; do
    fetch "$host" "$path" || true
  done
done

if ((failures > 0)); then
  echo "warm-up: $failures page(s) did not answer 200" >&2
  exit 1
fi
echo "warm-up: done"
