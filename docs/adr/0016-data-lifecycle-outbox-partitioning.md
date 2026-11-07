# ADR-0016: Data lifecycle (outbox, idempotent inbound webhooks, partitioning, retention, indexes)

**Date**: 2026-11-07
**Status**: Accepted (2026-11-07), approved by the user after P0.S2a-1/P0.S2a-2 review
**Deciders**: architect (draft), user

## Context

- Order intake, confirmation, dispatch, delivery and returns trigger side effects: notifications, Meta/TikTok/Snap CAPI, outbound webhooks, Google Sheets, platform sync, analytics and storefront revalidation. Losing one (a CAPI "Purchase", a merchant webhook) costs money. Doing one twice (duplicate notifications) annoys people. Redis/BullMQ is not durable enough to be the only record (ADR 0013).
- Carriers and payment providers deliver webhooks at least once, sometimes out of order, sometimes in bursts. Some carriers are polled instead [feature-inventory §6; P5 briefs].
- Volumes (infrastructure.md): Scale ≈ 200 k orders/day, ≈ 1 M carrier events/day, ≈ 1.2 M CAPI events/day, ≈ 75 M visitor events/day before rollup.
- Vendure uses TypeORM 0.3, migrations via `npx vendure migrate --generate/--run`, `synchronize: false` in production, DB in UTC [VN §9]. PgBouncer transaction-mode compatibility is **not documented**: it breaks session features (advisory locks, named prepared statements, LISTEN) [VN §9].

## Decision

### 1. Transactional outbox
- Table `outbox_event` columns:

  | Column | Definition |
  |---|---|
  | `id` | bigint snowflake |
  | `business_id` | bigint |
  | `topic` | text, e.g. `order.placed` |
  | `aggregate_id` | bigint |
  | `payload` | jsonb, ids + small facts only |
  | `dedupe_key` | text, **not unique** (see note) |
  | `status` | `pending` / `relayed` |
  | `created_at` | timestamptz |
  | `relayed_at` | timestamptz |

  Partitioned daily by `created_at`. PK `(created_at, id)`.
  **Note (review fix)**: Postgres requires every unique constraint on a partitioned table to include the partition key, so a global `UNIQUE (dedupe_key)` on a daily-partitioned table is impossible, and `UNIQUE (created_at, dedupe_key)` deduplicates nothing. Duplicate emission is prevented by the state machine (an event is written by the transition that causes it) and duplicate delivery by idempotent consumers, so the outbox needs no global unique key.
- Table `outbox_delivery(outbox_id, created_at, consumer, status pending|enqueued|done|failed|parked, attempts, next_attempt_at, last_error)`, one row per (event, consumer), written by the relay, **moved to a terminal state by the consumer**, partitioned like `outbox_event`. It is what the `job-reconciler` reads after a Valkey loss (ADR 0013 "Job durability").
- `OutboxService.add(ctx, topic, payload)` **must** run inside the business transaction that changes state (Vendure `TransactionalConnection` ctx).
- Relay: after commit, the transaction's `afterCommit` hook enqueues one BullMQ job per row (`jobId = outbox.id`, which makes enqueue idempotent) and marks the rows `relayed`. If the process dies first, `outbox-sweeper` (every 1 min) picks `pending` rows older than 60 s with `FOR UPDATE SKIP LOCKED` and enqueues them.
- Fan-out: one relay job per row routes to consumer queues (`order-effects`, `capi`, `outbound-webhooks`, `integrations`, `analytics`, `storefront-revalidate`), inserting the `outbox_delivery` rows. Each consumer job id is `{outboxId}:{consumer}`.
- **Consumers are idempotent**:
  - CAPI uses `event_id = {orderId}:{eventName}` (the platforms deduplicate it with the browser event).
  - Outbound webhooks carry `webhook-id = {outboxId}`.
  - Notifications are keyed by event + user + channel (P7.S3).
- Retention: partitions dropped after 7 days, **only if no `outbox_delivery` row in them is non-terminal**; otherwise partition maintenance keeps the partition and raises the DLQ alert.

### 2. Idempotent inbound webhook gateway
- One controller: `POST /webhooks/{provider}/{accountKey}`. Steps:
  1. Size cap 256 KB.
  2. Resolve the account (→ business) and verify the provider signature (ADR 0008).
  3. Compute the `event_key`: the provider's event id if present, else `sha256(provider + accountId + canonical body)`.
  4. In one transaction: `INSERT INTO inbound_webhook_key (provider, account_id, event_key, received_at) ON CONFLICT DO NOTHING`; if a row was inserted, `INSERT INTO inbound_webhook (...)` with `status = received`.
  5. If inserted, enqueue `inbound-webhooks` with `jobId = row.id` (the `job-reconciler` re-enqueues `received` rows older than 5 min if the job is lost).
  6. Answer `200` within 100 ms p95 whatever the processing outcome (signature failures → 401, unknown account → 404, both logged).
- **Why a separate key table (review fix)**: a unique `(provider, account_id, event_key)` constraint cannot exist on the daily-partitioned `inbound_webhook` (the partition key must be part of every unique constraint), and a retry arriving on another day would land in another partition. `inbound_webhook_key` is a narrow **non-partitioned** table with that primary key, purged in batches after 30 days by `retention-purge` (carrier retries happen within hours or days). Size at Scale ≈ 1 M rows/day × 30 d × ~100 B ≈ 3 GB.
- The processor applies the event idempotently. Parcel updates compare `(status, carrier_event_time)` and ignore older or equal ones. It then writes `parcel_event` and the `cod_order` projection, emits outbox events and sets `inbound_webhook.status = processed | ignored`.
- Table `inbound_webhook` is partitioned daily, keeps raw payloads for 14 days (replay and debugging), then metadata only for 90 days.
- **Polling carriers** share the same processor. A poll result is converted to the same normalised event shape, so webhook and polling paths cannot diverge.

### 3. Partitioning and retention (our tables only; Vendure core tables are not partitioned)
Native declarative range partitioning by `created_at`. The PK includes `created_at`, and no foreign keys point into partitioned tables. The `partition-maintenance` task creates 3 future partitions and detaches/drops expired ones (no pg_partman dependency, because extension availability on managed PG is unverified).

| Table | Partition | Hot retention | After |
|---|---|---|---|
| `order_event` (timeline, status history, audit diffs) | monthly | 24 months | export Parquet to the Algerian object storage `archive/` (it can contain personal data; never R2, ADR 0011/0012), drop |
| `parcel_event` (normalised carrier events) | monthly | 18 months | archive, drop |
| `stock_movement` | monthly | 36 months (finance) | archive, drop |
| `wallet_transaction` | monthly | never dropped (ledger) | — |
| `visitor_event` (raw track/beacon batches) | daily | 30 days | rollups kept forever |
| `capi_delivery_log`, `webhook_delivery_log` | daily | 30 days | drop |
| `inbound_webhook` | daily | 14 days raw / 90 days metadata | drop |
| `inbound_webhook_key` | none (dedupe PK) | 30 days | batched delete |
| `outbox_event`, `outbox_delivery` | daily | 7 days (never while a delivery is non-terminal) | drop |
| `erasure_log` | none | forever (ids only) | — |
| `activity_log` (audit) | monthly | 24 months | archive (security) |
| `notification` | monthly | 90 days | drop |
| `abandoned_checkout` | none (small) | 90 days (retention-purge) | delete |
| `spam_hold` | none | 30 days (expiry) | delete |

Vendure `order`, `order_line`, `history_entry`, `customer`: kept. At the Scale tier, revisit archiving delivered/returned orders older than 24 months (a Vendure-safe soft archive) if table size hurts. Spike C size: 5 M orders + 10 M lines + 5 M customers + their channel join rows = 6.1 GB including indexes (ADR 0002 Evidence).

### 4. Indexes for the order list (`cod_order`, ADR 0009)
All lists use keyset pagination `(created_at desc, id desc)` with a `limit`. Tab counts come from `order_counter(business_id, store_id, status)`, maintained in the same transaction as transitions, not from `COUNT(*)`.
```sql
-- defaults and tabs
CREATE INDEX ON cod_order (business_id, created_at DESC, id DESC);
CREATE INDEX ON cod_order (business_id, store_id, created_at DESC, id DESC);
CREATE INDEX ON cod_order (business_id, status, created_at DESC, id DESC);
CREATE INDEX ON cod_order (business_id, scheduled_at) WHERE status = 'scheduled';
CREATE INDEX ON cod_order (business_id, assignee_id, status, created_at DESC);
-- filters
CREATE INDEX ON cod_order (business_id, wilaya_code, created_at DESC);
CREATE INDEX ON cod_order (business_id, phone_e164);              -- client history, duplicates, bans
CREATE UNIQUE INDEX ON cod_order (business_id, order_number);
CREATE UNIQUE INDEX ON cod_order (quote_hash) WHERE quote_hash IS NOT NULL;
CREATE INDEX ON cod_order USING gin (offer_ids);                  -- offer / promo filter
CREATE INDEX ON cod_order (business_id, tracking_status, last_status_at) WHERE tracking_status IS NOT NULL;
CREATE INDEX ON cod_order USING gin (business_id, search_text gin_trgm_ops); -- needs btree_gin + pg_trgm
-- product / variant filter
CREATE INDEX ON cod_order_item (business_id, product_id, created_at DESC);
CREATE INDEX ON cod_order_item (business_id, variant_id, created_at DESC);
```
P4.S2 validates each filter with `EXPLAIN (ANALYZE, BUFFERS)` on a 5 M-order seed. P10.S2 re-checks with `pg_stat_statements`. Rule: equality columns first, range last. Partial indexes for hot tabs.

### 5. Migrations
- TypeORM migrations generated with `npx vendure migrate --generate <name>` and reviewed by a human. Never `synchronize` outside local dev [VN §9].
- **Expand/contract**: add nullable column/table → deploy code that writes both → backfill in batches (worker job, 1–5 k rows per batch, throttled) → switch reads → drop the old column in a later release.
- `CREATE INDEX CONCURRENTLY` goes in its own migration with `transaction = false`.
- Every migration sets `lock_timeout = '5s'` and `statement_timeout = '15min'`.
- Run by the `migrate` role as a **release job** before rollout, on a **direct (session) connection** (§6), never through the transaction pooler. Rollback = forward fix. Expand/contract keeps the previous image compatible.
- **Exception: Vendure core migrations in M.S1** are not ours and may not keep the previous image working. Staging runs the previous image against the migrated schema; if it fails, the release uses the maintenance-window procedure (system-design §9).

### 6. Connection pooling
- API and worker pools are sized per process (TypeORM `extra.max`: api 10, worker 5). Intake bursts need headroom: spike B needed 25 concurrent transactions, more than node-postgres's default of 10, so the worker that runs bulk intake (imports, platform sync) gets `extra.max` sized to its job concurrency.
- **Decision (spike D passed): `api` and `worker` connect through PgBouncer in transaction mode** (PgBouncer ≥ 1.21 with `max_prepared_statements` > 0; spike D used 1.26.1 with 200). Spike D ran Vendure 3.8.1's migrations, the e2e test server, `DefaultSchedulerPlugin` locking, BullMQ jobs that open transactions, `RedisCachePlugin` sessions and the `SET LOCAL` tenant helper through it (Evidence).
- **Rules that make transaction mode safe** (enforced by code review and a lint/grep check in P1.S1):
  - Per-request Postgres state only via `SET LOCAL` or `set_config(name, value, true)` **inside a transaction**. A plain `SET` survives on the server connection and is seen by the next client (spike D: client B read client A's `app.business_id = 99`).
  - No session-level advisory locks (`pg_advisory_lock`), `LISTEN/NOTIFY`, temp tables kept across transactions, or `WITH HOLD` cursors through the pooler. Use `pg_advisory_xact_lock` or row locks.
- **Direct (session) connections** to Postgres are used by: the `migrate` job (it runs `SET lock_timeout`/`statement_timeout` and `CREATE INDEX CONCURRENTLY`; spike D showed Vendure's full init migration also works through the pooler, so direct is a safety rule, not a workaround); test database setup/teardown (`@vendure/testing`'s `DROP DATABASE` fails through PgBouncer because the pooler keeps idle server connections to the old test database, spike D); and ad-hoc admin sessions.
- Fallback if a later Vendure version breaks transaction mode: session mode with right-sized pools (Risks).

### 7. Analytics data path
- Launch/Growth: rollup tables (`rollup_daily_store`, `rollup_daily_product`, `rollup_daily_wilaya`, `rollup_daily_carrier`, `rollup_daily_agent`, `rollup_daily_source`) upserted incrementally from outbox events (`analytics` queue) plus a nightly recompute for the last 3 days. Dashboards read rollups.
- At Growth, heavy reads (reports, exports, AI "ask about your orders" queries) are routed to the **read-only replica** through Vendure replication mode or a dedicated TypeORM DataSource [VN §9, exact API UNVERIFIED].
- Scale: `visitor_event` and order facts stream from the outbox to **ClickHouse** (Cloud ≈ $186/mo 24/7 basic and up [EH §11]) for funnels and visitor analytics. Postgres rollups stay for core KPIs.

## Consequences

### Positive
- No lost or duplicated side effects. Webhook storms are absorbed at insert speed. Table growth is bounded by retention. List queries stay index-only.

### Negative
- An outbox write per transition. Partition maintenance is ours. The `cod_order` projection must be kept consistent (nightly checker).

### Risks
- **A future Vendure or plugin version uses a session feature through the pooler** (spike D found none in 3.8.1 for the items tested; not tested: Vendure's own `LISTEN`-based features if any are enabled later, DO's managed pooler build). Re-run the spike D checks on every Vendure bump (M.S1) and when switching to the managed pooler. Mitigation: session mode with right-sized pools (Launch connection math in infrastructure.md fits either way). Note that small DO plans have low connection limits [BK, verify per plan]: 30 client connections at Launch must fit the 1 vCPU/2 GB plan's limit in session mode, or the pools shrink (api 8, worker 4).
- **Unique constraints on partitioned tables** must include the partition key. Every dedupe or uniqueness rule on a partitioned table needs a separate non-partitioned key table (as `inbound_webhook_key`) or must be dropped; P1.S6 adds a schema test for it.

## Evidence

Spike D, 2026-11-07, P0.S2a-2. Scratch app outside the repo (`@vendure/create@3.8.1` scaffold, `@vendure/job-queue-plugin` 3.8.1, `bullmq` 5.81.5, `@vendure/testing` 3.8.1), never committed. Arch Linux, native Docker 29.9.1, Node 24.22.1.

**Stack**: `postgres:17` (17.11), `edoburu/pgbouncer:v1.26.1-p0` (`sha256:488422e38cff…`), `valkey/valkey:8.1.11` (`sha256:8f836008e098…`). PgBouncer `SHOW VERSION` → `PgBouncer 1.26.1`; `SHOW CONFIG` → `pool_mode transaction`, `max_prepared_statements 200`, `default_pool_size 20`, `auth_type scram-sha-256`. The API and both workers connect to PgBouncer (`:6432`), never to Postgres directly.

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Vendure e2e smoke through PgBouncer (`@vendure/testing` `createTestEnvironment`, Postgres initializer) | **pass** | `server.init` (synchronize + populate) through `:6432`, then admin login, `createProduct` + `createProductVariants` + `products` query, shop `addItemToOrder` (order `AddingItems`, 2 × 2 500), order listed in the Admin API. **Gotcha:** the initializer's `DROP DATABASE` of the previous test database fails (`is being accessed by other users`) because PgBouncer keeps idle server connections to it. Clearing them with the admin command `KILL <db>` leaves that database **paused** until `RESUME <db>`. Test database setup and teardown therefore connect directly (§6). |
| 2 | `DefaultSchedulerPlugin`, 2 workers, task every 10 s | see ADR 0013 Evidence | no tick ran twice |
| 3 | BullMQ job opening a DB transaction (insert + same-`txid` read-back), ×1 000 | **pass** | 1 000 rows, 1 000 distinct `n`, 1 000 distinct `txid_current()`, both workers processed jobs, `failed = 0`. Wall time is not representative: the run overlapped spike C's 5 M-order bulk load on the same Postgres. |
| 4 | Sessions in Valkey (`RedisCachePlugin`) | **pass** | Valkey holds `vendure-cache:vendure-session-cache:<sha256>` keys (TTL ≈ 86 400 s). With TypeORM query logging at debug level: login does `INSERT INTO "session"`; the first authed request after login does one `SELECT` and one `UPDATE … SET "activeChannelId"`; the next 5 authed requests log only `CacheService hit for key [vendure-session-cache:…]` and **0** session-table statements. |
| 5 | TypeORM migrations through PgBouncer | **pass** | `generateMigration` against an empty database (direct), then `runMigrations` through `:6432`: `Successfully ran migration: Init1794051105270` (93 tables, 5.4 s). A second migration (create table, insert, create index, drop, create) also ran through `:6432`. Direct connection for `migrate` stays the rule (§6) because of session `SET`s and `CREATE INDEX CONCURRENTLY`. |
| 6 | `SET LOCAL app.business_id` with `default_pool_size=1` | **pass** | A second PgBouncer (`:6433`, pool size 1). Client A in a transaction: `SET LOCAL app.business_id='42'` → `current_setting` = `42`, `pg_backend_pid` 442. After commit, client B's next transaction on pid 442 → empty. Same with `set_config('app.business_id','7', true)`. **Contrast:** a plain `SET app.business_id='99'` by A outside a transaction is read by B on the same pid (`99`), so session `SET` is banned (§6). |

**Decision recorded in §6:** transaction mode for `api` and `worker`; direct connections for `migrate`, test database setup and admin sessions.

