import { AUTH_ERROR_CODES } from '@cod/shared';

/** The server's auth error codes, which the pages show as messages of the same id (D89). */
export const DYNAMIC_MESSAGE_IDS: readonly string[] = Object.values(AUTH_ERROR_CODES);
