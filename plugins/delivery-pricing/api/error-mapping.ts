import { DELIVERY_PRICING_ERROR_CODES, DomainError } from '@cod/shared';
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
import { DELIVERY_PRICING_LOG_CONTEXT as LOG_CONTEXT } from '../domain/constants';
import { DeliveryFeeGroupNotFoundError } from '../domain/errors';

const D = DELIVERY_PRICING_ERROR_CODES;
/** What a client reads for a fault of the server: never SQL, an entity name or a stack (D2136). */
export const INTERNAL_MESSAGE = 'The request could not be completed';
const INTERNAL_MESSAGE_KEY = 'error.delivery-pricing-internal';

/** The HTTP status of every code the fee-group API answers with. */
const STATUS_OF_CODE: ReadonlyMap<string, HttpStatus> = new Map([
  [D.NOT_FOUND, HttpStatus.NOT_FOUND],
  [D.CARRIER_NOT_FOUND, HttpStatus.NOT_FOUND],
  [D.INVALID_INPUT, HttpStatus.BAD_REQUEST],
  [D.GROUP_IN_USE, HttpStatus.CONFLICT],
]);

/** The `api/i18n` key of a code. i18next reads dots as nesting, so the dot becomes a dash. */
export const messageKeyOf = (code: string): string => `error.${code.replace('.', '-')}`;

/** The HTTP status of a domain error; a code this API does not answer with is a fault of the server (500). */
export function restStatusOf(error: DomainError): HttpStatus {
  return STATUS_OF_CODE.get(error.code) ?? HttpStatus.INTERNAL_SERVER_ERROR;
}

/** A refusal as GraphQL clients see it: `extensions.code` is the stable code, the message translated. */
export class DeliveryPricingApiError extends I18nError {
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
  Logger.error(`Delivery pricing fault: ${fault.name}`, LOG_CONTEXT, frames);
}

/**
 * The one translation of what a use case threw into what an API answers (D2136, §3a.8): a domain error stays itself,
 * a Vendure "entity not found" becomes the group's not found, a permission refusal stays itself, and anything else is
 * a fault of the server, logged here and returned as `undefined` (the caller answers generically).
 */
export function deliveryPricingErrorOf(error: unknown): DomainError | ForbiddenError | undefined {
  if (error instanceof DomainError) return error;
  if (error instanceof EntityNotFoundError) return new DeliveryFeeGroupNotFoundError();
  if (error instanceof ForbiddenError) return error;
  logFault(error);
  return undefined;
}

/** Runs a resolver body with the fee-group GraphQL error mapping. */
export async function withDeliveryPricingErrors<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (thrown: unknown) {
    const error = deliveryPricingErrorOf(thrown);
    if (error === undefined) throw new InternalServerError(INTERNAL_MESSAGE_KEY);
    if (!(error instanceof DomainError)) throw error;
    if (!STATUS_OF_CODE.has(error.code)) {
      Logger.error(`Domain error with no API mapping: ${error.code}`, LOG_CONTEXT);
      throw new InternalServerError(INTERNAL_MESSAGE_KEY);
    }
    throw new DeliveryPricingApiError(error);
  }
}

/**
 * Runs a REST handler body with the same mapping: a domain error reaches {@link DeliveryPricingRestErrorFilter}, a
 * Vendure permission refusal becomes 403, and a fault a bare 500.
 */
export async function restCall<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (thrown: unknown) {
    if (thrown instanceof HttpException) throw thrown;
    const error = deliveryPricingErrorOf(thrown);
    if (error === undefined) throw new InternalServerErrorException(INTERNAL_MESSAGE);
    if (error instanceof ForbiddenError) throw new ForbiddenException();
    throw error;
  }
}

/** The path without its query string. */
const pathOf = (url: string): string => url.split('?')[0] ?? url;

/** The REST answer of a domain error: its status, its stable code and the translated message. */
@Catch(DomainError)
export class DeliveryPricingRestErrorFilter implements ExceptionFilter<DomainError> {
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
