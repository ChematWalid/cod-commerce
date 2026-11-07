# One image for every server role (api, worker, migrate); ROLE picks the entry point.
# Single stage on purpose: hardening (multi-stage, non-root, pruned dependencies) is P3.S5.
FROM node:24.22.1-bookworm-slim@sha256:be8204d4bd327363357f532187b752ff62759c31bedf98e9e18fc08c9cbd605c
WORKDIR /app
ENV TZ=UTC COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# pnpm is fetched here, before COPY, so a source change does not download it again. Keep the version equal
# to package.json `packageManager` (a test pins it).
RUN corepack enable && corepack prepare pnpm@10.34.9 --activate
COPY . .
# Only the server and the workspace packages it depends on: nothing else is built or run in this image.
RUN NODE_OPTIONS=--max-old-space-size=2048 pnpm install --frozen-lockfile --filter "@cod/server..." \
 && pnpm --filter "@cod/server..." run build
# The dashboard's Vite plugin loads src/vendure-config.ts, whose loadEnv() needs a full env. It reads the
# config only to find the plugin dashboards and the Admin API schema (no connection is made), so the
# .env.example placeholders are enough. They are ARGs set on this RUN line only: no ENV, so neither the
# image nor the containers keep them.
ARG DASHBOARD_BUILD_DATABASE_URL=postgresql://cod:change-me-pg@localhost:6432/cod
ARG DASHBOARD_BUILD_REDIS_URL=redis://localhost:6380
ARG DASHBOARD_BUILD_S3_ENDPOINT=http://localhost:3900
ARG DASHBOARD_BUILD_S3_ACCESS_KEY=GK000000000000000000000000
ARG DASHBOARD_BUILD_S3_SECRET_KEY=0000000000000000000000000000000000000000000000000000000000000000
ARG DASHBOARD_BUILD_COOKIE_SECRET=change-me-000000000000000000000000000000000000000000000000000000
ARG DASHBOARD_BUILD_SUPERADMIN_PASSWORD=change-me-admin
RUN APP_ENV=development ROLE=api \
    DATABASE_URL="$DASHBOARD_BUILD_DATABASE_URL" DATABASE_URL_DIRECT="$DASHBOARD_BUILD_DATABASE_URL" \
    REDIS_URL="$DASHBOARD_BUILD_REDIS_URL" S3_ENDPOINT="$DASHBOARD_BUILD_S3_ENDPOINT" S3_BUCKET_PRIVATE=cod-private \
    S3_ACCESS_KEY="$DASHBOARD_BUILD_S3_ACCESS_KEY" S3_SECRET_KEY="$DASHBOARD_BUILD_S3_SECRET_KEY" \
    COOKIE_SECRET="$DASHBOARD_BUILD_COOKIE_SECRET" SUPERADMIN_USERNAME=superadmin \
    SUPERADMIN_PASSWORD="$DASHBOARD_BUILD_SUPERADMIN_PASSWORD" \
    NODE_OPTIONS=--max-old-space-size=2048 pnpm --filter @cod/server run build:dashboard
ENV NODE_ENV=production
ENTRYPOINT ["sh","/app/scripts/docker-entrypoint.sh"]
