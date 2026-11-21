import { readRequestToken, sendForStore, type StoreScope, storeQuery } from '@cod/plugin-merchant-shell/shell-api';
import { IMPORT_CONTENT_TYPE_OF_FORMAT, type ImportFormat } from '@cod/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '@vendure/dashboard';
import {
  BULK_BRANDS_QUERY_KEY,
  BULK_TAGS_QUERY_KEY,
  EXPORT_JOB_QUERY_KEY,
  IMPORT_JOB_QUERY_KEY,
  IMPORT_PREVIEW_QUERY_KEY,
  PREVIEW_PAGE_SIZE,
} from './constants';
import type { BulkEditInput } from './model/bulk-form';
import type { ExportInput } from './model/export-form';
import { type ColumnMapping, type ImportColumn, type ImportSummary, jobPollInterval } from './model/wizard';

/** `CatalogImport`: an import job, as the wizard reads it. */
export interface CatalogImportDto {
  readonly importId: string;
  readonly status: string;
  readonly rowCount: number;
  readonly progress: number;
  readonly columns: readonly ImportColumn[];
  readonly summary: ImportSummary | null;
  readonly result: { readonly created: number; readonly updated: number; readonly failed: number } | null;
  readonly errorCode: string | null;
  readonly errorReportUrl: string | null;
}

/** `CatalogImportPreviewRow`: messages are message ids, never the cell text. */
export interface ImportPreviewRowDto {
  readonly rowNumber: number;
  readonly action: string;
  readonly productKey: string | null;
  readonly name: string | null;
  readonly messages: readonly string[];
}

/** `CatalogImportPreview`: one page of planned rows. */
export interface ImportPreviewDto {
  readonly totalItems: number;
  readonly items: readonly ImportPreviewRowDto[];
  readonly summary: ImportSummary | null;
}

/** `CatalogExport`: an export job; `downloadUrl` is a fresh short-lived link once done. */
export interface CatalogExportDto {
  readonly exportId: string;
  readonly status: string;
  readonly progress: number;
  readonly rowCount: number;
  readonly skippedPacks: number;
  readonly errorCode: string | null;
  readonly downloadUrl: string | null;
}

/** `CatalogBulkEditProductResult`. */
export interface BulkEditProductResultDto {
  readonly productId: string;
  readonly ok: boolean;
  readonly changedFields: readonly string[];
  readonly error: string | null;
}

/** A brand or tag of the store, for the bulk edit's choices. */
export interface NamedDto {
  readonly id: string;
  readonly name: string;
}

/** `CatalogImportUpload`: a presigned PUT. */
interface ImportUploadDto {
  readonly importId: string;
  readonly uploadUrl: string;
  readonly method: string;
  readonly headers: readonly { readonly name: string; readonly value: string }[];
}

const IMPORT_FIELDS = `importId status rowCount progress columns { column header field warning }
  summary { creates updates errors warnings } result { created updated failed } errorCode errorReportUrl`;
const EXPORT_FIELDS = 'exportId status progress rowCount skippedPacks errorCode downloadUrl';
const PREVIEW_FIELDS = `totalItems items { rowNumber action productKey name messages }
  summary { creates updates errors warnings }`;

const IMPORT_QUERY = `query CatalogImportJob($id: String!) { catalogImport(id: $id) { ${IMPORT_FIELDS} } }`;
const PREVIEW_QUERY = `query CatalogImportPreviewPage($id: String!, $skip: Int, $take: Int) {
  catalogImportPreview(id: $id, skip: $skip, take: $take) { ${PREVIEW_FIELDS} } }`;
const EXPORT_QUERY = `query CatalogExportJob($id: String!) { catalogExport(id: $id) { ${EXPORT_FIELDS} } }`;
const BRANDS_QUERY = 'query CatalogImportBrands { catalogBrands { id name } }';
const TAGS_QUERY = 'query CatalogImportTags { catalogTags { id name } }';
const UPLOAD_MUTATION = `mutation CatalogImportUpload($input: CatalogImportUploadInput!) {
  createCatalogImportUpload(input: $input) { importId uploadUrl method headers { name value } } }`;
const ANALYZE_MUTATION = `mutation CatalogImportAnalyze($input: CatalogImportAnalyzeInput!) {
  analyzeCatalogImport(input: $input) { ${IMPORT_FIELDS} } }`;
const PREVIEW_MUTATION = `mutation CatalogImportPreview($id: String!, $input: CatalogImportPreviewInput) {
  previewCatalogImport(id: $id, input: $input) { ${PREVIEW_FIELDS} } }`;
const CONFIRM_MUTATION = `mutation CatalogImportConfirm($id: String!) {
  confirmCatalogImport(id: $id) { ${IMPORT_FIELDS} } }`;
const EXPORT_MUTATION = `mutation CatalogExportProducts($input: CatalogExportInput!) {
  exportCatalogProducts(input: $input) { ${EXPORT_FIELDS} } }`;
const BULK_MUTATION = `mutation CatalogBulkEdit($input: CatalogBulkEditInput!) {
  bulkEditCatalogProducts(input: $input) { results { productId ok changedFields error } } }`;

/** Raised when the object store refuses the uploaded file. */
export class UploadRefusedError extends Error {
  constructor(readonly httpStatus: number) {
    super(`The file upload was refused with HTTP ${String(httpStatus)}`);
    this.name = 'UploadRefusedError';
  }
}

/** A write sent only while requests go to `scope`'s store; the answer's shape is the document's. */
async function mutate<T>(scope: StoreScope | null, document: string, variables: object): Promise<T> {
  return (await sendForStore(scope?.channelToken ?? null, readRequestToken, () =>
    api.mutate(document, variables),
  )) as T;
}

/** The import job, read again until it is done or failed. */
export function useImportJob(scope: StoreScope | null, importId: string | null) {
  return useQuery({
    ...storeQuery(
      IMPORT_JOB_QUERY_KEY,
      scope,
      async () =>
        (await api.query<{ readonly catalogImport: CatalogImportDto }>(IMPORT_QUERY, { id: importId })).catalogImport,
      { importId },
    ),
    enabled: importId !== null,
    refetchInterval: (query) => jobPollInterval(query.state.data?.status),
  });
}

/** One page of the import's planned rows; page 0 is not read, since the preview mutation answered it. */
export function useImportPreview(scope: StoreScope | null, importId: string, skip: number) {
  const page = { id: importId, skip, take: PREVIEW_PAGE_SIZE };
  return useQuery({
    ...storeQuery(
      IMPORT_PREVIEW_QUERY_KEY,
      scope,
      async () =>
        (await api.query<{ readonly catalogImportPreview: ImportPreviewDto }>(PREVIEW_QUERY, page))
          .catalogImportPreview,
      page,
    ),
    enabled: skip > 0,
  });
}

/** The export job, read again until it is done or failed; not read while `exportId` is null. */
export function useExportJob(scope: StoreScope | null, exportId: string | null) {
  return useQuery({
    ...storeQuery(
      EXPORT_JOB_QUERY_KEY,
      scope,
      async () =>
        (await api.query<{ readonly catalogExport: CatalogExportDto }>(EXPORT_QUERY, { id: exportId })).catalogExport,
      { exportId },
    ),
    enabled: exportId !== null,
    refetchInterval: (query) => jobPollInterval(query.state.data?.status),
  });
}

/** The store's brands and tags, for the bulk edit's choices. */
export function useBulkTaxonomy(scope: StoreScope | null) {
  const brands = useQuery(
    storeQuery(
      BULK_BRANDS_QUERY_KEY,
      scope,
      async () => (await api.query<{ readonly catalogBrands: readonly NamedDto[] }>(BRANDS_QUERY)).catalogBrands,
    ),
  );
  const tags = useQuery(
    storeQuery(
      BULK_TAGS_QUERY_KEY,
      scope,
      async () => (await api.query<{ readonly catalogTags: readonly NamedDto[] }>(TAGS_QUERY)).catalogTags,
    ),
  );
  return { brands: brands.data ?? [], tags: tags.data ?? [] };
}

/** Sends the file with exactly the signed headers (D2208); the bytes never pass through our server. */
async function putFile(upload: ImportUploadDto, file: File): Promise<void> {
  const headers = Object.fromEntries(upload.headers.map(({ name, value }) => [name, value]));
  const response = await fetch(upload.uploadUrl, { method: upload.method, headers, body: file });
  if (!response.ok) throw new UploadRefusedError(response.status);
}

/** Asks for a presigned PUT, sends the file, then has the server analyze it (D2208, D2210). */
export async function uploadAndAnalyze(
  scope: StoreScope | null,
  file: File,
  format: ImportFormat,
): Promise<CatalogImportDto> {
  const input = { format, size: file.size, contentType: IMPORT_CONTENT_TYPE_OF_FORMAT[format] };
  const { createCatalogImportUpload: upload } = await mutate<{
    readonly createCatalogImportUpload: ImportUploadDto;
  }>(scope, UPLOAD_MUTATION, { input });
  await putFile(upload, file);
  return (
    await mutate<{ readonly analyzeCatalogImport: CatalogImportDto }>(scope, ANALYZE_MUTATION, {
      input: { importId: upload.importId },
    })
  ).analyzeCatalogImport;
}

/** Plans the rows with the merchant's mapping. */
export const previewImport = async (
  scope: StoreScope | null,
  importId: string,
  mapping: readonly ColumnMapping[],
): Promise<ImportPreviewDto> =>
  (
    await mutate<{ readonly previewCatalogImport: ImportPreviewDto }>(scope, PREVIEW_MUTATION, {
      id: importId,
      input: { mapping },
    })
  ).previewCatalogImport;

/** Starts writing the previewed rows (a job on `imports-exports`). */
export const confirmImport = async (scope: StoreScope | null, importId: string): Promise<CatalogImportDto> =>
  (await mutate<{ readonly confirmCatalogImport: CatalogImportDto }>(scope, CONFIRM_MUTATION, { id: importId }))
    .confirmCatalogImport;

/** Starts an export: written at once up to the sync limit, else a job (D2211). */
export const exportProducts = async (scope: StoreScope | null, input: ExportInput): Promise<CatalogExportDto> =>
  (await mutate<{ readonly exportCatalogProducts: CatalogExportDto }>(scope, EXPORT_MUTATION, { input }))
    .exportCatalogProducts;

/** Runs a bulk edit, as a dry run or for real (D2213). */
export const bulkEditProducts = async (
  scope: StoreScope | null,
  input: BulkEditInput,
): Promise<readonly BulkEditProductResultDto[]> =>
  (
    await mutate<{ readonly bulkEditCatalogProducts: { readonly results: readonly BulkEditProductResultDto[] } }>(
      scope,
      BULK_MUTATION,
      { input },
    )
  ).bulkEditCatalogProducts.results;
