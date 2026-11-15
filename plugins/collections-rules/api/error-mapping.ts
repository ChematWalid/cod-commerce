import { RateLimitedError, RateLimitedFilter } from '@cod/plugin-rate-limit';
import { COLLECTIONS_ERROR_CODES, DomainError } from '@cod/shared';
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
  ChannelNotFoundError,
  EntityNotFoundError,
  ForbiddenError,
  type I18nRequest,
  I18nError,
  InternalServerError,
  Logger,
  LogLevel,
  parseContext,
} from '@vendure/core';
import { CorruptCollectionDefinitionError } from '../domain/corrupt-collection-definition.error';
import { CollectionNotFoundError } from '../domain/errors';

const LOG_CONTEXT = 'CollectionsApi';
const C = COLLECTIONS_ERROR_CODES;
/** What a client reads for a fault of the server: never SQL, an entity name or a stack (D2136). */
export const INTERNAL_MESSAGE = 'The request could not be completed';
const INTERNAL_MESSAGE_KEY = 'error.collections-internal';

/** The HTTP status of every code the collections API answers with. */
const STATUS_OF_CODE: ReadonlyMap<string, HttpStatus> = new Map([
  [C.NOT_FOUND, HttpStatus.NOT_FOUND],
  [C.IMAGE_NOT_FOUND, HttpStatus.NOT_FOUND],
  [C.PRODUCT_NOT_FOUND, HttpStatus.NOT_FOUND],
  [C.INVALID_INPUT, HttpStatus.BAD_REQUEST],
  [C.RULE_INVALID, HttpStatus.BAD_REQUEST],
  [C.TOO_MANY_PRODUCTS, HttpStatus.BAD_REQUEST],
  [C.SLUG_TAKEN, HttpStatus.CONFLICT],
  [C.TOO_MANY_COLLECTIONS, HttpStatus.CONFLICT],
  [C.NOT_MANUAL, HttpStatus.CONFLICT],
  [C.RATE_LIMITED, HttpStatus.TOO_MANY_REQUESTS],
]);

/** The `api/i18n` key of a code. i18next reads dots as nesting, so the dot becomes a dash. */
export const messageKeyOf = (code: string): string => `error.${code.replace('.', '-')}`;

/** The HTTP status of a domain error; a code this API does not answer with is a fault of the server (500). */
export function restStatusOf(error: DomainError): HttpStatus {
  return STATUS_OF_CODE.get(error.code) ?? HttpStatus.INTERNAL_SERVER_ERROR;
}

/** A refusal as GraphQL clients see it: `extensions.code` is the stable code, the message translated. */
export class CollectionsApiError extends I18nError {
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

/**
 * Logs a fault with its type and stack frames only: a database message may quote the caller's data. A corrupt stored
 * definition also logs its ids, never its rule content, so the row can be found.
 */
function logFault(error: unknown): void {
  const fault = error instanceof Error ? error : new Error(`Non-error thrown: ${typeof error}`);
  const ids =
    fault instanceof CorruptCollectionDefinitionError
      ? ` (business ${fault.businessId}, definition ${fault.definitionId})`
      : '';
  Logger.error(`Collections fault: ${fault.name}${ids}`, LOG_CONTEXT, framesOf(fault.stack));
}

/**
 * The one translation of what a use case threw into what an API answers (§3a.8): a domain error stays itself, a
 * Vendure "entity not found" becomes the collection's not found, a permission or rate-limit refusal stays itself, and
 * anything else is a fault of the server, logged here and returned as `undefined` (the caller answers generically).
 */
export function collectionsErrorOf(error: unknown): DomainError | ForbiddenError | RateLimitedError | undefined {
  if (error instanceof DomainError) return error;
  if (error instanceof EntityNotFoundError) return new CollectionNotFoundError();
  if (error instanceof ForbiddenError || error instanceof RateLimitedError) return error;
  logFault(error);
  return undefined;
}

/** Runs a resolver body with the collections' GraphQL error mapping. */
export async function withCollectionsErrors<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (thrown: unknown) {
    const error = collectionsErrorOf(thrown);
    if (error === undefined) throw new InternalServerError(INTERNAL_MESSAGE_KEY);
    if (!(error instanceof DomainError)) throw error;
    if (!STATUS_OF_CODE.has(error.code)) Logger.error(`Domain error with no API mapping: ${error.code}`, LOG_CONTEXT);
    throw new CollectionsApiError(error);
  }
}

/**
 * Runs a REST handler body with the same mapping: a domain error reaches {@link CollectionsRestErrorFilter}, an
 * over-limit refusal reaches {@link RateLimitedFilter} (429), a Vendure permission refusal becomes 403, and a fault
 * becomes a bare 500 whose message is {@link INTERNAL_MESSAGE}.
 */
export async function restCall<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (thrown: unknown) {
    if (thrown instanceof HttpException) throw thrown;
    const error = collectionsErrorOf(thrown);
    if (error === undefined) throw new InternalServerErrorException(INTERNAL_MESSAGE);
    if (error instanceof ForbiddenError) throw new ForbiddenException();
    throw error;
  }
}

/** The path without its query string, which may quote a search text. */
const pathOf = (url: string): string => url.split('?')[0] ?? url;

/** The REST answer of a domain error: its status, its stable code and the translated message. */
@Catch(DomainError)
export class CollectionsRestErrorFilter implements ExceptionFilter<DomainError> {
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

/** What the GraphQL API answers for an unknown channel token; REST gives the same code. */
const CHANNEL_NOT_FOUND_CODE = 'CHANNEL_NOT_FOUND';

/**
 * The REST answer of an unknown channel token. Vendure refuses it while building the request context, before the
 * handler, so {@link restCall} never sees it and Nest would answer a bare 500.
 */
@Catch(ChannelNotFoundError)
export class ChannelNotFoundRestFilter implements ExceptionFilter<ChannelNotFoundError> {
  catch(_error: ChannelNotFoundError, host: ArgumentsHost): void {
    const { req, res } = parseContext(host);
    const messageKey = messageKeyOf('collections.channel-not-found');
    res.status(HttpStatus.NOT_FOUND).json({
      statusCode: HttpStatus.NOT_FOUND,
      code: CHANNEL_NOT_FOUND_CODE,
      message: (req as Partial<I18nRequest>).t?.(messageKey) ?? CHANNEL_NOT_FOUND_CODE,
      path: pathOf(req.url),
    });
  }
}

/** The filters of every collections REST controller: domain, over-limit and unknown-channel refusals. */
export const COLLECTIONS_REST_FILTERS = [
  CollectionsRestErrorFilter,
  RateLimitedFilter,
  ChannelNotFoundRestFilter,
] as const;
