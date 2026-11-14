import { CATALOG_ERROR_CODES, DomainError } from '@cod/shared';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  EntityNotFoundError,
  ForbiddenError,
  type I18nRequest,
  I18nError,
  InternalServerError,
  Logger,
  LogLevel,
  parseContext,
} from '@vendure/core';
import { ProductNotFoundError } from '../domain/errors';

const LOG_CONTEXT = 'CatalogApi';
const C = CATALOG_ERROR_CODES;
/** What a client reads for a fault of the server: never SQL, an entity name or a stack (D2136). */
export const INTERNAL_MESSAGE = 'The request could not be completed';
const INTERNAL_MESSAGE_KEY = 'error.catalog-internal';

/** The HTTP status of every code the catalog API answers with. */
const STATUS_OF_CODE: ReadonlyMap<string, HttpStatus> = new Map([
  [C.PRODUCT_NOT_FOUND, HttpStatus.NOT_FOUND],
  [C.BRAND_NOT_FOUND, HttpStatus.NOT_FOUND],
  [C.TAG_NOT_FOUND, HttpStatus.NOT_FOUND],
  [C.HIGHLIGHT_NOT_FOUND, HttpStatus.NOT_FOUND],
  [C.MEDIA_NOT_FOUND, HttpStatus.NOT_FOUND],
  [C.INVALID_INPUT, HttpStatus.BAD_REQUEST],
  [C.TOO_MANY_HIGHLIGHTS, HttpStatus.BAD_REQUEST],
  [C.MATRIX_TOO_LARGE, HttpStatus.BAD_REQUEST],
  [C.DUPLICATE_OPTION_VALUE, HttpStatus.BAD_REQUEST],
  [C.DUPLICATE_OPTION_NAME, HttpStatus.BAD_REQUEST],
  [C.ORDER_MANAGER_UNKNOWN, HttpStatus.BAD_REQUEST],
  [C.ORDER_MANAGERS_UNAVAILABLE, HttpStatus.CONFLICT],
  [C.NAME_TAKEN, HttpStatus.CONFLICT],
  [C.MEDIA_IN_USE, HttpStatus.CONFLICT],
  [C.CONCURRENT_UPDATE, HttpStatus.CONFLICT],
  [C.MEDIA_TOO_LARGE, HttpStatus.PAYLOAD_TOO_LARGE],
  [C.MEDIA_TYPE, HttpStatus.UNSUPPORTED_MEDIA_TYPE],
]);

/** The `api/i18n` key of a code. i18next reads dots as nesting, so the dot becomes a dash. */
export const messageKeyOf = (code: string): string => `error.${code.replace('.', '-')}`;

/** The HTTP status of a domain error; a code this API does not answer with is a fault of the server (500). */
export function restStatusOf(error: DomainError): HttpStatus {
  return STATUS_OF_CODE.get(error.code) ?? HttpStatus.INTERNAL_SERVER_ERROR;
}

/** A refusal as GraphQL clients see it: `extensions.code` is the stable code, the message translated. */
export class CatalogApiError extends I18nError {
  constructor(error: DomainError) {
    // Info: refusals of the caller's input, not faults of the server.
    super(messageKeyOf(error.code), {}, error.code, LogLevel.Info);
  }
}

/** A stack line naming a call site; the lines before them repeat the message. */
const STACK_FRAME = /^\s+at /;

/** The call sites of a stack, without its `<name>: <message>` head, which may span several lines. */
const framesOf = (stack: string | undefined): string =>
  (stack ?? '')
    .split('\n')
    .filter((line) => STACK_FRAME.test(line))
    .join('\n');

/** Logs a fault with its type and stack frames only: a database message may quote the caller's data. */
function logFault(error: unknown): void {
  const fault = error instanceof Error ? error : new Error(`Non-error thrown: ${typeof error}`);
  Logger.error(`Catalog fault: ${fault.name}`, LOG_CONTEXT, framesOf(fault.stack));
}

/**
 * The one translation of what a use case threw into what an API answers (D2136): a domain error stays itself, a
 * Vendure "entity not found" becomes the catalog's not found, a permission refusal stays a permission refusal, and
 * anything else is a fault of the server, logged here and returned as `undefined` (the caller answers generically).
 */
export function catalogErrorOf(error: unknown): DomainError | ForbiddenError | undefined {
  if (error instanceof DomainError) return error;
  if (error instanceof EntityNotFoundError) return new ProductNotFoundError();
  if (error instanceof ForbiddenError) return error;
  logFault(error);
  return undefined;
}

/** Runs a resolver body with the catalog's GraphQL error mapping (§3a.8). */
export async function withCatalogErrors<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (thrown: unknown) {
    const error = catalogErrorOf(thrown);
    if (error === undefined) throw new InternalServerError(INTERNAL_MESSAGE_KEY);
    if (!(error instanceof DomainError)) throw error;
    if (!STATUS_OF_CODE.has(error.code)) Logger.error(`Domain error with no API mapping: ${error.code}`, LOG_CONTEXT);
    throw new CatalogApiError(error);
  }
}

/**
 * Runs a REST handler body with the same mapping: a domain error reaches {@link CatalogRestErrorFilter}, a fault
 * becomes a bare 500 whose message is {@link INTERNAL_MESSAGE}.
 */
export async function restCall<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (thrown: unknown) {
    if (thrown instanceof HttpException) throw thrown;
    const error = catalogErrorOf(thrown);
    if (error === undefined) throw new InternalServerErrorException(INTERNAL_MESSAGE);
    throw error;
  }
}

/** The path without its query string, which may quote a search text. */
const pathOf = (url: string): string => url.split('?')[0] ?? url;

/** The REST answer of a domain error: its status, its stable code and the translated message. */
@Catch(DomainError)
export class CatalogRestErrorFilter implements ExceptionFilter<DomainError> {
  catch(error: DomainError, host: ArgumentsHost): void {
    const { req, res } = parseContext(host);
    const status = restStatusOf(error);
    const internal = status === HttpStatus.INTERNAL_SERVER_ERROR;
    if (internal) Logger.error(`Domain error with no REST status: ${error.code}`, LOG_CONTEXT);
    res.status(status).json({
      statusCode: status,
      code: error.code,
      message: internal
        ? INTERNAL_MESSAGE
        : ((req as Partial<I18nRequest>).t?.(messageKeyOf(error.code)) ?? error.code),
      path: pathOf(req.url),
    });
  }
}
