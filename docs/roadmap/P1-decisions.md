# P1 decisions

Decisions taken while building phase P1. Each row gives the decision, why, and the cost if it proves wrong.
Later rulings are appended under "Later rulings".

| # | Decision | Why | Cost if wrong |
|---|---|---|---|
| D1 | Snowflake ids are `String!` in GraphQL; ADR 0003 addendum. No custom `EntityIdStrategy`. | ADR 0003 §1 forbids a custom strategy; Vendure's `ID` decode does `+id`, corrupting 63-bit ids. | Renaming scalars in plugin schemas. |
| D2 | `Administrator.customFields.businessId`: `string` length 20, indexed, `internal: true`. Relation custom fields follow the integer id strategy, so a `bigint` PK does not fit (implementer confirms in Vendure source and records it in the addendum, ADR 0003 §6). | Tenant link must not be client-writable. | One custom field migration. |
| D3 | Subdomain is `varchar(30)` unique, always lowercased in domain code, with a DB `CHECK (subdomain = lower(subdomain))`, instead of `citext`. | Test databases use `synchronize: true` and have no citext extension; the check gives the same guarantee. | One column migration. |
| D4 | An archived store keeps its subdomain (unique across archived rows). | Prevents another merchant taking over a recently used host. | Later release job. |
| D5 | Platform provisioning is a SuperAdmin-only mutation `provisionBusiness`, used by the seed, tests and evidence; P1.S2 calls the same application service. | One creation path; fixtures stay GraphQL-only. | Removing one mutation. |
| D6 | A per-business placeholder Owner role (no default-channel, SuperAdmin or Customer role) is created with the first store and extended to each new store. P1.S3 replaces its permissions. | Member-of-channel is needed for any request; ADR 0002. | Replaced by design in P1.S3. |
| D7 | Channel `defaultLanguageCode` and `availableLanguageCodes` are both `[store language]`. | Dashboard content language then follows the store (P0.S2c-polish finding): `user-settings.tsx` switches when the channel does not offer the current one. | Adding languages to channels later. |
| D8 | Another business's `vendure-token` stays Vendure's `FORBIDDEN` at the auth guard; "not found" applies to ids. | The token check runs before our code and reveals nothing beyond "not yours". | Small guard change. |
| D9 | `TenantContext` is cached per `RequestContext` in a `WeakMap`; Store/Business status is read from the DB on each request (indexed lookups); Redis caching waits for a measured need. | ADR 0002 §7 needs our rows as authority, not specifically a cache now. | Add a cache behind the resolver. |
| D10 | Plugins consume tenancy only via the `@cod/plugin-tenancy` entry point. | §3a.2 forbids internals; `TenantEntity` needs typeorm, so it cannot live in `packages/shared`. | Move to a package. |
| D11 | `changeStoreSubdomain` mutation exists now (API only); UI and DNS stay in P8.S9. | Acceptance needs a real subdomain change to prove invalidation. | Removing one mutation. |
| D12 | Storefront calls `GET /store/resolve` on each proxy pass, without its own cache; server-side LRU + Valkey handles load. P3.S2 may add a proxy tier. | Keeps invalidation in one place. | Adding a tier. |
| D13 | `Order.customFields.orderNumber/businessId/storeId` are declared by P3.S4, which assigns them. This session ships the sequence service only. | Nothing writes them before P3.S4. | One migration. |
| D14 | Platform defaults keep converging on every migrate (no create-if-missing). | Currency, tax and languages are platform invariants, and the store flow depends on them. | Small seed edit. |
| D15 | "Default agent" in the acceptance list is the delivery agent, i.e. `defaultCarrierId`. | Same concept in the research captures. | Renaming a column. |

## Later rulings

| # | Decision | Why | Cost if wrong |
|---|---|---|---|
| D16 | Host keys in Valkey carry a 24 h TTL (`HOST_CACHE_TTL_SECONDS`), a deviation from ADR 0006's "no TTL". Invalidation stays the normal path; failed deletes are retried for about 30 s (`HOST_INVALIDATE_RETRIES`). | If Valkey is down for every delete, a key with no TTL would serve an old host for ever once Valkey returns. | One database read per host per day; if 24 h is too long, a moved host can stay stale that long after an outage outlasting the retries. |
| D17 | The storefront's `use cache` store name is not revalidated on rename in P1.S1; revalidation arrives with the publish flow (ADR 0006 §5, P3.S2). | The `storefront-revalidate` path belongs to that flow; host data itself is invalidated now. | A store's page shows its old name for up to the cache life. |
