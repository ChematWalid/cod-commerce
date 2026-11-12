import { DomainError, RBAC_ERROR_CODES, type RbacErrorCode } from '@cod/shared';
import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import { I18nError, Logger, LogLevel, parseContext } from '@vendure/core';

const TRANSLATED_CODES: ReadonlySet<string> = new Set(Object.values(RBAC_ERROR_CODES));

/** The `api/i18n` key of a stable code. i18next reads dots as nesting, so the code's dot becomes a dash. */
export const translationKeyOf = (code: string): string => code.replace('.', '-');

const messageOf = (error: DomainError): string =>
  TRANSLATED_CODES.has(error.code) ? `error.${translationKeyOf(error.code)}` : error.message;

/** A refusal as GraphQL clients see it: `extensions.code` is the domain error's stable code. */
export class RbacApiError extends I18nError {
  constructor(error: DomainError) {
    // Info: these are refusals of the caller's input, not faults of the server.
    super(messageOf(error), {}, error.code, LogLevel.Info);
  }
}

/** Runs a handler body with the plugin's one domain-to-API error mapping (§3a.8). */
export async function withRbacErrors<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error: unknown) {
    throw error instanceof DomainError ? new RbacApiError(error) : error;
  }
}

const LOG_CONTEXT = 'RbacApi';
const INTERNAL_MESSAGE = 'The request could not be completed';

/** Absent names are not found, escalation refusals are forbidden, every other refusal of the input is a bad request. */
const NOT_FOUND: ReadonlySet<string> = new Set([RBAC_ERROR_CODES.ROLE_NOT_FOUND, RBAC_ERROR_CODES.MEMBER_NOT_FOUND]);
const FORBIDDEN: ReadonlySet<string> = new Set([
  RBAC_ERROR_CODES.PRIVILEGE_EXCEEDED,
  RBAC_ERROR_CODES.SELF_ASSIGNMENT,
  RBAC_ERROR_CODES.SELF_HELD_ROLE,
  RBAC_ERROR_CODES.OWNER_RESTRICTED,
  RBAC_ERROR_CODES.LAST_OWNER,
  RBAC_ERROR_CODES.BUILT_IN_IMMUTABLE,
  RBAC_ERROR_CODES.STORE_NOT_ACCESSIBLE,
]);
/** The member's state forbids the change until it changes elsewhere (D204: deactivated in Team). */
const CONFLICT: ReadonlySet<string> = new Set([RBAC_ERROR_CODES.MEMBER_SUSPENDED]);
const RBAC_CODES: ReadonlySet<string> = new Set(Object.values(RBAC_ERROR_CODES) satisfies RbacErrorCode[]);

/** The HTTP status of a domain error: 404, 409, 403 or 400 for this plugin's codes, 500 for anything else. */
export function restStatusOf(error: DomainError): HttpStatus {
  if (!RBAC_CODES.has(error.code)) return HttpStatus.INTERNAL_SERVER_ERROR;
  if (NOT_FOUND.has(error.code)) return HttpStatus.NOT_FOUND;
  if (CONFLICT.has(error.code)) return HttpStatus.CONFLICT;
  return FORBIDDEN.has(error.code) ? HttpStatus.FORBIDDEN : HttpStatus.BAD_REQUEST;
}

/** The REST mapping of the same errors: the status from {@link restStatusOf} and the stable code in the body. */
@Catch(DomainError)
export class RbacRestErrorFilter implements ExceptionFilter<DomainError> {
  catch(error: DomainError, host: ArgumentsHost): void {
    const { req, res } = parseContext(host);
    const status = restStatusOf(error);
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      Logger.error(`Domain error with no REST status: ${error.code}`, LOG_CONTEXT);
    }
    res.status(status).json({
      statusCode: status,
      code: error.code,
      message: status === HttpStatus.INTERNAL_SERVER_ERROR ? INTERNAL_MESSAGE : error.message,
      path: req.url,
    });
  }
}
