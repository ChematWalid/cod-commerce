# cod-commerce

Multi-store cash-on-delivery commerce SaaS for Algeria, built as plugins on [Vendure](https://vendure.io) (published `@vendure/*` packages) with a multi-tenant Next.js storefront. `cod-commerce` is a working name until the product name is decided (ADR 0007).

## Where to start
- Roadmap (phases, sessions, dependencies): [docs/roadmap/README.md](docs/roadmap/README.md)
- Git & GitHub rules: [docs/roadmap/CONTRIBUTING.md](docs/roadmap/CONTRIBUTING.md)
- Architecture & tech stack: [docs/architecture/README.md](docs/architecture/README.md)

## Working with Claude Code
Every session follows [CLAUDE.md](CLAUDE.md): plan first and save it under `docs/roadmap/plans/`, small Conventional Commits, no AI attribution, a handoff note and one PR per session.

## Prerequisites
- Node 24.22.1 (pinned in `.nvmrc`; use `nvm`, `fnm` or [mise](https://mise.jdx.dev) to pick it up).
- pnpm 10.34.9, via corepack (`corepack enable`) or a global install. The root `package.json` `packageManager` field pins it.
- Docker with Compose v2 (2.23.1 or newer; the compose file uses `configs.content`).

## Setup after cloning
```bash
git config core.hooksPath .githooks   # local hooks: block AI attribution in commits and direct pushes to main
cp .env.example .env                  # placeholders only; never commit real values
docker compose up -d --wait postgres pgbouncer valkey garage mailpit   # data services only
pnpm install
```

## Scripts
Run from the repo root.

| Script | What it does |
|---|---|
| `pnpm lint` | ESLint (zero warnings) and a Prettier check |
| `pnpm typecheck` | TypeScript across the workspace (via turbo) |
| `pnpm test` | Unit tests across the workspace (via turbo) |
| `pnpm test:arch` | Whole-repo gates: architecture rules, Vendure pin, CI workflow, branding |
| `pnpm test:integration` | Integration tests that need the data services |
| `pnpm build` | Builds every package (via turbo, one at a time) |
| `pnpm dev` | Runs the dev tasks |
| `scripts/check-data-services.sh` | Verifies the running data services end to end |
| `scripts/verify-stack.sh` | Builds the server image and verifies the whole stack under project `cod-verify` (`--bad-password` checks the env failure path) |
| `scripts/evidence/P0.S2b-3.sh` | Re-runs the P0.S2b-3 api transcripts against a live stack (project `cod-evidence`) into `docs/evidence/P0.S2b-3/` |
| `scripts/evidence/P0.S2b-4.sh` | Re-runs the P0.S2b-4 dashboard transcripts and screenshots against a live stack into `docs/evidence/P0.S2b-4/` |
| `scripts/ci/ci-duration.sh` | Prints the p90 of recent CI runs on `main` (needs `gh`) |

## Data services
`docker compose up -d --wait postgres pgbouncer valkey garage mailpit` starts them (a bare `docker compose up -d` also builds the server image and starts `migrate`, `api` and `worker`). Every published port binds to `127.0.0.1` unless `DATA_BIND_ADDR` (or `API_BIND_ADDR` for the api) says otherwise.

| Service | Host port |
|---|---|
| Postgres | 5433 |
| PgBouncer | 6432 |
| Valkey | 6380 |
| Garage S3 | 3900 |
| Mailpit SMTP / web UI | 1026 / 8026 |

Dev servers: API on port 3100 (3000 inside containers), storefront on port 3001.

## Server (Vendure) dev
```bash
docker compose up -d --wait postgres pgbouncer valkey garage mailpit   # data services by name
cp -n apps/server/.env.example apps/server/.env                         # host-run env, placeholders only
pnpm --filter @cod/server dev                                           # migrate + seed, then api and worker
```
`dev` runs the `migrate` role once (migrations and the idempotent platform seed), then the `api` and `worker` roles side by side. Each package script sets `ROLE` itself; `pnpm --filter @cod/server dev:api` or `dev:worker` starts one role.

`SUPERADMIN_USERNAME` and `SUPERADMIN_PASSWORD` are read only when Vendure first creates the superadmin on an empty database. Changing them later has no effect on the existing account; password rotation is P3.S5.

`migrate` also re-asserts the platform invariants on every run (currency DZD only, tax-inclusive prices, languages ar, fr, en, zero tax, the Algeria zone), so a dashboard edit to them is reverted by the next deploy until P1.S1 decides create-if-missing.

| Process | Host-run dev | In the container |
|---|---|---|
| api (`/livez`, `/readyz`, Admin API, dashboard) | 3100 | 3000 (published on `API_HOST_PORT`, default 3100) |
| worker health (`/livez`, `/readyz`) | 3020 | 3020 |

The containerised api and a host-run `dev:api` both default to host port 3100, so run one at a time.

The single app image (`Dockerfile`) runs one role per container (`ROLE=api|worker|migrate`). `scripts/verify-stack.sh` builds it once and checks the whole single-VPS stack in its own compose project `cod-verify` (host ports shifted by 10000): `migrate` gates `api` and `worker`, both answer `/readyz` through PgBouncer, a second `up` is a migrate no-op, and Postgres or Valkey outages turn `/readyz` 503 then back to 200. `--bad-password` proves a URL-reserved database password fails `migrate` without leaking it. It always tears its project down.

`scripts/evidence/P0.S2b-3.sh` produces the session's committed evidence (`docs/evidence/P0.S2b-3/`): migrate, health, superadmin login and seeded-data transcripts, with secrets redacted by the script.

## Dashboard (Arabic RTL)
The Vendure dashboard is served by the api at `http://localhost:3100/dashboard`, with the `plugins/merchant-shell` customisations (Arabic RTL by default). Sign in with `SUPERADMIN_USERNAME` and `SUPERADMIN_PASSWORD`.

```bash
pnpm --filter @cod/server build:dashboard   # builds the dashboard; needs the server env, run after pnpm build
CORS_ORIGINS=http://localhost:5173 pnpm --filter @cod/server dev:dashboard   # Vite dev server on 5173
```
The api serves the built dashboard, so run `build:dashboard` before opening the URL above. The Vite dev server on port 5173 talks to the api on 3100 from another origin, so the api must be started with `CORS_ORIGINS=http://localhost:5173`.

Browser tests (Playwright, headless Chromium) run against a live api and the built dashboard:
```bash
pnpm --filter @cod/server exec playwright-core install chromium-headless-shell   # once; add --with-deps on a fresh Linux CI image
pnpm --filter @cod/server test:browser   # DASHBOARD_URL overrides the default http://localhost:3100/dashboard
```
Screenshots go to `apps/server/test-results/`. `scripts/evidence/P0.S2b-4.sh` regenerates the committed evidence in `docs/evidence/P0.S2b-4/`.

## CI
`.github/workflows/ci.yml` runs `lint`, `typecheck`, `unit`, `build`, `data-services`, `integration` (Postgres and Valkey service containers) and `stack` (builds the image and runs `scripts/verify-stack.sh`, then `--bad-password`) in parallel. The `build-test` job gates them all and is the required status check, next to `attribution-check`. The whole pipeline must finish in 10 minutes or less (ADR 0001); `build-test` writes the wall-clock time to the run summary, and `scripts/ci/ci-duration.sh` reports the p90 over the last 20 runs on `main`.

`.github/workflows/browser.yml` (job `browser`) runs the browser tests against the built api on Postgres and Valkey service containers. It is not part of the pull-request pipeline (ADR 0001 section 6): it runs on every push to `main`, nightly at 02:00 UTC, and on demand (`gh workflow run browser.yml`), and uploads the screenshots as an artifact. The `build` job also builds the dashboard.
