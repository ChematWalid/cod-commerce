import type { ProductListQuery } from './list-query';

/**
 * Block and action-bar ids of the product list page. Other plugins add action-bar items (export, bulk edit, import)
 * by these strings through stock `actionBarItems` (D2105, D2201), never by importing the catalog dashboard; the values
 * are pinned by a test.
 */
export const CATALOG_PRODUCT_LIST_BLOCK_ID = 'catalog-product-list';
export const CATALOG_CREATE_PRODUCT_ACTION_ID = 'catalog-create-product';

/**
 * The `entity` the product list page hands its action-bar items (D2201): the list's current query and the ids the
 * merchant selected, so an export or a bulk edit acts on exactly what the list shows.
 */
export type CatalogProductListPageEntity = {
  readonly query: ProductListQuery;
  readonly selectedIds: readonly string[];
};
