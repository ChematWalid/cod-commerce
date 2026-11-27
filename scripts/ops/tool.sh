#!/usr/bin/env bash
# Runs an ops tool from its pinned official image, so laptops and CI use the same versions and nothing is
# installed on the host (D3503).
#
#   scripts/ops/tool.sh <tool> [args...]   run the tool in the current directory (must be inside the repo)
#   scripts/ops/tool.sh image <tool>       print the pinned image reference
#
# The repo is mounted at /work and the tool runs in the matching subdirectory, as the host user.
# Environment variables reach the container only by name: TOOL_ENV="CLOUDFLARE_API_TOKEN TF_VAR_x" passes
# those names (docker reads the values from this environment; they never appear on a command line).
# TOOL_NETWORK picks a docker network (e.g. host for a k6 run against localhost).
# TOOL_DOCKER_SOCKET=1 hands the tool the docker socket, and TOOL_DOCKER_CLI=<path> a docker client binary at
# /usr/local/bin/docker: the Ansible image has neither, and its check run reaches its test containers that way.
# Never add `set -x` here: it would print passed-through values.
set -euo pipefail

readonly EX_USAGE=64

# Exact version plus the multi-arch index digest. Bump both together (docker buildx imagetools inspect <ref>).
image_of() {
  case "$1" in
    tofu) echo 'ghcr.io/opentofu/opentofu:1.10.6@sha256:879a73a0ee45132abf1b26583e3ab3a1e5443157a13b460114578d13dbe40b6e' ;;
    kamal) echo 'ghcr.io/basecamp/kamal:v2.7.0@sha256:025693d748bf2f33ff8999ac1b935f92b07cdf8cfbacf2a40870689b9c4b7257' ;;
    # Ansible publishes no ansible-core image; its dev-tools image carries ansible-core and ansible-lint.
    ansible-playbook | ansible-lint | ansible-galaxy | ansible-inventory | ansible-vault)
      echo 'ghcr.io/ansible/community-ansible-dev-tools:v25.9.0@sha256:01c11d4852af5573a0a84380456eefa736217fd2073a9137f6a1bf698ddabdc6' ;;
    k6) echo 'grafana/k6:1.3.0@sha256:3ddc8b1a33a2c3d8edc6e99b6a762ae36cba08788463458f5e6a7703e14eb77d' ;;
    trivy) echo 'aquasec/trivy:0.67.2@sha256:e2b22eac59c02003d8749f5b8d9bd073b62e30fefaef5b7c8371204e0a4b0c08' ;;
    otelcol) echo 'otel/opentelemetry-collector-contrib:0.135.0@sha256:89107a3a8f4636a396927edf7025bb9614b8da2d92f4cc3f43109e8d115736e2' ;;
    # promtool ships in the Prometheus image.
    promtool) echo 'prom/prometheus:v3.6.0@sha256:76947e7ef22f8a698fc638f706685909be425dbe09bd7a2cd7aca849f79b5f64' ;;
    actionlint) echo 'rhysd/actionlint:1.7.7@sha256:887a259a5a534f3c4f36cb02dca341673c6089431057242cdc931e9f133147e9' ;;
    shellcheck) echo 'koalaman/shellcheck:v0.11.0@sha256:61862eba1fcf09a484ebcc6feea46f1782532571a34ed51fedf90dd25f925a8d' ;;
    *) return 1 ;;
  esac
}

# The binary each image runs, when it is not the image's own entry point.
entrypoint_of() {
  case "$1" in
    ansible-playbook | ansible-lint | ansible-galaxy | ansible-inventory | ansible-vault) echo "$1" ;;
    otelcol) echo '/otelcol-contrib' ;;
    promtool) echo '/bin/promtool' ;;
    *) echo '' ;;
  esac
}

usage() {
  echo "usage: $0 <tofu|kamal|ansible-playbook|ansible-lint|ansible-galaxy|ansible-inventory|ansible-vault|k6|trivy|otelcol|promtool|actionlint|shellcheck> [args...]" >&2
  echo "       $0 image <tool>" >&2
  exit "$EX_USAGE"
}

pinned_image() {
  if ! image_of "$1"; then
    echo "unknown tool '$1'" >&2
    usage
  fi
}

[ "$#" -ge 1 ] || usage

if [ "$1" = image ]; then
  [ "$#" -eq 2 ] || usage
  pinned_image "$2"
  exit 0
fi

tool="$1"
shift
image="$(pinned_image "$tool")"

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
here="$(pwd -P)"
case "$here/" in
  "$repo_root"/*) rel="${here#"$repo_root"}" ;;
  *)
    echo "run $0 from inside the repository ($repo_root)" >&2
    exit "$EX_USAGE"
    ;;
esac

docker_args=(run --rm -i -v "$repo_root:/work" -w "/work$rel" -e HOME=/tmp)
[ -t 0 ] && [ -t 1 ] && docker_args+=(-t)
[ -n "${TOOL_NETWORK:-}" ] && docker_args+=(--network "$TOOL_NETWORK")

entrypoint="$(entrypoint_of "$tool")"
[ -n "$entrypoint" ] && docker_args+=(--entrypoint "$entrypoint")

for name in ${TOOL_ENV:-}; do
  [[ "$name" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || { echo "TOOL_ENV: '$name' is not a variable name" >&2; exit "$EX_USAGE"; }
  docker_args+=(-e "$name")
done

case "$tool" in
  # Kamal talks to the docker daemon (build, inspect) and to servers over the caller's ssh agent.
  kamal)
    docker_args+=(-v /var/run/docker.sock:/var/run/docker.sock --group-add "$(stat -c %g /var/run/docker.sock)")
    if [ -n "${SSH_AUTH_SOCK:-}" ]; then
      docker_args+=(-v "$SSH_AUTH_SOCK:/ssh-agent" -e SSH_AUTH_SOCK=/ssh-agent)
    fi
    # net-ssh accepts an unknown host key but refuses a changed one: the deploy job pins the server's key here.
    if [ -f "$HOME/.ssh/known_hosts" ]; then
      docker_args+=(-v "$HOME/.ssh/known_hosts:/tmp/.ssh/known_hosts:ro")
    fi
    docker_args+=(--user "$(id -u):$(id -g)")
    ;;
  # Trivy scans local images through the daemon and keeps its vulnerability database in a named volume.
  trivy)
    docker_args+=(-v /var/run/docker.sock:/var/run/docker.sock -v cod-trivy-cache:/tmp/trivy-cache
      -e TRIVY_CACHE_DIR=/tmp/trivy-cache)
    ;;
  # Ansible looks up a user name for the host uid, which the image's passwd lacks. The playbook reaches servers over
  # the caller's ssh agent and checks their keys against the caller's known_hosts. Falls through (;;&) to the default.
  ansible-*)
    docker_args+=(-e USER=ansible)
    if [ "$tool" = ansible-playbook ] && [ -n "${SSH_AUTH_SOCK:-}" ]; then
      docker_args+=(-v "$SSH_AUTH_SOCK:/ssh-agent" -e SSH_AUTH_SOCK=/ssh-agent)
    fi
    if [ "$tool" = ansible-playbook ] && [ -f "$HOME/.ssh/known_hosts" ]; then
      docker_args+=(-v "$HOME/.ssh/known_hosts:/tmp/.ssh/known_hosts:ro")
    fi
    ;;&
  *)
    docker_args+=(--user "$(id -u):$(id -g)")
    if [ "${TOOL_DOCKER_SOCKET:-}" = 1 ]; then
      docker_args+=(-v /var/run/docker.sock:/var/run/docker.sock --group-add "$(stat -c %g /var/run/docker.sock)")
    fi
    if [ -n "${TOOL_DOCKER_CLI:-}" ]; then
      docker_args+=(-v "$TOOL_DOCKER_CLI:/usr/local/bin/docker:ro")
    fi
    ;;
esac

exec docker "${docker_args[@]}" "$image" "$@"
