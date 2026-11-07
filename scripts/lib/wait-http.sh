#!/usr/bin/env bash
# wait_http <expected-status-code> <url> <timeout-seconds>
# Polls with curl once per second. Returns 1 with the last status when the timeout passes.
wait_http() {
  local want="$1" url="$2" timeout="$3" got="000" i
  for ((i = 0; i < timeout; i++)); do
    got=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "$url" || true)
    [[ "$got" == "$want" ]] && return 0
    sleep 1
  done
  echo "wait_http: $url answered $got, wanted $want after ${timeout}s" >&2
  return 1
}
