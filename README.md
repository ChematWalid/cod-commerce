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

## CI
`.github/workflows/ci.yml` runs `lint`, `typecheck`, `unit`, `build` and `data-services` in parallel. The `build-test` job gates them all and is the required status check, next to `attribution-check`. The whole pipeline must finish in 10 minutes or less (ADR 0001); `build-test` writes the wall-clock time to the run summary, and `scripts/ci/ci-duration.sh` reports the p90 over the last 20 runs on `main`.
