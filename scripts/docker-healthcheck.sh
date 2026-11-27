#!/bin/sh
# The image's HEALTHCHECK: each role's readiness, for a container run without compose's or Kamal's own checks.
set -eu
case "${ROLE:-}" in
  # PlatformHealthPlugin's /readyz on API_PORT (api) or WORKER_HEALTH_PORT (worker).
  api | worker)
    exec node apps/server/dist/healthcheck.js
    ;;
  storefront)
    exec node -e "fetch('http://127.0.0.1:3001/readyz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
    ;;
  # A one-shot that exits when done: nothing to probe.
  migrate)
    exit 0
    ;;
  *)
    echo "unknown ROLE '${ROLE:-}'" >&2
    exit 1
    ;;
esac
