// The public entry of the catalog (D2104, rule `catalog-entry-infra-only`): another plugin imports it only from its
// infrastructure/, its root *.plugin.ts file or its tests/; of the apps only apps/server does (frontends are API
// clients, ADR 0017). api/, application/, domain/ and dashboard/ never do. The handoff lists what later sessions use.
export { CatalogPlugin } from './catalog.plugin';
export { CatalogProductQueries } from './infrastructure/catalog-product-queries';
export type { ProductView } from './application/product-view';
export type { ProductViewPage } from './application/list-products.service';
export { ORDER_MANAGER_CHECK_REGISTRAR } from './application/tokens';
export type { OrderManagerCheck, OrderManagerCheckRegistrar } from './domain/ports/order-manager-check.port';
export type { OperationContext as CatalogOperationContext } from './domain/ports/operation-context';
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
} from './dashboard/constants';
