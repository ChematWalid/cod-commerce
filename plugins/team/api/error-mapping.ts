import { DomainError, RBAC_ERROR_CODES, TEAM_ERROR_CODES } from '@cod/shared';
import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import { type I18nRequest, I18nError, Logger, LogLevel, parseContext } from '@vendure/core';
import { noStoreHeaders } from './no-store';

const LOG_CONTEXT = 'TeamApi';
const INTERNAL_MESSAGE = 'The request could not be completed';
const TEAM = TEAM_ERROR_CODES;
const RBAC = RBAC_ERROR_CODES;

/** The HTTP status of every code Team's API answers with: its own, and rbac's for a grant rbac refused (D208). */
const STATUS_OF_CODE: ReadonlyMap<string, HttpStatus> = new Map([
  [TEAM.MEMBER_NOT_FOUND, HttpStatus.NOT_FOUND],
  [TEAM.COMMISSION_NOT_FOUND, HttpStatus.NOT_FOUND],
  [TEAM.OWNER_PROTECTED, HttpStatus.FORBIDDEN],
  [TEAM.SELF_ACTION, HttpStatus.FORBIDDEN],
  [TEAM.INVALID_INPUT, HttpStatus.BAD_REQUEST],
  [TEAM.INVITATION_INVALID, HttpStatus.BAD_REQUEST],
  [TEAM.INVITATION_EXPIRED, HttpStatus.BAD_REQUEST],
  [TEAM.EMAIL_ALREADY_MEMBER, HttpStatus.CONFLICT],
  [TEAM.ACCOUNT_ELSEWHERE, HttpStatus.CONFLICT],
  [TEAM.NOT_PENDING, HttpStatus.CONFLICT],
  [TEAM.NOT_ACTIVE, HttpStatus.CONFLICT],
  [TEAM.COMMISSION_IN_USE, HttpStatus.CONFLICT],
  [TEAM.ACCESS_UNAVAILABLE, HttpStatus.CONFLICT],
  [TEAM.MEMBER_SUSPENDED, HttpStatus.CONFLICT],
  [TEAM.RESEND_LIMIT, HttpStatus.CONFLICT],
  [TEAM.RESEND_COOLDOWN, HttpStatus.TOO_MANY_REQUESTS],
  [TEAM.TOO_MANY_PENDING, HttpStatus.TOO_MANY_REQUESTS],
  [RBAC.ROLE_NOT_FOUND, HttpStatus.NOT_FOUND],
  [RBAC.MEMBER_NOT_FOUND, HttpStatus.NOT_FOUND],
  [RBAC.PRIVILEGE_EXCEEDED, HttpStatus.FORBIDDEN],
  [RBAC.OWNER_RESTRICTED, HttpStatus.FORBIDDEN],
  [RBAC.STORE_NOT_ACCESSIBLE, HttpStatus.FORBIDDEN],
  [RBAC.SELF_ASSIGNMENT, HttpStatus.FORBIDDEN],
  [RBAC.LAST_OWNER, HttpStatus.FORBIDDEN],
  [RBAC.STORE_ACCESS_INVALID, HttpStatus.BAD_REQUEST],
  [RBAC.MEMBER_SUSPENDED, HttpStatus.CONFLICT],
]);

/** The `api/i18n` key of a code; Team's and rbac's messages are both registered. i18next reads dots as nesting. */
export const messageKeyOf = (code: string): string => `error.${code.replace('.', '-')}`;

/** The HTTP status of a domain error; a code this API does not answer with is a fault of the server (500). */
export function restStatusOf(error: DomainError): HttpStatus {
  return STATUS_OF_CODE.get(error.code) ?? HttpStatus.INTERNAL_SERVER_ERROR;
}

/** A refusal as GraphQL clients see it: `extensions.code` is the stable code, the message translated. */
export class TeamApiError extends I18nError {
  constructor(error: DomainError) {
    // Info: these are refusals of the caller's input, not faults of the server.
    super(messageKeyOf(error.code), {}, error.code, LogLevel.Info);
  }
}

/** Runs a resolver body with the plugin's one domain-to-GraphQL error mapping (§3a.8). */
export async function withTeamErrors<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error: unknown) {
    if (!(error instanceof DomainError)) throw error;
    if (!STATUS_OF_CODE.has(error.code)) Logger.error(`Domain error with no API mapping: ${error.code}`, LOG_CONTEXT);
    throw new TeamApiError(error);
  }
}

/** The path without its query string: a public route's query carries an invitation token (D205). */
const pathOf = (url: string): string => url.split('?')[0] ?? url;

/**
 * The REST mapping of the same errors: the status, the stable code and the translated message (`Accept-Language` or
 * `languageCode`). Never caches, never sends a referrer, never echoes the query string (D205).
 */
@Catch(DomainError)
export class TeamRestErrorFilter implements ExceptionFilter<DomainError> {
  catch(error: DomainError, host: ArgumentsHost): void {
    const { req, res } = parseContext(host);
    const status = restStatusOf(error);
    const internal = status === HttpStatus.INTERNAL_SERVER_ERROR;
    if (internal) Logger.error(`Domain error with no REST status: ${error.code}`, LOG_CONTEXT);
    noStoreHeaders(res);
    res.status(status).json({
      statusCode: status,
      code: error.code,
      message: internal
        ? INTERNAL_MESSAGE
        : ((req as Partial<I18nRequest>).t?.(messageKeyOf(error.code)) ?? error.message),
      path: pathOf(req.url),
    });
  }
}
