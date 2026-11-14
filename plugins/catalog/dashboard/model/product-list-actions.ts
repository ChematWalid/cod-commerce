import {
  CATALOG_CREATE_PRODUCT_ACTION_ID,
  type CatalogProductListPageEntity,
  type PermissionKey,
  productListQuerySchema,
  type ProductListQueryInput,
} from '@cod/shared';
import { CREATE_PRODUCTS_KEY } from '../constants';

/** An item of the product list's action bar and the key a caller must hold to see it. */
export interface ListActionItem {
  readonly id: string;
  readonly requires: PermissionKey;
}

/** Create product, for holders of the create key. */
export const CREATE_PRODUCT_ACTION: ListActionItem = {
  id: CATALOG_CREATE_PRODUCT_ACTION_ID,
  requires: CREATE_PRODUCTS_KEY,
};

/**
 * The items of `items` a caller holding `held` sees. The action bar itself is rendered for every viewer (D2201): other
 * plugins add items to it (export for viewers, bulk edit for editors), and each item is gated by its own key.
 */
export const actionItemsShown = (
  items: readonly ListActionItem[],
  held: ReadonlySet<string>,
): readonly ListActionItem[] => items.filter((item) => held.has(item.requires));

/**
 * The `entity` the list page hands its action-bar items: the list's query and the ticked products (D2201). A search
 * the server would refuse (the list then shows its error) is left out rather than breaking the page.
 */
export function listPageEntityOf(
  query: ProductListQueryInput,
  selectedIds: readonly string[],
): CatalogProductListPageEntity {
  const parsed = productListQuerySchema.safeParse(query);
  return {
    query: parsed.success ? parsed.data : productListQuerySchema.parse({ ...query, q: undefined }),
    selectedIds: [...selectedIds],
  };
}
