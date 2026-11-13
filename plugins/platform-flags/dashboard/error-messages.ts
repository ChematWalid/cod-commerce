import { FLAG_ERROR_CODES } from '@cod/shared';
import { FLAGS_FORBIDDEN_MESSAGE_ID, FLAGS_GENERIC_ERROR_MESSAGE_ID } from './constants';

const FORBIDDEN_CODE = 'FORBIDDEN';
const FLAG_CODES: ReadonlySet<string> = new Set(Object.values(FLAG_ERROR_CODES));

function errorCodeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('extensions' in error)) return undefined;
  const { extensions } = error;
  if (typeof extensions !== 'object' || extensions === null || !('code' in extensions)) return undefined;
  return typeof extensions.code === 'string' ? extensions.code : undefined;
}

/** The catalogue id for an API error: its own message for a known code, otherwise a generic one. */
export function flagErrorMessageId(error: unknown): string {
  const code = errorCodeOf(error);
  if (code === FORBIDDEN_CODE) return FLAGS_FORBIDDEN_MESSAGE_ID;
  return code !== undefined && FLAG_CODES.has(code) ? code : FLAGS_GENERIC_ERROR_MESSAGE_ID;
}
