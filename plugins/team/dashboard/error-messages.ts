import { RBAC_ERROR_CODES, TEAM_ERROR_CODES } from '@cod/shared';
import {
  FORBIDDEN_MESSAGE_ID,
  GENERIC_ERROR_MESSAGE_ID,
  PRIVILEGE_MESSAGE_ID,
  RATE_LIMITED_MESSAGE_ID,
} from './constants';

const FORBIDDEN_CODE = 'FORBIDDEN';
const RATE_LIMITED_CODE = 'RATE_LIMITED';
const TOO_MANY_REQUESTS = 429;
const TEAM_CODES: ReadonlySet<string> = new Set(Object.values(TEAM_ERROR_CODES));

/** rbac refusals of a grant (D208): Team shows them as its own messages, so its catalogue holds every id it shows. */
const RBAC_CODE_MESSAGES: ReadonlyMap<string, string> = new Map([
  [RBAC_ERROR_CODES.PRIVILEGE_EXCEEDED, PRIVILEGE_MESSAGE_ID],
  [RBAC_ERROR_CODES.OWNER_RESTRICTED, PRIVILEGE_MESSAGE_ID],
  [RBAC_ERROR_CODES.STORE_NOT_ACCESSIBLE, PRIVILEGE_MESSAGE_ID],
  [RBAC_ERROR_CODES.SELF_ASSIGNMENT, PRIVILEGE_MESSAGE_ID],
  [RBAC_ERROR_CODES.SELF_HELD_ROLE, PRIVILEGE_MESSAGE_ID],
  [RBAC_ERROR_CODES.LAST_OWNER, PRIVILEGE_MESSAGE_ID],
  [RBAC_ERROR_CODES.ROLE_NOT_FOUND, TEAM_ERROR_CODES.ACCESS_UNAVAILABLE],
  [RBAC_ERROR_CODES.MEMBER_NOT_FOUND, TEAM_ERROR_CODES.MEMBER_NOT_FOUND],
  [RBAC_ERROR_CODES.STORE_ACCESS_INVALID, TEAM_ERROR_CODES.INVALID_INPUT],
  [RBAC_ERROR_CODES.MEMBER_SUSPENDED, TEAM_ERROR_CODES.MEMBER_SUSPENDED],
]);

/** A refusal of a Team REST route: its status and the stable code of its body, when it had one. */
export class RestApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
  ) {
    super(`Team REST refusal ${String(status)}`);
    this.name = 'RestApiError';
  }
}

function graphQlCodeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('extensions' in error)) return undefined;
  const { extensions } = error;
  if (typeof extensions !== 'object' || extensions === null || !('code' in extensions)) return undefined;
  return typeof extensions.code === 'string' ? extensions.code : undefined;
}

/** The stable code of a GraphQL or REST refusal; a REST 429 carries none, so its status names it. */
function codeOf(error: unknown): string | undefined {
  if (!(error instanceof RestApiError)) return graphQlCodeOf(error);
  return error.status === TOO_MANY_REQUESTS ? RATE_LIMITED_CODE : error.code;
}

/** The catalogue id for an API error: its own message for a known code, otherwise a generic one. */
export function errorMessageId(error: unknown): string {
  const code = codeOf(error);
  if (code === undefined) return GENERIC_ERROR_MESSAGE_ID;
  if (code === FORBIDDEN_CODE) return FORBIDDEN_MESSAGE_ID;
  if (code === RATE_LIMITED_CODE) return RATE_LIMITED_MESSAGE_ID;
  if (TEAM_CODES.has(code)) return code;
  return RBAC_CODE_MESSAGES.get(code) ?? GENERIC_ERROR_MESSAGE_ID;
}

/**
 * The accept page's message: an expired link reads like an invalid or revoked one, so the page tells a guesser
 * nothing more than the preview does (D213). An address with an account elsewhere gets its own message, which
 * names no business (D201).
 */
export function acceptErrorMessageId(error: unknown): string {
  const id = errorMessageId(error);
  return id === TEAM_ERROR_CODES.INVITATION_EXPIRED ? TEAM_ERROR_CODES.INVITATION_INVALID : id;
}
