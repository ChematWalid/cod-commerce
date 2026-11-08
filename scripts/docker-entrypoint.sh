#!/bin/sh
# The image's entry point: ROLE selects which process runs. exec keeps node as PID 1's
# direct replacement, so it receives the container's SIGTERM.
set -eu
case "${ROLE:-}" in
  api | worker | migrate)
    exec node --enable-source-maps "apps/server/dist/main-$ROLE.js"
    ;;
  # The Next.js standalone server. HOSTNAME=0.0.0.0: listen on every interface of the container (with
  # 127.0.0.1, a host-run standalone server treated its own rewrites as external and proxying them failed).
  storefront)
    PORT=3001 HOSTNAME=0.0.0.0 exec node apps/storefront/.next/standalone/apps/storefront/server.js
    ;;
  *)
    echo "unknown ROLE '${ROLE:-}' (api|worker|migrate|storefront)" >&2
    exit 64
    ;;
esac
