// The public entry of catalog-import (D2200, rule `catalog-import-entry-infra-only`): another plugin imports it only
// from its infrastructure/, its root *.plugin.ts file or its tests/; of the apps only apps/server does.
export { CatalogImportPlugin } from './catalog-import.plugin';
export type {
  CatalogImportPluginOptions,
  LinkScraperKind,
  MemoryStorageOptions,
  S3StorageOptions,
} from './infrastructure/plugin-options';
export {
  IMPORTS_EXPORTS_JOB_REGISTRAR,
  type ImportsExportsJobHandler,
  type ImportsExportsJobRegistrar,
} from './infrastructure/job-registrar';
export type {
  JobFailure as ImportsExportsJobFailure,
  JobRowScope as ImportsExportsJobRowScope,
  JobRowSource as ImportsExportsJobRowSource,
  JobStatus as ImportsExportsJobStatus,
} from './application/ports/job-repository.port';
export type { ImportsExportsJobData } from './domain/imports-exports-job';
// The private object storage's token and port: the server's e2e suite puts an upload's bytes where the presigned PUT
// points through the instance the token resolves to (memory in the e2e boot), as the browser would (D2208).
export { OBJECT_STORAGE as CATALOG_IMPORT_OBJECT_STORAGE } from './application/tokens';
export type { ObjectStorage as CatalogImportObjectStorage } from './application/ports/object-storage.port';
export type { StoreScope as ImportStoreScope } from './domain/store-scope';
// The dashboard's test ids, for the browser spec and the evidence script (framework-free, `dashboard-shared-is-pure`).
export {
  BULK_DIALOG_TEST_ID,
  BULK_EDIT_ACTION_TEST_ID,
  BULK_RESULT_TEST_ID,
  BULK_STATUS_TEST_ID,
  BULK_SUBMIT_TEST_ID,
  CATALOG_IMPORT_PAGE_TEST_ID,
  EXPORT_ACTION_TEST_ID,
  EXPORT_DIALOG_TEST_ID,
  EXPORT_DOWNLOAD_TEST_ID,
  EXPORT_SUBMIT_TEST_ID,
  IMPORT_ACTION_TEST_ID,
  IMPORT_CONFIRM_TEST_ID,
  IMPORT_CREATED_TEST_ID,
  IMPORT_FILE_INPUT_TEST_ID,
  IMPORT_MAPPING_NEXT_TEST_ID,
  IMPORT_PREVIEW_NEXT_TEST_ID,
  IMPORT_RESULT_TEST_ID,
  IMPORT_SUMMARY_TEST_ID,
  IMPORT_UPLOAD_TEST_ID,
} from './dashboard/constants';
