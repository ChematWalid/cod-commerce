# ADR-0002: Tenancy (Business → Stores on Vendure Channels)

**Date**: 2026-11-07
**Status**: Accepted (2026-11-07), approved by the user after P0.S2a-1/P0.S2a-2 review
**Deciders**: architect (draft), user

Citation keys: [VN §n] = `docs/architecture/research/vendure-v3.md` section n; [DM] = `docs/research/data-model.md`; [BK] = background knowledge, verify before relying on it.

## Context

- Product shape: Account → Business (billing, team, finance, order-number sequence) → 1..n Stores (storefront on `<sub>.ourdomain` or a custom domain) [feature-inventory.md intro]. Every reference row carries `businessId` and store rows carry `storeId` [DM intro].
- Vendure documents multi-tenancy as "one Channel per shop". Channel-aware core entities are Asset, Collection, Customer, Facet, FacetValue, Order, PaymentMethod, Product, ProductVariant, Promotion, Role, ShippingMethod and StockLocation. A channel is selected by the `vendure-token` header, and each channel has one Seller [VN §6, https://docs.vendure.io/current/core/core-concepts/channels.md].
- Every entity is also joined to the **default channel**, so the join tables grow with the platform. **No limits are documented for thousands of channels** [VN §6, UNVERIFIED].
- **Vendure 3.8 facts** (context7 `/vendurehq/vendure/v3.8.0`, `@vendure/core@3.8.1` source):
  - The channel cache is **per-process** in-memory Maps (`tokenCache` and siblings) with TTL `entityOptions.channelCacheTtl`, default **30 000 ms**. A channel change clears the cache **only in the process that made it**; other API and worker instances see the change after their TTL expires (up to 30 s).
  - **Since 3.8.0, `ChannelService.create` auto-assigns every new channel to the SuperAdmin role and the Customer role.** Any administrator holding either role therefore gains each new store's channel automatically.
- Scale target: Launch ≈100 stores, Growth ≈1,000, Scale ≈5,000 (README assumptions). At Scale that means 5,000 channels, millions of channel join rows and about 73 M orders per year.

## Options

1. **Database per business**: strongest isolation. N migrations, N pools and cross-business platform analytics through ETL. Vendure assumes one DataSource. Rejected: operationally impossible for a small team at 5,000 tenants.
2. **Schema per business**: same pool and migration fan-out problems, and TypeORM/Vendure are not schema-switch aware. Rejected.
3. **Shared database, Vendure Channels only**: covers core entities only. Business-wide concepts (team, finance, wallets, sequences) have no home. Rejected as incomplete.
4. **Shared database: Channel per Store + Business entity + `businessId` on every custom entity + tenant guard (recommended)**, with Postgres RLS added later as defence in depth on our own tables.

## Decision

Option 4.

**Entities and mapping (P1.S1 implements exactly this)**
| Concept | Implementation |
|---|---|
| Business | `Business` entity (plugin `tenancy`): `id`, `name`, `logoAssetId`, `onboardingState jsonb`, `ownerAdministratorId`, `planId`, `status`, `createdAt`. One **Seller** per Business (`Business.sellerId`). |
| Store | `Store` entity: `id`, `businessId`, `channelId` (unique), `sellerId`, `subdomain` (unique, citext), `language ar/fr/en`, settings columns. **One Vendure Channel per Store**; the channel's `defaultCurrencyCode = DZD`, zero-tax zone (ADR 0004). |
| Member | Vendure `Administrator` + channel-scoped `Role`s (one role set per store the member can access). The Business link is `Administrator.customFields.businessId`, plus a `BusinessMember` row (salary, commissions, limits). |
| Custom entities | Base class `TenantEntity { businessId: bigint (indexed, NOT NULL); storeId?: bigint }` (id types per ADR 0003). Every plugin entity extends it, and a schema test fails otherwise (P10.S2 guard). |
| Core entities touched by us | `Order.customFields.businessId/storeId` (denormalised, indexed) and the COD read model `cod_order` (ADR 0009/0016). Products, variants and collections are filtered through their channel. |
| Platform staff | The default channel, the SuperAdmin role and the Customer role are kept for platform staff and Vendure internals only. **Merchants and members never hold the SuperAdmin role, the Customer role or any default-channel role**, because since 3.8.0 every new channel is auto-assigned to the SuperAdmin and Customer roles; a merchant holding either would silently gain every future store. |

**Isolation mechanism**
1. **Request context**: a `TenantContextResolver` runs on every Admin API, REST and MCP request. It derives `businessId` from the authenticated Administrator (never from client input) and `activeStoreId` from the `vendure-token` channel, which must belong to that business. Storefront requests get `storeId` from the host via the storefront proxy (ADR 0006), never from the body.
2. **Guard**: a `@TenantScoped()` decorator plus a global guard **fail closed** when there is no tenant context. Cross-tenant reads return "not found", not "forbidden" (P1.S1 acceptance).
3. **Data access**: only `TenantRepository<T>` / `tenantQuery(ctx, qb)` may touch tenant tables, and both always add `businessId = :ctxBusinessId`. A lint rule bans raw `getRepository(TenantEntity)` outside the helper.
4. **Jobs and scheduled tasks**: every job payload carries `businessId`. The processor rebuilds a RequestContext for that business's channel and asserts it matches. Scheduled tasks (which run without a request) only **select due work and fan out** one job per business or carrier account; they never read or write several businesses' data in one RequestContext.
   - 4b. **Vendure core entities that can span channels**: `Customer` is looked up by email across channels, so intake uses a business-scoped synthetic email (ADR 0009 §7). `Asset` keys are tenant-prefixed by our `AssetNamingStrategy`. Merchants never get default-channel, SuperAdmin or Customer roles (above). Spike C also checks that `Customer`, `Asset` and `Role` queries in channel A never return rows created in business B.
   - 4c. **Shop API**: not used and not reachable from outside (`InternalOnlyGuard`, ADR 0008), so a channel token never opens public catalog or order mutations. On the Admin API, `vendure-token` only selects a channel, and the resolver in 1 rejects a channel outside the administrator's business.
5. **Caches and object keys**: helpers `tenantKey(ctx, ...)` (Redis) and `b/{businessId}/s/{storeId}/...` (R2 prefix) are mandatory. A unit test scans for un-prefixed `cache.set` calls.
6. **Business-wide queries** (finance, team, analytics across stores) filter `businessId` on our own tables. For Vendure entities they use `channelId IN (:storeChannelIds)`, resolved from the `Store` table and cached per business.
7. **Channel cache staleness**: because the channel cache is per process with a 30 s TTL, a store disabled or re-tokened on one instance stays resolvable on others for up to 30 s. Security-relevant state (store `status`, business suspension) is therefore checked from **our** `Store`/`Business` rows (Redis-cached, invalidated by pub/sub on change) inside `TenantContextResolver`, not from Vendure's channel cache. Conversely, an Admin API request for a channel created less than 30 s ago may reach an instance whose cache does not know it yet; store creation is idempotent and the dashboard retries once on "channel not found" right after creating a store. Spike C (a)/(f) records the actual behaviour.

**Postgres RLS (when)**: not at Launch. Vendure core queries run outside our transactions, so RLS can only cover our own tables. In P10.S2 we run an RLS spike on `cod_order`, `tenant_secret`, `customer_profile` and `activity_log` using `SET LOCAL app.business_id` inside our repository helper's transaction (this works with PgBouncer transaction mode; spike D checks it). We adopt it at the **Growth** tier if overhead is under 5 % p95. Trigger: before the first business above 10k orders/day or the first enterprise/API customer, whichever comes first.

**Precondition: spike C, channels at scale (P0.S2a-2)**. Seed 5,000 channels (Scale) with 50 products × 3 variants each (750 k variants, all joined to the default channel too), 1,000 customers per channel and 5 M orders spread Pareto-style (Zipf s ≈ 1.1) across channels. Measure p95 for:
- (a) channel resolution by token, cold and warm (30 s cache);
- (b) product list/detail by channel;
- (c) order list for one channel, filtered and paginated;
- (d) Administrator login with roles on 5 channels;
- (e) memory of the channel cache per API instance;
- (f) creating a new channel (time and locks, including 3.8's SuperAdmin/Customer role auto-assignment).

Pass: (b) and (c) under 150 ms p95 cold at the DB, (e) under 200 MB, (f) under 2 s with no table-level locks that block orders. On failure, the fallback is to keep Channel per Store but move hot paths (storefront catalog, order lists) onto our own `businessId`-keyed read models (`cod_order`, `storefront_product_cache`) so Vendure channel joins leave the request path. That fallback is designed in already (ADR 0009/0016).

**Spike C outcome (P0.S2a-2, Evidence below):** Channel per Store holds at 5 000 channels for channel resolution, catalog reads, login, cache memory and channel creation. **The order list fails for a large store**: Vendure's channel-joined `orders` query sorts and counts every matching order of the channel. On the hottest store (791 k orders, 237 k `Pending`), page 2 costs 2.6 s cold and 0.87 s warm at the DB. Therefore:
- **Mandatory, not optional:** every merchant-facing order list, tab count, filter and export reads `cod_order` with keyset pagination and `order_counter` (ADR 0009 §9, ADR 0016 §4), never Vendure's `orders` list query. Vendure's own dashboard order list is hidden from merchants (ADR 0010 nav) and kept for platform staff only.
- Catalog lists stay on Vendure's channel-scoped queries for the dashboard. The Admin API product list issues one variant query per product (N+1: 65–76 statements for 20 products); still 46 ms p95 cold at the DB. The storefront reads its own cache (ADR 0006), not this query.

## Testing (P1.S1 implements, P10.S2 extends)

- **Two-business suite**: fixtures create business A (stores A1, A2) and business B (store B1), each with an owner, a member with a role on one store only, products, an asset, a customer and orders — including the **same buyer phone in A and B**. The suite is generated from the resolver/route registry, so every Admin API resolver, REST route and MCP tool runs as A's member against B's ids and must return "not found" (or an empty list), never B's data. A new resolver without a registry entry fails the suite.
- **Role checks**: A's owner holds no SuperAdmin, Customer or default-channel role; after creating a new store for B, A's administrators still see no B channel (guards the 3.8 auto-assignment).
- **Schema test**: every plugin entity extends `TenantEntity` with a NOT NULL indexed `businessId`.
- **Host spoofing**: storefront requests with a mismatching body `storeId`/`businessId`, a `/_t/<other store>` path, or a forged `x-store-id` without a valid internal signature are rejected (ADR 0006/0008).
- **Jobs**: a job whose payload `businessId` does not match the rebuilt context fails; a scheduled task touching two businesses in one context fails.
- **Cache keys**: lint/unit check for un-prefixed cache and R2 keys.
- CI runs the suite on every PR (ADR 0001 budget).

## As implemented (P1.S1, 2026-11-08)

Where the code differs from, or sharpens, the Decision above. Evidence: `docs/evidence/P1.S1/`; full reasoning: `docs/roadmap/P1-decisions.md`.

- **Ids and tenant link.** Our ids are snowflake `bigint`, exposed as `String!` in GraphQL (ADR 0003 addendum). The Business link is the internal custom field `Administrator.customFields.businessId` (a 20-character indexed string), not a relation.
- **Subdomain** is `varchar(30)` unique with `CHECK (subdomain = lower(subdomain))` instead of `citext`. An archived store keeps its subdomain.
- **Provisioning.** The SuperAdmin-only `provisionBusiness` mutation is the one creation path (seed, tests, evidence; P1.S2 reuses the service).
- **Owner role.** One placeholder Owner role per business, on that business's channels only, extended with each new store. It holds `Authenticated`, the Tenant Store and Tenant Business CRUD permissions and assignable plugin permissions, and deliberately **not** `ReadChannel`, `ReadSettings` or `UpdateChannel`, because `channels` lists every store's token unscoped. The dashboard falls back to the channels on the owner's own user. P1.S3 replaces these permissions.
- **Channel languages.** A channel's default and available languages are both `[store language]`, so the dashboard's content language follows the store.
- **Another business's `vendure-token`** stays Vendure's `FORBIDDEN` at the auth guard; "not found" applies to ids.
- **Tenant status.** `TenantContext` is cached per request; Store and Business status are read from our rows on each request (indexed), without a Redis tier yet. This covers §7 (authority is our rows, not the channel cache).
- **Host resolution.** `GET /store/resolve` goes through an in-memory LRU, then Valkey, then the database. A subdomain change is invalidated across processes by pub/sub; a Valkey outage falls through to the database.
- **Demo seed.** `pnpm --filter @cod/server seed:demo` creates the synthetic businesses Demo (`demo`, Arabic; `demo2`, English) and Second (`second`, French; `second2`, English). It is idempotent, refuses `APP_ENV=production` and needs `DEMO_OWNER_PASSWORD`.
- **Not yet built:** `Order.customFields.businessId/storeId` (P3.S4 declares and assigns them; this session ships only the per-business order number sequence), `BusinessMember`, RLS (P10.S2).

## As implemented (P1.S3, 2026-11-09)

Accepted (2026-11-09, standing user authorization for P1). Sharpens the Decision above; full reasoning: `docs/roadmap/P1-decisions.md` (D53, D55, D56, D57).

- **Role mapping (D53).** A business role has bindings, each pointing at one Vendure Role: scope `all` is one Vendure Role on every store channel of the business, extended when a store opens; scope `<storeId>` is one Vendure Role on that channel. This replaces "one role set per store". Unused pairs cost nothing, and the Owner role of P1.S1 is the `all` binding of Owner.
- **Session invalidation (D55).** Role and assignment writes go through `RoleService` and `AdministratorService`, then delete the cached sessions of the affected users after commit and again after 500 ms, because Vendure's own clear runs before commit and is absent for assignments and channel extensions. The bound when this fails is `sessionCacheTTL`.
- **Lifecycle hooks (D56).** Tenancy exposes `TenantLifecycleRegistry` (`businessProvisioned`, `storeCreated`), awaited inside the provisioning or store transaction, so the RBAC plugin seeds roles atomically without tenancy importing it.
- **Existing businesses (D57).** No SQL data migration: `runMigrate` converges every business idempotently, adopting `ownerRoleId` as Owner's `all` binding with the same Vendure Role id, so sessions and user rows stay valid.

## Addendum: tenant status on every handler (P2.S1, 2026-11-14)

Accepted (2026-11-14, standing user authorization for P2). Sharpens Isolation mechanism §2; audit finding TEN-3 (#108); full reasoning: `docs/roadmap/P2-decisions.md` (D2117).

- **Where status is checked today.** Store archive and business suspension are enforced by `TenantGuard` on every `@TenantScoped()` handler, not by a global guard. That covers every handler that reads or writes tenant data: no catalogue key carries a stock Vendure permission (`REVIEWED_STOCK_ENGINE_GRANTS` is empty) and plugin handlers that touch tenant tables are tenant-scoped.
- **Known exceptions, on purpose.** Every engine role holds the stock `Permission.Authenticated`, which Vendure requires of any signed-in caller: the RBAC binding projector and converge add it to each role as `ENGINE_BASE_PERMISSION` (`plugins/rbac/domain/constants.ts`). So a member of a suspended business or an archived store still reaches the grant-free handlers of `apps/server/tests/unit/open-admin-operations.reviewed.ts`. That file is the full list, each operation with what it reads; this ADR names the categories and why each is exempt from status checks, since none reads or writes another row of the business:
  - own-account operations (`activeAdministrator`, `updateActiveAdministrator`, `setActiveAdministratorAvatar`, `me`, the account profile, password, email-change request and email verification operations) act on the caller's own user;
  - token-bearer operations (`confirmEmailChange`, `verifyEmail`, `resetPassword`) act on the owner of a mailed token, which proves the mailbox;
  - sign-in and sign-up (`login`, `authenticate`, `logout`, `requestPasswordReset`, `registerMerchant`) start or end the caller's own session, or create a new business, and answer the same for an unknown address;
  - public configuration (`authPublicConfig`, `subdomainAvailability`, `entityDuplicators`, `globalSettings`) returns deployment or platform settings, or whether a public host name is free;
  - `activeChannel` returns the request's own channel; `duplicateEntity` needs a stock permission no merchant role holds; the settings-store operations have no registered field; `switchableStores` lists only active stores of the caller's business, which is none for a suspended one.

  The gate below cannot see them, since they need no grant; adding a handler to that file means placing it in one of these categories or extending this list. Option A below covers them too once it lands.
- **When the global guard becomes mandatory.** The session that adds the first reviewed stock grant also adds a global tenant status guard (option A, an `APP_GUARD` that runs after Vendure's `AuthGuard`) in the same PR, so a suspended business or archived store cannot reach a stock handler through that grant.
- **Gate.** `apps/server/tests/unit/tenant-status-guard.test.ts` fails as soon as any catalogue key projects onto a stock `Permission`, or `ownerRolePermissions`, which the Owner role receives directly rather than through catalogue keys, contains one (the engine base `Authenticated` is added on top of it); its messages point here.
- **Proof of the scoped path (planned).** Task 11 of P2.S1 adds the catalog plugin's integration suite `plugins/catalog/tests/integration/tenant-status.int.test.ts`, which checks that its handlers refuse an archived store and a suspended business (`FORBIDDEN` on `catalogProducts`, `createCatalogProduct`, the REST routes and `uploadCatalogMedia`). TEN-3 (#108) stays open until that suite is merged, and is then closed by the P2.S1 PR (closed by hand after the squash-merge into `phase/P2`, D2143).

## Consequences

### Positive
- Uses the documented Vendure model, so Products, Orders and Roles get channel scoping and RBAC for free.
- One database, one migration stream, and simple platform analytics.
- Defence in depth: guard + helper + tests now, RLS later.

### Negative
- Spike C measured 5 000 channels: catalog, login, channel creation and cache memory scale. Vendure's channel-joined order list does not scale with a store's order count, so the `cod_order` read model is mandatory for merchant order lists (Decision).
- Default-channel join tables grow without bound, so channel joins need explicit index review.
- Business-wide queries over Vendure entities need `channelId IN (...)` lists.
- Channel changes take up to 30 s to reach other instances; tenant status checks must not rely on the channel cache.

### Risks
- **A developer bypasses the helper.** Mitigation: lint rule, schema test, two-business suite in CI, later RLS.
- **Superadmin/default-channel exposure**, amplified by 3.8's auto-assignment of new channels to the SuperAdmin and Customer roles. Mitigation: merchants never hold those roles (tested), platform-staff accounts only, 2FA (ADR 0008), audit log.

## Evidence

Spike C, 2026-11-07, P0.S2a-2. Scratch app outside the repo (`@vendure/create@3.8.1` scaffold switched to Postgres), never committed.

**Environment**: Arch Linux, native Docker 29.9.1, 8 CPU threads, 11.6 GB RAM shared with unrelated containers. `postgres:17` (17.11, `sha256:ff87138949ad…`) with `shared_buffers=1GB`, `work_mem=4MB`, `random_page_cost=4`, `effective_cache_size=4GB`, `pg_stat_statements`. Node 24.22.1, `@vendure/core` 3.8.1. The data directory sits on a **SATA SSD**. The first cold trial ran on the machine's 7 200 rpm HDD (Docker's default root) and cost 1 570 ms for a 20-product list (≈ 7 ms per random read). Production Postgres is SSD/NVMe, so the volume was copied to the SSD and every cold number below is from the SSD.

**Data** (generators written against `\d` of the real Vendure 3.8.1 tables, loaded with `generate_series`; non-PK indexes dropped and rebuilt around the big loads; load 2 333 s; database 6.1 GB):

| Rows | Count |
|---|---|
| channels (+ sellers) | 5 001 (5 000 stores + default) |
| products / variants | 250 000 / 750 000 (50 × 3 per store), each joined to its channel **and** the default channel, with prices and stock levels |
| customers | 5 000 000 (1 000 per store), customer–channel rows 10 000 000 (store + default, as `assignToCurrentChannel` does) |
| orders / order lines | 5 000 000 / 10 000 001, Zipf s = 1.1 over stores (shuffled), state mix 30 % Pending, 15 % Confirmed, 40 % Delivered, 15 % Cancelled; order–channel rows 10 000 000 |
| hottest stores | 791 421, 369 215, 236 363 orders; median store 145 |
| role–channel rows | SuperAdmin and Customer roles on every store channel (the 3.8 auto-assignment) |

**Method.** The SQL of each case was captured from TypeORM query logging on real Admin API calls (`products` take 20 with variants, `product(id)`, `orders` filtered `state = Pending`, `skip 20 take 20`, sorted `createdAt DESC`). DB time per request = the sum of `pg_stat_statements.total_exec_time` over **all** statements the request issued (reset before each request), so it covers the real statement set Vendure sends, not a hand-written query.
- **Cold**: for each of 50 random stores (seeded): `docker restart` Postgres, drop the host page cache (`echo 3 > /proc/sys/vm/drop_caches` in a privileged container), one request. Hottest store: 10 cold runs.
- **Steady-state session**: one unrelated authed request (`globalSettings`) on the same channel before the measured one, so the measured request is not the first after login. The first request after login reads and updates the `session` row (24 ms cold), which RedisCachePlugin removes in production (ADR 0013 Evidence item 4).
- **Warm**: a warm-up pass over the 50 stores, then 200 requests round-robin.

**Results** (DB time unless marked API):

| Case | Cold p95 | Warm p95 | Threshold | Result |
|---|---|---|---|---|
| (b) product list, 20 products with variants | 46.3 ms (p50 39.9; 65 statements) | 63.1 ms | < 150 ms cold | **pass** |
| (b) product detail | 97.9 ms (p50 53.9; 19 statements)¹ | 48.5 ms | < 150 ms cold | **pass** |
| (c) order list, random store | 109.4 ms (p50 50.6; 15 statements)¹ | 57.1 ms | < 150 ms cold | **pass** |
| (c) order list, **hottest store** (237 087 Pending) | **2 623.6 ms** (p50 2 360; 176 901 blocks read) | **867.6 ms** | < 150 ms cold | **fail** → `cod_order` read model (Decision, above) |
| (a) first request with an unseen channel token | DB p50 36.2 / p95 52.3 ms; API p95 264 ms (cached token: API p95 253 ms; after the 30 s TTL: 277 ms) | — | recorded | resolution is not on the critical path |
| (d) login, administrator with a role on 5 stores | DB p50 1.8 / p95 2.9 ms; API p95 254 ms | — | recorded | — |
| (e) channel cache memory, all 5 001 tokens resolved in one process | +7.1 MB heap (heapUsed 91.4 → 98.9 MB, RSS 343 → 362 MB vs a 1-channel DB) | — | < 200 MB | **pass** |
| (f) `createChannel` ×10 at 5 000 channels during an order-insert loop | max 358 ms (261–358) | inserts p95 22.1 ms during vs 25.6 ms baseline; **0** `still waiting for` lock lines (`log_lock_waits=on`, `deadlock_timeout=10ms`) | < 2 s, no blocking | **pass**; each new channel was joined to `__super_admin_role__` and `__customer_role__` (10 + 10 rows) |

¹ These two cold sets ran before the steady-state-session fix and include the first-request session read and update; their true steady-state values are lower. The cold product list was re-run with the fix (the numbers in the table); before the fix it was p95 167.9 ms.

API times include ~220 ms of fixed per-request overhead from this dev server (`ts-node`, a shared busy host); they are recorded, not judged. Warm (b) is higher than steady-state cold (b) because the warm loop switches channel on every request, which updates the session's active channel each time.

**Leak check through Vendure** (scratch COD app on database `spikeb`: businesses A = `store-101` and B = `store-202` with intake orders from ADR 0009's addendum). Steps: superadmin uploads an asset in B and creates role `b-staff` on B; then role `a-staff` (ReadOrder, ReadCustomer, ReadCatalog, ReadAsset, ReadAdministrator) on channel A only, and administrator `a-only` with it. As `a-only` with `vendure-token: store-101`:

| Query | A's admin sees | B's rows visible to A |
|---|---|---|
| `orders` | 204 | **0** of 76 |
| `assets` | 0 | **0** of 1 |
| `roles` | `a-staff` only | `b-staff` not visible |
| `customers` | 202 | **1** of 77: the deliberate unscoped-email contrast customer (`213555123456@buyers.invalid`, joined to both stores by Vendure's email lookup) |

- The business-scoped customers for the same phone `+213555123456` (`…101@` and `…202@buyers.invalid`) appear only in their own business.
- The same administrator with `vendure-token: store-202` gets `FORBIDDEN`.
- **Conclusion:** channel scoping isolates orders, assets and roles. Customers are isolated **only** with the business-scoped synthetic email (ADR 0009 §7). With an unscoped email, the merged row is visible to the other business's staff through the Admin API, not only in the database. P1.S1's two-business suite keeps this case as a regression test.

**Gotchas**
- Channels whose `defaultLanguageCode` is not in `GlobalSettings.availableLanguages` cannot be created (`LANGUAGE_NOT_AVAILABLE_ERROR`); P1.S1 seeds `availableLanguages: [ar, fr, en]`.
- The channel cache in 3.8.1 is a lazy per-token `Map` (`tokenCache`) filled as tokens are seen, not an all-channels list loaded at boot; (e) measured the worst case (every token resolved).
- Vendure's own `orders` list cost grows with the channel's order count (sort plus `COUNT(DISTINCT)` over the channel join), not with the number of channels. Small stores stay fast at 5 000 channels.
