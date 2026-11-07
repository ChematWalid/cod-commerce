# One image for every server role (api, worker, migrate); ROLE picks the entry point.
# Single stage on purpose: hardening (multi-stage, non-root, pruned dependencies) is P3.S5.
FROM node:24.22.1-bookworm-slim@sha256:be8204d4bd327363357f532187b752ff62759c31bedf98e9e18fc08c9cbd605c
WORKDIR /app
ENV TZ=UTC COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
COPY . .
RUN NODE_OPTIONS=--max-old-space-size=2048 pnpm install --frozen-lockfile && pnpm --filter "@cod/server..." run build
ENV NODE_ENV=production
ENTRYPOINT ["sh","/app/scripts/docker-entrypoint.sh"]
