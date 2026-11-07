# ADR-0002: Tenancy (Business → Stores on Vendure Channels)

**Date**: 2026-11-07
**Status**: Proposed — evidence pending P0.S2a-2 (spike C channels at scale)
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

## Testing (P1.S1 implements, P10.S2 extends)

- **Two-business suite**: fixtures create business A (stores A1, A2) and business B (store B1), each with an owner, a member with a role on one store only, products, an asset, a customer and orders — including the **same buyer phone in A and B**. The suite is generated from the resolver/route registry, so every Admin API resolver, REST route and MCP tool runs as A's member against B's ids and must return "not found" (or an empty list), never B's data. A new resolver without a registry entry fails the suite.
- **Role checks**: A's owner holds no SuperAdmin, Customer or default-channel role; after creating a new store for B, A's administrators still see no B channel (guards the 3.8 auto-assignment).
- **Schema test**: every plugin entity extends `TenantEntity` with a NOT NULL indexed `businessId`.
- **Host spoofing**: storefront requests with a mismatching body `storeId`/`businessId`, a `/_t/<other store>` path, or a forged `x-store-id` without a valid internal signature are rejected (ADR 0006/0008).
- **Jobs**: a job whose payload `businessId` does not match the rebuilt context fails; a scheduled task touching two businesses in one context fails.
- **Cache keys**: lint/unit check for un-prefixed cache and R2 keys.
- CI runs the suite on every PR (ADR 0001 budget).

## Consequences

### Positive
- Uses the documented Vendure model, so Products, Orders and Roles get channel scoping and RBAC for free.
- One database, one migration stream, and simple platform analytics.
- Defence in depth: guard + helper + tests now, RLS later.

### Negative
- The scaling behaviour of thousands of channels is unproven, which is why spike C is a hard gate.
- Default-channel join tables grow without bound, so channel joins need explicit index review.
- Business-wide queries over Vendure entities need `channelId IN (...)` lists.
- Channel changes take up to 30 s to reach other instances; tenant status checks must not rely on the channel cache.

### Risks
- **A developer bypasses the helper.** Mitigation: lint rule, schema test, two-business suite in CI, later RLS.
- **Superadmin/default-channel exposure**, amplified by 3.8's auto-assignment of new channels to the SuperAdmin and Customer roles. Mitigation: merchants never hold those roles (tested), platform-staff accounts only, 2FA (ADR 0008), audit log.

## Evidence

Pending P0.S2a-2 (spike C).
