import { CATALOG_IMPORT_ERROR_CODES, CATALOG_IMPORT_ROW_REASONS } from '@cod/shared';

export const GENERIC_ERROR_MESSAGE_ID = 'catalog-import.error-generic';
export const FORBIDDEN_MESSAGE_ID = 'catalog-import.error-forbidden';
/** A request refused because the page's store is no longer the one requests go to. */
export const STORE_SWITCHED_MESSAGE_ID = 'catalog-import.error-store-switched';
/** The object store refused the uploaded file (expired link, size or type other than signed). */
export const UPLOAD_REFUSED_MESSAGE_ID = 'catalog-import.error-upload-refused';
/** A row reason or error code the dashboard has no message for. */
export const UNKNOWN_REASON_MESSAGE_ID = 'catalog-import.reason-unknown';

const FORBIDDEN_CODE = 'FORBIDDEN';

/**
 * Codes the dashboard shows as messages of the same id: the import API's. Another code (a catalog validation refusal
 * of one bulk-edited product) reads as the generic message.
 */
export const SHOWN_ERROR_CODES: readonly string[] = Object.values(CATALOG_IMPORT_ERROR_CODES);
const SHOWN_CODES: ReadonlySet<string> = new Set(SHOWN_ERROR_CODES);
const ROW_REASONS: ReadonlySet<string> = new Set(Object.values(CATALOG_IMPORT_ROW_REASONS));

function graphQlCodeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('extensions' in error)) return undefined;
  const { extensions } = error;
  if (typeof extensions !== 'object' || extensions === null || !('code' in extensions)) return undefined;
  return typeof extensions.code === 'string' ? extensions.code : undefined;
}

/** The catalogue id for an API error: the code's own message, forbidden, or a generic one. */
export function importErrorMessageId(error: unknown): string {
  const code = graphQlCodeOf(error);
  if (code === FORBIDDEN_CODE) return FORBIDDEN_MESSAGE_ID;
  return code !== undefined && SHOWN_CODES.has(code) ? code : GENERIC_ERROR_MESSAGE_ID;
}

/** The catalogue id of a code a job or a result row carries (`errorCode`, a bulk result's `error`). */
export const codeMessageId = (code: string): string => (SHOWN_CODES.has(code) ? code : GENERIC_ERROR_MESSAGE_ID);

/** The catalogue id of a preview row's reason (D2209); an unknown one gets a neutral message, never the raw id. */
export const rowReasonMessageId = (reason: string): string =>
  ROW_REASONS.has(reason) ? reason : UNKNOWN_REASON_MESSAGE_ID;
