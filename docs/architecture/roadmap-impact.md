# Roadmap impact (proposed edits; roadmap files NOT modified)

Status: proposal, 2026-11-07. Apply through a `docs/roadmap-architecture` PR per the plan mutation protocol (roadmap README). Each item gives the file, the location and the **exact text** to add or replace. "Replace" quotes the current text, followed by its replacement.

## 0. Summary

| # | File | Session | Change | Driver |
|---|---|---|---|---|
| 1 | README.md | — | "Base" paragraph, session table (+2 sessions, P0.S2a size), totals, shared contracts, credentials | ADR 0001, new sessions |
| 2 | CONTRIBUTING.md | — | Repository bullets | ADR 0001 |
| 3 | P0-setup.md | P0.S1 | clean repo on published packages, no upstream mirror | ADR 0001 |
| 4 | P0-setup.md | P0.S2a | +5 spikes (C–G), ADRs 0011–0016, start from drafts, size M → L | ADR 0002/0006/0011/0014/0016 |
| 5 | P0-setup.md | P0.S2b | readiness probe, BullMQ + RedisCache + scheduler, acceptance line on `packages/` | ADR 0001/0013 |
| 6 | P1-foundation.md | **new P1.S6** | platform plumbing: outbox, webhook gateway, queues, tenant secrets, flags, partitions | ADR 0013/0016 |
| 7 | P1-foundation.md | P1.S1 | host map in Redis + pub/sub | ADR 0006 |
| 8 | P3-storefront-checkout.md | P3.S2 | Next 16 specifics (proxy.ts rewrite, `'use cache'` with tenant param, shared handler, assetPrefix, same-origin API) | ADR 0006 |
| 9 | P3-storefront-checkout.md | P3.S4 | Turnstile, outbox, `cod_order` read model v1, depends on P1.S6 | ADR 0004/0009/0012/0016 |
| 10 | P3-storefront-checkout.md | **new P3.S5** | staging environment, IaC, images, deploy pipeline, observability baseline | ADR 0011/0012/0013/0015 |
| 11 | P4-order-ops.md | P4.S1, P4.S2 | maintain read model; list indexes, keyset pagination, counters | ADR 0009/0016 |
| 12 | P5-delivery.md | P5.S1, P5.S4, P5.S5 | async dispatch via queue; gateway; scheduler polling; tenant secrets | ADR 0013/0016 |
| 13 | P7-analytics-home.md | P7.S1 | rollups from outbox; replica routing | ADR 0016 |
| 14 | P8-builder-themes.md | P8.S9 | Cloudflare for SaaS replaces Caddy; apex rules; depends on P3.S5 | ADR 0012 |
| 15 | P9-saas-integrations.md | P9.S3, P9.S8a, P9.S8b | outbox-driven CAPI/webhooks; MCP OAuth 2.1 | ADR 0008/0016 |
| 16 | P10-hardening.md | P10.S2 | RLS spike, load targets from capacity math | ADR 0002, infrastructure.md |
| 17 | P10-hardening.md | P10.S3 | production only (staging exists), Cloudflare, Kamal, OpenTofu, approval-gate caveat | ADR 0011/0012/0013 |
| 18 | P10-hardening.md | M.S1 | bump pins instead of merging upstream tag | ADR 0001 |

---

## 1. `docs/roadmap/README.md`

**1a. "Base" paragraph (line 4).** Replace:
> **Base:** a private repository seeded from `vendurehq/vendure` with an `upstream` remote (GitHub does not allow a private fork of a public repo, so this is a private mirror) — TypeScript · NestJS · GraphQL · React dashboard. **Vendure core is never modified**; every feature lives in a plugin. Whether our workspace builds the upstream packages from source or consumes the published `@vendure/*` packages pinned to the upstream tag, and whether merchant screens are Vendure dashboard extensions or our own admin app, are decided in ADR 0001 / ADR 0010 (P0.S2a) before any code. Storefront + builder: our own Next.js app, multi-tenant by host. Postgres.

with:
> **Base:** a clean private repository whose workspace consumes the **published `@vendure/*` packages pinned to one exact version** (ADR 0001; Vendure source is read from a reference clone outside the repo) — TypeScript · NestJS · GraphQL · React dashboard. **Vendure core is never modified**; every feature lives in a plugin; an emergency fix is only possible as a reviewed `pnpm patch` (ADR 0001). Merchant screens: Vendure React dashboard extensions (ADR 0010, subject to spike A). Storefront + builder runtime: our own Next.js 16 app, multi-tenant by host (ADR 0006). Postgres 17, Valkey, Cloudflare; hosting per ADR 0011. Architecture: [../architecture/README.md](../architecture/README.md).

**1b. Session table.** Change the P0.S2a row's size `M` → `L`. Insert after the P1.S5 row:
```
| P1.S6 | Platform plumbing: outbox, webhook gateway, queues, secrets, flags | `feat/p1-s6-platform-plumbing` | P1.S1 | P1.S2, P1.S3, P1.S4, P1.S5 | O | L | |
```
Insert after the P3.S4 row:
```
| P3.S5 | Staging environment, IaC & observability baseline | `chore/p3-s5-staging` | P3.S2, P1.S6 | P2.*, P3.S3, P3.S4 | O | L | 🔑 DigitalOcean + Cloudflare accounts, staging domain |
```
Change the "Depends on" cells:
- P3.S4: `P3.S3` → `P3.S3, P1.S6`
- P5.S1: `P4.S1, P3.S1, P1.S4` → `P4.S1, P3.S1, P1.S4, P1.S6`
- P8.S9: `P3.S2` → `P3.S2, P3.S5`

**1c. Phases table.** P1 Sessions `5` → `6`; P3 Sessions `4` → `5`. Replace `**Total: 62 sessions + repeatable upstream sync.**` with `**Total: 64 sessions + repeatable upstream sync.**`

**1d. Dependency graph.** Add these lines inside the mermaid block:
```
  P1S1 --> P1S6[P1.S6 platform plumbing]
  P1S6 --> P3S4
  P1S6 --> P5S1
  P3S2 --> P3S5[P3.S5 staging + IaC]
  P1S6 --> P3S5
  P3S5 --> P8S9
```

**1e. Estimate.** Replace `- 62 sessions = 3 S + 25 M + 34 L ≈ **155–220 hours of agent work**` with `- 64 sessions = 3 S + 24 M + 37 L ≈ **165–235 hours of agent work**` (P0.S2a M→L, plus two L sessions).

**1f. Shared contracts table.** Append rows:
```
| `OutboxService.add(ctx, topic, payload)` (same-transaction), relay + sweeper, consumer job-id convention `{outboxId}:{consumer}` | P1.S6 | P3.S4, P4.S1, P5.*, P7.S3, P9.S3, P9.S8a, P9.S5, P9.S6 |
| Inbound webhook gateway `POST /webhooks/{provider}/{accountKey}` + `InboundWebhookHandler` registry (dedupe, enqueue) | P1.S6 | P5.S4–S7, P9.S2, P9.S5, P9.S6 |
| Queue names + pools (`packages/shared/src/queues.ts`), per-business semaphore helper, circuit-breaker helper | P1.S6 | every session that adds jobs |
| `TenantSecretService` (envelope encryption, write-only fields) | P1.S6 | P5.S1 carrier credentials, P9.S2–S6 tokens |
| `flags.isEnabled(ctx, key)` operational flags/kill switches | P1.S6 | P5.*, P9.* |
| Partition helper + `partition-maintenance` task | P1.S6 | P4.S1 (`order_event`), P5.S2 (`parcel_event`), P6.S1 (`stock_movement`), P3.S4 (`visitor_event`), P9.S3/S8a (delivery logs) |
| COD read model `cod_order` / `cod_order_item` / `order_counter` (same-transaction projection) | P3.S4 (create) → P4.S1 (transitions) → P4.S2 (indexes) | P4.*, P5.*, P7.S1, P9.S5 |
| `/readyz` + `/livez` (api, worker, storefront) | P0.S2b | P3.S5, P10.S3 |
| Deploy pipeline, `ROLE` image, Kamal config, OpenTofu modules | P3.S5 | P8.S9, P10.S3 |
```

**1g. Credentials table.** Append rows:
```
| P3.S4 | Cloudflare Turnstile site/secret key | Cloudflare's published Turnstile test keys (always-pass / always-fail) |
| P3.S5 | DigitalOcean account (FRA1), Cloudflare account with the root domain, GitHub environment secrets | — (session stops at a "needs you" checklist) |
```

## 2. `docs/roadmap/CONTRIBUTING.md` ("Repository" bullets, lines 4–5)

Replace the two bullets starting `A **private repository** under the GitHub account` and `Remotes:` with:
> - A **private repository** under the GitHub account **ChematWalid**, created clean (no upstream history). Our workspace consumes the published `@vendure/*` packages, all pinned to one exact version (ADR 0001). Read Vendure source from a reference clone at that version outside the repo, never from `node_modules` edits.
> - Remotes: `origin` only. There is no `upstream` remote. Upgrading Vendure = bumping the pins in an `M.S1` session.

Replace `- **Vendure core packages (`packages/*` from upstream) are never edited.**` with:
> - **Vendure core packages are never edited.** The only exception is a reviewed `pnpm patch` under `patches/` with a `vendure-patch` issue, an ADR addendum and a failing-without-patch test (ADR 0001).

## 3. `docs/roadmap/P0-setup.md`: P0.S1

- **Goal** cell. Replace `A private repository seeded from the latest `vendurehq/vendure` release under ChematWalid, with protected `main` …` with: `A clean private repository under ChematWalid (no upstream history), with protected `main` (or the documented fallback), CI skeleton incl. an attribution check, PR template, labels, milestones and one issue per roadmap session.`
- **GitHub facts** list. Delete the bullets on "private fork … private mirror", "Upstream Vendure ships its own `.github/workflows/*`" and "Upstream's default branch is `master`". Add: `- ADR 0001 (draft in docs/adr/drafts/) recommends published @vendure/* packages; this session therefore creates an empty repo. If the user rejects that in P0.S2a review, the mirror procedure is restored by a roadmap PR.`
- **Plan step 2.** Replace it entirely with: `2. Create the private repo: gh repo create ChematWalid/<repo-name> --private --add-readme; clone it; set the default branch to main. Record the latest stable Vendure version (npm view @vendure/core version) in the handoff for P0.S2a/P0.S2b → no commit (setup on GitHub only).`
- **Deliverables.** Replace `Private repo seeded from the upstream release tag, correct remotes, upstream workflows disabled;` with `Clean private repo, origin remote only, recorded Vendure version;`
- **Acceptance.** Replace the first two criteria with:
  - `- [ ] gh repo view --json isPrivate shows private; git remote -v shows origin only; the handoff records the pinned Vendure version.`
  - `- [ ] gh workflow list shows only our workflows.`

## 4. `docs/roadmap/P0-setup.md`: P0.S2a

- **Goal** cell. Replace `Ten ADRs that settle the base decisions (…)` with `Sixteen ADRs that settle the base decisions (repo layout, tenancy, ids, pricing→order totals, i18n, storefront, branding, auth, order lifecycle, dashboard host, hosting, edge/TLS, process model and queues, search, observability, data lifecycle), each backed where risky by a throw-away spike, merged before any scaffolding.`
- **Model / size**: `Opus · M` → `Opus · L`.
- **Read first**: add `- docs/architecture/README.md, system-design.md, infrastructure.md and the drafts in docs/adr/drafts/ (start from them: verify, edit with spike evidence, move to docs/adr/NNNN-*.md).`
- **High-level plan**: insert before step 5:
```
4b. Scale and infra spikes (scratch folder, never committed; each recorded in the gated ADR with versions, commands and numbers) → commit `docs(adr): 0011–0016 with spike results`
   - Spike C, channels at scale (ADR 0002): seed 5,000 channels × 50 products × 3 variants (all also in the default channel), 1,000 customers per channel, 5 M orders (Pareto across channels) with SQL generators; measure p95 of channel resolution (cold/warm), product list/detail by channel, order list per channel, admin login with roles on 5 channels, channel-cache memory per API process, create-channel time and locks. Pass: catalog and order list < 150 ms p95 cold at the DB, channel cache < 200 MB, create-channel < 2 s without blocking locks. Record the fallback decision if any fail.
   - Spike D, PgBouncer transaction mode (ADR 0016): run the Vendure e2e smoke, DefaultSchedulerPlugin locking with 2 workers, BullMQ jobs that open DB transactions, RedisCachePlugin sessions, a TypeORM migration, and a SET LOCAL helper through PgBouncer (docker image, transaction mode, version recorded incl. max_prepared_statements); pass/fail per item; decide transaction vs session mode.
   - Spike E, Arabic search (ADR 0014): 300 product names (Arabic with/without diacritics and hamza variants, French, Latin-script Darija) in 3 stores, 60 queries with expected hits; compare DefaultSearchPlugin, the Postgres normalisation + pg_trgm approach, and Meilisearch locally; record recall@5, MRR, p95; accept Phase 1 if recall@5 ≥ 0.85 and within 0.1 of Meilisearch.
   - Spike F, Next.js shared cache handler (ADR 0006): two `next start` instances (Next 16, cacheComponents) behind a local proxy and one Redis; prove cross-instance 'use cache' hits, revalidateTag propagation < 1 s, tenant param in cache keys, rolling restart with a new deploymentId plus assetPrefix serving old chunks, Redis size for 1,000 product pages, Cloudflare stores a tenant page with the TTL from Cloudflare-CDN-Cache-Control (staging zone), two URLs differing only by fbclid share one edge entry on the plan we will buy, /_t/<other store> on a store host returns 404; pick the handler.
   - Spike G, latency (ADR 0011, may finish before P10.S3): RTT from Algerian mobile and fixed networks to DigitalOcean FRA1 and Scaleway fr-par (Globalping/RIPE Atlas probes or volunteer devices); apply the ADR 0011 gate.
```
- **Step 5**: replace `docs/adr/README.md index + a "Decisions that change later briefs" section` with `docs/adr/README.md index + a "Decisions that change later briefs" section (start from docs/architecture/roadmap-impact.md)`.
- **Deliverables**: replace `docs/adr/0001…0010-*.md` with `docs/adr/0001…0016-*.md`.
- **Acceptance**: replace `- [ ] Ten ADRs each state …` with `- [ ] Sixteen ADRs each state context, options considered, decision and consequences; ADR 0002 names the exact entities/fields and the isolation mechanism that P1.S1 must implement.` Add:
  - `- [ ] Spikes C–F are recorded with numbers and a pass/fail against the thresholds in this brief; every failed threshold has an explicit fallback decision in its ADR.`
  - `- [ ] ADR 0001's recommendation (published packages) is confirmed or rejected by the user in the PR review; if rejected, the PR lists the roadmap edits to restore the mirror procedure.`

## 5. `docs/roadmap/P0-setup.md`: P0.S2b

- **Plan step 2**: replace `apps/server boots Vendure (admin API, BullMQ job queue on Redis, zero-tax zone + DZD default channel per ADR 0004)` with `apps/server boots Vendure with separate api / worker / migrate entry points (ADR 0013), BullMQJobQueuePlugin, RedisCachePlugin, DefaultSchedulerPlugin, HardenPlugin, systemOptions.healthChecks: [], a platform-health plugin exposing /livez and /readyz (Postgres, Redis, pending migrations), zero-tax zone + DZD default channel per ADR 0004`.
- **Plan step 4**: replace `middleware resolves store by host` with `proxy.ts (Next 16) resolves store by host and rewrites to /_t/[storeId]/...`.
- **Acceptance**: replace `git diff <upstream tag> -- packages/ is empty (no edit to upstream packages).` with `every @vendure/* dependency is pinned to the same exact version and patches/ is empty (ADR 0001).` Add: `- [ ] GET /readyz on api and the worker health port returns 503 when Postgres or Redis is stopped and 200 when both are up.`

## 6. `docs/roadmap/P1-foundation.md`: new session P1.S6 (insert after P1.S5)

```markdown
## P1.S6 — Platform plumbing: outbox, webhook gateway, queues, secrets, flags

| Field | Value |
|---|---|
| **Goal** | Shared infrastructure plugins every later session reuses: transactional outbox with relay and sweeper, idempotent inbound webhook gateway, queue registry with pools, per-business semaphore and circuit breaker helpers, envelope-encrypted tenant secrets, operational feature flags, and partition maintenance. |
| **Branch** | `feat/p1-s6-platform-plumbing` |
| **GitHub issue** | `P1.S6 Platform plumbing: outbox, webhook gateway, queues, secrets, flags` (label `phase-1`, milestone `P1 Foundation`) |
| **Prerequisites** | P1.S1 merged. |
| **Parallel-safe** | Yes, with P1.S2, P1.S3, P1.S4, P1.S5. Owns `plugins/platform-outbox/**`, `plugins/platform-webhooks/**`, `plugins/platform-secrets/**`, `plugins/platform-flags/**`, `plugins/platform-partitions/**`, `packages/shared/src/queues.ts`, `packages/shared/src/outbox/**`. |
| **Model / size** | Opus · L |
| **External needs** | None. |

**Inventory rows covered:** none directly (foundation for carriers, CAPI, webhooks, integrations).

**Read first**
- `docs/roadmap/CONTRIBUTING.md`; handoffs `P1.S1.md`, `P0.S2b.md`; `docs/adr/` 0002, 0013, 0016 (outbox, gateway, partitioning, pooling outcome of spike D).
- `docs/architecture/system-design.md` §2.3, §2.5, §5, §7 (tenant secrets).

**High-level plan**
1. Queue registry and pools in `packages/shared/src/queues.ts` (names, priorities, retries/backoff, pool membership), worker `activeQueues` from env `WORKER_POOL=critical|bulk|all`, `withBusinessSemaphore()` and `withCircuitBreaker()` helpers on Valkey → commit `feat(platform): queue registry, pools, semaphore and breaker helpers`
2. `outbox_event` + `outbox_delivery` (daily partitions, no global unique key), `OutboxService.add(ctx, …)` requiring an active transaction, afterCommit relay to BullMQ with `jobId = outbox.id`, consumer registry with `{outboxId}:{consumer}` job ids and consumer-owned terminal states, `outbox-sweeper` (pending > 60 s) and `job-reconciler` (non-terminal durable rows past SLA, same jobId) scheduled tasks, metrics `outbox_pending`/`outbox_oldest_age_seconds`/`scheduler_task_last_success_age_seconds` → commit `feat(platform-outbox): transactional outbox with relay, sweeper and reconciler`
3. Inbound webhook gateway `POST /webhooks/:provider/:accountKey` with `InboundWebhookHandler` registry (`resolveAccount`, `verify`, `eventKey`, `process`), 256 KB cap, non-partitioned dedupe table `inbound_webhook_key` (PK `(provider, account_id, event_key)`, 30-day batched purge) + `inbound_webhook` payload table (daily partitions, `status`), enqueue to `inbound-webhooks`, 200 within 100 ms; plus `InternalOnlyGuard` for `/shop-api`, `/store/*`, `/_internal/*` (internal HMAC over method, path, timestamp, store/IP/country headers and body hash) → commit `feat(platform-webhooks): idempotent inbound gateway and internal-only guard`
4. `TenantSecretService`: AES-256-GCM envelope encryption (per-business DEK wrapped by versioned KEK from env), write-only GraphQL input type, "last 4" display, KEK rotation job → commit `feat(platform-secrets): envelope-encrypted tenant secrets`
5. `feature_flag` entity (platform/plan/business/store scope, rollout %), Valkey cache + pub/sub invalidation, `flags.isEnabled(ctx, key)`, staff-only GraphQL to toggle; seed kill switches → commit `feat(platform-flags): operational flags and kill switches`
6. Partition helper (create table … partition by range, create next N partitions, detach/drop by retention policy) + `partition-maintenance` scheduled task; tests with time travel → commit `feat(platform-partitions): native partition maintenance`

**Deliverables:** the five plugins, shared queue/outbox types, migrations, scheduled tasks, docs section in ADR 0016 "as implemented".

**Acceptance criteria**
- [ ] An outbox row written in a transaction that rolls back is never relayed; one committed while the relay is killed (simulated crash) is enqueued by the sweeper within 2 min; a consumer runs once per row even if the relay runs twice.
- [ ] The same webhook body posted 5 times concurrently, and once more the next day, creates 1 `inbound_webhook` row and 1 processing job; an invalid signature returns 401 and enqueues nothing; p95 response < 100 ms in the integration test.
- [ ] Flushing Valkey (`FLUSHALL`) with jobs waiting, delayed and retrying: within 10 min the reconciler has re-enqueued every non-terminal outbox delivery and inbound webhook, and each consumer still runs exactly once in effect (idempotency checks).
- [ ] `/shop-api`, `/store/*` and `/_internal/*` return 403/404 on every host without the internal HMAC; a signed request with a modified `x-store-id` or body is rejected.
- [ ] A schema test fails if a unique index on a partitioned table does not include the partition key.
- [ ] A secret written for business A cannot be read by business B (not found), is never returned by any query, and survives KEK rotation.
- [ ] `withBusinessSemaphore` limits a business to N concurrent jobs while other businesses proceed; the breaker opens after 5 failures in 2 min and half-opens after 60 s.
- [ ] Partition maintenance creates future partitions and drops expired ones per policy; inserting a row for a date without a partition fails loudly in tests (not silently into a default partition).

**Verification**
- Unit + integration (Vendure test server, Postgres, Valkey). Browser check: staff flags screen only. Multi-tenant: two-business tests for secrets, flags, outbox payload `businessId`, gateway account resolution.

**Out of scope:** real carrier/payment handlers (P5, P9), CAPI/webhook consumers (P9.S3, P9.S8a), staging deployment (P3.S5).
```
(Kickoff prompt and "Ends with" lines per the template, with `P1-foundation.md`, `P1.S6` and the branch above.)

## 7. `docs/roadmap/P1-foundation.md`: P1.S1

**Plan step 3**: replace `Host→store resolver service (platform-domain subdomain, custom-domain table stub for P8.S9) with LRU cache + invalidation` with `Host→store resolver service (platform-domain subdomain, custom-domain table stub for P8.S9) with in-process LRU (60 s) + Valkey host map (host:{host}) + pub/sub invalidation on subdomain/domain change (ADR 0006)`.

## 8. `docs/roadmap/P3-storefront-checkout.md`: P3.S2

- **Read first**: add `- docs/adr/0006-* (storefront) and docs/architecture/system-design.md §2.1, §3`.
- **Plan step 1**: replace `Per-request store context on top of the host resolver that P1.S1 already wired into the storefront middleware` with `Per-request store context on top of the host resolver that P1.S1 already wired into proxy.ts: proxy.ts rewrites to the internal route /_t/[storeId]/[locale]/… so the tenant is a route param (never read headers()/cookies() in page renders)`.
- **Add plan step 7**: `7. Caching per ADR 0006: cacheComponents with 'use cache' + cacheTag('store:'+id, 'product:'+id, 'theme:'+id, 'offers:'+storeId) + cacheLife; the shared Redis cacheHandlers/cacheHandler chosen in spike F (cacheMaxMemorySize: 0); deploymentId = generateBuildId = GIT_SHA; constant NEXT_SERVER_ACTIONS_ENCRYPTION_KEY; assetPrefix https://cdn.<root>/sf; Cloudflare-CDN-Cache-Control max-age=60, stale-while-revalidate=600 on tenant pages (no-store while an A/B test is active); proxy.ts 404s incoming /_t and /_internal paths; product/landing/home routes never read searchParams; internal POST /_internal/revalidate (HMAC); same-origin /api/store/* route handlers proxying to the internal API with the resolved store injected; custom next/image loader for preset widths → commit feat(storefront): shared cache, revalidation and same-origin store api`.
- **Acceptance**: add:
  - `- [ ] Two storefront instances share one Redis: a page cached via instance A is a cache hit on B; revalidateTag('store:<id>') from either instance refreshes both within 1 s.`
  - `- [ ] A test fails if any module under app/_t/ calls cookies() or headers(); tenant pages emit Cloudflare-CDN-Cache-Control with max-age and no Set-Cookie; GET <storeA host>/_t/<storeB id>/ returns 404.`
  - `- [ ] Browser calls to /api/store/* never carry a client-supplied storeId that is trusted; a mismatching storeId is rejected.`

## 9. `docs/roadmap/P3-storefront-checkout.md`: P3.S4

- **Prerequisites**: `P3.S3 merged` → `P3.S3 and P1.S6 merged`.
- **Plan step 2**: append `; browsers reach these endpoints only as same-origin /api/store/orders and /api/store/abandoned on the store host (the P3.S2 proxy route handlers inject the host-resolved store); the API routes /business/:bid/orders/public and …/abandoned-checkouts/public are internal-only (HMAC) per ADR 0006/0012, and a body businessId/storeId that differs from the injected store is rejected`.
- **Plan step 3**: append `; in the same transaction insert the cod_order / cod_order_item read-model rows and bump order_counter (ADR 0009 §8), and write outbox order.placed via OutboxService (ADR 0016)`.
- **Plan step 4**: replace `emit OrderPlaced after commit` with `emit OrderPlaced through the outbox (same transaction), never as a fire-and-forget after commit`.
- **Plan step 6**: append `; Cloudflare Turnstile on submit verified server-side with a 1.5 s timeout; failure/timeout is passed to SpamGate as TURNSTILE_FAILED/TURNSTILE_UNAVAILABLE (never a hard reject); quote replay key quote:used:<hash> (SET NX, 1 h) plus unique cod_order.quote_hash; intake rate limits per (store, IP), (store, device) and 300/min per store (above it: hold, never drop)`.
- **Acceptance**: add:
  - `- [ ] Killing the process after commit but before enqueue still produces exactly one OrderPlaced consumer run (outbox sweeper).`
  - `- [ ] With Turnstile's always-fail test key the order is held with reason TURNSTILE_FAILED, not rejected.`
  - `- [ ] A quote mismatch between the token and a fresh recompute creates the order at the token's prices and increments pricing_quote_mismatch_total.`

## 10. `docs/roadmap/P3-storefront-checkout.md`: new session P3.S5 (insert after P3.S4)

```markdown
## P3.S5 — Staging environment, IaC & observability baseline

| Field | Value |
|---|---|
| **Goal** | A persistent staging environment on the chosen provider, built reproducibly (OpenTofu + Kamal), with the single role-based image, migrations as a release job, Cloudflare edge (wildcard subdomains, WAF, Turnstile, R2), and the observability baseline, so carriers, Cloudflare for SaaS and payment sandboxes can call a public URL. |
| **Branch** | `chore/p3-s5-staging` |
| **GitHub issue** | `P3.S5 Staging environment, IaC & observability baseline` (label `phase-3`, milestone `P3 Storefront & COD checkout`) |
| **Prerequisites** | P3.S2 and P1.S6 merged. |
| **Parallel-safe** | Yes, with P2.*, P3.S3, P3.S4. Owns `Dockerfile`, `.dockerignore`, `infra/**`, `deploy/**`, `.github/workflows/deploy-staging.yml`, `docs/ops/**`, `otel/**`. |
| **Model / size** | Opus · L |
| **External needs** | 🔑 DigitalOcean account (FRA1), Cloudflare account with the root domain, GitHub environment secrets. Until provided: everything runs locally (docker compose + `kamal` against a local VM or skipped), and the session stops at a "needs you" checklist. |

**Inventory rows covered:** none (infrastructure).

**Read first**
- `docs/roadmap/CONTRIBUTING.md`; handoffs `P0.S2b.md`, `P1.S6.md`, `P3.S2.md`; `docs/adr/` 0011, 0012, 0013, 0015.
- `docs/architecture/infrastructure.md` §1.1, §2, §5.1; `docs/architecture/system-design.md` §3, §8, §9.

**High-level plan**
1. Multi-stage Dockerfile producing one non-root image with `ROLE=api|worker|storefront|migrate`, graceful SIGTERM handling, OTel preload; CI job builds and pushes `ghcr.io/<org>/platform:<sha>`, uploads `.next/static` to R2 `sf/`, runs Trivy and SBOM → commit `chore(deploy): role-based image and build pipeline`
2. OpenTofu modules (`infra/modules/{network,compute,lb,postgres,valkey,cloudflare,r2}`) and `infra/envs/staging`: VPC, droplet, LB with Cloudflare-only firewall, managed or containerised PG/Valkey per ADR 0011 staging spec, Cloudflare DNS (`*.staging.<root>`, `app.`/`api.`), cache rule (query string ignored on product/landing/home paths, edge TTL from `Cloudflare-CDN-Cache-Control`), WAF rule blocking `/store/*`, `/shop-api*`, `/_internal/*`, `/_t/*` on **every** host, Bot Fight Mode off, CGNAT-safe rate-limit rule, Turnstile widget, R2 buckets `assets-prod` (public) and `private-prod`; state in R2 → commit `chore(infra): opentofu staging environment`
3. Kamal 2 config (`deploy/staging.yml`): roles api/worker/storefront on the host with memory limits and heap flags (infrastructure.md "Launch node budget"), kamal-proxy host rules (app/api/api.internal → api, default → storefront), pre-deploy hook running the `migrate` role (`kamal app exec --version`), per-container health checks and the node-level `/api/readyz` for the LB, `backup` accessory, secrets from GitHub environment; record measured RSS per role → commit `chore(deploy): kamal staging deploy with migrate hook`
4. `deploy-staging.yml`: on merge to main → build → migrate → rolling deploy → Playwright smoke + k6 smoke (synthetic test store) → warm-up of top pages; failure → `kamal rollback` → commit `ci(deploy): staging pipeline with smoke and rollback`
5. Observability baseline: OTel Collector container, Grafana Cloud stack (Free), Sentry projects, Cloudflare Web Analytics, uptime checks on `/readyz`, one storefront page and intake; dashboards "Is buying working?" and "Queues"; first alerts (5xx rate, readyz down, outbox lag, webhook backlog, Valkey memory) → commit `chore(ops): observability baseline and first alerts`
6. Runbook `docs/ops/runbook.md` (deploy, rollback, migrate, restore from PITR into staging, Cloudflare DNS-only fallback) and chaos checks (stop Valkey; stop worker; kill PG connection) with observed behaviour → commit `docs(ops): staging runbook and chaos results`

**Deliverables:** Dockerfile, CI image job, `infra/` modules + staging env, `deploy/` Kamal config, staging pipeline, observability config, runbook, "needs you" checklist.

**Acceptance criteria**
- [ ] `tofu plan` on a clean checkout shows no drift after apply; destroying and re-applying staging reproduces it with no manual console steps (except account/domain creation).
- [ ] `https://demo.staging.<root>` serves the storefront over valid TLS through Cloudflare; `api.staging.<root>/store/*` returns 403 at the edge; `app.staging.<root>` serves the dashboard login.
- [ ] A merge to main deploys staging with zero failed requests during rollout (k6 constant load during deploy shows no 5xx) and runs migrations before rollout.
- [ ] Stopping the worker triggers the queue/outbox alert within 10 min; stopping Valkey keeps cached storefront pages serving and the intake path degrades as documented; stopping Postgres with `intake.spool.enabled` turns submits into 202s that are replayed exactly once when it returns.
- [ ] Two requests to the same product URL with different `fbclid` values: the second is an edge HIT (`cf-cache-status`).
- [ ] No secret in the repo, image layers or logs (secret scan + `docker history` check).

**Verification:** pipeline run evidence, k6 output, alert screenshots in the PR; multi-tenant: two seeded stores on two staging subdomains never serve each other's catalog; host-header spoof returns 404.

**Out of scope:** production (P10.S3), custom domains (P8.S9), autoscaling/Kubernetes (Scale tier).
```
(Kickoff prompt and "Ends with" lines per the template.)

## 11. `docs/roadmap/P4-order-ops.md`

**P4.S1 plan**: add the step `Maintain the cod_order read model and order_counter in the same transaction as every transition; write timeline rows to the partitioned order_event table (P1.S6 partition helper); outbox event per transition (ADR 0009/0016) → commit feat(order-states): read model, timeline partitions and outbox events`. **Acceptance**: add `- [ ] A nightly read-model consistency check over 10k seeded orders reports 0 drift after a randomised transition run.`

**P4.S2 plan**: add the step `Index set from ADR 0016 §4 via CONCURRENTLY migrations; keyset pagination (created_at desc, id desc); tab counts from order_counter; every filter validated with EXPLAIN (ANALYZE, BUFFERS) on a 5 M-order seed (results in the PR) → commit perf(orders-list): indexes, keyset pagination and counters`. **Acceptance**: add `- [ ] Every list filter combination in the brief returns page 1 in < 300 ms p95 on the 5 M-order seed; tab counts do not use COUNT(*).`

## 12. `docs/roadmap/P5-delivery.md`

**P5.S1**:
- Plan step 2: replace `(encrypted credentials, …)` with `(credentials stored via TenantSecretService from P1.S6, …)`.
- Plan step 5: append `; dispatch executes asynchronously on the dispatch queue (jobId = parcelId, per-carrier-account token bucket and circuit breaker from P1.S6); POST /orders/dispatch returns {dispatchBatchId, preflightFailures} and GET /orders/dispatch/:batchId returns per-order results with the full taxonomy (UI polls every 1 s)`.
- Acceptance: add `- [ ] Dispatching 100 orders returns within 1 s with a batch id; a carrier outage opens the breaker and leaves orders in Confirmed with a "carrier unavailable" reason, not lost.`

**P5.S4 (Yalidine)**: Plan step 3, replace `Webhook endpoint for parcel_status_updated with secret/signature verification, replay-safe; status mapping to normalized statuses` with `InboundWebhookHandler for parcel_status_updated registered on the P1.S6 gateway (/webhooks/yalidine/:accountKey; verify the webhook secret, eventKey = carrier event id or body hash), processed by the shared applyParcelEvent; status mapping to normalized statuses`. Deliverables: replace `webhook route` with `gateway handler`. Acceptance: add `- [ ] Replaying the same webhook 5 times yields one parcel_event; an older event after a newer one is ignored.`

**P5.S5 (Ecotrack)**: Plan step 3, replace `Polling BullMQ job: batches parcels due by nextCheckAt` with `Polling via the carrier-poll-tick scheduled task (every 5 min) enqueuing per-account batches on carrier-polling; poll results converted to the same normalised event and applied by the shared applyParcelEvent`.

## 13. `docs/roadmap/P7-analytics-home.md`: P7.S1

Plan step 2: replace `refreshed by a BullMQ job and on OrderStatusChanged/ParcelStatusChanged` with `upserted incrementally by the analytics queue from outbox events and recomputed nightly for the last 3 days by the analytics-rollup scheduled task; heavy report queries use the read-replica repository when DATABASE_REPLICA_URL is set (ADR 0016 §7)`.

## 14. `docs/roadmap/P8-builder-themes.md`: P8.S9

- **Prerequisites**: `P3.S2` → `P3.S2, P3.S5`.
- **Parallel-safe**: replace `and deploy/caddy/** (edge config + docs)` with `and deploy/cloudflare/** (custom-hostname client + docs)`.
- **External needs**: replace `A staging domain with wildcard DNS and a public server for TLS tests` with `The staging environment from P3.S5 and a Cloudflare API token scoped to custom hostnames on the staging zone`.
- **Plan step 1**: replace `on-demand TLS with Caddy and an ask endpoint that only approves verified, enabled domains` with `Cloudflare for SaaS custom hostnames per ADR 0012 (CNAME to stores.<root>, Cloudflare DCV + our _verify TXT ownership check, apex via CNAME flattening/ALIAS or registrar forwarding to www); record the decision as an addendum to ADR 0012 rather than a new ADR`.
- **Plan step 3**: replace `BullMQ check job with TXT/CNAME lookups` with `domains-queue job polling the Cloudflare custom hostname status and our TXT record`.
- **Plan step 6**: replace the whole step with `6. Cloudflare client (create/delete custom hostname, read status, purge by hostname) behind an interface with a mock; staging run: connect a real test domain end to end; runbook deploy/cloudflare/README.md → commit feat(domains): cloudflare for saas integration`.
- **Acceptance**: replace `- [ ] The ask endpoint approves only verified, enabled domains, rejects unknown hosts and requires the shared secret.` with `- [ ] A custom hostname is created at Cloudflare only after the domain passes our ownership TXT check; disabling a domain removes routing immediately and deletes the Cloudflare hostname after 7 days.`

## 15. `docs/roadmap/P9-saas-integrations.md`

- **P9.S3**, plan step 3: replace `Server dispatcher subscribed to OrderPlaced, OrderConfirmed, OrderDelivered, OrderReturned` with `capi-queue consumer registered on the P1.S6 outbox for order.placed, order.confirmed, order.delivered, order.returned`. Replace `BullMQ retries` with `12 retries over 24 h then DLQ; invalid token marks the pixel unhealthy`.
- **P9.S8a**, plan step 3: replace `from domain events … BullMQ retries with backoff` with `from outbox events (consumer outbound-webhooks, webhook-id = outbox id), signed X-Signature: t=<unix>,v1=<HMAC-SHA256(secret, t.body)> with 5 min tolerance and dual-secret rotation, 12 retries over 24 h`.
- **P9.S8b**: add the read-first item `docs/adr/0008-* (MCP OAuth 2.1: authorization code + PKCE, dynamic client registration, protected resource metadata; verify the current MCP authorization spec revision)` and the acceptance criterion `- [ ] An MCP client completes OAuth (PKCE) against the consent screen, receives a 1 h access token bound to one business, and a revoked grant fails the next tool call.`

## 16. `docs/roadmap/P10-hardening.md`: P10.S2

- Plan step 1: append `; run the RLS spike from ADR 0002 on cod_order, tenant_secret, customer_profile, activity_log (SET LOCAL app.business_id in the repository helper) and record overhead; adopt if < 5 % p95`.
- Plan step 7: replace `default p95 < 500 ms at 50 rps on the staging-size stack` with `targets from docs/architecture/infrastructure.md §3 for the Growth tier spike: 140 rps quotes (p95 < 250 ms), 18 rps intake (p95 < 600 ms), 63 rps storefront origin HTML, 113 rps dashboard list queries (p95 < 500 ms) on a 5 M-order seed; storefront traffic generated through Cloudflare with a unique fbclid per virtual user (edge hit ratio ≥ 85 %), and intake traffic from a small set of IPs to prove CGNAT-shared buyers are held, not rejected`.
- Acceptance: update the matching line with these numbers.

## 17. `docs/roadmap/P10-hardening.md`: P10.S3

- **Goal**: replace with `Deploy production from the P3.S5 pipeline and modules (OpenTofu env prod, Kamal deploy/prod.yml) with Cloudflare for SaaS custom domains, backups and a restore drill, monitoring, and a gated release workflow.`
- **External needs**: replace with `🔑 production DigitalOcean resources (FRA1, or Scaleway fr-par if the ADR 0011 latency gate chose it), production root domain on Cloudflare, Cloudflare for SaaS enabled, GitHub environment secrets.`
- **Plan steps 1–3**: replace with `1. infra/envs/prod via the P3.S5 modules (managed PG 17 with PITR, Valkey noeviction, LB, Cloudflare zone rules, R2) → commit chore(infra): production environment` and `2. Cloudflare: wildcard *.<root>, app/api/cdn hosts, fallback origin and stores.<root> CNAME target for custom hostnames (ADR 0012), WAF/rate-limit rules → commit feat(deploy): production edge and custom hostnames`.
- **Plan step 7**: replace `production via workflow_dispatch with required manual approval (environment protection)` with `production via workflow_dispatch restricted to maintainers and a production environment limited to main (required reviewers on private repos need GitHub Enterprise [verify]); Kamal lock; post-deploy smoke and warm-up`.
- **Acceptance**: replace `- [ ] A custom domain verified in the dashboard obtains a certificate on first request; an unverified domain is refused a certificate.` with `- [ ] A custom domain verified in the dashboard is active at Cloudflare and served over HTTPS; an unverified domain is never created at Cloudflare and returns 404 by host.` Add: `- [ ] Nightly pg_dump to R2 exists and a PITR restore into staging passes the E2E smoke (evidence).`

## 18. `docs/roadmap/P10-hardening.md`: M.S1

- **Goal**: replace `without touching core (per the ADR 0001 procedure)` with `by bumping all @vendure/* pins to the new exact version (ADR 0001 procedure)`.
- **Plan step 1**: replace `git fetch upstream --tags` with `npm view @vendure/core versions`.
- **Plan step 2**: replace the whole step with `2. Bump every @vendure/* dependency to the same exact version in one commit, pnpm install, re-apply or drop each patches/ entry (each needs re-validation), npx vendure migrate --generate vendure-<version> and review the core migration → commit chore(upstream): vendure <version>`.
- **Acceptance**: replace `- [ ] git diff <new tag> --stat -- packages/ is empty …` and `- [ ] gh workflow list shows no enabled upstream workflow.` with `- [ ] All @vendure/* pins equal <version>; patches/ entries are re-validated or removed with their issues closed; OTel attribute names re-checked (telemetry plugin).`
