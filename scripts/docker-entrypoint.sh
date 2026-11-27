#!/bin/sh
# The image's entry point. With arguments it runs them (kamal app exec, one-off tasks); without, ROLE selects
# which process runs. exec keeps node as PID 1's direct replacement, so it receives the container's SIGTERM.
set -eu
if [ "$#" -gt 0 ]; then
  exec "$@"
fi

# The OpenTelemetry preload (ADR 0015) goes on the node command line, not in the inherited node options, so it
# never leaks into child processes. It is a no-op until OTEL_EXPORTER_OTLP_ENDPOINT is set; an image without it starts plainly.
OTEL_PRELOAD=apps/server/dist/config/otel.js
preload=""
[ -f "$OTEL_PRELOAD" ] && preload="--require ./$OTEL_PRELOAD"

case "${ROLE:-}" in
  api | worker | migrate)
    # shellcheck disable=SC2086 # $preload is empty or two words on purpose.
    exec node --enable-source-maps $preload "apps/server/dist/main-$ROLE.js"
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
