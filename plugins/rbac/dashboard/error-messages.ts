import { RBAC_ERROR_CODES } from '@cod/shared';
import { FORBIDDEN_MESSAGE_ID, GENERIC_ERROR_MESSAGE_ID } from './constants';

const FORBIDDEN_CODE = 'FORBIDDEN';
const RBAC_CODES: ReadonlySet<string> = new Set(Object.values(RBAC_ERROR_CODES));

function errorCodeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('extensions' in error)) return undefined;
  const { extensions } = error;
  if (typeof extensions !== 'object' || extensions === null || !('code' in extensions)) return undefined;
  return typeof extensions.code === 'string' ? extensions.code : undefined;
}

/** The catalogue id for an API error: its own message for a known code, otherwise a generic one. */
export function errorMessageId(error: unknown): string {
  const code = errorCodeOf(error);
  if (code === FORBIDDEN_CODE) return FORBIDDEN_MESSAGE_ID;
  return code !== undefined && RBAC_CODES.has(code) ? code : GENERIC_ERROR_MESSAGE_ID;
}
