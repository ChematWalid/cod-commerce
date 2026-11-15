# `plugins/catalog`: products, variants and the media library

The store catalog of P2.S1: products and variants on Vendure's own `Product` / `ProductVariant` with our custom
fields, brands, tags, highlights, product settings and a per-business media library in tenant tables beside them
(D2100). The layout and layer rules are those of `plugins/_template` (see its README).

## Public entry (D2104)

`index.ts` is the only file another workspace package may import, as `@cod/plugin-catalog`:

- other plugins import it only from `infrastructure/`, from their root `*.plugin.ts` module file and from their
  `tests/` (test kits list `CatalogPlugin`, D2137), per rule `catalog-entry-infra-only` in
  `packages/config/architecture/rules.ts`; their `api/`, `application/`, `domain/` and `dashboard/` reach the
  catalog through their own ports or the API;
- of the apps only `apps/server` imports it (it registers `CatalogPlugin` and runs the demo seed); frontend apps such
  as `apps/storefront` are API clients and are refused (ADR 0017);
- shared contracts (types, event names, zod schemas, constants, page and block ids) live in
  `packages/shared/src/catalog/`, not here.

The entry exports `CatalogPlugin` and the read facade `CatalogProductQueries` (with its `ProductView` and
`ProductViewPage` types): the products of the request's active store, the store taken from the resolved tenant
(D2142). It also exports `ORDER_MANAGER_CHECK_REGISTRAR` with the `OrderManagerCheck`, `OrderManagerCheckRegistrar`
and `CatalogOperationContext` types: Team registers its check there on bootstrap (D2114, D2132); a second
registration throws. Later tasks add more services; the session handoff lists what P2.S2-S5 and P3 may use.

### Product facts reader (P2.S3, D2308)

`CatalogProductFactsReader` (with `CatalogProductFacts`, `CatalogRuleOptions`, `CatalogStoreScope`,
`CatalogStoreChannelMismatchError` and `CATALOG_FACTS_MAX_IDS`) serves collection rules. It takes the store as an
argument, so an outbox consumer or a job can call it with a context it built on the store's channel; every method
refuses a context on another channel. It does not check the store's status (active, archived): the caller does. `factsOf(ctx, scope, ids)` (at most 100 ids; unknown, deleted, other-store and
malformed ids left out) reads in three statements: products, variants with their channel price and options, and tag
links. Price, on sale and variant options come from non-hidden variants only (D2304). `pageIds(ctx, scope,
{ after, take, search? })` is a keyset page (`id < after`, newest first); a malformed `after`, a `take` outside 1-100
or a search over 100 characters is refused with `InvalidCatalogInputError`. `ruleOptionsOf(ctx, scope)` lists the
store's brands, tags and option names with their values, merged by the shared `normalForMatch`. The Vendure-table
reads live in `infrastructure/vendure-product-facts.query.ts`, a reviewed raw-data entry; tag links go through
`TagRepositoryPort.tagIdsOfProducts`.

### Collection membership and visible reads (P2.S3, D2309-D2311, D2324)

- `COLLECTION_MEMBERSHIP_SOURCE_REGISTRAR` (with `CollectionMembershipSource`, `CollectionMembershipSourceRegistrar`
  and `CatalogCollectionOption`): the catalog reads which collections hold a product through
  `CollectionMembershipRegistry`, the `catalog_product_collection` table until collection rules register their
  source on bootstrap. A product's `collectionIds` are its manual collections only; a
  product write naming a collection the source does not call manual (`manualCollectionIdsAmong`) answers
  `catalog.collection-not-found`; the list's collection filter sees every member (`productIdsInCollection`). The
  Admin API query `catalogCollectionOptions` (`catalog.products.view`) lists the source's `collectionOptionsOf`,
  empty without collection rules.
- `CatalogReadService.listVisibleAmong(ctx, context, productIds, { skip, take })`: the products a public list
  context shows among at most `COLLECTION_MAX_MANUAL_PRODUCTS` ids, in the given order (a manual collection); ids are
  filtered by `ProductCatalogPort.visibleIdsAmong` (ids only) and only the page's records are read.
  `listVisible(ctx, context, { skip, take, productIds })` limits the newest-first list to at most
  `CATALOG_MAX_AMONG_IDS` ids (an automatic collection). Malformed, repeated and other-store ids are left out.
- `VisibleProduct.collectionIds` (the public read) holds manual collections only (D2309); a product's automatic
  memberships come from the collections-rules read, never from this field.
- The registrar the plugin exports can only `register`; a second registration throws
  `CollectionMembershipSourceAlreadyRegisteredError`. A registered source must take its per-store lock (D2334) in
  `replaceProductCollections` and drop or refuse ids that turned automatic since the use case's manual check.
- Deleting a tag publishes `product.changed` (`updated`) for every product it unlinks, in the delete's transaction,
  as a brand delete does.

## API (Task 11)

GraphQL `catalogProducts`, `catalogProduct`, `catalogSlugAvailability`, `createCatalogProduct`,
`updateCatalogProduct`, `setCatalogProductStatus`, `deleteCatalogProduct`; REST `GET /catalog/products`,
`GET /catalog/products/slug-availability`, `GET|PATCH|DELETE /catalog/products/:id`, `POST /catalog/products`,
`POST /catalog/products/:id/status`. Both run the same `ProductActions`; the tenant comes from the session and
the `vendure-token` channel, never from the path (D2102).

## Store taxonomy (Task 12)

GraphQL `catalogBrands`, `createCatalogBrand`, `updateCatalogBrand`, `deleteCatalogBrand` and the same for tags and
highlights; REST `GET|POST /catalog/brands`, `PATCH|DELETE /catalog/brands/:id`, and the same under `/catalog/tags`
and `/catalog/highlights`. Reads need `catalog.products.view`, writes `catalog.products.edit`. Everything is
store-scoped: an id of the business's other store answers not found. Deleting a brand clears `brandId` on that
store's products in the same transaction (D2140) and publishes `product.changed` for each. Product settings ride
on the product's create and update (`settings`); their order managers are checked by Team's registered check, and
refused with `catalog.order-managers-unavailable` while none is registered (D2114).

## Media library (Task 13)

GraphQL `uploadCatalogMedia(file: Upload!)` (multipart; GraphQL only, D2102), `catalogMedia(options)`,
`deleteCatalogMedia(id)`; REST `GET /catalog/media`, `DELETE /catalog/media/:id`. Upload and delete need
`catalog.products.edit`, the list `.view`. An upload is at most `MEDIA_MAX_BYTES`, a PNG, JPEG, GIF or WebP image by
its bytes (SVG never); its file name and type come from the sniffed format, never from the client; auth's content
guard refuses a body that does not decode or is over 40 MP (`catalog.media-type`). Uploads are rate-limited per
administrator and per business (policies `catalog-media-actor`, `catalog-media-business`, D2138). Each upload is one
`catalog_media` row in the uploading store and one Vendure asset in that store's channel only (it leaves the default
channel); the key is `assets/b/{business}/s/{store}/source/…` from `TenantAssetNamingStrategy` in `apps/server`.
A caller sees, attaches and deletes the media of the stores it reaches (D2132: every store for `all` access, its
stores for a restricted member, the active store while no team check is registered); attaching an image of another
store to a product shares the asset with the product's store channel. Media a live product, variant or collection of
any store uses cannot be deleted (`catalog.media-in-use`, D2128).

## Registration (D2137)

`apps/server/src/config/plugins.config.ts` registers `CatalogPlugin` once, inside `memberPlugins`, after
`AuthPlugin` and before `TeamPlugin`: Team imports the catalog module to register its order-manager check.

## Tests

- `pnpm --filter @cod/plugin-catalog test`: unit tests (domain, use cases with fakes, contracts).
- `pnpm --filter @cod/plugin-catalog test:integration`: a Vendure test server on the compose Postgres; CI runs it
  in its own matrix part `catalog` (D2116).
