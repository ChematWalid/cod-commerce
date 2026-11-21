import type { PermissionKey } from '@cod/shared';

/** The offer keys the server's `effectivePermissions` answers with, which decide the controls shown (D2517, ADR 0017). */
export const VIEW_OFFERS_KEY: PermissionKey = 'offers.view';
export const CREATE_OFFERS_KEY: PermissionKey = 'offers.create';
export const EDIT_OFFERS_KEY: PermissionKey = 'offers.edit';
export const DELETE_OFFERS_KEY: PermissionKey = 'offers.delete';

/** Query key prefixes; each query adds the store it answers for (`StoreScope`), so no store sees another's cache. */
export const OFFERS_QUERY_KEY = ['offers', 'list'] as const;
export const APP_TYPES_QUERY_KEY = ['offers', 'app-types'] as const;
export const EFFECTIVE_PERMISSIONS_QUERY_KEY = ['offers', 'effective-permissions'] as const;
export const OFFER_QUERY_KEY = ['offers', 'offer'] as const;
export const PREVIEW_QUERY_KEY = ['offers', 'preview'] as const;
export const OFFER_CODES_QUERY_KEY = ['offers', 'codes'] as const;
export const TARGET_PRODUCTS_QUERY_KEY = ['offers', 'target-products'] as const;
export const TARGET_PRODUCT_QUERY_KEY = ['offers', 'target-product'] as const;

/** The offer pages below `/stores/<store>/` (D2523): the list is the shell leaf, the editor routes sit beside it. */
export const OFFERS_PATH = 'offers';
export const NEW_OFFER_PATH = 'offers/new';
export const offerPathOf = (offerId: string): string => `${OFFERS_PATH}/${offerId}`;

/** `data-testid`s the browser spec and the evidence script look for. */
export const OFFER_LIST_TEST_ID = 'offers-offer-list';
export const OFFER_ROW_TEST_ID = 'offers-offer-row';
export const OFFERS_EMPTY_TEST_ID = 'offers-offers-empty';
export const OFFER_TABS_TEST_ID = 'offers-offer-tabs';
export const KIND_CHIPS_TEST_ID = 'offers-kind-chips';
export const CREATE_OFFER_TEST_ID = 'offers-create-offer';
export const CREATE_DIALOG_TEST_ID = 'offers-create-dialog';
export const APP_TYPE_CARD_TEST_ID = 'offers-app-type-card';
export const OFFER_EDITOR_TEST_ID = 'offers-offer-editor';
export const ARABIC_PREVIEW_TEST_ID = 'offers-arabic-preview';
export const EDITOR_SAVE_TEST_ID = 'offers-editor-save';
export const EDITOR_PUBLISH_TEST_ID = 'offers-editor-publish';
export const EDITOR_DISCARD_TEST_ID = 'offers-editor-discard';
export const SUMMARY_CARD_TEST_ID = 'offers-summary-card';
export const CODES_PANEL_TEST_ID = 'offers-codes-panel';

/** How long the editor waits after the last change before it asks for a new preview (D2516). */
export const PREVIEW_DEBOUNCE_MS = 300;
/** Products a target search lists at once. */
export const TARGET_SEARCH_TAKE = 10;
/** Algeria's offset from UTC: the country keeps UTC+1 all year, so offer dates are typed and shown in it. */
export const ALGERIA_UTC_OFFSET = '+01:00';
export const ALGERIA_UTC_OFFSET_MS = 60 * 60 * 1000;

/** What a table cell shows when it has nothing to show. */
export const EMPTY_VALUE = '—';
