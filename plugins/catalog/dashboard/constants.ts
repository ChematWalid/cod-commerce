import type { PermissionKey } from '@cod/shared';

/** The catalog keys the server's `effectivePermissions` answers with, which decide the controls shown (ADR 0017). */
export const CREATE_PRODUCTS_KEY: PermissionKey = 'catalog.products.create';
export const EDIT_PRODUCTS_KEY: PermissionKey = 'catalog.products.edit';
export const DELETE_PRODUCTS_KEY: PermissionKey = 'catalog.products.delete';

/** Query keys; a store switch invalidates every query, so each refetches with the new channel token. */
export const PRODUCTS_QUERY_KEY = ['catalog', 'products'] as const;
export const BRANDS_QUERY_KEY = ['catalog', 'brands'] as const;
export const TAGS_QUERY_KEY = ['catalog', 'tags'] as const;
export const MEDIA_PREVIEWS_QUERY_KEY = ['catalog', 'media-previews'] as const;
export const EFFECTIVE_PERMISSIONS_QUERY_KEY = ['catalog', 'effective-permissions'] as const;

/** The product pages below `/stores/<store>/` (D82): the list is the shell leaf, the editor routes are Task 16's. */
export const PRODUCTS_PATH = 'products';
export const NEW_PRODUCT_PATH = 'products/new';
export const productPathOf = (productId: string): string => `${PRODUCTS_PATH}/${productId}`;

/** `data-testid`s the browser spec and the evidence script look for. */
export const PRODUCT_LIST_TEST_ID = 'catalog-product-list';
export const PRODUCT_ROW_TEST_ID = 'catalog-product-row';
export const PRODUCTS_EMPTY_TEST_ID = 'catalog-products-empty';
export const PRODUCT_SEARCH_TEST_ID = 'catalog-product-search';
export const CREATE_PRODUCT_TEST_ID = 'catalog-create-product';
export const PRODUCT_TABS_TEST_ID = 'catalog-product-tabs';

/** What a table cell shows when it has nothing to show. */
export const EMPTY_VALUE = '—';
