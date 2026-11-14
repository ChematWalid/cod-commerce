import type { PermissionKey } from '@cod/shared';

/** The catalog keys the server's `effectivePermissions` answers with, which decide the controls shown (ADR 0017). */
export const CREATE_PRODUCTS_KEY: PermissionKey = 'catalog.products.create';
export const EDIT_PRODUCTS_KEY: PermissionKey = 'catalog.products.edit';
export const DELETE_PRODUCTS_KEY: PermissionKey = 'catalog.products.delete';
export const VIEW_PRODUCTS_KEY: PermissionKey = 'catalog.products.view';
/** The team key that lets the editor list the members who may be order managers (D2114). */
export const VIEW_MEMBERS_KEY: PermissionKey = 'team.members.view';

/** Query key prefixes; each query adds the store it answers for (`StoreScope`), so no store sees another's cache. */
export const PRODUCTS_QUERY_KEY = ['catalog', 'products'] as const;
export const BRANDS_QUERY_KEY = ['catalog', 'brands'] as const;
export const TAGS_QUERY_KEY = ['catalog', 'tags'] as const;
export const MEDIA_PREVIEWS_QUERY_KEY = ['catalog', 'media-previews'] as const;
export const EFFECTIVE_PERMISSIONS_QUERY_KEY = ['catalog', 'effective-permissions'] as const;
export const PRODUCT_QUERY_KEY = ['catalog', 'product'] as const;
export const HIGHLIGHTS_QUERY_KEY = ['catalog', 'highlights'] as const;
export const MEDIA_LIBRARY_QUERY_KEY = ['catalog', 'media-library'] as const;
export const SLUG_QUERY_KEY = ['catalog', 'slug-availability'] as const;
export const ORDER_MANAGERS_QUERY_KEY = ['catalog', 'order-managers'] as const;

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
export const PRODUCT_EDITOR_TEST_ID = 'catalog-product-editor';
export const EDITOR_SAVE_TEST_ID = 'catalog-editor-save';
export const EDITOR_TITLE_TEST_ID = 'catalog-editor-title';
export const EDITOR_PRICE_TEST_ID = 'catalog-editor-price';
export const EDITOR_SKU_TEST_ID = 'catalog-editor-sku';
export const OPTION_NAME_INPUT_TEST_ID = 'catalog-option-name';
export const OPTION_VALUE_INPUT_TEST_ID = 'catalog-option-value';
export const VARIANT_ROW_TEST_ID = 'catalog-variant-row';
export const VARIANT_PRICE_TEST_ID = 'catalog-variant-price';
export const RESET_CONFIRM_TEST_ID = 'catalog-reset-confirm';

/** How long the slug field waits after the last key before it asks whether the slug is free. */
export const SLUG_CHECK_DELAY_MS = 500;

/** What a table cell shows when it has nothing to show. */
export const EMPTY_VALUE = '—';
