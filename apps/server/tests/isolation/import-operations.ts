import {
  importTargetOf,
  type ImportTarget,
  JOB_NOT_FOUND,
  jobNotFound,
  PRODUCT_NOT_FOUND,
  restImportTargetOf,
  restNotFound,
} from './import-targets';
import { LINK_OPERATIONS, LINK_ROUTES } from './link-import-operations';
import type { SweptEndpoints, SweptOperation, SweptRoute } from './endpoint-sweep';
import type { Expectation } from './matrix';

/**
 * Every catalog-import endpoint (plugins/catalog-import, P2.S2: bulk edit, export, spreadsheet import, link import and
 * polish) as the P2 matrix calls it, aimed at a business's catalog product, jobs and link-imported Draft. The import
 * cases build their cells from these lists, so a new endpoint is one entry here.
 */

/** A bulk edit (D2213) setting the target's product to Draft. */
export const bulkEditBody = (t: ImportTarget): Record<string, unknown> => ({
  productIds: [t.productId],
  changes: { status: 'draft' },
});

/** An export (D2211) of the target's product as CSV. */
const exportBody = (t: ImportTarget): Record<string, unknown> => ({
  scope: 'selected',
  format: 'csv',
  productIds: [t.productId],
});

const uploadBody = (): Record<string, unknown> => ({ format: 'csv', size: 64, contentType: 'text/csv' });

/** A success that reports each of the victim's products not found and writes nothing (D2213). */
const REPORTED: Expectation = { kind: 'own', mustInclude: () => [PRODUCT_NOT_FOUND] };
/** A success about the caller's own store only: an export of the victim's ids holds no row (D2258). */
const EMPTY_EXPORT: Expectation = { kind: 'own', mustInclude: () => ['"rowCount":0'] };

export const BULK_EDIT_DOCUMENT =
  'mutation ($input: CatalogBulkEditInput!) { bulkEditCatalogProducts(input: $input) { results { productId ok error } } }';
const EXPORT_FIELDS = 'exportId status rowCount errorCode';
const IMPORT_FIELDS = 'importId status rowCount errorCode';
const PREVIEW_FIELDS = 'importId totalItems items { rowNumber action productKey }';

const BULK_AND_EXPORT_OPERATIONS: readonly SweptOperation<ImportTarget>[] = [
  {
    name: 'bulkEditCatalogProducts',
    entity: 'product',
    document: BULK_EDIT_DOCUMENT,
    variables: (t) => ({ input: bulkEditBody(t) }),
    foreign: REPORTED,
  },
  {
    name: 'exportCatalogProducts',
    entity: 'export job',
    document: `mutation ($input: CatalogExportInput!) { exportCatalogProducts(input: $input) { ${EXPORT_FIELDS} } }`,
    variables: (t) => ({ input: exportBody(t) }),
    foreign: EMPTY_EXPORT,
  },
  {
    name: 'catalogExport',
    entity: 'export job',
    document: `query ($id: String!) { catalogExport(id: $id) { ${EXPORT_FIELDS} } }`,
    variables: (t) => ({ id: t.exportId }),
    foreign: jobNotFound,
  },
];

const SPREADSHEET_OPERATIONS: readonly SweptOperation<ImportTarget>[] = [
  {
    name: 'catalogImportFields',
    entity: 'import job',
    document: 'query { catalogImportFields { key required } }',
    variables: () => ({}),
  },
  {
    name: 'catalogImportFormats',
    entity: 'import job',
    document: 'query { catalogImportFormats { format contentType extension } }',
    variables: () => ({}),
  },
  {
    name: 'createCatalogImportUpload',
    entity: 'import job',
    document:
      'mutation ($input: CatalogImportUploadInput!) { createCatalogImportUpload(input: $input) { importId uploadUrl } }',
    variables: () => ({ input: uploadBody() }),
  },
  {
    name: 'analyzeCatalogImport',
    entity: 'import job',
    document: `mutation ($input: CatalogImportAnalyzeInput!) { analyzeCatalogImport(input: $input) { ${IMPORT_FIELDS} } }`,
    variables: (t) => ({ input: { importId: t.importId } }),
    foreign: jobNotFound,
  },
  {
    name: 'catalogImport',
    entity: 'import job',
    document: `query ($id: String!) { catalogImport(id: $id) { ${IMPORT_FIELDS} errorReportUrl } }`,
    variables: (t) => ({ id: t.importId }),
    foreign: jobNotFound,
  },
  {
    name: 'catalogImportPreview',
    entity: 'import job',
    document: `query ($id: String!) { catalogImportPreview(id: $id) { ${PREVIEW_FIELDS} } }`,
    variables: (t) => ({ id: t.importId }),
    foreign: jobNotFound,
  },
  {
    name: 'previewCatalogImport',
    entity: 'import job',
    document: `mutation ($id: String!) { previewCatalogImport(id: $id) { ${PREVIEW_FIELDS} } }`,
    variables: (t) => ({ id: t.importId }),
    foreign: jobNotFound,
  },
  {
    name: 'confirmCatalogImport',
    entity: 'import job',
    document: `mutation ($id: String!) { confirmCatalogImport(id: $id) { ${IMPORT_FIELDS} } }`,
    variables: (t) => ({ id: t.importId }),
    foreign: jobNotFound,
  },
];

export const IMPORT_OPERATIONS: readonly SweptOperation<ImportTarget>[] = [
  ...BULK_AND_EXPORT_OPERATIONS,
  ...SPREADSHEET_OPERATIONS,
  ...LINK_OPERATIONS,
];

const IMPORTS = '/catalog/import-export/products/imports';

const BULK_AND_EXPORT_ROUTES: readonly SweptRoute<ImportTarget>[] = [
  {
    method: 'POST',
    route: '/catalog/products/bulk-edit',
    entity: 'product',
    path: () => '/catalog/products/bulk-edit',
    body: bulkEditBody,
    foreign: REPORTED,
  },
  {
    method: 'POST',
    route: '/catalog/products/export',
    entity: 'export job',
    path: () => '/catalog/products/export',
    body: exportBody,
    foreign: EMPTY_EXPORT,
  },
  {
    method: 'GET',
    route: '/catalog/import-export/exports/:id',
    entity: 'export job',
    path: (t) => `/catalog/import-export/exports/${t.exportId}`,
    foreign: restNotFound(JOB_NOT_FOUND),
  },
];

const SPREADSHEET_ROUTES: readonly SweptRoute<ImportTarget>[] = [
  {
    method: 'GET',
    route: '/catalog/import-export/fields',
    entity: 'import job',
    path: () => '/catalog/import-export/fields',
  },
  {
    method: 'GET',
    route: '/catalog/import-export/formats',
    entity: 'import job',
    path: () => '/catalog/import-export/formats',
  },
  {
    method: 'POST',
    route: '/catalog/import-export/uploads',
    entity: 'import job',
    path: () => '/catalog/import-export/uploads',
    body: uploadBody,
  },
  {
    method: 'POST',
    route: '/catalog/import-export/products/analyze',
    entity: 'import job',
    path: () => '/catalog/import-export/products/analyze',
    body: (t) => ({ importId: t.importId }),
    foreign: restNotFound(JOB_NOT_FOUND),
  },
  {
    method: 'GET',
    route: `${IMPORTS}/:id`,
    entity: 'import job',
    path: (t) => `${IMPORTS}/${t.importId}`,
    foreign: restNotFound(JOB_NOT_FOUND),
  },
  {
    method: 'GET',
    route: `${IMPORTS}/:id/preview`,
    entity: 'import job',
    path: (t) => `${IMPORTS}/${t.importId}/preview?skip=0&take=50`,
    foreign: restNotFound(JOB_NOT_FOUND),
  },
  {
    method: 'POST',
    route: `${IMPORTS}/:id/preview`,
    entity: 'import job',
    path: (t) => `${IMPORTS}/${t.importId}/preview`,
    body: () => ({}),
    foreign: restNotFound(JOB_NOT_FOUND),
  },
  {
    method: 'POST',
    route: `${IMPORTS}/:id/confirm`,
    entity: 'import job',
    path: (t) => `${IMPORTS}/${t.importId}/confirm`,
    foreign: restNotFound(JOB_NOT_FOUND),
  },
];

export const IMPORT_ROUTES: readonly SweptRoute<ImportTarget>[] = [
  ...BULK_AND_EXPORT_ROUTES,
  ...SPREADSHEET_ROUTES,
  ...LINK_ROUTES,
];

/** The catalog-import endpoints and their targets, for `sweepCases`. */
export const IMPORT_ENDPOINTS: SweptEndpoints<ImportTarget> = {
  prefix: 'import',
  operations: IMPORT_OPERATIONS,
  routes: IMPORT_ROUTES,
  targetOf: importTargetOf,
  restTargetOf: restImportTargetOf,
};
