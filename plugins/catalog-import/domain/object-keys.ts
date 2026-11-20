import { isSnowflake, tenantObjectKey } from '@cod/shared';
import { InvalidImportInputError } from './errors';
import type { StoreScope } from './store-scope';

declare const objectKeyBrand: unique symbol;

/** A key of the private bucket the server made (D2208); no client text ever becomes one. */
export type ObjectKey = string & { readonly [objectKeyBrand]: 'ObjectKey' };

const UPLOADS_PREFIX = 'uploads/';
const EXPORTS_PREFIX = 'exports/';

/** Only a snowflake job id may become a key part, so a key can never climb out of its tenant prefix. */
function jobPart(jobId: string): string {
  if (!isSnowflake(jobId)) throw new InvalidImportInputError();
  return jobId;
}

const keyOf = (prefix: string, scope: StoreScope, parts: readonly [string, string, string]): ObjectKey =>
  `${prefix}${tenantObjectKey(scope, ...parts)}` as ObjectKey;

/**
 * Where an import's uploaded file lives: `uploads/b/<business>/s/<store>/imports/<jobId>/source`.
 *
 * @throws {@link InvalidImportInputError} when `jobId` is not a snowflake
 */
export function importSourceKey(scope: StoreScope, jobId: string): ObjectKey {
  return keyOf(UPLOADS_PREFIX, scope, ['imports', jobPart(jobId), 'source']);
}

/**
 * Where an export's file lives: `exports/b/<business>/s/<store>/exports/<jobId>/file`.
 *
 * @throws {@link InvalidImportInputError} when `jobId` is not a snowflake
 */
export function exportFileKey(scope: StoreScope, jobId: string): ObjectKey {
  return keyOf(EXPORTS_PREFIX, scope, ['exports', jobPart(jobId), 'file']);
}

/**
 * Where an import's per-row error report lives: `exports/b/<business>/s/<store>/imports/<jobId>/errors`.
 *
 * @throws {@link InvalidImportInputError} when `jobId` is not a snowflake
 */
export function errorReportKey(scope: StoreScope, jobId: string): ObjectKey {
  return keyOf(EXPORTS_PREFIX, scope, ['imports', jobPart(jobId), 'errors']);
}

/** Whether `key` lies under `exports/`, the only prefix a presigned download may name (D2208). */
export function isExportKey(key: string): boolean {
  return key.startsWith(EXPORTS_PREFIX);
}
