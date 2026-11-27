#!/usr/bin/env bash
# Deploys one image version to staging with Kamal, smokes it, warms it, and rolls back to the version that was
# running when any of those fails (D3505). Run by .github/workflows/deploy-staging.yml, which loads the deploy key
# into an ssh agent, pins the server's host key in ~/.ssh/known_hosts and exports the variables and secrets that
# config/deploy*.yml and .kamal/secrets.example name.
#
#   VERSION=<40-hex sha> STAGING_HOST=<ip> STAGING_SMOKE_HOSTS="<synthetic store host> …" … scripts/ops/deploy-staging.sh
#
# 1. records the running version (`kamal app version`), the rollback target;
# 2. `kamal deploy --skip-push --version=$VERSION`: the pre-deploy hook migrates first (D3504);
# 3. opens an ssh tunnel to kamal-proxy on the node, so the checks reach the node itself with the store host in
#    `Host`, never through Cloudflare (D3515; the firewall admits only Cloudflare on 80/443);
# 4. smoke: the node-level `/api/readyz`, then ops/k6/smoke.js per store host;
# 5. warm-up: scripts/ops/warm-up.sh over the same tunnel.
#
# The secrets reach Kamal only (TOOL_ENV on its calls); k6 and the warm-up get none. Never add `set -x` or print the
# environment: every secret is in it.
set -euo pipefail
cd "$(dirname "$0")/../.."

readonly EX_USAGE=64
# config/deploy.yml ssh.user: the operator account of the Ansible baseline.
readonly SSH_USER=cod
# kamal-proxy as seen from the node: plain HTTP (ssl_redirect off), routed by Host.
readonly NODE_PROXY=127.0.0.1:80
readonly TUNNEL_PORT=18080 TUNNEL_WAIT_S=20 READYZ_TIMEOUT_S=10
readonly ORIGIN="http://127.0.0.1:$TUNNEL_PORT"
readonly SECRETS_FILE=.kamal/secrets.staging

usage_error() {
  echo "deploy-staging: $*" >&2
  exit "$EX_USAGE"
}

[[ "${VERSION:-}" =~ ^[0-9a-f]{40}$ ]] || usage_error "VERSION must be a full 40-character commit SHA"
[[ -n "${STAGING_HOST:-}" ]] || usage_error "set STAGING_HOST to the staging server"
[[ -n "${STAGING_SMOKE_HOSTS:-}" ]] || usage_error "set STAGING_SMOKE_HOSTS to the synthetic store hosts to smoke"
for host in $STAGING_SMOKE_HOSTS; do
  [[ "$host" =~ ^[A-Za-z0-9.-]+$ ]] || usage_error "STAGING_SMOKE_HOSTS: '$host' is not a bare host name"
done

# Every name Kamal reads: the variables of config/deploy*.yml and every secret of .kamal/secrets.example.
kamal_env="GITHUB_REPOSITORY_OWNER KAMAL_REGISTRY_USERNAME STAGING_HOST STAGING_BASE_DOMAIN STAGING_S3_PUBLIC_ENDPOINT
STAGING_SMTP_HOST STAGING_SMTP_PORT STAGING_SMTP_FROM STAGING_OTEL_EXPORTER_OTLP_ENDPOINT STAGING_SENTRY_DSN
STAGING_STOREFRONT_SENTRY_DSN STAGING_CLOUDFLARE_ZONE_ID STOREFRONT_ASSET_PREFIX
$(sed -n 's/^\([A-Z][A-Z0-9_]*\)=\$.*/\1/p' .kamal/secrets.example)"

previous=''
tunnel_pid=''
cleanup() {
  if [[ -n "$tunnel_pid" ]]; then kill "$tunnel_pid" 2>/dev/null || echo "deploy-staging: the tunnel had already closed"; fi
  rm -f "$SECRETS_FILE"
}
trap cleanup EXIT

kamal() { TOOL_ENV="$kamal_env" scripts/ops/tool.sh kamal "$@" -d staging; }

roll_back() {
  echo "::error title=staging deploy failed::$1 failed for $VERSION"
  if [[ -n "$previous" && "$previous" != "$VERSION" ]]; then
    echo "deploy-staging: rolling back to $previous"
    kamal rollback "$previous"
  else
    echo "deploy-staging: no earlier version is running, nothing to roll back to" >&2
  fi
  exit 1
}

# Prints the version running on the primary host, or nothing on a first deploy.
running_version() {
  local output
  output=$(kamal app version --primary --quiet) || { echo "deploy-staging: no running version could be read" >&2; return 0; }
  grep -Eo '^[0-9a-f]{40}$' <<<"$output" | head -n 1 || return 0
}

deploy_version() {
  kamal deploy --skip-push --version="$VERSION" || roll_back "kamal deploy"
}

open_tunnel() {
  local waited
  ssh -N -o BatchMode=yes -o StrictHostKeyChecking=yes -o ExitOnForwardFailure=yes -L "127.0.0.1:$TUNNEL_PORT:$NODE_PROXY" \
    "$SSH_USER@$STAGING_HOST" &
  tunnel_pid=$!
  for ((waited = 0; waited < TUNNEL_WAIT_S; waited++)); do
    curl -s -o /dev/null --max-time 2 "$ORIGIN/" && return 0
    sleep 1
  done
  echo "deploy-staging: the tunnel to $STAGING_HOST did not open in $TUNNEL_WAIT_S s" >&2
  return 1
}

smoke() {
  local host first=${STAGING_SMOKE_HOSTS%% *}
  # The node-level probe: the storefront is up and the node-local api answers its /readyz.
  curl -fsS -o /dev/null --max-time "$READYZ_TIMEOUT_S" -H "Host: $first" "$ORIGIN/api/readyz" || return 1
  for host in $STAGING_SMOKE_HOSTS; do
    TOOL_NETWORK=host scripts/ops/tool.sh k6 run --quiet -e ORIGIN="$ORIGIN" -e STORE_HOST="$host" ops/k6/smoke.js || return 1
  done
}

warm_up() {
  WARMUP_HOSTS="$STAGING_SMOKE_HOSTS" WARMUP_ORIGIN="$ORIGIN" scripts/ops/warm-up.sh
}

# References only: Kamal expands each $NAME from the environment it gets through TOOL_ENV.
cp .kamal/secrets.example "$SECRETS_FILE"
previous=$(running_version)
echo "deploy-staging: running ${previous:-nothing}, deploying $VERSION"
deploy_version
open_tunnel || roll_back "the ssh tunnel"
smoke || roll_back "the smoke"
warm_up || roll_back "the warm-up"
echo "deploy-staging: $VERSION is live and warm"
