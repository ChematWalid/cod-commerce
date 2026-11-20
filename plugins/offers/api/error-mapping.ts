import { DomainError, PRICING_ERROR_CODES } from '@cod/shared';
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
  EntityNotFoundError,
  ForbiddenError,
  type I18nRequest,
  I18nError,
  InternalServerError,
  Logger,
  LogLevel,
  parseContext,
} from '@vendure/core';
import { OfferNotFoundError, OfferPublishInvalidError } from '../domain/errors';

const LOG_CONTEXT = 'OffersApi';
const C = PRICING_ERROR_CODES;
/** What a client reads for a fault of the server: never SQL, an entity name or a stack (D2520). */
export const INTERNAL_MESSAGE = 'The request could not be completed';
const INTERNAL_MESSAGE_KEY = 'error.offers-internal';

/**
 * The HTTP status of every pricing and offer code (D2520). The post-order add-on codes are answered by no endpoint of
 * P2.S5 (D2508) and are mapped so a later surface needs no second table.
 */
const STATUS_OF_CODE: ReadonlyMap<string, HttpStatus> = new Map([
  [C.INVALID_REQUEST, HttpStatus.BAD_REQUEST],
  [C.INVALID_CONFIG, HttpStatus.BAD_REQUEST],
  [C.UNKNOWN_KIND, HttpStatus.BAD_REQUEST],
  [C.INVALID_TARGETS, HttpStatus.BAD_REQUEST],
  [C.OFFER_NOT_FOUND, HttpStatus.NOT_FOUND],
  [C.ORDER_NOT_FOUND, HttpStatus.NOT_FOUND],
  [C.NO_ACTIVE_STORE, HttpStatus.CONFLICT],
  [C.CODE_TAKEN, HttpStatus.CONFLICT],
  [C.INVALID_TRANSITION, HttpStatus.CONFLICT],
  [C.OFFER_CONFLICT, HttpStatus.CONFLICT],
  [C.CODE_METHOD_REQUIRED, HttpStatus.CONFLICT],
  [C.OFFER_NOT_DELETABLE, HttpStatus.CONFLICT],
  [C.ORDER_ADDON_UNAVAILABLE, HttpStatus.CONFLICT],
  [C.ORDER_NOT_EDITABLE, HttpStatus.CONFLICT],
  [C.ADDON_NOT_OFFERED, HttpStatus.CONFLICT],
  [C.PUBLISH_INVALID, HttpStatus.UNPROCESSABLE_ENTITY],
  [C.TOTAL_TOO_LARGE, HttpStatus.UNPROCESSABLE_ENTITY],
]);

/** The `api/i18n` key of a code. i18next reads dots as nesting, so the dot becomes a dash. */
export const messageKeyOf = (code: string): string => `error.${code.replace('.', '-')}`;

/** The HTTP status of a domain error; a code this API does not answer with is a fault of the server (500). */
export function restStatusOf(error: DomainError): HttpStatus {
  return STATUS_OF_CODE.get(error.code) ?? HttpStatus.INTERNAL_SERVER_ERROR;
}

/** What a refusal adds beside its code: a publish refusal names its problems (D2510), codes only. */
function detailsOf(error: DomainError): Record<string, unknown> {
  return error instanceof OfferPublishInvalidError ? { problems: [...error.problems] } : {};
}

/** A refusal as GraphQL clients see it: `extensions.code` is the stable code, the message translated. */
export class OffersApiError extends I18nError {
  constructor(error: DomainError) {
    // Info: refusals of the caller's input, not faults of the server.
    super(messageKeyOf(error.code), {}, error.code, LogLevel.Info);
    Object.assign(this.extensions, detailsOf(error));
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
  Logger.error(`Offers fault: ${fault.name}`, LOG_CONTEXT, framesOf(fault.stack));
}

/**
 * The one translation of what a use case threw into what an API answers (D2520): a domain error stays itself, a
 * Vendure "entity not found" becomes the offer's not found, a permission refusal stays itself, and anything else is a
 * fault of the server, logged here and returned as `undefined` (the caller answers generically).
 */
export function offersErrorOf(error: unknown): DomainError | ForbiddenError | undefined {
  if (error instanceof DomainError) return error;
  if (error instanceof EntityNotFoundError) return new OfferNotFoundError();
  if (error instanceof ForbiddenError) return error;
  logFault(error);
  return undefined;
}

/** Runs a resolver body with the offers' GraphQL error mapping (§3a.8). */
export async function withOffersErrors<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (thrown: unknown) {
    const error = offersErrorOf(thrown);
    if (error === undefined) throw new InternalServerError(INTERNAL_MESSAGE_KEY);
    if (!(error instanceof DomainError)) throw error;
    if (!STATUS_OF_CODE.has(error.code)) Logger.error(`Domain error with no API mapping: ${error.code}`, LOG_CONTEXT);
    throw new OffersApiError(error);
  }
}

/**
 * Runs a REST handler body with the same mapping: a domain error reaches {@link OffersRestErrorFilter}, a Vendure
 * permission refusal becomes 403, and a fault becomes a bare 500 whose message is {@link INTERNAL_MESSAGE}. Vendure's
 * own errors are GraphQL errors, not Nest HTTP exceptions: left alone they would reach the client as a 500.
 */
export async function restCall<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (thrown: unknown) {
    if (thrown instanceof HttpException) throw thrown;
    const error = offersErrorOf(thrown);
    if (error === undefined) throw new InternalServerErrorException(INTERNAL_MESSAGE);
    if (error instanceof ForbiddenError) throw new ForbiddenException();
    throw error;
  }
}

/** The path without its query string, which may quote a filter value. */
const pathOf = (url: string): string => url.split('?')[0] ?? url;

/** The REST answer of a domain error: its status, its stable code, the translated message and its details. */
@Catch(DomainError)
export class OffersRestErrorFilter implements ExceptionFilter<DomainError> {
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
      ...(internal ? {} : detailsOf(error)),
      path: pathOf(req.url),
    });
  }
}

/** The filters of every offers REST controller. */
export const OFFERS_REST_FILTERS = [OffersRestErrorFilter] as const;
