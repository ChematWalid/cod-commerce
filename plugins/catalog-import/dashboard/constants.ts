import type { PermissionKey } from '@cod/shared';

/** The keys the server's `effectivePermissions` answers with, which decide the controls shown (ADR 0017). */
export const CREATE_PRODUCTS_KEY: PermissionKey = 'catalog.products.create';
export const VIEW_PRODUCTS_KEY: PermissionKey = 'catalog.products.view';
export const EDIT_PRODUCTS_KEY: PermissionKey = 'catalog.products.edit';

/** Query key prefixes; each query adds the store it answers for, so no store sees another's cache. */
export const IMPORT_JOB_QUERY_KEY = ['catalog-import', 'import'] as const;
export const IMPORT_PREVIEW_QUERY_KEY = ['catalog-import', 'preview'] as const;
export const EXPORT_JOB_QUERY_KEY = ['catalog-import', 'export'] as const;
export const BULK_BRANDS_QUERY_KEY = ['catalog-import', 'brands'] as const;
export const BULK_TAGS_QUERY_KEY = ['catalog-import', 'tags'] as const;

/** The import wizard's page below `/stores/<store>/` (a store-scoped page outside the sidebar, D2110). */
export const IMPORT_PATH = 'products/import';

/** The file picker's filter: the extensions of `IMPORT_FORMATS` (the server sniffs the bytes again, D2222). */
export const IMPORT_FILE_ACCEPT = '.xlsx,.csv';

/** How often a running import or export job is read again. */
export const JOB_POLL_INTERVAL_MS = 1_000;
/** How many preview rows one page of the wizard shows. */
export const PREVIEW_PAGE_SIZE = 50;

/** Ids of the items this plugin adds to the product list's action bar, and of its dialog host block. */
export const IMPORT_ACTION_ID = 'catalog-import-import';
export const EXPORT_ACTION_ID = 'catalog-import-export';
export const BULK_EDIT_ACTION_ID = 'catalog-import-bulk-edit';
export const LIST_DIALOGS_BLOCK_ID = 'catalog-import-list-dialogs';

/** `data-testid`s the browser spec and the evidence script look for. */
export const CATALOG_IMPORT_PAGE_TEST_ID = 'catalog-import-page';
export const IMPORT_FILE_INPUT_TEST_ID = 'catalog-import-file';
export const IMPORT_UPLOAD_TEST_ID = 'catalog-import-upload';
export const IMPORT_MAPPING_NEXT_TEST_ID = 'catalog-import-mapping-next';
export const IMPORT_PREVIEW_NEXT_TEST_ID = 'catalog-import-preview-next';
export const IMPORT_SUMMARY_TEST_ID = 'catalog-import-summary';
export const IMPORT_CONFIRM_TEST_ID = 'catalog-import-confirm';
export const IMPORT_RESULT_TEST_ID = 'catalog-import-result';
export const IMPORT_CREATED_TEST_ID = 'catalog-import-created';
export const IMPORT_ACTION_TEST_ID = 'catalog-import-action-import';
export const EXPORT_ACTION_TEST_ID = 'catalog-import-action-export';
export const BULK_EDIT_ACTION_TEST_ID = 'catalog-import-action-bulk-edit';
export const EXPORT_DIALOG_TEST_ID = 'catalog-import-export-dialog';
export const EXPORT_SUBMIT_TEST_ID = 'catalog-import-export-submit';
export const EXPORT_DOWNLOAD_TEST_ID = 'catalog-import-export-download';
export const BULK_DIALOG_TEST_ID = 'catalog-import-bulk-dialog';
export const BULK_STATUS_TEST_ID = 'catalog-import-bulk-status';
export const BULK_SUBMIT_TEST_ID = 'catalog-import-bulk-submit';
export const BULK_RESULT_TEST_ID = 'catalog-import-bulk-result';
