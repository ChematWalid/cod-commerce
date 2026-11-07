#!/bin/sh
# The image's entry point: ROLE selects which server process runs. exec keeps node as PID 1's
# direct replacement, so it receives the container's SIGTERM.
set -eu
case "${ROLE:-}" in
  api | worker | migrate)
    exec node --enable-source-maps "apps/server/dist/main-$ROLE.js"
    ;;
  *)
    echo "unknown ROLE '${ROLE:-}' (api|worker|migrate)" >&2
    exit 64
    ;;
esac
