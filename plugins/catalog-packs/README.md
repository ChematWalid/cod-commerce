# @cod/plugin-catalog-packs

Pack (bundle) products of a store (P2.S2, D2200-D2205): a catalog product of type `pack` holds 2 to 10 component
lines; its price, weight and variant matrix are computed here and written into the product through catalog's
explicit-scope facade `CatalogProductCommands` (D2201, D2227), never through the plain catalog API.

| Layer | What lives there |
|---|---|
| `domain/` | `packPrice`, `packWeight`, `sharedOptionMatrix`, `checkComponents`, `computePack`, `packWriteOf`, ports |
| `application/` | `SavePackService`, `GetPackService`, `PreviewPackService`, `RecomputePacksService`, `PackPricesService` |
| `infrastructure/` | `catalog_pack` / `catalog_pack_component` (TenantRepository), the catalog facade adapter, the `catalog-packs-recompute` outbox consumer, `PackUnitPriceResolver` |
| `api/` | GraphQL `catalogPack`, `saveCatalogPack`, `previewCatalogPack`; REST `GET\|PUT catalog/packs/:productId`, `POST catalog/packs/preview` |

- Permissions (D2207): read `catalog.products.view`; save and preview `catalog.products.edit`. Preview is throttled
  per administrator (`catalog-pack-preview-actor`, D2217).
- Stored values (D2203): a save writes price, weight and matrix only when they change; the outbox consumer recomputes
  the packs holding a changed product in the store-channel context `CatalogProductCommands.storeContext` builds. A
  component deleted, set to draft or losing the shared value marks the pack `stale` (last price kept).
- `PackUnitPriceResolver` (D2204, D2276) prices pack variants live for the offers' pricing pipeline; it registers itself on `UNIT_PRICE_RESOLVER_REGISTRAR` from `@cod/plugin-offers` on bootstrap, so `CatalogPacksPlugin` imports `OffersPlugin` and comes after it in `buildPlugins`.

Tests: `pnpm --filter @cod/plugin-catalog-packs test` (unit, fakes) and `test:integration` (CI part
`catalog-packs`, worker id 1016, kit on `@cod/testing`'s `StoreKit`, D2216).
