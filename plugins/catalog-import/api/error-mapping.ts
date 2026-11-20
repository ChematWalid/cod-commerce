import { RateLimitedError, RateLimitedFilter } from '@cod/plugin-rate-limit';
import { CATALOG_IMPORT_ERROR_CODES, DomainError } from '@cod/shared';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  ForbiddenException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  ForbiddenError,
  type I18nRequest,
  I18nError,
  InternalServerError,
  Logger,
  LogLevel,
  parseContext,
} from '@vendure/core';

const LOG_CONTEXT = 'CatalogImportApi';
const C = CATALOG_IMPORT_ERROR_CODES;
/** What a client reads for a fault of the server: never SQL, an entity name or a stack (D2136). */
export const INTERNAL_MESSAGE = 'The request could not be completed';
const INTERNAL_MESSAGE_KEY = 'error.catalog-import-internal';

/**
 * The HTTP status of every code the catalog-import API answers a request with. Catalog's own refusals of one product
 * are that product's result, never a request error (D2213); each later task adds the codes it answers.
 */
const STATUS_OF_CODE: ReadonlyMap<string, HttpStatus> = new Map([
  [C.INVALID_INPUT, HttpStatus.BAD_REQUEST],
  [C.TAXONOMY_NOT_FOUND, HttpStatus.NOT_FOUND],
  [C.COLLECTIONS_UNAVAILABLE, HttpStatus.BAD_REQUEST],
]);

/** The `api/i18n` key of a code. i18next reads dots as nesting, so the dot becomes a dash. */
export const messageKeyOf = (code: string): string => `error.${code.replace('.', '-')}`;

/** The HTTP status of a domain error; a code this API does not answer with is a fault of the server (500). */
export function restStatusOf(error: DomainError): HttpStatus {
  return STATUS_OF_CODE.get(error.code) ?? HttpStatus.INTERNAL_SERVER_ERROR;
}

/** A refusal as GraphQL clients see it: `extensions.code` is the stable code, the message translated. */
export class ImportApiError extends I18nError {
  constructor(error: DomainError) {
    // Info: refusals of the caller's input, not faults of the server.
    super(messageKeyOf(error.code), {}, error.code, LogLevel.Info);
  }
}

/** A stack line naming a call site; the lines before them repeat the message. */
const STACK_FRAME = /^\s+at /;

/** Logs a fault with its type and stack frames only: a database message may quote the caller's data. */
function logFault(error: unknown): void {
  const fault = error instanceof Error ? error : new Error(`Non-error thrown: ${typeof error}`);
  const frames = (fault.stack ?? '')
    .split('\n')
    .filter((line) => STACK_FRAME.test(line))
    .join('\n');
  Logger.error(`Catalog import fault: ${fault.name}`, LOG_CONTEXT, frames);
}

/**
 * The one translation of what a use case threw into what an API answers (D2136, §3a.8): a domain error stays itself,
 * a permission or rate-limit refusal stays itself, and anything else is a fault of the server, logged here and
 * returned as `undefined` (the caller answers generically).
 */
export function importErrorOf(error: unknown): DomainError | ForbiddenError | RateLimitedError | undefined {
  if (error instanceof DomainError) return error;
  if (error instanceof ForbiddenError || error instanceof RateLimitedError) return error;
  logFault(error);
  return undefined;
}

/** Runs a resolver body with the catalog-import GraphQL error mapping. */
export async function withImportErrors<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (thrown: unknown) {
    const error = importErrorOf(thrown);
    if (error === undefined) throw new InternalServerError(INTERNAL_MESSAGE_KEY);
    if (!(error instanceof DomainError)) throw error;
    if (!STATUS_OF_CODE.has(error.code)) {
      Logger.error(`Domain error with no API mapping: ${error.code}`, LOG_CONTEXT);
      throw new InternalServerError(INTERNAL_MESSAGE_KEY);
    }
    throw new ImportApiError(error);
  }
}

/**
 * Runs a REST handler body with the same mapping: a domain error reaches {@link ImportRestErrorFilter}, an over-limit
 * refusal reaches {@link RateLimitedFilter} (429), a Vendure permission refusal becomes 403, and a fault a bare 500.
 */
export async function restCall<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (thrown: unknown) {
    if (thrown instanceof HttpException) throw thrown;
    const error = importErrorOf(thrown);
    if (error === undefined) throw new InternalServerErrorException(INTERNAL_MESSAGE);
    if (error instanceof ForbiddenError) throw new ForbiddenException();
    throw error;
  }
}

/** The path without its query string. */
const pathOf = (url: string): string => url.split('?')[0] ?? url;

/** The REST answer of a domain error: its status, its stable code and the translated message. */
@Catch(DomainError)
export class ImportRestErrorFilter implements ExceptionFilter<DomainError> {
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

/** The filters of every catalog-import REST controller: domain refusals, then over-limit refusals (D2217). */
export const IMPORT_REST_FILTERS = [ImportRestErrorFilter, RateLimitedFilter] as const;
