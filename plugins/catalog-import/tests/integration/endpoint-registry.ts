/**
 * The registry of every catalog-import handler: its operation or route, permission, a call aimed at a target's ids,
 * and what another business gets back. The coverage test, the isolation sweep and the permission suite read it.
 * Each task appends its handlers here (bulk edit from Task 7, export from Task 8, spreadsheet import from Task 9).
 */
import { CATALOG_ERROR_CODES, CATALOG_IMPORT_ERROR_CODES, type PermissionKey } from '@cod/shared';
import { rawTestId } from '@cod/testing';

/** The ids of one business a call names; the isolation sweep fills them with B's and calls as A. */
export interface TargetIds {
  /** An import job of the business's first store. */
  readonly importId: string;
  /** An export job of the business's first store. */
  readonly exportId: string;
  /** A product of the business's first store. */
  readonly productId: string;
}

/**
 * `null` (a read of none), `not-found` (the entry's not-found code, 404 over REST), `reported` (the call succeeds
 * and reports each named product with the entry's not-found code, D2213) or `own-only` (the call succeeds about the
 * caller's own store only: another business's product is in no answer or file, D2258).
 */
export type ForeignOutcome = 'null' | 'not-found' | 'reported' | 'own-only';

/** One Admin API operation of the plugin, with a call aimed at a target's ids. */
export interface OperationEntry {
  readonly operation: string;
  readonly access: PermissionKey;
  readonly foreign: ForeignOutcome;
  readonly notFound: string;
  readonly document: string;
  readonly variables: (ids: TargetIds) => Readonly<Record<string, unknown>>;
}

/** One REST route of the plugin, with a call aimed at a target's ids. */
export interface RouteEntry {
  readonly method: 'GET' | 'POST' | 'PUT';
  readonly route: string;
  readonly access: PermissionKey;
  readonly foreign: Exclude<ForeignOutcome, 'null'>;
  readonly notFound: string;
  readonly url: (ids: TargetIds) => string;
  readonly body?: (ids: TargetIds) => Readonly<Record<string, unknown>>;
}

/** A bulk edit (D2213) setting the target's product to Draft; REST names the database id, GraphQL its `ID`. */
export const bulkEditBody = (ids: TargetIds, rest = false): Readonly<Record<string, unknown>> => ({
  productIds: [rest ? rawTestId(ids.productId) : ids.productId],
  changes: { status: 'draft' },
});

/** The selection a `reported` call answers with: one result per named product. */
export const BULK_EDIT_RESULT_FIELDS = 'results { productId ok changedFields error }';

/** An export (D2211) of the target's product as CSV; REST names the database id, GraphQL its `ID`. */
export const exportBody = (ids: TargetIds, rest = false): Readonly<Record<string, unknown>> => ({
  scope: 'selected',
  format: 'csv',
  productIds: [rest ? rawTestId(ids.productId) : ids.productId],
});

/** The selection of an export answer. */
export const EXPORT_FIELDS = 'exportId status progress rowCount skippedPacks errorCode downloadUrl';

const VIEW = 'catalog.products.view';
const CREATE = 'catalog.products.create';
const JOB_NOT_FOUND = CATALOG_IMPORT_ERROR_CODES.JOB_NOT_FOUND;

/** A CSV upload of 64 bytes (D2208): the format's own content type. */
export const uploadBody = (): Readonly<Record<string, unknown>> => ({
  format: 'csv',
  size: 64,
  contentType: 'text/csv',
});

/** The selection of an import answer. */
export const IMPORT_FIELDS =
  'importId status format rowCount progress headerRow columns { column header field warning } ' +
  'summary { creates updates errors warnings } result { created updated failed } errorCode errorReportUrl';

/** The selection of a preview page. */
export const PREVIEW_FIELDS =
  'importId totalItems skip take items { rowNumber action productKey name messages } summary { creates updates errors warnings }';

/** Every Admin API operation the plugin's resolvers declare. */
export const OPERATION_REGISTRY: readonly OperationEntry[] = [
  {
    operation: 'bulkEditCatalogProducts',
    access: 'catalog.products.edit',
    foreign: 'reported',
    notFound: CATALOG_ERROR_CODES.PRODUCT_NOT_FOUND,
    document: `mutation ($input: CatalogBulkEditInput!) { bulkEditCatalogProducts(input: $input) { ${BULK_EDIT_RESULT_FIELDS} } }`,
    variables: (ids) => ({ input: bulkEditBody(ids) }),
  },
  {
    operation: 'exportCatalogProducts',
    access: VIEW,
    foreign: 'own-only',
    notFound: JOB_NOT_FOUND,
    document: `mutation ($input: CatalogExportInput!) { exportCatalogProducts(input: $input) { ${EXPORT_FIELDS} } }`,
    variables: (ids) => ({ input: exportBody(ids) }),
  },
  {
    operation: 'catalogExport',
    access: VIEW,
    foreign: 'not-found',
    notFound: JOB_NOT_FOUND,
    document: `query ($id: String!) { catalogExport(id: $id) { ${EXPORT_FIELDS} } }`,
    variables: (ids) => ({ id: ids.exportId }),
  },
  {
    operation: 'catalogImportFields',
    access: VIEW,
    foreign: 'own-only',
    notFound: JOB_NOT_FOUND,
    document: 'query { catalogImportFields { key required } }',
    variables: () => ({}),
  },
  {
    operation: 'catalogImportFormats',
    access: VIEW,
    foreign: 'own-only',
    notFound: JOB_NOT_FOUND,
    document: 'query { catalogImportFormats { format contentType extension } }',
    variables: () => ({}),
  },
  {
    operation: 'createCatalogImportUpload',
    access: CREATE,
    foreign: 'own-only',
    notFound: JOB_NOT_FOUND,
    document:
      'mutation ($input: CatalogImportUploadInput!) { createCatalogImportUpload(input: $input) { importId uploadUrl method headers { name value } expiresAt } }',
    variables: () => ({ input: uploadBody() }),
  },
  {
    operation: 'analyzeCatalogImport',
    access: CREATE,
    foreign: 'not-found',
    notFound: JOB_NOT_FOUND,
    document: `mutation ($input: CatalogImportAnalyzeInput!) { analyzeCatalogImport(input: $input) { ${IMPORT_FIELDS} } }`,
    variables: (ids) => ({ input: { importId: ids.importId } }),
  },
  {
    operation: 'catalogImport',
    access: CREATE,
    foreign: 'not-found',
    notFound: JOB_NOT_FOUND,
    document: `query ($id: String!) { catalogImport(id: $id) { ${IMPORT_FIELDS} } }`,
    variables: (ids) => ({ id: ids.importId }),
  },
  {
    operation: 'catalogImportPreview',
    access: CREATE,
    foreign: 'not-found',
    notFound: JOB_NOT_FOUND,
    document: `query ($id: String!) { catalogImportPreview(id: $id) { ${PREVIEW_FIELDS} } }`,
    variables: (ids) => ({ id: ids.importId }),
  },
  {
    operation: 'previewCatalogImport',
    access: CREATE,
    foreign: 'not-found',
    notFound: JOB_NOT_FOUND,
    document: `mutation ($id: String!) { previewCatalogImport(id: $id) { ${PREVIEW_FIELDS} } }`,
    variables: (ids) => ({ id: ids.importId }),
  },
  {
    operation: 'confirmCatalogImport',
    access: CREATE,
    foreign: 'not-found',
    notFound: JOB_NOT_FOUND,
    document: `mutation ($id: String!) { confirmCatalogImport(id: $id) { ${IMPORT_FIELDS} } }`,
    variables: (ids) => ({ id: ids.importId }),
  },
];

/** Every REST route the plugin's controllers declare. */
export const ROUTE_REGISTRY: readonly RouteEntry[] = [
  {
    method: 'POST',
    route: '/catalog/products/bulk-edit',
    access: 'catalog.products.edit',
    foreign: 'reported',
    notFound: CATALOG_ERROR_CODES.PRODUCT_NOT_FOUND,
    url: () => '/catalog/products/bulk-edit',
    body: (ids) => bulkEditBody(ids, true),
  },
  {
    method: 'POST',
    route: '/catalog/products/export',
    access: VIEW,
    foreign: 'own-only',
    notFound: JOB_NOT_FOUND,
    url: () => '/catalog/products/export',
    body: (ids) => exportBody(ids, true),
  },
  {
    method: 'GET',
    route: '/catalog/import-export/exports/:id',
    access: VIEW,
    foreign: 'not-found',
    notFound: JOB_NOT_FOUND,
    url: (ids) => `/catalog/import-export/exports/${ids.exportId}`,
  },
  {
    method: 'GET',
    route: '/catalog/import-export/fields',
    access: VIEW,
    foreign: 'own-only',
    notFound: JOB_NOT_FOUND,
    url: () => '/catalog/import-export/fields',
  },
  {
    method: 'GET',
    route: '/catalog/import-export/formats',
    access: VIEW,
    foreign: 'own-only',
    notFound: JOB_NOT_FOUND,
    url: () => '/catalog/import-export/formats',
  },
  {
    method: 'POST',
    route: '/catalog/import-export/uploads',
    access: CREATE,
    foreign: 'own-only',
    notFound: JOB_NOT_FOUND,
    url: () => '/catalog/import-export/uploads',
    body: () => uploadBody(),
  },
  {
    method: 'POST',
    route: '/catalog/import-export/products/analyze',
    access: CREATE,
    foreign: 'not-found',
    notFound: JOB_NOT_FOUND,
    url: () => '/catalog/import-export/products/analyze',
    body: (ids) => ({ importId: ids.importId }),
  },
  {
    method: 'GET',
    route: '/catalog/import-export/products/imports/:id',
    access: CREATE,
    foreign: 'not-found',
    notFound: JOB_NOT_FOUND,
    url: (ids) => `/catalog/import-export/products/imports/${ids.importId}`,
  },
  {
    method: 'GET',
    route: '/catalog/import-export/products/imports/:id/preview',
    access: CREATE,
    foreign: 'not-found',
    notFound: JOB_NOT_FOUND,
    url: (ids) => `/catalog/import-export/products/imports/${ids.importId}/preview?skip=0&take=50`,
  },
  {
    method: 'POST',
    route: '/catalog/import-export/products/imports/:id/preview',
    access: CREATE,
    foreign: 'not-found',
    notFound: JOB_NOT_FOUND,
    url: (ids) => `/catalog/import-export/products/imports/${ids.importId}/preview`,
    body: () => ({}),
  },
  {
    method: 'POST',
    route: '/catalog/import-export/products/imports/:id/confirm',
    access: CREATE,
    foreign: 'not-found',
    notFound: JOB_NOT_FOUND,
    url: (ids) => `/catalog/import-export/products/imports/${ids.importId}/confirm`,
  },
];

export const operationKey = (entry: OperationEntry): string => entry.operation;
export const routeKey = (entry: RouteEntry): string => `${entry.method} ${entry.route}`;
