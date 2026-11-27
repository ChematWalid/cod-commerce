#!/usr/bin/env bash
# shellcheck disable=SC2016 # backticks are Markdown in the report, not command substitution
# Checks infra/ansible (P3.S5a Task 5) without a server and writes docs/evidence/P3.S5a/ansible-check.md:
#   1. ansible-playbook --syntax-check and ansible-lint (production profile);
#   2. site.yml in --check --diff against a fresh Debian 12 container (the ufw and kernel tasks cannot run in a
#      container and are skipped: tags firewall-ufw, host-kernel);
#   3. the DOCKER-USER edge chain applied for real to a Docker-in-Docker container with a published port, probed from
#      another container: reachable before, dropped once the chain is in, reachable again only when the probe's
#      address is an allowed range and only on a web port, and a second apply leaves exactly one chain jump.
# Every container and the network are removed on exit. Values are synthetic (infra/ansible/tests/check-vars.yml).
#
#   flock -w 3600 /tmp/cod-heavy-jobs.lock timeout 2400 bash scripts/ops/ansible-check.sh
#
# Never add `set -x`.
set -euo pipefail
cd "$(dirname "$0")/../.."
repo_root=$(pwd -P)

readonly DEBIAN_IMAGE='debian:12.12@sha256:c66c66fac809bfb56a8001b12f08181a49b6db832d2c8ddabe22b6374264055f'
readonly DIND_IMAGE='docker:29.10.1-dind@sha256:fbbc96e0af32cdc190aff92ba97a1281a115351a723afe21af78879cc55126b0'
readonly BUSYBOX_IMAGE='busybox:1.37.0@sha256:a7dbc319b1438115a207e11930dc4bb3e643dcb3ec0bdd694bb36cd8fad289ec'
readonly NETWORK=cod-ansible-check
readonly CHECK_TARGET=cod-ansible-check-target
readonly EDGE_TARGET=cod-ansible-edge-target
readonly PROBE=cod-ansible-check-probe
readonly CLI_SOURCE=cod-ansible-check-cli
readonly WEB_PORT=80 OTHER_PORT=8081 PROBE_TIMEOUT_S=3 DIND_START_TRIES=60

out=docs/evidence/P3.S5a
report=$out/ansible-check.md
log=$(mktemp)
mkdir -p "$out"

cli_dir=$(mktemp -d)

cleanup() {
  docker rm -f "$CHECK_TARGET" "$EDGE_TARGET" "$PROBE" "$CLI_SOURCE" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
  rm -rf "$log" "$cli_dir"
}
trap cleanup EXIT

fail() {
  echo "ANSIBLE-CHECK FAILED: $*" >&2
  exit 1
}

rows=()
record() { rows+=("| $1 | $2 |"); }

# The ansible tools reach the test containers through the Docker socket (community.docker.docker connection), with
# the static docker client of the pinned Docker-in-Docker image.
ansible_tool() {
  (cd infra/ansible && TOOL_DOCKER_SOCKET=1 TOOL_DOCKER_CLI="$cli_dir/docker" "$repo_root/scripts/ops/tool.sh" "$@")
}

# Runs a step, keeps its output for the failure message, and returns the PLAY RECAP line.
run_step() {
  local name="$1"
  shift
  if ! "$@" >"$log" 2>&1; then
    tail -n 60 "$log" >&2
    fail "$name"
  fi
}

recap_of() { grep -E '^[a-z0-9-]+ +: ok=' "$log" | tr -s ' ' | tail -n 1; }

probe() {
  docker exec "$PROBE" wget -q -T "$PROBE_TIMEOUT_S" -O /dev/null "http://$edge_ip:$1/" >/dev/null 2>&1
}

expect_reachable() {
  probe "$1" || fail "$2: port $1 should answer"
  record "$2, port $1" 'answers'
}

expect_dropped() {
  ! probe "$1" || fail "$2: port $1 should be dropped"
  record "$2, port $1" "dropped (no answer within ${PROBE_TIMEOUT_S} s)"
}

edge_apply() {
  run_step "edge chain apply ($1)" ansible_tool ansible-playbook -i tests/inventory.yml tests/edge-firewall.yml "${@:2}"
  record "Edge chain apply ($1)" "\`$(recap_of)\`"
}

docker create --name "$CLI_SOURCE" "$DIND_IMAGE" >/dev/null
docker cp -q "$CLI_SOURCE:/usr/local/bin/docker" "$cli_dir/docker"
docker rm "$CLI_SOURCE" >/dev/null

# 0. The pinned collections (the tool image carries only ansible.posix).
run_step 'collections' ansible_tool ansible-galaxy collection install -r requirements.yml -p .ansible/collections
record 'Collections (requirements.yml)' 'community.general, community.docker installed at their pinned versions'

# 1. Static checks.
run_step 'syntax check' ansible_tool ansible-playbook -i inventory/staging.example.yml site.yml --syntax-check
run_step 'syntax check (edge test)' ansible_tool ansible-playbook -i tests/inventory.yml tests/edge-firewall.yml --syntax-check
record 'ansible-playbook --syntax-check' 'site.yml and tests/edge-firewall.yml pass'
run_step 'ansible-lint' ansible_tool ansible-lint
record 'ansible-lint (production profile)' "$(grep -E 'Passed|passed' "$log" | tail -n 1 || echo passed)"

docker network create "$NETWORK" >/dev/null

# 2. --check --diff against a fresh Debian 12 (python3, python3-apt for the apt module in --check, and iproute2,
#    which every VPS image has, for the default-route fact).
docker run -d --name "$CHECK_TARGET" --network "$NETWORK" "$DEBIAN_IMAGE" sleep infinity >/dev/null
docker exec "$CHECK_TARGET" sh -c 'apt-get update -qq && apt-get install -y -qq python3 python3-apt iproute2' >/dev/null 2>&1 ||
  fail 'python3 could not be installed in the Debian target'
run_step 'site.yml --check --diff' ansible_tool ansible-playbook -i tests/inventory.yml site.yml --limit staging \
  --check --diff --skip-tags firewall-ufw,host-kernel -e @tests/check-vars.yml
record 'site.yml `--check --diff` on Debian 12.12' "\`$(recap_of)\`"
grep -q 'check-only-not-a-secret' "$log" && fail 'a vault value appears in the --check --diff output'
record 'Vault values in the `--diff` output' 'none'

# 3. The edge chain on a real Docker host.
docker run -d --privileged --name "$EDGE_TARGET" --network "$NETWORK" -e DOCKER_TLS_CERTDIR= "$DIND_IMAGE" >/dev/null
for ((i = 0; i < DIND_START_TRIES; i++)); do
  docker exec "$EDGE_TARGET" docker info >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$EDGE_TARGET" docker info >/dev/null 2>&1 || fail 'the Docker-in-Docker target did not start'
docker exec "$EDGE_TARGET" apk add --no-cache -q python3 >/dev/null
docker image inspect "$BUSYBOX_IMAGE" >/dev/null 2>&1 || docker pull -q "$BUSYBOX_IMAGE" >/dev/null
docker save "$BUSYBOX_IMAGE" | docker exec -i "$EDGE_TARGET" docker load -q >/dev/null
docker exec "$EDGE_TARGET" docker run -d --name web -p "$WEB_PORT:8080" -p "$OTHER_PORT:8080" "$BUSYBOX_IMAGE" \
  sh -c 'mkdir -p /www && echo ok >/www/index.html && exec httpd -f -p 8080 -h /www' >/dev/null
docker run -d --name "$PROBE" --network "$NETWORK" "$BUSYBOX_IMAGE" sleep 3600 >/dev/null
edge_ip=$(docker inspect -f "{{(index .NetworkSettings.Networks \"$NETWORK\").IPAddress}}" "$EDGE_TARGET")
probe_ip=$(docker inspect -f "{{(index .NetworkSettings.Networks \"$NETWORK\").IPAddress}}" "$PROBE")

expect_reachable "$WEB_PORT" 'Before the chain'
edge_apply 'Cloudflare ranges only'
expect_dropped "$WEB_PORT" 'Probe outside the edge ranges'
edge_apply 'probe address added' -e "{\"firewall_edge_ranges_extra\": [\"$probe_ip/32\"]}"
expect_reachable "$WEB_PORT" 'Probe inside the edge ranges'
expect_dropped "$OTHER_PORT" 'Probe inside the edge ranges, non-web published port'

jumps=$(docker exec "$EDGE_TARGET" iptables -S DOCKER-USER | grep -c -- '-j COD-EDGE$' || true)
[[ "$jumps" == 1 ]] || fail "DOCKER-USER holds $jumps jumps to COD-EDGE after two applies"
docker exec "$EDGE_TARGET" iptables -S COD-EDGE-NEXT >/dev/null 2>&1 && fail 'COD-EDGE-NEXT was left behind'
record 'DOCKER-USER after two applies' 'one jump to COD-EDGE, no leftover chain'

{
  echo "# Ansible baseline check (scripts/ops/ansible-check.sh, $(date -u +%Y-%m-%dT%H:%MZ), commit $(git rev-parse --short HEAD))"
  echo
  echo '| Check | Result |'
  echo '|---|---|'
  printf '%s\n' "${rows[@]}"
  echo
  echo "Targets: \`$DEBIAN_IMAGE\` (check run), \`$DIND_IMAGE\` (edge chain), probes from \`$BUSYBOX_IMAGE\`."
  echo 'Skipped in the container (run on the server only): ufw (`firewall-ufw`), sysctl (`host-kernel`), the swap file,'
  echo 'service restarts (no systemd), the login as the operator (the account does not exist in `--check`).'
} >"$report"
echo "ansible-check: all checks passed, report in $report"
