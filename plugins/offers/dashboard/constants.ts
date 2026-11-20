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

/** The offer pages below `/stores/<store>/` (D2523): the list is the shell leaf, the editor routes are Task 13's. */
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

/** What a table cell shows when it has nothing to show. */
export const EMPTY_VALUE = '—';
