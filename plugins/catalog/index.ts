// The public entry of the catalog (D2104, rule `catalog-entry-infra-only`): another plugin imports it only from its
// infrastructure/, its root *.plugin.ts file or its tests/; of the apps only apps/server does (frontends are API
// clients, ADR 0017). api/, application/, domain/ and dashboard/ never do. The handoff lists what later sessions use.
export { CatalogPlugin } from './catalog.plugin';
export { CatalogProductQueries } from './infrastructure/catalog-product-queries';
export {
  CATALOG_FACTS_MAX_IDS,
  type CatalogFactsIdPage,
  type CatalogFactsPage,
  CatalogProductFactsReader,
} from './infrastructure/catalog-product-facts';
export {
  type CatalogProductFacts,
  type CatalogRuleName,
  type CatalogRuleOption,
  type CatalogRuleOptions,
  CatalogStoreChannelMismatchError,
  type CatalogVariantOption,
} from './application/product-facts';
export {
  CatalogProductCommands,
  type PackSaveLock,
  type ProductStatusChange,
} from './infrastructure/catalog-product-commands';
export type { ProductSaveResult, ProductView } from './application/product-view';
export type { ProductWithVariantsCommand, VariantOverride } from './application/create-product-with-variants.service';
export type {
  NamedRef,
  ProductIdsPage,
  ProductIdsPageRequest,
  TaxonomyIndex,
} from './application/product-lookup.service';
export type { ProductListFilter } from './application/product-criteria';
export type { PackOptionPrice, PackValues } from './application/write-pack-values.service';
export type { SkuMatch } from './domain/sku-match';
export type { StoreScope as CatalogStoreScope } from './domain/store-scope';
export type { ProductViewPage } from './application/list-products.service';
export {
  type CatalogListOptions,
  type CatalogReadOptions,
  CatalogReadService,
  NoActiveStoreError,
  type VisibleImage,
  type VisibleProduct,
  type VisibleProductPage,
  type VisibleVariant,
} from './application/catalog-read.service';
export { DemoCatalogSeedService, type DemoSeedExtras } from './application/demo-catalog-seed.service';
export {
  DEMO_COLLECTION_KEYS,
  type DemoCollectionKey,
  type DemoCollectionSpec,
  demoCollectionsFor,
  demoProductsFor,
  type DemoProductSpec,
} from './domain/demo-products';
export type { PublicListContext, PublicVisibilityContext } from './domain/visibility';
export {
  COLLECTION_MEMBERSHIP_SOURCE_REGISTRAR,
  ORDER_MANAGER_CHECK_REGISTRAR,
  SOLD_OUT_SOURCE_REGISTRAR,
} from './application/tokens';
export type {
  CollectionMembershipSource,
  CollectionMembershipSourceRegistrar,
  CollectionOption as CatalogCollectionOption,
} from './domain/ports/collection-membership-source.port';
export { CollectionMembershipSourceAlreadyRegisteredError } from './domain/errors';
export { CATALOG_MAX_AMONG_IDS } from './domain/constants';
export type { SoldOutSource, SoldOutSourceRegistrar } from './domain/ports/sold-out-source.port';
export { type CoreId, parseCoreId, toCoreId } from './domain/core-id';
export type { OrderManagerCheck, OrderManagerCheckRegistrar } from './domain/ports/order-manager-check.port';
export {
  asOperationContext as asCatalogOperationContext,
  type OperationContext as CatalogOperationContext,
} from './domain/ports/operation-context';
export {
  CREATE_PRODUCT_TEST_ID,
  EDITOR_PRICE_TEST_ID,
  EDITOR_SAVE_TEST_ID,
  EDITOR_SKU_TEST_ID,
  EDITOR_TITLE_TEST_ID,
  OPTION_NAME_INPUT_TEST_ID,
  OPTION_VALUE_INPUT_TEST_ID,
  PRODUCT_EDITOR_TEST_ID,
  PRODUCT_LIST_TEST_ID,
  PRODUCT_ROW_TEST_ID,
  PRODUCT_SEARCH_TEST_ID,
  PRODUCT_TABS_TEST_ID,
  PRODUCTS_EMPTY_TEST_ID,
  VARIANT_PRICE_TEST_ID,
  VARIANT_ROW_TEST_ID,
  VARIANT_SKU_TEST_ID,
} from './dashboard/constants';
