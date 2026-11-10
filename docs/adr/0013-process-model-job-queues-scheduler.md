# ADR-0013: Process model, job queues and scheduler

**Date**: 2026-11-07
**Status**: Accepted (2026-11-07), approved by the user after P0.S2a-1/P0.S2a-2 review
**Deciders**: architect (draft), user

## Context

- Vendure: the server is `bootstrap(config)`, the worker is `bootstrapWorker(config)` + `startJobQueue()` with no network listener. Running jobs on the server is discouraged in production. Both scale horizontally, and all state must be external. Docker guide: one image, two commands [VN §1].
- `BullMQJobQueuePlugin` (Redis, push-based) is recommended for production with many queues. Options: `concurrency` per queue, `setRetries`, `setBackoff`, `setJobOptions` (priority, delay, attempts). `JobQueueOptions.activeQueues` dedicates a worker to some queues. Job data must be JSON. Serialised RequestContexts are large and strain Redis. **Per-tenant fairness is not documented** [VN §2].
- Scheduler: `DefaultSchedulerPlugin` (adds a DB table). Tasks run only on workers and are locked so each tick runs once across instances. Per-task timezone since 3.8 [VN §2].
- `/health` returns ok unconditionally since 3.6 (the DB check is gone). Worker health comes from `startHealthCheckServer({port})` [VN §1].
- Cache: `RedisCachePlugin` backs `CacheService` and sessions [VN §3].

## Options

1. **Separate images per app**: more registry, more versions, and API/storefront/worker skew during deploys. Rejected.
2. **One image with roles, BullMQ on Redis, Vendure scheduler on workers, our queue taxonomy (recommended).**
3. **`DefaultJobQueuePlugin` (SQL polling every 200 ms per queue)**: load on Postgres grows with queues × workers. Rejected for production; fine in unit tests.

## Decision

**One image, roles** (`ghcr.io/<org>/platform:<git-sha>`, multi-stage, non-root, Node LTS slim). Entry point `ROLE`:
| Role | Command | Port | Replicas (Launch → Growth → Scale) |
|---|---|---|---|
| `api` | Vendure `bootstrap` (Admin API, our REST, DashboardPlugin, webhooks gateway, MCP) | 3000 | 2 → 3 → 6–20 (HPA) |
| `worker` | `bootstrapWorker` + `startJobQueue` + `startHealthCheckServer(3020)` | 3020 (health) | 2 (all queues) → 2 critical + 2 bulk → KEDA by queue |
| `storefront` | Next.js standalone `server.js` | 3001 | 2 → 3 → 6–20 (HPA) |
| `migrate` | `runMigrations()` once per release, then a one-shot `bootstrap` that seeds Vendure's defaults on a new database, then exit | — | release job; **must finish before any `api`/`worker` replica starts** (spike D: concurrent first boot races) |

If the image grows beyond 1.2 GB, split into two build targets from the same Dockerfile and tag (`platform-server`, `platform-storefront`), with the same SHA so they still deploy atomically.

**Runtime environment**: every role runs with `TZ=UTC` (spike D: `DefaultSchedulerPlugin` writes `scheduled_task_record.lastExecutedAt` from the Node process's local time into a `timestamp without time zone` column, one hour ahead of `updatedAt` on a `+01:00` host). Business-facing schedules set `timezone: 'Africa/Algiers'` per task instead.

**Plugins**: `BullMQJobQueuePlugin` (key prefix `bull:{env}`), `RedisCachePlugin` (sessions + CacheService), `DefaultSchedulerPlugin`, `@vendure/telemetry-plugin`, `HardenPlugin` [VN §1, §2, §3, §11]. `systemOptions.healthChecks: []` [VN §1].

**Readiness and liveness** (plugin `platform-health`):
- `GET /livez`: process up, event-loop lag under 1 s.
- `GET /readyz`: Postgres `SELECT 1` within 500 ms, Redis `PING` within 200 ms, migrations at the expected version (no pending ones for this image), not draining. Returns 503 on failure.
- The worker exposes the same checks on 3020 plus "BullMQ workers connected".
- During shutdown (SIGTERM) `/readyz` returns 503 immediately, the server drains in-flight requests for 25 s, and workers `close()` and wait for active jobs up to 60 s.

**Queue taxonomy** (names in `packages/shared/src/queues.ts`). Priority is a BullMQ job priority within the queue (1 = highest). Pools are set via `activeQueues`.
| Queue | Producers | Concurrency / worker | Retries / backoff | Pool |
|---|---|---|---|---|
| `inbound-webhooks` | webhook gateway (ADR 0016) | 10 | 10, exp 2 s → 30 min | critical |
| `order-effects` | outbox relay: assignment, notifications fan-out, sheets append, abandoned conversion, read-model extras | 10 | 8, exp 1 s | critical |
| `dispatch` | merchant dispatch actions | 5 (+ per-carrier-account token bucket) | 5, exp 5 s; non-retryable taxonomy errors fail fast | critical |
| `notifications` | order-effects (email, web push, WhatsApp, in-app) | 10 | 6, exp 10 s | critical |
| `storefront-revalidate` | builder publish, product/offer changes | 5 | 5, exp 1 s | critical |
| `domains` | DNS/hostname verification | 3 | scheduled re-checks | critical |
| `capi` | outbox relay (Meta, TikTok, Snapchat) | 10 | 12 over 24 h, then DLQ | bulk |
| `outbound-webhooks` | outbox relay (P9.S8a) | 10 | 12 over 24 h, then DLQ | bulk |
| `integrations` | Sheets, platform sync (Shopify/YouCan/Woo/Ayor/Order Dz), ads spend import | 5 + per-business semaphore 1 | 8, exp 30 s | bulk |
| `carrier-polling` | scheduler tick, batched by carrier account | 5 + per-account limiter | 3, then next tick | bulk |
| `analytics` | rollups (incremental + nightly) | 2 | 3 | bulk |
| `ai` | LLM jobs (polish, landing page generation) | 3 (Anthropic rate limits) | 3, exp 10 s; credits committed only on success | bulk |
| `imports-exports` | catalog import/export, order exports > 500 rows | 2 + per-business semaphore 1 | 2 | bulk |
| `asset-derivatives` | asset upload (sharp presets) | 1 at Launch (memory budget), 2 from Growth | 3 | bulk |
| `documents` | bulk "Print labels" (merge carrier PDFs), private-courier labels, delivery sheets (`pdf-lib`, no headless browser) | 1 + per-business semaphore 1 | 3 | bulk |
| Vendure built-ins | `update-search-index`, `send-email` (if used), `apply-collection-filters` | default 3 | default | critical |

**Per-tenant fairness** (OSS BullMQ has no groups):
- (a) Heavy jobs take a per-business Redis semaphore (`sem:{queue}:{businessId}`, max 1–2). When it is not acquired, the job is re-delayed 5–30 s with jitter (`moveToDelayed`).
- (b) Plan-based priority: paid plans get priority 2 and trials 3, on bulk queues only.
- (c) Fan-out jobs carry at most 100 items. Large work is chunked.
- (d) Job payloads hold ids only (`{businessId, storeId, orderId, ...}`), never serialised RequestContexts. The processor rebuilds the context [VN §2].
- (e) `removeOnComplete: {age: 3600, count: 1000}`, `removeOnFail: {age: 14 d}`. Failed jobs are the DLQ, browsable and replayable from a staff-only Bull Board route.

**Job durability** (Valkey is not a system of record, so BullMQ state, including delayed retries and backoff chains, can be lost with the instance):
- Every job whose loss matters has a **durable Postgres row with a status**: `outbox_delivery` per (outbox event, consumer), `inbound_webhook.status`, `parcel.status = dispatching`, `asset.derivatives_status`, `document_job`, `import_export_job`, `ai_job` (table in system-design §10).
- The consumer, not the relay, moves the row to a terminal state (`done`, `failed`, `parked`). The relay only sets `enqueued`.
- `job-reconciler` (every 5 min) re-enqueues rows that are non-terminal and older than their queue's SLA (critical 5 min, bulk 30 min, or `next_attempt_at` passed) with the **same `jobId`**. BullMQ ignores an add whose `jobId` already exists, so live jobs are not duplicated; a job already removed after completion can run twice, which idempotent consumers tolerate.
- Jobs without a durable row (live-visitor counters, visitor buffer, cache warm-up, rate-limit state) are accepted losses.

**Scheduled tasks** (`ScheduledTask`, workers only, locked; timezone `Africa/Algiers` where business-facing). Every task is **catch-up**: it processes everything due up to now, so a tick missed because no worker was alive is absorbed by the next run (Vendure stores only the last result and does not replay missed ticks [VN §2; replay behaviour BK]). Each task emits `scheduler_task_last_success_age_seconds{task}` for the "Scheduler stalled" alert (ADR 0015).
| Task id | Schedule | Action |
|---|---|---|
| `carrier-poll-tick` | every 5 min | enqueue `carrier-polling` batches for parcels with `next_check_at <= now()` |
| `late-parcel-scan` | hourly | flag late parcels (P5.S2) |
| `outbox-sweeper` | every 1 min | enqueue outbox rows still `pending` 60 s after commit (relay failure safety net) |
| `job-reconciler` | every 5 min | re-enqueue non-terminal durable job rows past their SLA (above) |
| `intake-spool-replay` | every 1 min while the spool is non-empty | replay spooled submits through the intake service once `/readyz` is green (system-design §2.2) |
| `visitor-flush` | every 30 s | drain the Valkey visitor stream into `visitor_event` with multi-row inserts |
| `valkey-memory-guard` | every 30 s | set or clear `{env}:cache:writes-off` at 60 % `used_memory` (Launch shared instance) |
| `catalog-feeds` | every 10 min | regenerate feeds for stores with `product.changed` since the last run |
| `tls-fallback-renew` | monthly | renew the pre-issued Let's Encrypt wildcard for the Cloudflare DNS-only runbook (ADR 0012) |
| `analytics-rollup` | every 15 min + nightly 03:00 | incremental and full rollups (ADR 0016) |
| `partition-maintenance` | daily 02:00 | create next partitions, detach/drop expired (ADR 0016) |
| `spam-daily-summary` | daily 20:00 Africa/Algiers | held-orders summary per business (P4.S5); fans out one notification job per business, idempotent per (business, date) |
| `distribution-reclaim` | every 1 min | reclaim untouched orders (P4.S4) |
| `expenses-process-due` | daily 06:00 | recurring expenses with `next_due_at <= now()` (P6.S4); idempotent per (expense, period) |
| `ads-spend-import` | daily 05:00 | enqueue spend imports per connected ad account (P9.S4) |
| `offer-boundary-revalidate` | every 1 min | revalidate `offers:{storeId}` for offers starting/ending this minute |
| `quota-cycle` | hourly | subscription cycles, grace periods, unmask (P9.S1) |
| `retention-purge` | daily 04:00 | abandoned > 90 d, held spam > 30 d, PII retention |
| `read-model-consistency` | nightly | sample `cod_order` vs Vendure Order, alert on drift |
| `cleanSessionsTask` | default | Vendure built-in |

**Redis roles**:
- Launch: one self-run Valkey (in the compose stack on the Algerian VPS, ADR 0011) with `maxmemory-policy noeviction` (BullMQ requirement). Every non-queue key has a TTL. Memory alert at 70 %.
- Growth: split into `valkey-queue` (noeviction, persistence on) and `valkey-cache` (allkeys-lru, persistence off) for Vendure cache, Next cache handler, rate limits and host map.
- Redis is **not** a system of record. Durable intents go through the Postgres outbox and the durable job rows above (ADR 0016). Losing Redis loses queue state (waiting, delayed and retrying jobs), caches, rate-limit state and live counters; the sweeper re-enqueues un-relayed outbox rows and the `job-reconciler` re-enqueues everything else that has a durable row. (The earlier claim that "the sweeper re-enqueues in-flight work" was wrong: relayed rows are not `pending`, so the sweeper alone never recovers them.)
- Every container has a memory limit and a Node heap flag (infrastructure.md "Launch node budget"); the worker yields CPU to the api.

## Consequences

### Positive
- Atomic deploys, one artefact to scan and sign. Critical queues are isolated from bulk and LLM work.
- Fairness without BullMQ Pro. Health that actually checks dependencies.

### Negative
- The image is larger than necessary for each role.
- Semaphore re-delays add latency to heavy jobs under contention (by design).

### Risks
- **The scheduler lock lives in the DB.** Spike D ran it behind PgBouncer transaction mode with 2 workers: no tick ran twice. A task that runs longer than its interval skips the following ticks (`preventOverlap`), so every task here is catch-up by design and emits its last-success age.
- **Concurrent first boot on an empty database fails** (spike D: two processes both insert `__default_channel__`, unique violation). The `migrate` release job seeds the database before replicas start; P0.S2b's compose file starts `api`/`worker` only after `migrate` exits 0.
- **A misconfigured eviction policy at Launch** could drop BullMQ keys. Mitigation: noeviction enforced and asserted at boot (`CONFIG GET` or provider setting check; managed providers may block `CONFIG`, then check the provider setting via OpenTofu [BK]).
- **A full noeviction instance rejects writes**, including BullMQ enqueues. Mitigation: `valkey-memory-guard`, TTLs on every non-queue key, capped streams, the Growth split.
- **BullMQ on Valkey**: spike D ran `@vendure/job-queue-plugin` 3.8.1 with `bullmq` 5.81.5 on `valkey/valkey:8.1.11` (1 000 jobs, 0 failed). Re-check on each BullMQ major bump.
- Vendure's BullMQ plugin puts every Vendure queue into **one** BullMQ queue (`bull:vendure-job-queue`, job name = queue name). The critical/bulk pools above therefore rely on `activeQueues` per worker role, not on separate BullMQ queues; P0.S2b verifies that `activeQueues` filters correctly with this layout before the pools are split (Growth).

## Evidence

Spike D, 2026-11-07, P0.S2a-2: the same stack and scratch app as ADR 0016 Evidence (PgBouncer 1.26.1 in transaction mode, Valkey 8.1.11, `@vendure/job-queue-plugin` 3.8.1 with `bullmq` 5.81.5, Node 24.22.1), never committed. Topology: 1 `api` + 2 `worker` processes, all through PgBouncer `:6432`. Config: `BullMQJobQueuePlugin.init({ connection: { host, port: 6380, maxRetriesPerRequest: null } })` replacing `DefaultJobQueuePlugin`, `RedisCachePlugin.init({ redisOptions })`, `DefaultSchedulerPlugin`.

**Scheduler exactly-once.** Task `spike-d-tick`, schedule `*/10 * * * * *`, `preventOverlap: true`; each run inserts one row tagged with the worker's pid.

| Run | Window | Rows | Distinct 10-s slots | Duplicates | Gaps | Workers |
|---|---|---|---|---|---|---|
| Quiet Postgres, `TZ=UTC` | 14:27:42–14:32:42 UTC | **30** | 30 | **0** | avg 10.00 s, max 10.01 s | w1 13, w2 17 |
| During spike C's bulk load | 11:35:39–11:40:39 UTC | 16 | 16 | **0** | 10–25 s | w1 6, w2 10 |

- The losing worker logs `Task invocation of spike-d-tick … was blocked because an existing task is still running`, which shows the database lock working across processes.
- Under the bulk load, each tick's single `INSERT` took 8–10 s, so `preventOverlap` skipped the following tick. Ticks were skipped, never doubled. This is why every task in the Decision table is catch-up.
- `TZ`: with the host at `+01:00`, `scheduled_task_record.lastExecutedAt` was `12:43:13` while `updatedAt` was `11:43:13` (local time written into `timestamp(3) without time zone`). With `TZ=UTC` both read `14:32:40.01` (Decision, runtime environment).

**BullMQ.**
- 1 000 jobs enqueued from the API in 1 010 ms. Each job opens a transaction through PgBouncer, inserts, and reads its row back with the same `txid_current()`.
- Result: 1 000 rows, 1 000 distinct txids, both workers, `failed = 0`, default concurrency (3 per worker).
- Vendure's plugin stores everything in one BullMQ queue (`bull:vendure-job-queue:*`, job name = Vendure queue name). See the Risks entry on pools.

**Sessions.** `RedisCachePlugin` caches sessions in Valkey (`vendure-cache:vendure-session-cache:<sha256>`, TTL ≈ 24 h). Steady-state authed requests read no `session` rows (ADR 0016 Evidence item 4).

**First boot.** API and 2 workers started together on an empty, freshly migrated database:
- The API and worker 2 failed with `duplicate key value violates unique constraint "UQ_06127ac6c6d913f4320759971db"`: `Key (code)=(__default_channel__) already exists`.
- After one process had seeded the database, all three started cleanly.
- Hence the `migrate` role seeds before replicas start (Decision table).


## Addendum (2026-11-07): activeQueues with Vendure's BullMQ plugin

**Finding.** In `@vendure/job-queue-plugin` 3.8.1:
- `BullMQJobQueueStrategy` puts every Vendure queue into one BullMQ queue (`<prefix>:vendure-job-queue`), with the job name set to the Vendure queue name.
- A worker creates a BullMQ `Worker` on that queue as soon as any one of its queues starts.
- Its processor then looks up the job name among the queues **this** process started. For a job of a queue that `jobQueueOptions.activeQueues` excludes, it throws `No processor defined for the queue "<name>"`.

The job therefore **fails** and uses up an attempt. It is not left waiting for a worker of another pool.

**Evidence (P0.S2b-3, Task 10).** Run on 2026-11-07, `apps/server/tests/e2e/active-queues.e2e.test.ts` (`activeQueues: ['probe-critical']`, BullMQ 5.81.5 on Valkey 8.1.11). Written first as a plain test, the desired behaviour failed with:

```
FAIL  |e2e| tests/e2e/active-queues.e2e.test.ts > worker activeQueues with the BullMQ job queue > a worker leaves jobs of inactive queues for another pool
AssertionError: expected 'failed' to be 'waiting' // Object.is equality
```

With the desired-behaviour test marked `it.fails` and the limitation asserted (`state` `failed`, `failedReason` `No processor defined for the queue "probe-bulk"`), the Vitest output is:

```
✓ |e2e| tests/e2e/active-queues.e2e.test.ts > worker activeQueues with the BullMQ job queue > a worker processes jobs of its active queue 112ms
✓ |e2e| tests/e2e/active-queues.e2e.test.ts > worker activeQueues with the BullMQ job queue > a worker leaves jobs of inactive queues for another pool 3022ms
✓ |e2e| tests/e2e/active-queues.e2e.test.ts > worker activeQueues with the BullMQ job queue > known limitation: stock BullMQ strategy fails jobs of inactive queues 156ms
Tests  11 passed | 1 expected fail (12)
```

**Decision.**
1. **At Launch, every worker runs all queues.** `WORKER_ACTIVE_QUEUES` stays empty. The desired-behaviour test stays as `it.fails`, so an upstream fix shows up as a failing test.
2. **The critical/bulk pool split belongs to P1.S6** (queue registry). The options to evaluate:
   - (a) a `JobQueueStrategy` that gives each pool its own BullMQ queue;
   - (b) an upstream change that keeps jobs of inactive queues waiting;
   - (c) a separate Redis prefix per pool.

   The selection criteria: no lost or failed jobs, a working dashboard job list, and unchanged semaphore and priority rules.
3. **Until P1.S6, nothing may set `activeQueues`.** P1.S6 adds a boot assertion that fails fast when `WORKER_ACTIVE_QUEUES` is non-empty while the stock strategy is in use.

## Addendum (2026-11-10): queue registry and pools (P1.S6)

**Status**: Accepted (2026-11-10, standing user authorization for P1)

- `packages/shared/src/queues.ts` is the single registry of queue names with pool, concurrency per worker, total attempts and backoff. The taxonomy table above is its source; "retries" is read as total attempts.
- Added to the table: `outbox-relay` (critical), `platform-maintenance` (bulk), `auth-email` (critical, 5 attempts, exponential 30 s; closes D42) and the stock queues `apply-collection-filters`, `clean-sessions`, `update-search-index` (critical, one attempt).
- The pool split follows option (c) of the activeQueues addendum: one BullMQ prefix per pool (`WORKER_POOL=critical|bulk|all`, default `all`), replacing `WORKER_ACTIVE_QUEUES`. Reasoning and cost: `docs/roadmap/P1-decisions.md` (D96, D97, D98).
- Durable job ids are `ob-`, `od-`, `iw-`, `kek-` plus dash-joined parts, because BullMQ refuses integer ids and ids containing `:` (D99).


## Addendum (2026-11-10): Settled in P1.S6 (D97)

**Status**: Accepted (2026-11-10, standing user authorization for P1)

This settles the three items of the activeQueues addendum.

1. **Pools instead of `WORKER_ACTIVE_QUEUES`.** `WORKER_POOL=critical|bulk|all` (default `all`) sets a worker's `activeQueues` to the registry queues of its pool (`all` = every queue). Boot refuses a non-empty `WORKER_ACTIVE_QUEUES` ("replaced by WORKER_POOL"); an empty one is accepted so old `.env` files still boot. Compose keeps one worker with `all` at Launch.
2. **Option (c), one prefix per pool.** `PooledJobQueueStrategy` (plugin `platform-jobs`) routes each registry queue to one stock `BullMQJobQueueStrategy` per pool, each with its own prefix `bull:{APP_ENV}:{pool}` (queue and worker), options and job list index. A process starts workers only for its pools, so a job of another pool waits in its own BullMQ queue instead of failing (`apps/server/tests/e2e/worker-pools.e2e.test.ts`). Jobs leave the strategy with id `{pool}.{bullId}`; the Admin API lists and finds jobs of every pool. A queue outside the registry throws `UnregisteredQueueError` at `add` and `start`. The stock `clean-job-queue-index` task is replaced by one that cleans every pool's index. Jobs under the old prefix `bull:{APP_ENV}` are abandoned (pre-production; drain a dev worker before switching).
3. **Boot assertion.** `buildVendureConfig` throws when `activeQueues` is non-empty and the job queue strategy is not `PooledJobQueueStrategy`. The `it.fails` test of `active-queues.e2e.test.ts` keeps running on the stock strategy as the upstream signal.

Cost: deep imports into `@vendure/job-queue-plugin` (`bullmq-job-queue-strategy`, `constants`, `job-list-index.service`), which a plugin upgrade must re-check; M.S1 re-runs the pool e2e. Fallback: every worker `all`.
