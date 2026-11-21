import type { PermissionKey } from '@cod/shared';

/** The keys the server's `effectivePermissions` answers with, which decide the controls shown (ADR 0017). */
export const VIEW_PRODUCTS_KEY: PermissionKey = 'catalog.products.view';
export const EDIT_PRODUCTS_KEY: PermissionKey = 'catalog.products.edit';

/** Query key prefixes; each query adds the store it answers for, so no store sees another's cache. */
export const PACK_QUERY_KEY = ['packs', 'pack'] as const;
export const PACK_PRODUCT_QUERY_KEY = ['packs', 'product'] as const;
export const PACK_CANDIDATES_QUERY_KEY = ['packs', 'candidates'] as const;

/** The pack block's id on catalog's product editor page (D2105). */
export const PACK_BLOCK_ID = 'packs-editor-block';

/** How many products one search of the component picker lists. */
export const PICKER_PAGE_SIZE = 20;

/** `data-testid`s the browser spec and the evidence script look for. */
export const PACK_BLOCK_TEST_ID = 'packs-block';
export const PACK_SAVE_FIRST_TEST_ID = 'packs-save-first';
export const PACK_PICKER_SEARCH_TEST_ID = 'packs-picker-search';
export const PACK_PICKER_OPTION_TEST_ID = 'packs-picker-option';
export const PACK_COMPONENT_ROW_TEST_ID = 'packs-component-row';
export const PACK_DISCOUNT_VALUE_TEST_ID = 'packs-discount-value';
export const PACK_SAVE_TEST_ID = 'packs-save';
export const PACK_PREVIEW_TEST_ID = 'packs-preview';
export const PACK_PRICE_TEST_ID = 'packs-price';
