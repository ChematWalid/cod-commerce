# Architecture Decision Records

Nygard format (Status, Context, Options, Decision, Consequences, plus **Evidence** for spike-backed ADRs). Drafts that fed these ADRs stay in [drafts/](drafts/). Spike definitions and the full session plan: [../roadmap/plans/P0.S2a-plan.md](../roadmap/plans/P0.S2a-plan.md).

Status `Proposed` until the user approves in PR review; then the session flips it to `Accepted (date)` (shared plan, Task 11). 0001–0005, 0007–0010, 0013 and 0016 were accepted on 2026-11-07; the product name stays the placeholder "CodShop" (ADR 0007) until the user picks one.

| ADR | Title | Status | Gating spike | Spike result | Written in |
|---|---|---|---|---|---|
| [0001](0001-repo-layout-and-upstream.md) | Repo layout and upstream (published `@vendure/*`, clean repo) | Accepted (2026-11-07) | — (Node 24 + pnpm smoke) | pass (Node 24.22.1 boot; pnpm 10 needs `onlyBuiltDependencies` + explicit `typeorm`) | P0.S2a-1 |
| [0002](0002-tenancy.md) | Tenancy: Business → Stores on Vendure Channels | Accepted (2026-11-07) | C channels at scale | pass except (c) on a large store (2.6 s cold) → `cod_order` read model mandatory for order lists | P0.S2a-1, evidence P0.S2a-2 |
| [0003](0003-ids.md) | Ids: Vendure defaults for core, snowflake strings for ours | Accepted (2026-11-07) | — | — | P0.S2a-1 |
| [0004](0004-pricing-engine-and-order-totals.md) | Pricing engine and order totals (signed quote) | Accepted (2026-11-07) | B order totals | pass (total 9 100 DZD exact, precision 0) | P0.S2a-1 |
| [0005](0005-i18n.md) | i18n: dashboard ar/en RTL, storefront ar/fr/en | Accepted (2026-11-07) | — | — | P0.S2a-1 |
| [0006](0006-storefront-architecture.md) | Storefront: Next.js 16 multi-tenant by host | Proposed — user confirms | F shared cache handler | pass (a–e, h) with the Next repo Redis example + deployment-id key prefix; (f)/(g) pending P3.S5 | P0.S2a-1, evidence P0.S2a-3 |
| [0007](0007-branding.md) | Branding: neutral placeholder, banned reference names | Accepted (2026-11-07) | — | — | P0.S2a-1 |
| [0008](0008-auth.md) | Authentication and authorization surfaces | Accepted (2026-11-07) | A (token type) | pass (dashboard sends Bearer with `['cookie','bearer']`) | P0.S2a-1 |
| [0009](0009-order-lifecycle.md) | COD order lifecycle on Vendure | Accepted (2026-11-07) | B order process | pass (Pending/Confirmed/Scheduled/Returned; settle on Delivered) | P0.S2a-1 |
| [0010](0010-merchant-dashboard-host.md) | Merchant dashboard host | Accepted (2026-11-07) | A dashboard extensions | pass → Option 1 (RTL partial, CSS-fixable) | P0.S2a-1 |
| [0011](0011-hosting-and-regions.md) | Hosting location, provider and regions | Proposed — user confirms | G latency | **Algeria required** (Law 18-07); single-VPS minimum; provider chosen in P3.S5; G pending before P10.S3 | P0.S2a-3 |
| [0012](0012-edge-tls-custom-domains.md) | Edge, TLS and custom domains | Proposed — user confirms | — (Cloudflare facts verified in docs) | Cloudflare for SaaS; Turnstile from one challenge host; purge rate limits | P0.S2a-3 |
| [0013](0013-process-model-job-queues-scheduler.md) | Process model, job queues and scheduler | Accepted (2026-11-07) | D PgBouncer | pass (scheduler exactly-once, BullMQ ×1 000, sessions in Valkey); first boot must be single-process; `TZ=UTC` | P0.S2a-2 |
| [0014](0014-search.md) | Search | Proposed — user confirms | E Arabic search | pass: Phase 1 Postgres recall@5 0.878 (0.947 with the chosen variant) vs Meilisearch 0.881; Vendure search 0.244 | P0.S2a-3 |
| [0015](0015-observability.md) | Observability | Proposed — user confirms | — | — | P0.S2a-3 |
| [0016](0016-data-lifecycle-outbox-partitioning.md) | Data lifecycle, outbox, partitioning, pooling | Accepted (2026-11-07) | D PgBouncer | pass → PgBouncer transaction mode for api/worker; direct for migrate and test DB setup | P0.S2a-2 |

All P0.S2a-1 spikes ran on **SQLite** (Docker unavailable on the machine: Windows "Virtual Machine Platform" off). Spikes A/B test extension APIs and order math, which are database-independent; Postgres-specific behaviour (order-number counter under concurrency) was re-checked in P0.S2a-2 on Postgres 17: gapless and duplicate-free, see the ADR 0009 addendum.

## Decisions that change later briefs

Start from [../architecture/roadmap-impact.md](../architecture/roadmap-impact.md) (already applied). New items from P0.S2a-1, to apply in a `docs/roadmap-<change>` PR:

| Decision | ADR | Brief / section to edit |
|---|---|---|
| Money stored with precision 0 for DZD (custom `MoneyStrategy`; 9 100 DZD stored as 9100) | 0004 | P2.S4 pricing, P3.S4 intake, P6 finance briefs: "integer DZD" wording stays, add "precision 0 money strategy (ADR 0004)" |
| Order number = `Order.customFields.orderNumber` from a per-business counter assigned on entering `Pending` (not `OrderCodeStrategy`) | 0009 | P1.S1 "order number sequence service" contract, P3.S4, P4.S5 |
| Intake must run in one DB transaction (payment added outside the API's request handling) | 0009 | P3.S4 intake steps |
| Vendure's built-in cancel zeroes line quantities; restore needs our guard; default check `checkAllItemsBeforeCancel` disabled | 0009 | P4.S1 order process |
| pnpm 10: `onlyBuiltDependencies` (bcrypt, better-sqlite3/pg natives, esbuild, sharp, re2) + explicit `typeorm` dependency | 0001 | P0.S2b step 1 |
| Dashboard nav per user via 3.8 per-user visibility (`ctx.hasPermissions`), custom `PlatformStaff` permission | 0010 | P1.S5 admin shell |
| Dashboard auth: Vendure session token, `tokenMethod: ['cookie','bearer']` (no custom JWT) | 0008 | P1.S2 auth brief "JWT" wording |

New items from P0.S2a-2:

| Decision | ADR | Brief / section to edit |
|---|---|---|
| Merchant order lists, tab counts, filters and exports read `cod_order` + `order_counter` only (keyset pagination); Vendure's `orders` list is staff-only. Spike C: 2.6 s cold on a 791 k-order store | 0002, 0009 §9 | P3.S4 (read model lands), P4.S1 orders list, P4.S2 filters, P1.S5 nav (hide built-in order list for merchants) |
| PgBouncer **transaction mode** for api/worker; no session `SET`, session advisory locks or `LISTEN` through the pooler; `migrate`, test-DB setup and admin sessions connect directly | 0016 §6 | P0.S2b compose/env (`DATABASE_URL` pooled + `DATABASE_URL_DIRECT`), P1.S1 tenant helper (`set_config(…, true)` only), P3.S5 deploy |
| `migrate` job seeds Vendure's defaults and must finish before any api/worker starts (concurrent first boot fails on `__default_channel__`) | 0013 | P0.S2b docker-compose (`depends_on: condition: service_completed_successfully`), P3.S5 Kamal release hook |
| All roles run with `TZ=UTC` (scheduler writes local time into `timestamp without time zone`) | 0013 | P0.S2b Dockerfile/compose env |
| Seed `GlobalSettings.availableLanguages = [ar, fr, en]` before creating stores (`LANGUAGE_NOT_AVAILABLE_ERROR` otherwise) | 0002 | P1.S1 store creation |
| One business's intake burst on a hot product serialises on Vendure's stock-level row lock (not the order-number counter): keep the intake transaction short, number + allocation last; flash-sale load test | 0009 addendum | P3.S4 intake, P3.S5 load test (k6) |
| TypeORM pool `extra.max` sized to job concurrency for bulk-intake workers (node-postgres default 10 was too small for 25 parallel intakes) | 0016 §6 | P0.S2b server config, P9 platform-sync briefs |

New items from P0.S2a-3:

| Decision | ADR | Brief / section to edit |
|---|---|---|
| **Production hosted in Algeria** (Law 18-07 Art. 44); minimum target = one Algerian VPS running the full compose stack, backups (pgBackRest PITR) to a second Algerian provider; no managed services assumed; provider chosen in P3.S5 after a trial benchmark | 0011 | P0.S2b compose must run unchanged on one VPS (MinIO instead of R2 for private objects); P3.S5 deploy (Kamal to Algerian VPS, no DO/DOKS, OpenTofu limited to Cloudflare); P10.S3 (no DOKS; Scale on VMs) |
| Platform domain is a `.com.dz`; stores at `<store>.<platform>.com.dz` | 0011, 0012 | P1.S1 store subdomains, P8.S9 custom domains |
| Pre-production legal item: ANPDP declaration/authorisation (Arts. 12, 44), ARPCE SaaS authorisation, Law 18-05 Art. 8; parked by the user | 0011 | add to P10 launch checklist |
| Private objects (exports, labels, imports) in Algerian object storage, never R2; R2 only for public assets | 0012 | P5 labels, P6 exports, P2.S3 imports |
| Turnstile served from one `challenge.<platform>` host (Free: 10 hostnames per widget) | 0012 | P3.S4 intake |
| Cloudflare purge: coalesce + batch (Free 5 requests/min); Cache Rule Edge TTL "Respect origin" | 0006, 0012 | P2 storefront publish, P3.S5 |
| Storefront cache handler = Next repo Redis example, adopted as our code, with deployment-id-prefixed ISR keys | 0006 | P0.S2b `apps/storefront`, P2 storefront |
| Search: Phase 1 Postgres with `word_similarity` + "ال" stripping (shared TS/SQL normaliser); Vendure `DefaultSearchPlugin` not used for Arabic search; Darija transliteration table | 0014 | P2 storefront search, P4.S2 order search, `packages/shared` normaliser |
| Uptime and DB observability: `pg_stat_statements` everywhere, probes on `/readyz` not `/health`, queue gauges per job name | 0015 | P3.S5, P10.S2 |
