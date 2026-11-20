import type { PermissionKey } from '@cod/shared';

/** The collections keys the server's `effectivePermissions` answers with, which decide the controls shown (ADR 0017). */
export const VIEW_COLLECTIONS_KEY: PermissionKey = 'catalog.collections.view';
export const CREATE_COLLECTIONS_KEY: PermissionKey = 'catalog.collections.create';
export const EDIT_COLLECTIONS_KEY: PermissionKey = 'catalog.collections.edit';
export const DELETE_COLLECTIONS_KEY: PermissionKey = 'catalog.collections.delete';
/** The image card picks through catalog's media library, so it needs catalog's keys (D2320). */
export const VIEW_PRODUCTS_KEY: PermissionKey = 'catalog.products.view';
export const CREATE_PRODUCTS_KEY: PermissionKey = 'catalog.products.create';

/** Query key prefixes; each query adds the store it answers for (`StoreScope`), so no store sees another's cache. */
export const COLLECTIONS_QUERY_KEY = ['collections', 'list'] as const;
export const COLLECTION_QUERY_KEY = ['collections', 'one'] as const;
export const COLLECTION_PRODUCTS_QUERY_KEY = ['collections', 'products'] as const;
export const PRODUCT_SEARCH_QUERY_KEY = ['collections', 'product-search'] as const;
export const SLUG_QUERY_KEY = ['collections', 'slug-availability'] as const;
export const MEDIA_LIBRARY_QUERY_KEY = ['collections', 'media-library'] as const;
export const EFFECTIVE_PERMISSIONS_QUERY_KEY = ['collections', 'effective-permissions'] as const;
export const RULE_OPTIONS_QUERY_KEY = ['collections', 'rule-options'] as const;
export const PRODUCT_COLLECTIONS_QUERY_KEY = ['collections', 'of-product'] as const;
export const COLLECTION_CHOICES_QUERY_KEY = ['collections', 'choices'] as const;

/** The collection pages below `/stores/<store>/` (D82): the list is the shell leaf, the editor routes are ours. */
export const COLLECTIONS_PATH = 'collections';
export const NEW_COLLECTION_PATH = 'collections/new';
export const collectionPathOf = (collectionId: string): string => `${COLLECTIONS_PATH}/${collectionId}`;

/** The `Page` ids of the list and the editor, so later sessions can add blocks to them. */
export const COLLECTION_LIST_PAGE_ID = 'collections-list';
export const COLLECTION_EDITOR_PAGE_ID = 'collections-editor';
/** The editor's cards, each under a pinned block id so later sessions can add theirs around it. */
export const COLLECTION_EDITOR_BLOCK_IDS = {
  details: 'collections-details',
  products: 'collections-products',
  image: 'collections-image',
  visibility: 'collections-visibility',
  organisation: 'collections-organisation',
} as const;

/** How long the editor waits after the last change before it asks for a preview or a slug check. */
export const PREVIEW_DELAY_MS = 400;
export const SLUG_CHECK_DELAY_MS = 500;
/** How many matching products the preview lists under its count. */
export const PREVIEW_ROWS = 10;
/** The block the collections plugin adds to catalog's product editor (D2324a). */
export const PRODUCT_COLLECTIONS_BLOCK_ID = 'collections-product-collections';

/** How long the product search waits after the last key. */
export const PRODUCT_SEARCH_DELAY_MS = 300;

/** What a table cell shows when it has nothing to show. */
export const EMPTY_VALUE = '—';

/** `data-testid`s the browser spec and the evidence script look for. */
export const COLLECTION_LIST_TEST_ID = 'collections-list';
export const COLLECTION_ROW_TEST_ID = 'collections-row';
export const COLLECTIONS_EMPTY_TEST_ID = 'collections-empty';
export const CREATE_COLLECTION_TEST_ID = 'collections-create';
export const COLLECTION_EDITOR_TEST_ID = 'collections-editor';
export const COLLECTION_SAVE_TEST_ID = 'collections-save';
export const COLLECTION_TITLE_TEST_ID = 'collections-title';
export const COLLECTION_MODE_TEST_ID = 'collections-mode';
export const MODE_SWITCH_CONFIRM_TEST_ID = 'collections-mode-confirm';
export const COLLECTION_MATCH_ALL_TEST_ID = 'collections-match-all';
export const COLLECTION_MATCH_ANY_TEST_ID = 'collections-match-any';
export const CONDITION_ROW_TEST_ID = 'collections-condition-row';
export const PREVIEW_COUNT_TEST_ID = 'collections-preview-count';
export const MANUAL_PRODUCT_ROW_TEST_ID = 'collections-manual-product';
export const ADD_PRODUCTS_TEST_ID = 'collections-add-products';
export const COLLECTION_VISIBLE_TEST_ID = 'collections-visible';
export const COLLECTION_POSITION_TEST_ID = 'collections-position';
export const PRODUCT_COLLECTIONS_BLOCK_TEST_ID = 'collections-product-block';
export const ADD_CONDITION_TEST_ID = 'collections-add-condition';
export const PRODUCT_COLLECTIONS_SAVE_TEST_ID = 'collections-product-block-save';
