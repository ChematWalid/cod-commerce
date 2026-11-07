# ADR-0015: Observability

**Date**: 2026-11-07
**Status**: Accepted (2026-11-07), approved by the user after P0.S2a-3 review; pending items stay listed as follow-ups
**Deciders**: architect (draft), user

## Context

- `@vendure/telemetry-plugin` (OpenTelemetry) exists since 3.3. The SDK must be preloaded with `--require`. v3.7 switched to stable semantic conventions (renamed attributes), and custom `instrumentations` replace the defaults rather than merging with them [VN §11, https://docs.vendure.io/current/core/how-to/telemetry.md].
- Grafana Cloud Free: ~10 k active series, 50 GB logs, 50 GB traces, 3 users, 14-day retention. Pro from $19 + usage. Sentry Developer: free, 1 user, 5 k errors. Team: $26/mo (50 k errors) [EH §9].
- A small team needs alerts on business failures (dispatch failures, webhook backlog, quote mismatches, spam spikes), not only on CPU.

## Options

1. **Self-hosted Prometheus/Loki/Tempo/Grafana**: no fees, but it is a stateful stack to operate. Rejected before Scale.
2. **Datadog / New Relic**: excellent, but per-host and ingest pricing breaks the Launch budget. Rejected.
3. **OpenTelemetry everywhere → OTel Collector → Grafana Cloud (metrics/logs/traces) + Sentry (errors) + Cloudflare Web Analytics (RUM) (recommended).** It is vendor-neutral, so the backend can be swapped by changing the Collector config.

## Decision

- **Instrumentation**:
  - API and worker: `@vendure/telemetry-plugin`, OTel Node SDK preloaded (`node --require ./otel.js`). Version-pinned config, re-checked in every M.S1 because of the 3.7 attribute rename [VN §11].
  - Storefront: Next.js OTel (`instrumentation.ts`).
  - Logs: pino JSON with redaction (system-design §7), trace ids attached.
- **Collector**: an OTel Collector (contrib) container per node (Launch/Growth) or DaemonSet (Scale), with a `memory_limiter` (150 MB at Launch). It does tail sampling (keep all errors and slow traces over 1 s, 10 % of the rest at Launch, 2–5 % at Growth, 2 % at Scale), batching, and drops high-cardinality attributes, `url.query` and SQL parameters before export. **Visitor track/beacon requests are never traced** (they are ~55 % of Launch requests) and are logged as per-minute aggregates only. Without this policy, unsampled traces would be ≈ 125 GB/month at Launch against the 50 GB free tier (budget in infrastructure.md §5.1).
- **Backends**:
  - Grafana Cloud Free (Launch) → Pro at Growth. Stack created in an **EU region**.
  - Sentry (`@sentry/nestjs`, `@sentry/nextjs`, dashboard React SDK): Developer at Launch (5 k errors, 1 user: SDK-side rate limiting and spike protection on; Team as soon as a second engineer joins or merchants pay), Team at Growth. EU data region. PII scrubbing on; buyer phone/name never sent.
  - Cloudflare Web Analytics for storefront Core Web Vitals by country (free).
  - Uptime: Grafana Synthetic Monitoring or a free external pinger on `/readyz`, a storefront page and order intake (synthetic test store). **Pending: the tool is picked in P3.S5** (staging exists then).
  - **Database**: `pg_stat_statements` enabled on every environment. Dashboards and the slow-query report read it; spike C showed it gives exact per-request DB time, including Vendure's N+1 patterns, without any app change. Whether DO Managed PG exposes it is checked with ADR 0011's provider facts (P3.S5).
- **Cardinality rule** (keeps us within ~10 k series):
  - Metric labels never include `businessId`, `storeId`, `orderId`, phone or host.
  - Allowed labels: `queue`, `carrier_system`, `provider`, `reason` (bounded enum), `route` (templated), `status_class`, `role`.
  - Per-tenant views come from SQL (rollups, read model) and from logs/traces, which carry tenant ids as attributes.
- **Golden signals per role**: request rate, errors, p50/p95/p99 latency per templated route; event-loop lag; heap; DB pool in-use/waiting; Redis ops/latency; per-queue waiting/active/failed/delayed and **oldest-waiting-job age**. Vendure's BullMQ plugin keeps all Vendure queues in one BullMQ queue (ADR 0013 Evidence), so per-queue gauges are computed per job **name**, not per BullMQ queue.
- **Health**: Vendure's `/health` answers ok without checking dependencies (since 3.6), so probes and uptime checks use our `/readyz` and `/livez` (ADR 0013), never `/health`.
- **Business metrics** (counters/gauges emitted by plugins):
  - `orders_intake_total{result=accepted|held|rejected|quote_mismatch|rate_limited}`
  - `pricing_quote_mismatch_total`, `quote_latency_seconds`
  - `spam_held_total{reason}`
  - `dispatch_attempts_total{carrier_system,result,reason}`
  - `inbound_webhooks_total{provider,result}`, `inbound_webhook_backlog`
  - `outbox_pending`, `outbox_oldest_age_seconds`
  - `capi_events_total{platform,result}`
  - `carrier_poll_lag_seconds{carrier_system}`
  - `llm_requests_total{feature,result}`, `llm_tokens_total{direction}`
  - `custom_domain_verifications_total{result}`
  - `storefront_cache_hit_ratio{layer}`
  - `scheduler_task_last_success_age_seconds{task}`, `job_reconciler_requeued_total{queue}`, `intake_spool_length`
- **Alerts** (Grafana Alerting → email + Telegram/Slack webhook; on-call = founder rotation). Two levels, because a 1–2 person team cannot be woken for everything: **page** (Telegram with sound, 24/7) only for "buyers cannot order" and "the system has stopped working on its own" (intake failing or silent, intake spool non-empty, scheduler stalled, fast SLO burn, Valkey > 80 %, DB storage > 90 %); webhook backlog and outbox lag page only 08:00–23:00. Everything else **notifies** (read during working hours). The full table with levels is in system-design §8.
  - Symptom alerts on SLO burn rates (system-design §10): fast burn pages, slow burn notifies.
  - Business alerts: dispatch failure ratio above 20 % for 15 min per carrier system; webhook backlog older than 5 min; outbox oldest older than 5 min; `scheduler_task_last_success_age_seconds` above 3 intervals for `outbox-sweeper`, `job-reconciler`, `carrier-poll-tick`; quote mismatches above 1 % of intakes per hour; spam holds above 3× the 7-day baseline per hour (platform-wide; per-tenant spikes surface in the daily report); intake accepted = 0 for 30 min during 08:00–23:00 Africa/Algiers (armed once the baseline exceeds 50 orders/hour, to avoid early false pages); LLM error rate above 10 %; platform LLM spend above 80 % of the monthly budget.
  - Infrastructure alerts: DB CPU over 80 % for 10 min, DB storage over 75 %, connections over 80 %, replica lag over 30 s, Redis memory over 60 % (cache writes off) and 80 %, droplet memory over 80 %, disk, nightly backup missing.
- **Dashboards** (built from operator questions): "Is buying working?" (intake, quote, storefront latency, cache hit), "Are parcels moving?" (dispatch, polling lag, webhook backlog per carrier), "Queues" (depth and age per queue, DLQ), "Data tier".

## Consequences

### Positive
- Launch observability costs $0. Signals are vendor-neutral. Business failures page us before merchants do.

### Negative
- Grafana Free keeps 14 days, so incident forensics beyond that need logs exported to R2 (a daily job for audit-relevant logs).

### Risks
- **Series explosion from a careless label.** Mitigation: the Collector drops banned attributes, and CI lints metric definitions.

## Evidence

No dedicated spike. These P0.S2a findings shaped the Decision:

| Finding | Source | Effect here |
|---|---|---|
| A scheduled task slower than its interval skips ticks (`preventOverlap`); under DB load the 10 s task ran every 10–25 s | ADR 0013 Evidence (spike D) | `scheduler_task_last_success_age_seconds` alert at 3 intervals stays the right signal; a skipped tick is not an error |
| `pg_stat_statements` deltas gave exact per-request DB time (e.g. 65–76 statements for a 20-product Admin API list) | ADR 0002 Evidence (spike C) | enabled everywhere; slow-query and N+1 reports read it |
| One BullMQ queue for all Vendure queues | ADR 0013 Evidence (spike D) | queue gauges grouped by job name |
| `lastExecutedAt` written in local time unless `TZ=UTC` | ADR 0013 Evidence (spike D) | all dashboards and alerts assume UTC timestamps; business views convert to Africa/Algiers |
| A single-product intake burst queues on Vendure's stock-row lock | ADR 0009 addendum | `orders_intake` latency is broken down by phase (quote, stock allocation, commit) in P3.S4 traces |
