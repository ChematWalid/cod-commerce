# Architecture: multi-tenant COD commerce SaaS for Algeria

Status: **proposed** (architecture pass, 2026-11-07). It is input to roadmap session P0.S2a, which runs the spikes and turns the drafts in `../adr/drafts/` into accepted ADRs. Product name and root domain are placeholders ("Platform", `ourdomain`). The reference product's name, logo and theme names are never used (ADR 0007).

## Assumptions (stated explicitly)

| # | Assumption |
|---|---|
| A1 | **Scale tiers**: Launch ≈ 100 stores / 5k orders/day; Growth ≈ 1,000 stores / 50k orders/day; Scale ≈ 5,000 stores / 200k orders/day. |
| A2 | Storefront traffic comes from ads and **spikes 10× for minutes**. Design point: 10× the peak-hour rate (peak hour = 10 % of daily orders) for ≤ 15 min. |
| A3 | Buyers are mostly **mobile in Algeria**, so latency matters. Origin in an EU region close to Algeria (Paris/Frankfurt), plus Cloudflare's edge, which has an Algiers PoP [EH §3]. |
| A4 | **MVP budget < ~$150/month** for production + staging infrastructure. Pass-through costs (WhatsApp, SMS, LLM tokens, payment fees) are billed to merchants and excluded. |
| A5 | **Small team**: managed services preferred; **no self-run Kubernetes before the Scale tier**. |
| A6 | Traffic shape per order: 30 storefront HTML views, 10 quote calls, 1.3 intake submits, 75 visitor/beacon writes, 6 CAPI events, 8 carrier status events per dispatched parcel (60 % dispatched). Dashboard: 1.5 concurrent users per business at peak, 0.1 rps each. These are planning numbers; P10.S2 measures the real ones. |
| A7 | Base: Vendure 3.8 (NestJS, GraphQL, TypeORM) with every feature as a plugin and core never modified, plus our own Next.js 16 storefront/builder [VN; roadmap README]. |
| A8 | All prices are **estimates as of 2026-11-07**, in USD, excluding VAT, and must be re-verified at provisioning. |

**Citation keys used in every architecture document**:
- [VN §n] = [research/vendure-v3.md](research/vendure-v3.md);
- [EH §n] = [research/edge-hosting-costs.md](research/edge-hosting-costs.md);
- [DM] = `../research/data-model.md`, [API] = `../research/api-surface.md`;
- [V] verified official page, [3P] third-party figure, [?] gap in the notes;
- **[BK] background knowledge not in the notes: verify before relying on it** (list below).

## Executive summary

We build on **published, exactly pinned `@vendure/*` 3.8 packages in a clean private repo**, not on a source mirror (ADR 0001). Core is never edited, so building from source buys nothing. The published path keeps CI fast and upgrades a version bump, and `pnpm patch` is a reviewed escape hatch. This changes roadmap session P0.S1.

**Tenancy** is Vendure's documented model: Channel per Store, Seller per Business, a `Business` entity, `businessId` on every custom table, and a fail-closed tenant guard + repository helper. RLS comes later, on our own high-risk tables, at Growth. Vendure's behaviour with thousands of channels is undocumented, so a **load-test spike (5,000 channels, 5 M orders) gates ADR 0002**. A fallback is already designed: dashboard lists and the storefront read our own `businessId`-keyed read models, not channel joins (ADR 0002, 0009).

**Runtime**: one container image with four roles (`api`, `worker`, `storefront`, `migrate`). Vendure server and worker run separately with `BullMQJobQueuePlugin`, `RedisCachePlugin` and `DefaultSchedulerPlugin` (workers only). Queues are split into a critical and a bulk pool, with per-business semaphores for fairness. Our own `/readyz` checks Postgres and Redis, because Vendure's `/health` no longer does (ADR 0013).

**Side effects are durable**: a transactional **outbox** in Postgres feeds CAPI, outbound webhooks, notifications, integrations and analytics. Every carrier, payment and platform webhook enters one **idempotent gateway** (dedupe on a non-partitioned key table). Redis is never a system of record: every job whose loss matters has a durable Postgres row, and a `job-reconciler` re-enqueues them after a Valkey loss (ADR 0013, 0016).

**Internal surfaces stay internal**: the Vendure Shop API, our `/store/*` and `/_internal/*` are rejected by the api role on every host unless they carry the internal HMAC (which binds store, client IP and body), and only our intake service can create a COD order (ADR 0008, 0009).

**Orders**: the signed quote token is a 15-minute price commitment. Its prices become Vendure totals through `OrderItemPriceCalculationStrategy`, a shipping calculator and one system promotion (ADR 0004). COD states extend Vendure's default process (Pending, Confirmed, Scheduled, Returned). Dispatch is a Fulfillment, and payment settles on delivery. Merchant statuses are data. A `cod_order` read model, written in the same transaction, serves every list and filter (ADR 0009).

**Storefront**: self-hosted **Next.js 16**.
- `proxy.ts` resolves host → store and rewrites to `/_t/[storeId]/...`, so the tenant is a route parameter in every `'use cache'` key.
- HTML is buyer-agnostic and cached at the Cloudflare edge (60 s plus stale-while-revalidate, via `Cloudflare-CDN-Cache-Control`) and in a shared Redis cache handler. The edge cache key ignores the query string on product/landing/home paths, because every ad click carries a unique `fbclid`/`ttclid`; without that, ad spikes would bypass the edge entirely.
- A/B-tested pages are served `no-store` at the edge and split in `proxy.ts` by a sticky cookie.
- Publish triggers `revalidateTag` plus a purge by hostname.
- Static chunks are served from R2 for skew-free rolling deploys.
- Image presets are generated at upload.
- Browser calls to the API are same-origin and proxied (ADR 0006).

**Edge**: Cloudflare in front of everything (DNS, CDN, WAF, Turnstile on order submit with fail-open into the spam engine; Bot Fight Mode off at Launch because it cannot be scoped on Free; CGNAT-safe per-IP limits). **Cloudflare for SaaS** handles custom domains (100 free, then $0.10/hostname/month), replacing the Caddy on-demand TLS plan. Apex domains use CNAME flattening or forwarding to `www` (ADR 0012).

**Hosting**: **DigitalOcean FRA1** for Launch and Growth. It has the most verified prices and offers managed Postgres (PITR, standby, read-only nodes, PgBouncer pools) and Valkey. Kamal 2 deploys containers to droplets with zero downtime, and DOKS (managed Kubernetes) is the Scale path. **Scaleway Paris** replaces it if a measured latency gate (≥ 25 ms better p50 from Algerian networks) passes within budget (ADR 0011).

**Estimated costs** (estimates, 2026-11-07): Launch ≈ **$133–140/month** (2 × 2 vCPU/4 GB droplets with an explicit per-container memory budget), Growth ≈ **$970/month**, Scale ≈ **$5,000–8,000/month** (infrastructure.md). WhatsApp, SMS and LLM costs are pass-through only because they are prepaid and metered per business.

**Search** starts in Postgres (Arabic/French normalisation + `pg_trgm`), with Meilisearch on measured triggers (ADR 0014). **Analytics** uses rollups, then a read replica, then ClickHouse at Scale. **Observability** is OpenTelemetry → Grafana Cloud Free + Sentry, with business alerts on dispatch failures, webhook backlog, outbox lag, quote mismatches and spam spikes (ADR 0015).

**SLOs**: storefront 99.9 %, intake 99.9 % at Launch (single PG node; an intake spool in Valkey turns a PG outage into delayed orders) and 99.95 % from Growth, quote p95 < 250 ms. RPO ≤ 5 min / RTO ≤ 2 h at Launch, improving to RTO ≤ 5 min with a standby at Growth. Single points of failure and the accepted risks are listed per component in system-design §10.

## Key decisions

| Decision | Choice | ADR |
|---|---|---|
| Repo and Vendure consumption | Clean private repo, published `@vendure/*` exact pins, pnpm workspaces, `pnpm patch` escape hatch; P0.S1 changes | [0001](../adr/drafts/0001-repo-layout-and-upstream.md) |
| Tenancy | Channel per Store, Seller per Business, `businessId` everywhere, fail-closed guard; RLS at Growth; channels load-test gate | [0002](../adr/drafts/0002-tenancy.md) |
| Pricing and order totals | Own `PricingService` on a cached snapshot; HMAC quote token honoured as a commitment; strategies force Vendure totals | [0004](../adr/drafts/0004-pricing-engine-and-order-totals.md) |
| Storefront | Next.js 16 standalone, `proxy.ts` rewrite with tenant param, buyer-agnostic cached HTML, shared Redis cache handler, same-origin store API | [0006](../adr/drafts/0006-storefront-architecture.md) |
| Auth | Vendure sessions for humans (+ TOTP for staff); hashed scoped API keys; MCP OAuth 2.1; signed webhooks; internal HMAC | [0008](../adr/drafts/0008-auth.md) |
| COD order lifecycle | Extend the default process (Pending/Confirmed/Scheduled/Returned); dispatch = Fulfillment; settle on delivery; `cod_order` read model | [0009](../adr/drafts/0009-order-lifecycle.md) |
| Merchant dashboard | Vendure React dashboard extensions on `app.ourdomain`; unauthenticated flows in Next.js; own admin app as fallback | [0010](../adr/drafts/0010-merchant-dashboard-host.md) |
| Hosting and regions | DigitalOcean FRA1 (Launch/Growth), DOKS at Scale; Scaleway Paris under a latency gate; data-tier gate at Scale | [0011](../adr/drafts/0011-hosting-and-regions.md) |
| Edge, TLS, custom domains | Cloudflare everywhere; Cloudflare for SaaS custom hostnames; Origin CA; Turnstile fail-open | [0012](../adr/drafts/0012-edge-tls-custom-domains.md) |
| Process model, queues, scheduler | One image, roles; BullMQ pools; semaphores; durable job rows + `job-reconciler`; catch-up scheduler tasks on workers; `/readyz` | [0013](../adr/drafts/0013-process-model-job-queues-scheduler.md) |
| Search | Postgres normalisation + trigram first; Meilisearch on triggers | [0014](../adr/drafts/0014-search.md) |
| Observability | OTel → Grafana Cloud + Sentry + Cloudflare RUM; no tenant labels; business alerts | [0015](../adr/drafts/0015-observability.md) |
| Data lifecycle | Outbox + per-consumer delivery rows, idempotent webhook gateway (non-partitioned dedupe key table), native partitioning + retention, list indexes, expand/contract migrations (M.S1 exception), pooling rule | [0016](../adr/drafts/0016-data-lifecycle-outbox-partitioning.md) |

ADRs 0003 (ids), 0005 (i18n) and 0007 (branding) are written by P0.S2a and have no architecture-level change here. 0003 should keep snowflake-style bigint ids for our tables, since 0016 relies on time-ordered ids for keyset pagination.

## Documents and diagram index

| Document | Contents |
|---|---|
| [system-design.md](system-design.md) | §1 C4 context + container diagrams; §2 sequence diagrams; §3 edge/LB; §4 scaling + per-tenant limits; §5 data; §6 integrations; §7 security; §8 observability; §9 environments/delivery; §10 reliability |
| [tech-stack.md](tech-stack.md) | One table per layer: choice, version policy, why, rejected alternatives |
| [infrastructure.md](infrastructure.md) | Topology per tier, LB details, capacity math, scaling triggers, cost tables, migration path |
| [roadmap-impact.md](roadmap-impact.md) | Exact proposed edits to roadmap files (2 new sessions, 5 new spikes, changed briefs) |
| [../adr/drafts/](../adr/drafts/README.md) | 13 ADR drafts (0001, 0002, 0004, 0006, 0008–0016) |

| Diagram | Where |
|---|---|
| C4 system context | system-design §1.1 |
| C4 containers | system-design §1.2 |
| Storefront page view (edge hit / origin miss) | system-design §2.1 |
| Cart quote → order intake (signed quote, spam, abandoned) | system-design §2.2 |
| Carrier webhook ingestion | system-design §2.3 |
| Carrier polling job | system-design §2.4 |
| CAPI server events via outbox | system-design §2.5 |
| Dashboard confirm → dispatch | system-design §2.6 |
| Delivery pipeline | system-design §9 |
| Launch / Growth / Scale topology | infrastructure §1.1–1.3 |

## Facts to verify (marked [BK])

1. DigitalOcean Managed PG: exact plan prices above the $15.15 entry, standby and read-only node pricing, built-in PgBouncer pool modes and version, PITR window, available extensions (`pg_trgm`, `btree_gin`, `unaccent`), cross-region read-only nodes.
2. DO Managed Valkey prices above 1 GB and a configurable `maxmemory-policy` (must be `noeviction` for BullMQ).
3. Cloudflare: purge-by-hostname on Free/Pro; apex proxying for custom hostnames being Enterprise-only; Turnstile free limits; the ~100 s proxied origin-response limit (SSE heartbeats).
4. GitHub: environment "required reviewers" on private repos requiring Enterprise (affects the production approval gate).
5. Node 24 LTS support in Vendure 3.8; Postgres 17/18 support in Vendure CI.
6. Kamal 2 / kamal-proxy: default-host (catch-all) routing for wildcard and custom hostnames; OpenTofu S3-backend native locking on R2.
7. Algerian Law 18-07 (personal data; ANPDP) obligations for hosting buyer data outside Algeria.
8. Cloudflare Free/Pro: Bot Fight Mode being zone-wide and not skippable; cache-key "ignore query string" in Cache Rules (else Page Rule or Worker); honouring `Cloudflare-CDN-Cache-Control` and `stale-while-revalidate`; rate-limit rule period and counting on Free; purge API rate limits.
9. R2: no S3 object versioning; bucket locks; that an R2 custom domain exposes the whole bucket.
10. BullMQ (version shipped with `@vendure/job-queue-plugin` 3.8) on Valkey 8; DO Valkey persistence and standby options; DO PG connection limits per plan.
11. Vendure: customer lookup by email across channels (drives the business-scoped synthetic email); the scheduler's behaviour for missed ticks; whether the Shop API can be unmounted rather than guarded.
12. Kamal 2: `kamal app exec --version` for the migrate hook; whether non-proxied roles overlap old and new containers during deploy (memory budget).
13. Typical RSS of a Vendure 3.8 api/worker with ~20 plugins and of a Next 16 standalone server (Launch node budget).
14. Algerian mobile CGNAT prevalence (per-IP limit sizing), via RUM on staging.

## Open questions for the user

1. **Confirm ADR 0001** (published packages, clean repo): this changes P0.S1, CONTRIBUTING and M.S1 (roadmap-impact.md §1–3, §18).
2. **Data protection / residency**: are you prepared to get legal advice on Law 18-07 (declaration/authorisation for processing Algerian buyers' data on EU servers, and for the sub-processors listed in system-design §7)? If local hosting is mandatory, ADR 0011 changes. This is an open question, not legal advice.
3. **Legal entities and payment rails**: Chargily/SlickPay need an Algerian entity, and Stripe needs a supported-country entity. Which entities exist or are planned? Can you pay a foreign cloud provider (card/FX) from the entity that will own the infrastructure?
4. **Provider account**: OK to open DigitalOcean (FRA1) and Cloudflare accounts, or do you prefer Scaleway (EUR billing, Paris) even before the latency gate?
5. **Launch HA**: accept a single-node Postgres at Launch (RTO ≈ 2 h on node loss, intake spooled meanwhile, ~$133–140/month), or pay ~$30/month more for a standby from day one?
6. **Root domain**: `.com` or `.dz` (`.dz` registration requires a local entity [BK])? And must merchant **apex** domains work at launch, or is "connect `www`/`shop.`" acceptable initially?
7. **GitHub plan**: Free, Pro or Team? This decides branch protection (P0.S1) and the production approval mechanism.
8. **LLM data**: OK to send business data (with buyer PII masked) to the Claude API, under Anthropic's commercial terms?
9. **SMS**: confirm SMS is not needed at launch (WhatsApp + email + in-app only, SMS as a paid add-on later).
10. **Roadmap changes**: approve adding P1.S6 (platform plumbing) and P3.S5 (staging + IaC) and growing P0.S2a to size L (+2 sessions, +~10–15 agent hours).
11. **GPL and the dashboard bundle**: will counsel confirm whether our dashboard extensions, compiled into one bundle with GPLv3 `@vendure/dashboard` and sent to merchants' browsers, may stay proprietary (ADR 0001 §8)? A "no" favours ADR 0010 Option 2.
12. **WhatsApp account model**: does each merchant connect their own WhatsApp Business account (Meta bills them), or does the platform send from its own (we pay Meta and must resell prepaid message credit)?

## Review log

Adversarial review, 2026-11-07, in four roles: Architect (structure and boundaries), Operator (can 1–2 people run it), Tuner (capacity and cost), Skeptic (failure modes, security, tenant isolation). Every fix is applied in the files named. "Accepted" means the risk stays, is stated where it applies, and has a mitigation or trigger. Facts the fixes rely on but the notes do not verify are marked [BK] and listed in "Facts to verify" (items 8–14).

| # | Severity | Role | Finding | Status / where |
|---|---|---|---|---|
| 1 | Critical | Skeptic | The Vendure Shop API, `/store/*` and `/_internal/*` were blocked only on `api.ourdomain`. `app.ourdomain` (and any `Host` forged from another Cloudflare zone pointed at the LB) reaches the same api container, so anyone could create COD orders through the Shop API, bypassing quote, Turnstile, spam and rate limits. | Fixed: `InternalOnlyGuard` in the api role on every host, a WAF rule on all hosts, COD payment eligibility limited to our intake. system-design §3, §7; ADR 0008, 0009 §11, 0012; P1.S6 |
| 2 | Critical | Tuner | Every ad click appends a unique `fbclid`/`ttclid`/`gclid`. Because the Cloudflare cache key includes the query string, ad traffic would miss the edge entirely and the 10× spike would hit the origin (≈ 417 rps HTML at the Growth spike, ~5 extra cores). | Fixed: query string ignored in the cache key on product/landing/home paths, no server-side `searchParams` there, click ids read client-side; spike F (g) and the P3.S5 and P10.S2 acceptance tests. system-design §2.1; ADR 0006, 0012; infrastructure §3 |
| 3 | Critical | Skeptic | "Losing Redis loses only in-flight work and the sweeper re-enqueues it" was false. Relayed outbox rows, CAPI retry chains, inbound-webhook jobs, dispatch, assets, exports and AI jobs live only in BullMQ. | Fixed: durable job rows (`outbox_delivery`, `inbound_webhook.status`, …), consumer-owned terminal states, and a `job-reconciler` every 5 min. ADR 0013, 0016; system-design §10; P1.S6 acceptance (FLUSHALL test) |
| 4 | Critical | Architect | `ON CONFLICT (provider, account_id, event_key)` on the daily-partitioned `inbound_webhook`, and a unique `dedupe_key` on the partitioned outbox, cannot exist in Postgres: unique constraints must include the partition key. Webhook dedupe would silently fail across partitions. | Fixed: non-partitioned `inbound_webhook_key` (30-day purge), no global unique key on the outbox, a schema test. ADR 0016 §1–3; system-design §2.3; P1.S6 |
| 5 | Major | Skeptic | The synthetic guest email `<phone>@buyers.invalid` makes Vendure reuse one `Customer` across businesses, so business B could see and edit names and addresses that business A also uses. | Fixed: business-scoped synthetic email, two-business test. ADR 0009 §7, ADR 0002 4b, system-design §7 |
| 6 | Major | Skeptic | `storeA.host/_t/<storeB>/…` would render store B (even a disabled one) under A's host and be cached at the edge. | Fixed: `proxy.ts` 404s incoming `/_t`/`/_internal` paths, plus an edge block and a test. ADR 0006 §2; system-design §2.1, §7 |
| 7 | Major | Skeptic | The internal HMAC covered only method, path and timestamp, so `x-store-id`, client IP and body were not bound. The Cloudflare-IP allow-list was treated as authentication. | Fixed: HMAC binds headers and body hash, with a 60 s skew. ADR 0008, 0012; system-design §7 |
| 8 | Major | Skeptic | A single R2 bucket with a public custom domain exposes every key, so `private/exports` (buyer PII) and backups were publicly addressable. | Fixed: separate `assets-prod` (public) and `private-prod` buckets, a prefix lint, 1 h presigned URLs. system-design §1.3, §5; tech-stack; ADR 0012 |
| 9 | Major | Skeptic / Operator | "Bot Fight Mode except `/api/store/*`" cannot be configured on Free: Bot Fight Mode is zone-wide [BK]. It would challenge carrier and payment webhooks, public-API and MCP clients. | Fixed: off at Launch, Super Bot Fight Mode with skip rules at Pro. ADR 0012; system-design §3; tech-stack |
| 10 | Major | Tuner / Skeptic | Per-IP limits (20/min at the edge, 10/min per store and IP) would lock out buyers behind Algerian mobile CGNAT during ad spikes. | Fixed: abuse-level IP limits, device-based buyer limits, excess becomes a hold and never a 429. system-design §3–4; ADR 0008, 0012 |
| 11 | Major | Architect | A/B traffic split (feature-inventory §7) was impossible with HTML cached per (host, path). | Fixed: `no-store` at the edge for tested pages, sticky cookie and variant rewrite in `proxy.ts`, plan cap. system-design §2.1; ADR 0006 |
| 12 | Major | Operator | The intake SLO of 99.95 % contradicted the accepted Launch RTO of 2 h on a single PG node. There was no inventory of single points of failure. | Fixed: Launch intake SLO 99.9 %, intake spool degraded mode, SPOF table per component. system-design §2.2, §10 |
| 13 | Major | Tuner | The Next page cache shares the noeviction Valkey with BullMQ. Its "300 MB cap" had no enforcement, so a full instance would reject queue writes. | Fixed: memory guard (writes off at 60 %), gzip, 6 h TTL, split trigger. ADR 0006, 0013; system-design §5; infrastructure §3–4 |
| 14 | Major | Tuner / Operator | The Launch node (2 vCPU/4 GB with 5 containers) had no memory budget, and PDF labels via headless Chromium would not fit. | Fixed: per-container limits and heap flags (≈ 1.9 GB steady, ≈ 2.4 GB during a swap), swap, `pdf-lib` only, sharp concurrency 1, worker-droplet trigger. Sizing kept, to be measured in P3.S5. infrastructure §1.1, §4; ADR 0013; tech-stack |
| 15 | Major | Tuner | Unsampled traces ≈ 125 GB/month at Launch against Grafana Free's 50 GB. Sentry Developer has 5 k errors and 1 user. | Fixed: beacons never traced, tail sampling, a volume budget, EU regions, Sentry spike protection and the upgrade point. ADR 0015; infrastructure §5.1 |
| 16 | Major | Tuner / Skeptic | LLM credits were committed "on success", so aborted SSE streams were free. WhatsApp/SMS were "pass-through" without metering (≈ $7 k/month exposure at Growth). | Fixed: reserve/commit of actual tokens (including aborts), caps, a platform spend alert, prepaid message balance; open question 12. system-design §4, §6; infrastructure §5.1 |
| 17 | Major | Operator | Missed scheduler ticks were not recovered and a dead worker fleet was not detected (daily 20:00 summary, 06:00 expenses, sweeper). | Fixed: catch-up task semantics, `scheduler_task_last_success_age_seconds` page. ADR 0013, 0015; system-design §8, §10 |
| 18 | Major | Operator | Vendure core migrations (M.S1) are not expand/contract, so a rolling deploy can break the old image. | Fixed: staging old-image check, otherwise a short maintenance window with the intake spool. system-design §9; ADR 0016 §5 |
| 19 | Major | Operator | Backups: R2 has no object versioning [BK]; 12 monthly dumps contradicted the 30-day PII purge; a nightly `pg_dump` does not scale to Growth; the restore-drill target did not fit. | Fixed: soft delete + bucket lock, 14 daily + 3 monthly dumps, an erasure ledger replayed after restore, weekly dumps from the read-only node at Growth, a temporary cluster for drills, key escrow. system-design §5, §10 |
| 20 | Major | Operator | The LB health check `/readyz` carries no store host, so kamal-proxy would route it to the storefront default route, not the api. | Fixed: node-level `/api/readyz` (storefront + local api). infrastructure §2; system-design §1.3, §3; ADR 0006 §12, 0012 |
| 21 | Major | Architect | Features from feature-inventory were not covered: bulk label PDFs, xlsx streaming, catalog feeds, app id-token, `CF-IPCountry` for "network abroad", quota masking at every egress, the dashboard real-time model, scheduled ads import. | Fixed. system-design §3, §6, §7; ADR 0008, 0009 §10, 0013 |
| 22 | Major | Skeptic (legal) | The GPL status of the compiled dashboard bundle sent to browsers, and the Law 18-07 sub-processor list, were missing. | Added as open questions (not legal advice): open questions 2 and 11; ADR 0001 §8, 0010; system-design §7 |
| 23 | Minor | Tuner | ADR 0004 used 8 quotes per order (111/444 rps) against 10 in infrastructure (139/556). | Fixed: ADR 0004 |
| 24 | Minor | Architect | The sweeper threshold was 30 s in ADR 0016 and 2 min in ADR 0013. | Fixed: 60 s in both |
| 25 | Minor | Tuner | The Growth heading said $950 against a $960 sum, and R2 omitted backups. Launch email (15 k/month) was inconsistent with 15 k notifications/day unless email is opt-in. | Fixed: Growth ≈ $966, R2 lines include dumps, email assumption stated. infrastructure §5 |
| 26 | Minor | Skeptic | Outbox partition drop could delete undelivered events. | Fixed: drop guarded. ADR 0016 |
| 27 | Minor | Operator | Alerts had no page/notify levels, and intake-silence would false-alarm at low volume. | Fixed. system-design §8; ADR 0015 |
| 28 | Minor | Operator | The DNS-only fallback needed a pre-issued certificate and does not cover a Cloudflare DNS outage. | Fixed (pre-issued wildcard) / accepted (DNS outage). ADR 0012 |
| 29 | Minor | Operator | The Kamal pre-deploy hook runs on the CI runner; GitHub Environment secrets depend on the plan; the KEK had no escrow. | Fixed. system-design §9; tech-stack |
| 30 | Minor | Tuner | Visitor beacons were written to Postgres per request (104 rps at the Launch spike). | Fixed: Valkey stream + 30 s batch flush. system-design §5; ADR 0013 |
| 31 | Minor | Tuner | The intake DB load (Vendure order creation, ~100–200 statements [BK]) was not quantified. | Fixed: infrastructure §3 notes |
| 32 | Minor | Operator | IaC scope at Launch was not bounded. | Fixed: Grafana/Sentry/GitHub settings by hand until Growth. system-design §9 |
| 33 | Minor | Architect | Mermaid check: C4Context/C4Container use valid Mermaid C4 statements (`Person`, `System_Ext`, `System_Boundary {}`, `ContainerDb_Ext`, `Rel`, `UpdateLayoutConfig`); sequence and flowchart labels contain no unquoted special characters; arrows are valid. | No change; accepted that Mermaid C4 is experimental in some renderers |
| 34 | Accepted | Operator | Single-node PG at Launch (RTO ≤ 2 h). | Accepted: intake spool; standby trigger (+~$30); open question 5 |
| 35 | Accepted | Skeptic | Single Valkey node; loss of ≤ 30 s of visitor events and live counters. | Accepted: reconciler covers jobs |
| 36 | Accepted | Operator | Cloudflare vendor concentration (DNS, CDN, TLS, R2, custom hostnames); single DO LB node; single region FRA1. | Accepted: runbooks; LB 2 nodes at Growth; region RTO ≤ 8 h |
| 37 | Accepted | Operator | Regional disaster RPO at Growth up to 7 days (weekly dumps) until the cross-region node at Scale. | Accepted; revisit for the first enterprise customer |

**Launch after review**: Cloudflare Free (DNS, CDN with a click-id-proof cache key, WAF, Turnstile, custom hostnames, R2 `assets-prod` + `private-prod`) → DO LB (1 node, node-level health check) → 2 × DO 2 vCPU/4 GB droplets, each running kamal-proxy + api + storefront + worker + otel-collector with memory limits (backup accessory on node 2) → DO Managed PostgreSQL 17 1 vCPU/2 GB (single node, PITR) + DO Managed Valkey 1 GB (noeviction, memory guard); one staging droplet; Grafana Cloud Free + Sentry Developer (EU). Estimated **≈ $133–140/month**; options: PG standby +~$30, worker droplet +$24. Growth ≈ $966/month (range $850–1,150); Scale ≈ $5,000–8,000/month. All figures are estimates as of 2026-11-07.
