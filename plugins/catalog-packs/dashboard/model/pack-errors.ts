import { CATALOG_PACKS_ERROR_CODES } from '@cod/shared';

export const GENERIC_ERROR_MESSAGE_ID = 'packs.error-generic';
export const FORBIDDEN_MESSAGE_ID = 'packs.error-forbidden';
/** A write refused because the page's store is no longer the one requests go to. */
export const STORE_SWITCHED_MESSAGE_ID = 'packs.error-store-switched';

const FORBIDDEN_CODE = 'FORBIDDEN';
const PACK_CODES: ReadonlySet<string> = new Set(Object.values(CATALOG_PACKS_ERROR_CODES));

function graphQlCodeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('extensions' in error)) return undefined;
  const { extensions } = error;
  if (typeof extensions !== 'object' || extensions === null || !('code' in extensions)) return undefined;
  return typeof extensions.code === 'string' ? extensions.code : undefined;
}

/** The catalogue id for an API error of the pack API: the pack code's own message, forbidden, or a generic one. */
export function packErrorMessageId(error: unknown): string {
  const code = graphQlCodeOf(error);
  if (code === FORBIDDEN_CODE) return FORBIDDEN_MESSAGE_ID;
  return code !== undefined && PACK_CODES.has(code) ? code : GENERIC_ERROR_MESSAGE_ID;
}
