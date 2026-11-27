import type { PermissionKey } from '@cod/shared';

/** The delivery keys the server's `effectivePermissions` answers with, which decide the controls shown (ADR 0017). */
export const VIEW_PRICING_KEY: PermissionKey = 'delivery.pricing.view';
export const CREATE_PRICING_KEY: PermissionKey = 'delivery.pricing.create';
export const EDIT_PRICING_KEY: PermissionKey = 'delivery.pricing.edit';
export const DELETE_PRICING_KEY: PermissionKey = 'delivery.pricing.delete';
/** The Carriers tab's key (P5.S1 fills the tab); the `delivery` leaf opens with it alone. */
export const VIEW_CARRIERS_KEY: PermissionKey = 'delivery.carriers.view';

/** Query key prefixes; each store query adds the store it answers for (`StoreScope`), so no store sees another's cache. */
export const FEE_GROUPS_QUERY_KEY = ['delivery-pricing', 'list'] as const;
export const FEE_GROUP_QUERY_KEY = ['delivery-pricing', 'one'] as const;
export const PRICING_TEMPLATE_QUERY_KEY = ['delivery-pricing', 'template'] as const;
/** The communes of a wilaya: public reference data, the same for every store (D3117). */
export const TOWNS_QUERY_KEY = ['delivery-pricing', 'towns'] as const;

/** The shell leaf's account-level path, and the search value that opens the pricing tab (`?tab=pricing`). */
export const DELIVERY_PATH = '/delivery';
/** The pricing option pages below `/stores/<store>/` (D82): store-scoped pages outside the sidebar. */
export const NEW_PRICING_PATH = 'delivery/pricing/new';
export const pricingPathOf = (groupId: string): string => `delivery/pricing/${groupId}`;
/** The public wilaya detail with its communes (`GET /provinces/code/:code`, D3115). */
export const PROVINCE_BY_CODE_ENDPOINT = '/provinces/code/';

/** The `Page` ids of the delivery page and the pricing option editor, so later sessions can add blocks to them. */
export const DELIVERY_PAGE_ID = 'delivery-page';
export const PRICING_EDITOR_PAGE_ID = 'delivery-pricing-editor';

/** What a cell shows when it has nothing to show. */
export const EMPTY_VALUE = '—';

/** `data-testid`s the browser spec and the evidence script look for. */
export const DELIVERY_PAGE_TEST_ID = 'delivery-page';
export const DELIVERY_TABS_TEST_ID = 'delivery-tabs';
export const CARRIERS_PLACEHOLDER_TEST_ID = 'delivery-carriers-placeholder';
export const PRICING_LIST_TEST_ID = 'delivery-pricing-list';
export const PRICING_ROW_TEST_ID = 'delivery-pricing-row';
export const PRICING_EMPTY_TEST_ID = 'delivery-pricing-empty';
export const ADD_PRICING_TEST_ID = 'delivery-pricing-add';
export const PRICING_EDITOR_TEST_ID = 'delivery-pricing-editor';
export const PRICING_SAVE_TEST_ID = 'delivery-pricing-save';
export const PRICING_BACK_TEST_ID = 'delivery-pricing-back';
export const PRICING_NAME_TEST_ID = 'delivery-pricing-name';
export const APPLY_HOME_TEST_ID = 'delivery-pricing-apply-home';
export const APPLY_DESK_TEST_ID = 'delivery-pricing-apply-desk';
export const APPLY_ALL_TEST_ID = 'delivery-pricing-apply-all';
export const DELIVER_EVERYWHERE_TEST_ID = 'delivery-pricing-deliver-everywhere';
export const DESK_EVERYWHERE_TEST_ID = 'delivery-pricing-desk-everywhere';
export const WILAYA_ROW_TEST_ID = 'delivery-pricing-wilaya';
export const COMMUNES_SAVE_FIRST_TEST_ID = 'delivery-pricing-communes-save-first';
export const COMMUNE_PANEL_TEST_ID = 'delivery-pricing-communes';
export const COMMUNE_ROW_TEST_ID = 'delivery-pricing-commune';
export const WILAYA_SELECT_TEST_ID = 'delivery-pricing-wilaya-select';
export const SELECT_ALL_TEST_ID = 'delivery-pricing-select-all';
export const ADJUST_OPEN_TEST_ID = 'delivery-pricing-adjust-open';
export const ADJUST_DIALOG_TEST_ID = 'delivery-pricing-adjust-dialog';
export const ADJUST_VALUE_TEST_ID = 'delivery-pricing-adjust-value';
export const ADJUST_APPLY_TEST_ID = 'delivery-pricing-adjust-apply';
export const COMMUNE_PRICES_TEST_ID = 'delivery-pricing-commune-prices';
export const COMMUNE_PRICES_APPLY_TEST_ID = 'delivery-pricing-commune-prices-apply';
export const COPY_DIALOG_TEST_ID = 'delivery-pricing-copy-dialog';
export const COPY_NAME_TEST_ID = 'delivery-pricing-copy-name';
export const COPY_CONFIRM_TEST_ID = 'delivery-pricing-copy-confirm';

/** The most changed rows the CSV import preview lists; the rest are counted. */
export const CSV_PREVIEW_MAX_ROWS = 200;
/** The type of the downloaded export. */
export const CSV_DOWNLOAD_TYPE = 'text/csv;charset=utf-8';
export const CSV_EXPORT_TEST_ID = 'delivery-pricing-csv-export';
export const CSV_IMPORT_OPEN_TEST_ID = 'delivery-pricing-csv-import-open';
export const CSV_IMPORT_DIALOG_TEST_ID = 'delivery-pricing-csv-import-dialog';
export const CSV_IMPORT_FILE_TEST_ID = 'delivery-pricing-csv-import-file';
export const CSV_PREVIEW_TEST_ID = 'delivery-pricing-csv-preview';
export const CSV_ISSUES_TEST_ID = 'delivery-pricing-csv-issues';
export const CSV_APPLY_TEST_ID = 'delivery-pricing-csv-apply';
