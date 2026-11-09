import { AUTH_ERROR_CODES } from '@cod/shared';
import { GENERIC_ERROR_MESSAGE_ID, SUBDOMAIN_REASON_MESSAGE_IDS } from './constants';

const RATE_LIMITED_CODE = 'RATE_LIMITED';
const SUBDOMAIN_TAKEN_CODE = 'tenancy.subdomain-taken';
const SUBDOMAIN_INVALID_CODE = 'tenancy.subdomain-invalid';
const AUTH_CODES: ReadonlySet<string> = new Set(Object.values(AUTH_ERROR_CODES));

/** The stable code the API attached to an error, when it did. */
export function errorCodeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('extensions' in error)) return undefined;
  const { extensions } = error;
  if (typeof extensions !== 'object' || extensions === null || !('code' in extensions)) return undefined;
  return typeof extensions.code === 'string' ? extensions.code : undefined;
}

/** The catalogue id for an API error; a code the pages do not know gets the generic message. */
export function errorMessageId(error: unknown): string {
  const code = errorCodeOf(error);
  if (code === RATE_LIMITED_CODE) return AUTH_ERROR_CODES.RATE_LIMITED;
  if (code === SUBDOMAIN_TAKEN_CODE) return SUBDOMAIN_REASON_MESSAGE_IDS.taken;
  if (code === SUBDOMAIN_INVALID_CODE) return SUBDOMAIN_REASON_MESSAGE_IDS.format;
  return code !== undefined && AUTH_CODES.has(code) ? code : GENERIC_ERROR_MESSAGE_ID;
}

/** Whether the server refused the chosen subdomain, which only step 3 can fix. */
export function isSubdomainRefusal(error: unknown): boolean {
  const code = errorCodeOf(error);
  return code === SUBDOMAIN_TAKEN_CODE || code === SUBDOMAIN_INVALID_CODE;
}
