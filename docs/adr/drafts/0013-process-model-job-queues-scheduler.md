# ADR-0013: Process model, job queues and scheduler

**Date**: 2026-11-07
**Status**: Proposed (new)
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
| `migrate` | `runMigrations()` once per release, then exit | — | release job |

If the image grows beyond 1.2 GB, split into two build targets from the same Dockerfile and tag (`platform-server`, `platform-storefront`), with the same SHA so they still deploy atomically.

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
- Launch: one DO Managed Valkey with `maxmemory-policy noeviction` (BullMQ requirement). Every non-queue key has a TTL. Memory alert at 70 %.
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
- **The scheduler lock lives in the DB, so it must be tested behind PgBouncer** (spike D).
- **A misconfigured eviction policy at Launch** could drop BullMQ keys. Mitigation: noeviction enforced and asserted at boot (`CONFIG GET` or provider setting check; managed providers may block `CONFIG`, then check the provider setting via OpenTofu [BK]).
- **A full noeviction instance rejects writes**, including BullMQ enqueues. Mitigation: `valkey-memory-guard`, TTLs on every non-queue key, capped streams, the Growth split.
- **BullMQ on Valkey** (rather than Redis) is assumed compatible [BK, verify the BullMQ version's supported servers in P0.S2b].
