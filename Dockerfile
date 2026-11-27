# One image for every role (api, worker, migrate, storefront); ROLE picks the entry point.
# Multi-stage (P3.S5a): `deps` fetches the lockfile's packages, `build` compiles everything and prunes the server to
# its production dependencies, `runtime` keeps only what the roles run, as the non-root `node` user (uid 1000).
# The build stages never reach the shipped image, so nothing they hold appears in its `docker history`.

FROM node:24.22.1-bookworm-slim@sha256:be8204d4bd327363357f532187b752ff62759c31bedf98e9e18fc08c9cbd605c AS base
WORKDIR /app
ENV TZ=UTC COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# Keep the version equal to package.json `packageManager` (a test pins it).
RUN corepack enable && corepack prepare pnpm@10.34.9 --activate

# Only the lockfile and the workspace settings: a source change does not download the packages again.
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
RUN pnpm fetch

FROM deps AS build
COPY . .
# Only the server, the storefront and the workspace packages they depend on: nothing else is built or run here.
RUN NODE_OPTIONS=--max-old-space-size=2048 pnpm install --offline --frozen-lockfile --filter "@cod/server..." --filter "@cod/storefront..." \
 && pnpm --filter "@cod/server..." run build
# The dashboard's Vite plugin loads src/vendure-config.ts, whose loadEnv() needs a full env. It reads the config
# only to find the plugin dashboards and the Admin API schema (no connection is made), so fixed placeholders are
# enough. They live on this RUN line of a build stage only: no ARG (nothing to pass a real value through), no ENV,
# and the runtime image never carries this layer.
RUN APP_ENV=development ROLE=api \
    DATABASE_URL=postgresql://cod:change-me-pg@localhost:6432/cod \
    DATABASE_URL_DIRECT=postgresql://cod:change-me-pg@localhost:6432/cod \
    REDIS_URL=redis://localhost:6380 S3_ENDPOINT=http://localhost:3900 S3_BUCKET_PRIVATE=cod-private \
    S3_ACCESS_KEY=GK000000000000000000000000 \
    S3_SECRET_KEY=0000000000000000000000000000000000000000000000000000000000000000 \
    COOKIE_SECRET=change-me-000000000000000000000000000000000000000000000000000000 \
    AUTH_TOKEN_SECRET=change-me-auth-000000000000000000000000000000000000000000000000 \
    INTERNAL_HMAC_KEYS=k1:change-me-internal-hmac-000000000000000000000 \
    QUOTE_HMAC_KEYS=k1:change-me-quote-hmac-00000000000000000000000000 QUOTE_HMAC_ACTIVE_KID=k1 \
    TENANT_SECRET_KEKS=k1:0000000000000000000000000000000000000000000000000000000000000000 TENANT_SECRET_ACTIVE_KID=k1 \
    SUPERADMIN_USERNAME=superadmin SUPERADMIN_PASSWORD=change-me-admin \
    NODE_OPTIONS=--max-old-space-size=2048 pnpm --filter @cod/server run build:dashboard
# The server with its production dependencies only; workspace packages are copied in (with their dist), not linked.
# Injected workspace packages let deploy reuse the shared lockfile (exact versions, offline); `--legacy` would
# resolve again without it. Plain copies: hard links to the store (a lower layer) would make overlayfs copy each
# file up with an fsync, which took over 30 min on a busy disk.
RUN pnpm --filter @cod/server deploy --prod --config.inject-workspace-packages=true --config.package-import-method=copy --offline /out/server \
 && rm -rf /out/server/src /out/server/tests
# The storefront's deployment id namespaces its cache keys and assets (ADR 0006). next build embeds it, and the
# standalone server sets process.env.NEXT_DEPLOYMENT_ID to that embedded id at start whatever the environment
# says; the runtime ENV stays for the cache handlers' process.env read, which then sees the same value. Declared
# here so a new id does not rebuild the layers above. Compose passes the caller's NEXT_DEPLOYMENT_ID (the commit
# id; verify-stack exports it) or `local`.
ARG NEXT_DEPLOYMENT_ID=local
ENV NEXT_DEPLOYMENT_ID=$NEXT_DEPLOYMENT_ID
# The static files' CDN prefix (https://cdn.<root>/sf in staging and production, empty locally). The standalone
# output embeds next.config's assetPrefix at build time, so it is a build arg, not a runtime variable.
ARG STOREFRONT_ASSET_PREFIX=
# One build at a time: next build and the dashboard build are both memory-heavy. The standalone output does not
# include .next/static, so it is copied in.
RUN STOREFRONT_ASSET_PREFIX="$STOREFRONT_ASSET_PREFIX" NODE_OPTIONS=--max-old-space-size=2048 pnpm --filter @cod/storefront build \
 && cp -r apps/storefront/.next/static apps/storefront/.next/standalone/apps/storefront/.next/static

FROM node:24.22.1-bookworm-slim@sha256:be8204d4bd327363357f532187b752ff62759c31bedf98e9e18fc08c9cbd605c AS runtime
WORKDIR /app
# Paths stay those of the build (/app/apps/...): the storefront's cacheHandler paths are absolute and embedded.
COPY --from=build --chown=node:node /out/server /app/apps/server
# deploy copies the package as published; the compiled server and the dashboard are copied explicitly.
COPY --from=build --chown=node:node /app/apps/server/dist /app/apps/server/dist
COPY --from=build --chown=node:node /app/apps/storefront/cache/dist /app/apps/storefront/cache/dist
COPY --from=build --chown=node:node /app/apps/storefront/.next/standalone /app/apps/storefront/.next/standalone
COPY --from=build --chown=node:node /app/apps/storefront/.next/static /app/apps/storefront/.next/standalone/apps/storefront/.next/static
COPY --chown=node:node scripts/docker-entrypoint.sh scripts/docker-healthcheck.sh /app/scripts/
ARG NEXT_DEPLOYMENT_ID=local
ENV TZ=UTC NODE_ENV=production NEXT_DEPLOYMENT_ID=$NEXT_DEPLOYMENT_ID
USER node
# api and worker probe /readyz through the server healthcheck (worker on WORKER_HEALTH_PORT), the storefront its own
# /readyz; migrate is a one-shot. Compose and Kamal keep their own checks; this one serves plain `docker run`.
HEALTHCHECK --interval=10s --timeout=3s --retries=6 --start-period=30s CMD ["sh", "/app/scripts/docker-healthcheck.sh"]
ENTRYPOINT ["sh","/app/scripts/docker-entrypoint.sh"]
