# `plugins/collections-rules`: store collections with conditions

The store collections of P2.S3. A collection is a Vendure `Collection` in the store channel only (name, description,
slug, featured image) plus our definition row: `manual` (products picked and ordered by hand) or `automatic`
(All/Any conditions on tag, brand, price, on sale, title and every option name of the store), visibility, position
and the ordered membership (D2300-D2303). The layout and layer rules are those of `plugins/_template`.

## Layers

- `domain/`: the rule evaluator (`evaluate-rule.ts`, one matcher per field in `condition-matchers.ts`), the rule
  facts of a product (`product-facts.ts`, hidden variants left out, D2304), membership rows and diffs
  (`membership.ts`), the mode switch (`collection.ts`, D2302) and the typed errors of `COLLECTIONS_ERROR_CODES`.
- Shared contracts (rule schema, inputs, caps, error codes, `normalForMatch`, the `collection.changed` payload) live
  in `packages/shared/src/collections/`.

## Public entry (D2317)

`index.ts` is the only file another workspace package may import, as `@cod/plugin-collections-rules`, and only from
its `infrastructure/`, its root `*.plugin.ts` file and its `tests/` (rule `collections-entry-infra-only` in
`packages/config/architecture/rules.ts`). It exports:

- `CollectionsRulesPlugin`;
- `CollectionsReadService` (D2316, for P3.S2's storefront routes): `listVisible(ctx, { skip, take })` lists the
  visible collections of the context's active store by position, then id; `productsOf(ctx, collectionId, context,
  { skip, take })` reads one visible collection's products through the catalog's `CatalogReadService` (hand order for
  a manual collection, newest first for an automatic one, at most the newest `CATALOG_MAX_AMONG_IDS`), `undefined`
  for a hidden, foreign or unknown collection. The store is never an argument: a context without an active store on
  that store's own channel is refused with `CollectionsNoActiveStoreError`;
- `CollectionMembershipQueries` (D2317, for P2.S4, P2.S5 and P3.S2): `productIdsOf`, `collectionIdsOfProducts` (one
  query for N products), `isMember`, `existingCollectionIds`, each naming its `CollectionsStoreScope`, so a consumer
  or job context works too. These answers are merchant-level, not buyer-safe: they include hidden collections and
  draft or hidden products, so anything a buyer sees goes through `CollectionsReadService`; the scope comes from
  `tenantOf` or the active store, never from request input. `productIdsOf` is unbounded (an automatic collection can
  hold tens of thousands of ids): an order path prefers `isMember` or `collectionIdsOfProducts`;
- `asCollectionsOperationContext` to pass a Vendure `RequestContext` to both.

Membership is **eventually consistent** with product edits: a tag, price or option change reaches automatic
collections through the outbox (`product.changed`, seconds of lag), and the nightly reconcile repairs what a failed
delivery missed (D2336). Drafts, hidden and sold-out products are members (D2306); visibility applies when products
are read through `CollectionsReadService`.

## Commands

`pnpm --filter @cod/plugin-collections-rules test` (unit), `typecheck`, and `test:integration` (needs the compose
Postgres).
