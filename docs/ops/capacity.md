# Capacity: database connections and memory per role

Owner: P3.S5a (#270 items 10 and 12). Numbers come from `packages/shared/src/queues.ts` and the compose file;
`packages/config/tests/pool-capacity.test.ts` recomputes them and fails when the compose worker pool falls short.
P3.S5b replaces the memory column with RSS measured on the staging node (`docker stats --no-stream`).

## How many jobs a worker runs at once

Vendure's BullMQ strategy keeps one BullMQ worker per **distinct concurrency value** of a pool, and every queue with
that value shares it (`bullmq-job-queue-strategy.js`, "Workers are grouped by their concurrency value"). So a pool
runs at most the sum of its distinct concurrency values at once, not the sum over its queues.

| Pool | Jobs at once | Distinct concurrencies (queues) |
|---|---|---|
| critical | 18 | 10 (inbound-webhooks, outbox-relay, order-effects, notifications), 5 (dispatch, storefront-revalidate, auth-email), 3 (domains, the three stock Vendure queues) |
| bulk | 21 | 10 (capi, outbound-webhooks), 5 (integrations, carrier-polling), 3 (ai, catalog-effects), 2 (analytics, imports-exports), 1 (asset-derivatives, documents, platform-maintenance, catalog-reconcile, storefront-projection) |

At Launch one worker runs both pools (`WORKER_POOL=all`): **39 jobs at once**.

## Pool sizes

A running job holds at most one connection while it is in a transaction (#260, D2282). The catalog export reads
25 products at once outside a transaction (`EXPORT_READ_BATCH`, #270 item 10), a burst of 25 more connections.

| Role | `DB_POOL_MAX` | Why |
|---|---|---|
| api | 10 (`API_DB_POOL_MAX`) | requests are short; Vendure's default per process |
| worker | 66 (`WORKER_DB_POOL_MAX`) | 39 jobs + 25 for one export burst + 2 (scheduler task, readiness probe) |
| migrate | 2 | one migration run, one advisory lock |
| storefront | — | no database: it reads through the api |

Two exports at once (the `imports-exports` worker runs 2) would ask for 50 burst connections; the second burst waits
in the `pg` pool, which is safe because those reads hold no transaction. Raising the pool to cover it is not worth
the extra PgBouncer clients.

## PgBouncer and Postgres

Every pooled connection is a PgBouncer **client**; PgBouncer multiplexes them (transaction mode) onto its
**server** connections to Postgres.

| Setting | Value | Check |
|---|---|---|
| `MAX_CLIENT_CONN` | 500 | api 10 + worker 66 + migrate 2 = 78 clients per node; a second node or a split worker pool stays far below |
| `DEFAULT_POOL_SIZE` (`PGBOUNCER_DEFAULT_POOL_SIZE`) | 20 | server connections per database and user; transactions above 20 wait in PgBouncer, not in Postgres |
| Postgres `max_connections` | 100 (image default) | 20 from PgBouncer + direct connections (`DATABASE_URL_DIRECT`: migrations, LISTEN), the collector's 1, backups |

Raise `DEFAULT_POOL_SIZE` to 30 when `SHOW POOLS` shows `cl_waiting > 0` for minutes at a time, or when the
"DB pool waiting" panel (ADR 0015 golden signals) stays above 0 outside an export. Keep
`DEFAULT_POOL_SIZE + direct connections` below `max_connections` minus 10 for maintenance.

## Memory per container (Launch node budget)

Limits follow `docs/architecture/infrastructure.md` §1.1 "Launch node budget" and are set in `docker-compose.yml`
(`mem_limit`, `NODE_OPTIONS=--max-old-space-size`). The heap flag stays about 25 % below the limit so the process
is killed by its own heap limit, with a stack trace, before the kernel's OOM killer.

| Container | `mem_limit` | Heap flag | Measured RSS |
|---|---|---|---|
| api | 1000m | `--max-old-space-size=768` | P3.S5a image check (`scripts/ops/image-check.sh`), then staging |
| worker | 1000m (`cpus: 1.0`) | `--max-old-space-size=768` | idem |
| storefront | 700m | `--max-old-space-size=512` | idem |
| otel-collector | 150m | `memory_limiter` 120 MiB, spike 25 MiB | idem |

## pg_stat_statements

Loaded on every environment (`shared_preload_libraries`, compose `postgres` command). A new volume creates the
extension from the init script; an existing database needs it once:

```sh
scripts/ops/slow-queries.sh --ensure   # CREATE EXTENSION IF NOT EXISTS pg_stat_statements
scripts/ops/slow-queries.sh            # the 20 statements with the most total time
```
