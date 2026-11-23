# `plugins/storefront-api`: the storefront's public catalog

HMAC-signed REST under `/store` (the internal-only middleware signs every call, D111) that the storefront app reads
(ADR 0017; the app never imports this plugin). Every handler runs as the signed, active store through tenancy's
`@StorefrontScoped()` / `@StorefrontCtx()` (D3201) and is limited per buyer address under `storefront-read` (D3213).

| Route | Answers |
| --- | --- |
| `GET /store/products?skip&take&sort&collection` | a page of listed products (`StorefrontProductPage`) |
| `GET /store/product/search?q&skip&take` | search (ADR 0014 Phase 1: word similarity over the projection's `searchText`, widened by the business's Darija synonyms; a query under 2 characters answers an empty page), declared before `product/:slug` |
| `GET /store/product/:slug` | a product page (`StorefrontProduct`) |
| `GET /store/collections` | the visible collections (`StorefrontCollectionList`) |
| `GET /store/collection/:slug` | a collection and a page of its products (`StorefrontCollectionPage`) |

Unknown, hidden, draft, another store's and malformed answer 404 with an empty body; paging is clamped, never a 400.

Lists read `storefront_product`, a per-store projection (D3205): `listed` folds the catalog's visibility and the
store's sold-out hiding. `product.changed` rewrites one row and `store.changed` (settings) re-applies the sold-out
behaviour in one `UPDATE` and queues a rebuild of the store on `storefront-projection`, since names follow the store
language (`StorefrontProjectionConsumer`, D3222); the `storefront-projection-backfill` task builds the rows of active
stores that have none (D3219). Product pages and collections read the catalog and collections plugins (D3206).

Revalidation (D3210, D3211, D3222): `StorefrontRevalidateConsumer` turns `product.changed`, `collection.changed` and
`store.changed` into a `storefront-revalidate` job with the cache tags they expire; the worker signs
`POST {STOREFRONT_INTERNAL_URL}/api/internal/revalidate` and asks `PurgeCoalescer` for a CDN purge of the store's
hostnames (at most one per store per 30 s, at most 100 hostnames per request). The CDN adapter is a logging no-op
until the owner provides a Cloudflare token (P3.S5). Without `STOREFRONT_INTERNAL_URL` (`StorefrontApiPlugin.init`),
revalidations are logged, not sent.

Tests: `pnpm --filter @cod/plugin-storefront-api test` (unit) and `test:integration` (compose Postgres and Valkey).
